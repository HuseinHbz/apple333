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
    "manager": {"inventory.read", "device.read", "transfer.create", "transfer.approve", "transfer.dispatch", "transfer.receive", "reservation.create", "reservation.cancel", "receiving.execute", "report.read"},
    "warehouse": {"inventory.read", "device.read", "transfer.create", "transfer.dispatch", "transfer.receive", "reservation.create", "reservation.cancel", "receiving.execute"},
    "sales": {"inventory.read", "device.read", "reservation.create", "reservation.cancel"},
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
        CREATE INDEX IF NOT EXISTS devices_imei_hash_idx ON devices(imei_1_hash);
        CREATE INDEX IF NOT EXISTS devices_serial_hash_idx ON devices(serial_hash);
        CREATE INDEX IF NOT EXISTS devices_location_status_idx ON devices(warehouse_id, status);
        CREATE INDEX IF NOT EXISTS reservations_expiry_idx ON reservations(status, expires_at);
        CREATE INDEX IF NOT EXISTS movements_device_time_idx ON stock_movements(device_id, occurred_at DESC);
        CREATE INDEX IF NOT EXISTS transfers_status_idx ON transfer_orders(status, created_at DESC);
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


def assert_location(db: sqlite3.Connection, location_id: str) -> None:
    if not db.execute("SELECT 1 FROM warehouses WHERE id=? AND active=1",(location_id,)).fetchone(): raise APIError(400,"invalid_location","موقعیت انبار معتبر نیست")


if __name__ == "__main__":
    init_db()
    print(f"Applekhane Phase 3 API on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
