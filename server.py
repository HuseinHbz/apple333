"""Local Phase 3 inventory API. Run with: python server.py"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "applekhane.db"
PORT = int(os.getenv("PORT", "8080"))
IMEI_SALT = os.getenv("IMEI_LOOKUP_SALT", "change-this-before-production")

ROLE_PERMISSIONS = {
    "admin": {"*"},
    "manager": {"inventory.read", "device.read", "transfer.create", "transfer.approve", "transfer.dispatch", "transfer.receive", "reservation.create", "reservation.cancel", "receiving.execute", "report.read", "order.read", "order.manage", "checkout.create", "wallet.read"},
    "warehouse": {"inventory.read", "device.read", "transfer.create", "transfer.dispatch", "transfer.receive", "reservation.create", "reservation.cancel", "receiving.execute", "order.read"},
    "sales": {"inventory.read", "device.read", "reservation.create", "reservation.cancel", "checkout.create", "order.read", "wallet.read"},
}

CATALOG = {
    "iphone-16-pro-256-black": ("iPhone 16 Pro 256GB Black Titanium", 1549000000),
    "iphone-16-pro-max-256-black": ("iPhone 16 Pro Max 256GB Black", 1699000000),
    "airpods-pro-2": ("AirPods Pro 2", 329000000),
    "iphone-16-256-blue": ("iPhone 16 256GB Ultramarine", 1199000000),
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def imei_hash(value: str) -> str:
    return hashlib.sha256(f"{IMEI_SALT}:{value.strip()}".encode()).hexdigest()


def mask(value: str | None) -> str | None:
    if not value:
        return None
    return "•" * max(0, len(value) - 4) + value[-4:]


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA journal_mode = WAL")
    return db


def init_db() -> None:
    DB_PATH.parent.mkdir(exist_ok=True)
    db = connect()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS warehouses (id TEXT PRIMARY KEY, branch_id TEXT REFERENCES branches(id), code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS inventory_balances (warehouse_id TEXT NOT NULL REFERENCES warehouses(id), variant_id TEXT NOT NULL, on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand >= 0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= on_hand), version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, PRIMARY KEY(warehouse_id, variant_id));
        CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, variant_id TEXT NOT NULL, display_name TEXT NOT NULL, warehouse_id TEXT REFERENCES warehouses(id), status TEXT NOT NULL CHECK(status IN ('received','available','reserved','in_transit','sold','returned','repair','damaged','lost')), imei_1 TEXT, imei_1_hash TEXT UNIQUE, imei_2 TEXT, serial_number TEXT, serial_hash TEXT UNIQUE, model_number TEXT, region TEXT, sim_type TEXT, purchase_date TEXT, warranty_status TEXT, cost_amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS transfer_orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, source_warehouse_id TEXT NOT NULL REFERENCES warehouses(id), destination_warehouse_id TEXT NOT NULL REFERENCES warehouses(id), status TEXT NOT NULL CHECK(status IN ('draft','requested','approved','dispatched','received','rejected','cancelled')), reason TEXT NOT NULL, requested_by TEXT NOT NULL, approved_by TEXT, dispatched_by TEXT, received_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(source_warehouse_id <> destination_warehouse_id));
        CREATE TABLE IF NOT EXISTS transfer_items (id TEXT PRIMARY KEY, transfer_id TEXT NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE, device_id TEXT NOT NULL REFERENCES devices(id), UNIQUE(transfer_id, device_id));
        CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id), warehouse_id TEXT NOT NULL REFERENCES warehouses(id), customer_reference TEXT, priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('active','confirmed','fulfilled','expired','cancelled')), expires_at TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, device_id TEXT REFERENCES devices(id), variant_id TEXT NOT NULL, from_warehouse_id TEXT REFERENCES warehouses(id), to_warehouse_id TEXT REFERENCES warehouses(id), movement_type TEXT NOT NULL, reference_id TEXT, actor_id TEXT NOT NULL, occurred_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_value TEXT, after_value TEXT, branch_id TEXT, request_id TEXT NOT NULL, occurred_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, label TEXT, recipient_name TEXT NOT NULL, phone TEXT NOT NULL, province TEXT, city TEXT, address_line TEXT NOT NULL, postal_code TEXT, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS carts (id TEXT PRIMARY KEY, customer_id TEXT, guest_token_hash TEXT, currency TEXT NOT NULL DEFAULT 'IRR', expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(customer_id IS NOT NULL OR guest_token_hash IS NOT NULL));
        CREATE TABLE IF NOT EXISTS cart_items (id TEXT PRIMARY KEY, cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE, variant_id TEXT NOT NULL, title TEXT NOT NULL, warranty TEXT, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price INTEGER NOT NULL CHECK(unit_price >= 0), installment_plan TEXT, created_at TEXT NOT NULL, UNIQUE(cart_id,variant_id,warranty));
        CREATE TABLE IF NOT EXISTS coupon_rules (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('percent','fixed')), value INTEGER NOT NULL CHECK(value >= 0), minimum_amount INTEGER NOT NULL DEFAULT 0, maximum_discount INTEGER, starts_at TEXT, ends_at TEXT, customer_group TEXT, branch_id TEXT REFERENCES branches(id), active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS coupon_redemptions (id TEXT PRIMARY KEY, coupon_id TEXT NOT NULL REFERENCES coupon_rules(id), customer_id TEXT, order_id TEXT, amount INTEGER NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS gift_cards (id TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, initial_amount INTEGER NOT NULL, remaining_amount INTEGER NOT NULL CHECK(remaining_amount >= 0), expires_at TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS wallets (customer_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0), updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS wallet_transactions (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('credit','debit','refund')), reference_id TEXT, balance_after INTEGER NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, order_number TEXT UNIQUE NOT NULL, customer_id TEXT, guest_token_hash TEXT, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','processing','packed','shipping','delivered','completed','canceled','returned','refunded')), payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','success','failed','refunded','canceled')), fulfillment_method TEXT NOT NULL CHECK(fulfillment_method IN ('pickup','post','tipax','snapbox','express','scheduled')), branch_id TEXT REFERENCES branches(id), address_id TEXT REFERENCES addresses(id), subtotal INTEGER NOT NULL, discount_amount INTEGER NOT NULL DEFAULT 0, shipping_amount INTEGER NOT NULL DEFAULT 0, insurance_amount INTEGER NOT NULL DEFAULT 0, tax_amount INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'IRR', lock_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, variant_id TEXT NOT NULL, title_snapshot TEXT NOT NULL, warranty_snapshot TEXT, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price INTEGER NOT NULL, discount_amount INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL, device_id TEXT REFERENCES devices(id));
        CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, method TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0), status TEXT NOT NULL CHECK(status IN ('pending','success','failed','refunded','canceled')), authority TEXT UNIQUE, provider_reference TEXT, idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payment_logs (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, invoice_number TEXT UNIQUE NOT NULL, order_id TEXT UNIQUE NOT NULL REFERENCES orders(id), issued_at TEXT NOT NULL, snapshot TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, tracking_code TEXT, status TEXT NOT NULL, estimated_at TEXT, shipping_amount INTEGER NOT NULL, insurance_amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS order_status_history (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), status TEXT NOT NULL, actor_id TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS devices_imei_hash_idx ON devices(imei_1_hash);
        CREATE INDEX IF NOT EXISTS devices_serial_hash_idx ON devices(serial_hash);
        CREATE INDEX IF NOT EXISTS devices_location_status_idx ON devices(warehouse_id, status);
        CREATE INDEX IF NOT EXISTS reservations_expiry_idx ON reservations(status, expires_at);
        CREATE INDEX IF NOT EXISTS movements_device_time_idx ON stock_movements(device_id, occurred_at DESC);
        CREATE INDEX IF NOT EXISTS transfers_status_idx ON transfer_orders(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders(customer_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS payments_order_status_idx ON payments(order_id, status);
        CREATE INDEX IF NOT EXISTS carts_customer_idx ON carts(customer_id, expires_at);
        CREATE INDEX IF NOT EXISTS shipments_tracking_idx ON shipments(tracking_code);
        """
    )
    if db.execute("SELECT COUNT(*) FROM branches").fetchone()[0] == 0:
        branches = [("b-vanak", "VNK", "شعبه ونک"), ("b-pasdaran", "PSD", "شعبه پاسداران"), ("b-koorosh", "KRS", "شعبه کوروش"), ("b-tehran", "THR", "شعبه تهران")]
        db.executemany("INSERT INTO branches(id,code,name) VALUES(?,?,?)", branches)
        warehouses = [("wh-central", None, "CENTRAL", "انبار مرکزی", "central"), ("wh-vanak", "b-vanak", "VNK-STOCK", "انبار شعبه ونک", "branch"), ("wh-pasdaran", "b-pasdaran", "PSD-STOCK", "انبار شعبه پاسداران", "branch"), ("wh-koorosh", "b-koorosh", "KRS-STOCK", "انبار شعبه کوروش", "branch"), ("wh-tehran", "b-tehran", "THR-STOCK", "انبار شعبه تهران", "branch")]
        db.executemany("INSERT INTO warehouses(id,branch_id,code,name,kind) VALUES(?,?,?,?,?)", warehouses)
        seed_device(db, "wh-central", "iphone-16-pro-256-black", "iPhone 16 Pro 256GB Black Titanium", "356938035643809", "C02XK0A2JGH5")
        seed_device(db, "wh-central", "iphone-16-pro-max-256-black", "iPhone 16 Pro Max 256GB Black", "356938035643817", "C02XK0A2JGH6")
        seed_device(db, "wh-vanak", "iphone-16-pro-256-black", "iPhone 16 Pro 256GB Black Titanium", "356938035643825", "C02XK0A2JGH7")
        seed_device(db, "wh-pasdaran", "airpods-pro-2", "AirPods Pro 2", "356938035643833", "C02XK0A2JGH8")
    db.execute("INSERT OR IGNORE INTO coupon_rules(id,code,kind,value,minimum_amount,maximum_discount,active) VALUES('coupon-welcome','WELCOME10','percent',10,10000000,20000000,1)")
    db.close()


def seed_device(db: sqlite3.Connection, warehouse_id: str, variant_id: str, name: str, imei: str, serial: str) -> None:
    add_device(db, warehouse_id, variant_id, name, imei, serial, "system", 0)


def balance(db: sqlite3.Connection, warehouse_id: str, variant_id: str, on_hand_delta: int = 0, reserved_delta: int = 0) -> None:
    row = db.execute("SELECT on_hand,reserved,version FROM inventory_balances WHERE warehouse_id=? AND variant_id=?", (warehouse_id, variant_id)).fetchone()
    if row:
        on_hand, reserved = row["on_hand"] + on_hand_delta, row["reserved"] + reserved_delta
    else:
        on_hand, reserved = on_hand_delta, reserved_delta
    if on_hand < 0 or reserved < 0 or reserved > on_hand:
        raise ValueError("موجودی یا رزرو نامعتبر است")
    if row:
        db.execute("UPDATE inventory_balances SET on_hand=?,reserved=?,version=?,updated_at=? WHERE warehouse_id=? AND variant_id=?", (on_hand, reserved, row["version"] + 1, now(), warehouse_id, variant_id))
    else:
        db.execute("INSERT INTO inventory_balances(warehouse_id,variant_id,on_hand,reserved,version,updated_at) VALUES(?,?,?,?,1,?)", (warehouse_id, variant_id, on_hand, reserved, now()))


def add_device(db: sqlite3.Connection, warehouse_id: str, variant_id: str, name: str, imei: str, serial: str, actor: str, cost: int) -> str:
    device_id = str(uuid.uuid4())
    db.execute("INSERT INTO devices(id,variant_id,display_name,warehouse_id,status,imei_1,imei_1_hash,serial_number,serial_hash,purchase_date,warranty_status,cost_amount,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (device_id, variant_id, name, warehouse_id, "available", imei, imei_hash(imei), serial, imei_hash(serial), now()[:10], "unknown", cost, now(), now()))
    balance(db, warehouse_id, variant_id, on_hand_delta=1)
    movement(db, device_id, variant_id, None, warehouse_id, "receive", device_id, actor)
    audit(db, actor, "device.received", "device", device_id, None, {"warehouseId": warehouse_id, "status": "available"})
    return device_id


def movement(db: sqlite3.Connection, device_id: str, variant_id: str, source: str | None, destination: str | None, kind: str, reference: str, actor: str) -> None:
    db.execute("INSERT INTO stock_movements(id,device_id,variant_id,from_warehouse_id,to_warehouse_id,movement_type,reference_id,actor_id,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), device_id, variant_id, source, destination, kind, reference, actor, now()))


def audit(db: sqlite3.Connection, actor: str, action: str, entity_type: str, entity_id: str, before: dict | None, after: dict | None, branch: str | None = None) -> None:
    db.execute("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value,branch_id,request_id,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), actor, action, entity_type, entity_id, json.dumps(before) if before else None, json.dumps(after) if after else None, branch, str(uuid.uuid4()), now()))


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str): self.status, self.code, self.message = status, code, message


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        return str(ROOT / path.lstrip("/"))

    def log_message(self, fmt: str, *args) -> None:  # avoid leaking request data
        print(f"[{now()}] {self.address_string()} {fmt % args}")

    def json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        try: return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError: raise APIError(400, "invalid_json", "بدنهٔ JSON معتبر نیست")

    def actor(self) -> dict:
        role = self.headers.get("X-Role", "admin").lower()
        return {"id": self.headers.get("X-User-ID", "demo-admin"), "role": role, "branch": self.headers.get("X-Branch-ID")}

    def allow(self, permission: str, branch_id: str | None = None) -> dict:
        actor = self.actor(); perms = ROLE_PERMISSIONS.get(actor["role"], set())
        if "*" not in perms and permission not in perms: raise APIError(403, "forbidden", "مجوز لازم برای این عملیات وجود ندارد")
        if actor["role"] in {"sales", "warehouse"} and actor["branch"] and branch_id and actor["branch"] != branch_id: raise APIError(403, "branch_scope", "دسترسی به شعبهٔ دیگر مجاز نیست")
        return actor

    def respond(self, status: int, payload: object) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)

    def handle_api(self, method: str) -> None:
        try:
            parsed = urlparse(self.path); path = parsed.path; query = parse_qs(parsed.query); db = connect()
            if method == "GET" and path == "/api/v1/inventory":
                actor = self.allow("inventory.read", query.get("branchId", [None])[0]); rows = db.execute("SELECT w.id warehouse_id,w.name warehouse,ib.variant_id,ib.on_hand,ib.reserved,ib.on_hand-ib.reserved available FROM inventory_balances ib JOIN warehouses w ON w.id=ib.warehouse_id ORDER BY w.name,ib.variant_id").fetchall(); self.respond(200, {"data": [dict(r) for r in rows], "actor": actor})
            elif method == "GET" and path.startswith("/api/v1/inventory/branches/"):
                branch_id = path.rsplit("/", 1)[1]; self.allow("inventory.read", branch_id); rows = db.execute("SELECT b.name,COALESCE(SUM(ib.on_hand),0) on_hand,COALESCE(SUM(ib.reserved),0) reserved FROM branches b LEFT JOIN warehouses w ON w.branch_id=b.id LEFT JOIN inventory_balances ib ON ib.warehouse_id=w.id WHERE b.id=? GROUP BY b.id", (branch_id,)).fetchone(); self.respond(200, dict(rows) if rows else {})
            elif method == "GET" and path.startswith("/api/v1/devices/"):
                actor = self.allow("device.read"); lookup = unquote(path.rsplit("/", 1)[1]); hashed = imei_hash(lookup); row = db.execute("SELECT d.*,w.name warehouse FROM devices d LEFT JOIN warehouses w ON w.id=d.warehouse_id WHERE d.imei_1_hash=? OR d.serial_hash=?", (hashed, hashed)).fetchone()
                if not row: raise APIError(404, "not_found", "دستگاهی با این شناسه یافت نشد")
                data = dict(row); sensitive = actor["role"] in {"admin", "manager", "warehouse"}
                data["imei_1"] = data["imei_1"] if sensitive else mask(data["imei_1"]); data["serial_number"] = data["serial_number"] if sensitive else mask(data["serial_number"]); data.pop("imei_1_hash"); data.pop("serial_hash"); audit(db, actor["id"], "device.lookup", "device", data["id"], None, {"sensitive": sensitive}); self.respond(200, data)
            elif method == "GET" and path == "/api/v1/inventory/reports":
                self.allow("report.read"); totals = db.execute("SELECT COALESCE(SUM(on_hand),0) on_hand,COALESCE(SUM(reserved),0) reserved,COUNT(DISTINCT variant_id) variants FROM inventory_balances").fetchone(); branches = db.execute("SELECT w.name,COALESCE(SUM(ib.on_hand),0) on_hand,COALESCE(SUM(ib.reserved),0) reserved FROM warehouses w LEFT JOIN inventory_balances ib ON ib.warehouse_id=w.id GROUP BY w.id ORDER BY on_hand DESC").fetchall(); low = db.execute("SELECT warehouse_id,variant_id,on_hand-reserved available FROM inventory_balances WHERE on_hand-reserved <= 1").fetchall(); self.respond(200, {"totals": dict(totals), "branches": [dict(r) for r in branches], "lowStock": [dict(r) for r in low]})
            elif method == "POST" and path == "/api/v1/receiving-orders":
                actor = self.allow("receiving.execute"); body = self.json_body(); wh = body.get("warehouseId"); devices = body.get("devices", []); assert_location(db, wh)
                if not isinstance(devices, list) or not devices: raise APIError(400, "devices_required", "حداقل یک دستگاه برای دریافت لازم است")
                db.execute("BEGIN IMMEDIATE")
                for item in devices: add_device(db, wh, required(item, "variantId"), required(item, "displayName"), required(item, "imei"), required(item, "serial"), actor["id"], int(item.get("costAmount", 0)))
                db.commit(); self.respond(201, {"received": len(devices)})
            elif method == "POST" and path == "/api/v1/transfers":
                actor = self.allow("transfer.create"); body = self.json_body(); source, dest, ids = required(body,"sourceWarehouseId"), required(body,"destinationWarehouseId"), body.get("deviceIds", [])
                if source == dest: raise APIError(400, "same_location", "مبدأ و مقصد انتقال نباید یکسان باشند")
                assert_location(db, source); assert_location(db, dest)
                if not ids: raise APIError(400, "devices_required", "برای انتقال دستگاه انتخاب کنید")
                db.execute("BEGIN IMMEDIATE"); number=f"TRF-{datetime.now().strftime('%y%m%d%H%M%S')}"; tid=str(uuid.uuid4())
                db.execute("INSERT INTO transfer_orders(id,number,source_warehouse_id,destination_warehouse_id,status,reason,requested_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", (tid,number,source,dest,"requested",body.get("reason","restock"),actor["id"],now(),now()))
                for did in ids:
                    row=db.execute("SELECT * FROM devices WHERE id=?",(did,)).fetchone()
                    if not row or row["warehouse_id"] != source or row["status"] != "available": raise APIError(409,"device_unavailable","دستگاه انتخاب‌شده در مبدأ قابل انتقال نیست")
                    db.execute("INSERT INTO transfer_items(id,transfer_id,device_id) VALUES(?,?,?)",(str(uuid.uuid4()),tid,did))
                audit(db,actor["id"],"transfer.created","transfer",tid,None,{"status":"requested","devices":ids}); db.commit(); self.respond(201,{"id":tid,"number":number,"status":"requested"})
            elif method == "PATCH" and path.startswith("/api/v1/transfers/") and path.endswith("/status"):
                tid=path.split("/")[4]; body=self.json_body(); desired=required(body,"status"); db.execute("BEGIN IMMEDIATE"); order=db.execute("SELECT * FROM transfer_orders WHERE id=?",(tid,)).fetchone()
                if not order: raise APIError(404,"not_found","انتقال یافت نشد")
                permission={"approved":"transfer.approve","dispatched":"transfer.dispatch","received":"transfer.receive"}.get(desired)
                if not permission: raise APIError(400,"invalid_transition","وضعیت درخواستی مجاز نیست")
                actor=self.allow(permission); expected={"approved":"requested","dispatched":"approved","received":"dispatched"}[desired]
                if order["status"] != expected: raise APIError(409,"invalid_transition","وضعیت فعلی با انتقال درخواستی سازگار نیست")
                items=db.execute("SELECT d.* FROM transfer_items ti JOIN devices d ON d.id=ti.device_id WHERE ti.transfer_id=?",(tid,)).fetchall()
                if desired == "dispatched":
                    for d in items:
                        if d["status"] != "available": raise APIError(409,"device_unavailable","یکی از دستگاه‌ها دیگر قابل ارسال نیست")
                        db.execute("UPDATE devices SET status='in_transit',updated_at=? WHERE id=?",(now(),d["id"])); balance(db,order["source_warehouse_id"],d["variant_id"],on_hand_delta=-1); movement(db,d["id"],d["variant_id"],order["source_warehouse_id"],None,"transfer_dispatch",tid,actor["id"])
                if desired == "received":
                    for d in items:
                        db.execute("UPDATE devices SET status='available',warehouse_id=?,updated_at=? WHERE id=?",(order["destination_warehouse_id"],now(),d["id"])); balance(db,order["destination_warehouse_id"],d["variant_id"],on_hand_delta=1); movement(db,d["id"],d["variant_id"],None,order["destination_warehouse_id"],"transfer_receive",tid,actor["id"])
                field={"approved":"approved_by","dispatched":"dispatched_by","received":"received_by"}[desired]; db.execute(f"UPDATE transfer_orders SET status=?,{field}=?,updated_at=? WHERE id=?",(desired,actor["id"],now(),tid)); audit(db,actor["id"],f"transfer.{desired}","transfer",tid,{"status":order["status"]},{"status":desired}); db.commit(); self.respond(200,{"id":tid,"status":desired})
            elif method == "POST" and path == "/api/v1/reservations":
                actor=self.allow("reservation.create"); body=self.json_body(); did=required(body,"deviceId"); minutes=min(max(int(body.get("minutes",30)),1),240); db.execute("BEGIN IMMEDIATE"); d=db.execute("SELECT * FROM devices WHERE id=?",(did,)).fetchone()
                if not d or d["status"] != "available": raise APIError(409,"device_unavailable","دستگاه قابل رزرو نیست")
                rid=str(uuid.uuid4()); expiry=(datetime.now(timezone.utc)+timedelta(minutes=minutes)).isoformat(); db.execute("UPDATE devices SET status='reserved',updated_at=? WHERE id=?",(now(),did)); balance(db,d["warehouse_id"],d["variant_id"],reserved_delta=1); db.execute("INSERT INTO reservations(id,device_id,warehouse_id,customer_reference,priority,status,expires_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'active',?,?,?,?)",(rid,did,d["warehouse_id"],body.get("customerReference"),int(body.get("priority",0)),expiry,actor["id"],now(),now())); movement(db,did,d["variant_id"],d["warehouse_id"],d["warehouse_id"],"reserve",rid,actor["id"]); audit(db,actor["id"],"reservation.created","reservation",rid,None,{"deviceId":did,"expiresAt":expiry}); db.commit(); self.respond(201,{"id":rid,"expiresAt":expiry})
            elif method == "DELETE" and path.startswith("/api/v1/reservations/"):
                rid=path.rsplit("/",1)[1]; actor=self.allow("reservation.cancel"); db.execute("BEGIN IMMEDIATE"); r=db.execute("SELECT r.*,d.variant_id FROM reservations r JOIN devices d ON d.id=r.device_id WHERE r.id=?",(rid,)).fetchone()
                if not r or r["status"] != "active": raise APIError(404,"not_found","رزرو فعال یافت نشد")
                db.execute("UPDATE reservations SET status='cancelled',updated_at=? WHERE id=?",(now(),rid)); db.execute("UPDATE devices SET status='available',updated_at=? WHERE id=?",(now(),r["device_id"])); balance(db,r["warehouse_id"],r["variant_id"],reserved_delta=-1); movement(db,r["device_id"],r["variant_id"],r["warehouse_id"],r["warehouse_id"],"release",rid,actor["id"]); audit(db,actor["id"],"reservation.cancelled","reservation",rid,{"status":"active"},{"status":"cancelled"}); db.commit(); self.respond(204,{})
            elif method == "GET" and path == "/api/v1/orders":
                actor = self.allow("order.read"); sql = "SELECT id,order_number,status,payment_status,fulfillment_method,total_amount,branch_id,created_at FROM orders"; params = []
                if actor["role"] in {"sales", "warehouse"} and actor["branch"]: sql += " WHERE branch_id=?"; params.append(actor["branch"])
                rows = db.execute(sql + " ORDER BY created_at DESC LIMIT 100", params).fetchall(); self.respond(200, {"data": [dict(row) for row in rows]})
            elif method == "GET" and path.startswith("/api/v1/orders/"):
                order_id = path.rsplit("/", 1)[1]; actor = self.allow("order.read"); data = order_detail(db, order_id)
                if actor["role"] in {"sales", "warehouse"} and actor["branch"] and data["branch_id"] != actor["branch"]: raise APIError(403, "branch_scope", "دسترسی به سفارش شعبهٔ دیگر مجاز نیست")
                self.respond(200, data)
            elif method == "GET" and path.startswith("/api/v1/invoices/"):
                invoice_id = path.rsplit("/", 1)[1]; self.allow("order.read"); row = db.execute("SELECT * FROM invoices WHERE id=? OR order_id=?", (invoice_id, invoice_id)).fetchone()
                if not row: raise APIError(404, "not_found", "فاکتور یافت نشد")
                self.respond(200, {**dict(row), "snapshot": json.loads(row["snapshot"])})
            elif method == "GET" and path.startswith("/api/v1/tracking/"):
                order_id = path.rsplit("/", 1)[1]; self.allow("order.read"); data = order_detail(db, order_id); self.respond(200, {"orderNumber": data["order_number"], "status": data["status"], "paymentStatus": data["payment_status"], "shipment": data["shipment"], "timeline": data["history"]})
            elif method == "GET" and path == "/api/v1/wallet":
                actor = self.allow("wallet.read"); row = db.execute("SELECT balance FROM wallets WHERE customer_id=?", (actor["id"],)).fetchone(); self.respond(200, {"customerId": actor["id"], "balance": row["balance"] if row else 0})
            elif method == "POST" and path == "/api/v1/coupons/validate":
                body = self.json_body(); discount, coupon_id = coupon_discount(db, body.get("code"), int(body.get("subtotal", 0)), body.get("customerId"), body.get("branchId")); self.respond(200, {"valid": True, "couponId": coupon_id, "discountAmount": discount})
            elif method == "POST" and path == "/api/v1/carts":
                body = self.json_body(); customer_id, guest = body.get("customerId"), body.get("guestToken")
                if not customer_id and not guest: raise APIError(400, "cart_owner", "customerId یا guestToken لازم است")
                cid = str(uuid.uuid4()); db.execute("INSERT INTO carts(id,customer_id,guest_token_hash,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)", (cid, customer_id, imei_hash(guest) if guest else None, (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(), now(), now())); self.respond(201, {"id": cid, "expiresAt": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()})
            elif method == "POST" and path.startswith("/api/v1/carts/") and path.endswith("/items"):
                cart_id = path.split("/")[4]; body = self.json_body(); cart = db.execute("SELECT id FROM carts WHERE id=? AND expires_at>?", (cart_id, now())).fetchone()
                if not cart: raise APIError(404, "cart_not_found", "سبد معتبر نیست")
                price = catalog_price(required(body, "variantId")); db.execute("INSERT INTO cart_items(id,cart_id,variant_id,title,warranty,quantity,unit_price,installment_plan,created_at) VALUES(?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()),cart_id,body["variantId"],catalog_title(body["variantId"]),body.get("warranty"),int(body.get("quantity",1)),price,body.get("installmentPlan"),now())); self.respond(201, {"cartId":cart_id})
            elif method == "POST" and path == "/api/v1/checkout":
                actor = self.allow("checkout.create"); body = self.json_body(); items = body.get("items", []); method = required(body, "fulfillmentMethod"); customer = body.get("customerId") or actor["id"]; branch_id = body.get("branchId")
                if not items: raise APIError(400, "items_required", "سبد خرید خالی است")
                if method == "pickup" and not branch_id: raise APIError(400, "pickup_branch", "برای تحویل شعبه، شعبه را انتخاب کنید")
                subtotal = sum(catalog_price(required(item, "variantId")) * int(item.get("quantity", 1)) for item in items)
                shipping, insurance, provider = shipping_quote(method, subtotal); discount, coupon_id = coupon_discount(db, body.get("couponCode"), subtotal, customer, branch_id)
                wallet_requested = max(0, int(body.get("walletAmount", 0))); db.execute("BEGIN IMMEDIATE"); wallet = db.execute("SELECT balance FROM wallets WHERE customer_id=?", (customer,)).fetchone(); wallet_used = min(wallet_requested, wallet["balance"] if wallet else 0)
                total = subtotal - discount + shipping + insurance; order_id = str(uuid.uuid4()); order_number = make_order_number(); created = now()
                db.execute("INSERT INTO orders(id,order_number,customer_id,status,payment_status,fulfillment_method,branch_id,address_id,subtotal,discount_amount,shipping_amount,insurance_amount,total_amount,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (order_id,order_number,customer,"pending","pending",method,branch_id,body.get("addressId"),subtotal,discount,shipping,insurance,total,created,created))
                destination = db.execute("SELECT id FROM warehouses WHERE branch_id=? AND active=1 LIMIT 1", (branch_id,)).fetchone() if method == "pickup" else db.execute("SELECT id FROM warehouses WHERE kind='central' AND active=1 LIMIT 1").fetchone()
                for item in items:
                    variant = item["variantId"]; quantity = int(item.get("quantity", 1)); price = catalog_price(variant)
                    if quantity < 1: raise APIError(400, "quantity", "تعداد باید بیشتر از صفر باشد")
                    for _ in range(quantity):
                        device = db.execute("SELECT * FROM devices WHERE variant_id=? AND warehouse_id=? AND status='available' LIMIT 1", (variant, destination["id"])).fetchone()
                        if not device: raise APIError(409, "out_of_stock", f"موجودی {catalog_title(variant)} کافی نیست")
                        db.execute("UPDATE devices SET status='reserved',updated_at=? WHERE id=?", (now(),device["id"])); balance(db,destination["id"],variant,reserved_delta=1)
                        reservation_id = str(uuid.uuid4()); expiry=(datetime.now(timezone.utc)+timedelta(minutes=20)).isoformat(); db.execute("INSERT INTO reservations(id,device_id,warehouse_id,customer_reference,priority,status,expires_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'active',?,?,?,?)", (reservation_id,device["id"],destination["id"],customer,0,expiry,actor["id"],now(),now())); movement(db,device["id"],variant,destination["id"],destination["id"],"reserve",order_id,actor["id"])
                        db.execute("INSERT INTO order_items(id,order_id,variant_id,title_snapshot,warranty_snapshot,quantity,unit_price,total_amount,device_id) VALUES(?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()),order_id,variant,catalog_title(variant),item.get("warranty"),1,price,price,device["id"]))
                if coupon_id: db.execute("INSERT INTO coupon_redemptions(id,coupon_id,customer_id,order_id,amount,created_at) VALUES(?,?,?,?,?,?)", (str(uuid.uuid4()),coupon_id,customer,order_id,discount,now()))
                if wallet_used: wallet_after=(wallet["balance"]-wallet_used); db.execute("UPDATE wallets SET balance=?,updated_at=? WHERE customer_id=?", (wallet_after,now(),customer)); db.execute("INSERT INTO wallet_transactions(id,customer_id,amount,kind,reference_id,balance_after,created_at) VALUES(?,?,?,?,?,?,?)", (str(uuid.uuid4()),customer,-wallet_used,"debit",order_id,wallet_after,now()))
                remaining = total - wallet_used; payment_id = str(uuid.uuid4()); payment_status = "success" if remaining == 0 else "pending"; provider_name = "wallet" if remaining == 0 else body.get("paymentProvider", "mock")
                db.execute("INSERT INTO payments(id,order_id,provider,method,amount,status,authority,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (payment_id,order_id,provider_name,body.get("paymentMethod","online"),remaining,payment_status,uuid.uuid4().hex,body.get("idempotencyKey"),now(),now()))
                final_status = "confirmed" if remaining == 0 else "pending"; db.execute("UPDATE orders SET status=?,payment_status=?,updated_at=? WHERE id=?", (final_status,payment_status,now(),order_id)); db.execute("INSERT INTO shipments(id,order_id,provider,status,estimated_at,shipping_amount,insurance_amount,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()),order_id,provider,"awaiting_payment" if remaining else "processing",(datetime.now(timezone.utc)+timedelta(days=2)).isoformat(),shipping,insurance,now(),now())); db.execute("INSERT INTO order_status_history(id,order_id,status,actor_id,note,created_at) VALUES(?,?,?,?,?,?)", (str(uuid.uuid4()),order_id,final_status,actor["id"],"checkout",now()))
                snapshot={"orderNumber":order_number,"customerId":customer,"subtotal":subtotal,"discount":discount,"shipping":shipping,"insurance":insurance,"total":total}; db.execute("INSERT INTO invoices(id,invoice_number,order_id,issued_at,snapshot) VALUES(?,?,?,?,?)", (str(uuid.uuid4()),f"INV-{order_number}",order_id,now(),json.dumps(snapshot)))
                audit(db,actor["id"],"order.checkout","order",order_id,None,{"status":final_status,"total":total}); db.commit(); self.respond(201,{"orderId":order_id,"orderNumber":order_number,"paymentId":payment_id,"paymentStatus":payment_status,"amountPayable":remaining,"paymentUrl":f"/api/v1/payments/{payment_id}/confirm" if remaining else None})
            elif method == "POST" and path.startswith("/api/v1/payments/") and path.endswith("/confirm"):
                payment_id=path.split("/")[4]; actor=self.actor(); db.execute("BEGIN IMMEDIATE"); payment=db.execute("SELECT * FROM payments WHERE id=?",(payment_id,)).fetchone()
                if not payment: raise APIError(404,"not_found","پرداخت یافت نشد")
                if payment["status"] != "pending": raise APIError(409,"payment_state","پرداخت در وضعیت قابل تأیید نیست")
                db.execute("UPDATE payments SET status='success',provider_reference=?,updated_at=? WHERE id=?",(f"MOCK-{uuid.uuid4().hex[:10].upper()}",now(),payment_id)); db.execute("INSERT INTO payment_logs(id,payment_id,event_type,payload,created_at) VALUES(?,?,?,?,?)",(str(uuid.uuid4()),payment_id,"verified",json.dumps({"source":"mock"}),now())); db.execute("UPDATE orders SET payment_status='success',status='confirmed',updated_at=? WHERE id=?",(now(),payment["order_id"])); db.execute("UPDATE shipments SET status='processing',updated_at=? WHERE order_id=?",(now(),payment["order_id"])); db.execute("INSERT INTO order_status_history(id,order_id,status,actor_id,note,created_at) VALUES(?,?,?,?,?,?)",(str(uuid.uuid4()),payment["order_id"],"confirmed",actor["id"],"payment verified",now())); audit(db,actor["id"],"payment.confirmed","payment",payment_id,None,{"orderId":payment["order_id"]}); db.commit(); self.respond(200,{"id":payment_id,"status":"success"})
            elif method == "PATCH" and path.startswith("/api/v1/orders/") and path.endswith("/status"):
                order_id=path.split("/")[4]; body=self.json_body(); desired=required(body,"status"); actor=self.allow("order.manage"); db.execute("BEGIN IMMEDIATE"); order=db.execute("SELECT * FROM orders WHERE id=?",(order_id,)).fetchone()
                if not order: raise APIError(404,"not_found","سفارش یافت نشد")
                transitions={"pending":{"confirmed","canceled"},"confirmed":{"processing","canceled"},"processing":{"packed","canceled"},"packed":{"shipping","delivered"},"shipping":{"delivered"},"delivered":{"completed","returned"},"completed":set(),"canceled":set(),"returned":{"refunded"},"refunded":set()}
                if desired not in transitions[order["status"]]: raise APIError(409,"order_transition","تغییر وضعیت سفارش مجاز نیست")
                allocated = db.execute("SELECT oi.device_id,d.variant_id,d.warehouse_id,d.status FROM order_items oi JOIN devices d ON d.id=oi.device_id WHERE oi.order_id=?", (order_id,)).fetchall()
                if desired == "canceled":
                    for device in allocated:
                        if device["status"] == "reserved":
                            db.execute("UPDATE devices SET status='available',updated_at=? WHERE id=?", (now(), device["device_id"])); balance(db, device["warehouse_id"], device["variant_id"], reserved_delta=-1); movement(db, device["device_id"], device["variant_id"], device["warehouse_id"], device["warehouse_id"], "release", order_id, actor["id"])
                if desired == "completed":
                    for device in allocated:
                        if device["status"] != "reserved": raise APIError(409, "device_state", "دستگاه سفارش در وضعیت رزرو نیست")
                        db.execute("UPDATE devices SET status='sold',updated_at=? WHERE id=?", (now(), device["device_id"])); balance(db, device["warehouse_id"], device["variant_id"], on_hand_delta=-1, reserved_delta=-1); movement(db, device["device_id"], device["variant_id"], device["warehouse_id"], None, "sale", order_id, actor["id"])
                db.execute("UPDATE orders SET status=?,lock_version=lock_version+1,updated_at=? WHERE id=?",(desired,now(),order_id)); db.execute("UPDATE shipments SET status=?,tracking_code=COALESCE(tracking_code,?),updated_at=? WHERE order_id=?",(desired,f"TRK-{uuid.uuid4().hex[:8].upper()}",now(),order_id)); db.execute("INSERT INTO order_status_history(id,order_id,status,actor_id,note,created_at) VALUES(?,?,?,?,?,?)",(str(uuid.uuid4()),order_id,desired,actor["id"],body.get("note"),now())); audit(db,actor["id"],"order.status_changed","order",order_id,{"status":order["status"]},{"status":desired}); db.commit(); self.respond(200,{"id":order_id,"status":desired})
            else: raise APIError(404,"not_found","Endpoint یافت نشد")
            db.close()
        except APIError as e: self.respond(e.status,{"error":{"code":e.code,"message":e.message}})
        except sqlite3.IntegrityError as e: self.respond(409,{"error":{"code":"integrity_error","message":"یکپارچگی داده نقض شده است"}})
        except (KeyError, ValueError, AssertionError) as e: self.respond(400,{"error":{"code":"validation_error","message":str(e) or "ورودی نامعتبر است"}})
        except Exception:
            self.respond(500,{"error":{"code":"internal_error","message":"خطای داخلی رخ داد"}})

    def do_GET(self):
        if self.path.startswith("/api/"): self.handle_api("GET")
        else: super().do_GET()
    def do_POST(self): self.handle_api("POST")
    def do_PATCH(self): self.handle_api("PATCH")
    def do_DELETE(self): self.handle_api("DELETE")


def required(data: dict, key: str):
    value=data.get(key)
    if value in (None, "", []): raise APIError(400,"required",f"فیلد {key} الزامی است")
    return value


def catalog_price(variant_id: str) -> int:
    if variant_id not in CATALOG: raise APIError(400, "invalid_variant", "variant محصول معتبر نیست")
    return CATALOG[variant_id][1]


def catalog_title(variant_id: str) -> str:
    catalog_price(variant_id)
    return CATALOG[variant_id][0]


def assert_location(db: sqlite3.Connection, location_id: str) -> None:
    if not db.execute("SELECT 1 FROM warehouses WHERE id=? AND active=1",(location_id,)).fetchone(): raise APIError(400,"invalid_location","موقعیت انبار معتبر نیست")


def shipping_quote(method: str, subtotal: int) -> tuple[int, int, str]:
    quotes = {"pickup": (0, 0, "branch pickup"), "post": (1800000, 0, "post"), "tipax": (2600000, 0, "tipax"), "snapbox": (3500000, 0, "snapbox"), "express": (4900000, 0, "express"), "scheduled": (3000000, 0, "scheduled")}
    if method not in quotes: raise APIError(400, "shipping_method", "روش ارسال معتبر نیست")
    shipping, insurance, provider = quotes[method]
    if subtotal >= 500000000 and method != "express": shipping = 0
    return shipping, insurance, provider


def coupon_discount(db: sqlite3.Connection, code: str | None, subtotal: int, customer_id: str | None, branch_id: str | None) -> tuple[int, str | None]:
    if not code: return 0, None
    row = db.execute("SELECT * FROM coupon_rules WHERE code=? AND active=1", (code.upper(),)).fetchone()
    if not row: raise APIError(400, "coupon_invalid", "کد تخفیف معتبر نیست")
    if subtotal < row["minimum_amount"]: raise APIError(400, "coupon_minimum", "حداقل مبلغ سبد برای این کد رعایت نشده است")
    if row["branch_id"] and row["branch_id"] != branch_id: raise APIError(400, "coupon_branch", "کد برای شعبهٔ انتخاب‌شده معتبر نیست")
    discount = subtotal * row["value"] // 100 if row["kind"] == "percent" else row["value"]
    if row["maximum_discount"] is not None: discount = min(discount, row["maximum_discount"])
    return discount, row["id"]


def make_order_number() -> str:
    return f"A3-{datetime.now(timezone.utc).strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def order_detail(db: sqlite3.Connection, order_id: str) -> dict:
    order = db.execute("SELECT o.*,b.name branch_name FROM orders o LEFT JOIN branches b ON b.id=o.branch_id WHERE o.id=?", (order_id,)).fetchone()
    if not order: raise APIError(404, "not_found", "سفارش یافت نشد")
    result = dict(order)
    result["items"] = [dict(row) for row in db.execute("SELECT * FROM order_items WHERE order_id=?", (order_id,)).fetchall()]
    result["payments"] = [dict(row) for row in db.execute("SELECT id,provider,method,amount,status,authority,provider_reference,created_at FROM payments WHERE order_id=?", (order_id,)).fetchall()]
    result["shipment"] = dict(row) if (row := db.execute("SELECT * FROM shipments WHERE order_id=?", (order_id,)).fetchone()) else None
    result["history"] = [dict(row) for row in db.execute("SELECT status,actor_id,note,created_at FROM order_status_history WHERE order_id=? ORDER BY created_at", (order_id,)).fetchall()]
    return result


if __name__ == "__main__":
    init_db()
    print(f"Applekhane Phase 3 API on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
