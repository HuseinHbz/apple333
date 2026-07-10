-- Phase 3: PostgreSQL inventory foundation.
-- Preconditions: pgcrypto is available; product_variants is created by the catalog module.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TYPE inventory.device_status AS ENUM ('received','available','reserved','in_transit','sold','returned','repair','damaged','lost');
CREATE TYPE inventory.transfer_status AS ENUM ('draft','requested','approved','dispatched','received','rejected','cancelled');
CREATE TYPE inventory.reservation_status AS ENUM ('active','confirmed','fulfilled','expired','cancelled');

CREATE TABLE inventory.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), branch_id uuid REFERENCES inventory.branches(id),
  code text NOT NULL UNIQUE, name text NOT NULL, kind text NOT NULL CHECK (kind IN ('central','branch','repair','transit')),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory.inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id),
  variant_id uuid NOT NULL, on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand), version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(warehouse_id, variant_id)
);
CREATE TABLE inventory.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL, warehouse_id uuid REFERENCES inventory.warehouses(id),
  status inventory.device_status NOT NULL DEFAULT 'received', model_number text, region text, sim_type text,
  imei_1_ciphertext bytea, imei_1_hash char(64) UNIQUE, imei_2_ciphertext bytea, imei_2_hash char(64) UNIQUE,
  serial_ciphertext bytea, serial_hash char(64) UNIQUE, activation_date date, purchase_date date,
  warranty_status text, cost_amount bigint CHECK (cost_amount >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), po_number text NOT NULL UNIQUE, supplier_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','approved','partial','received','cancelled')),
  expected_at timestamptz, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory.receiving_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_order_id uuid REFERENCES inventory.purchase_orders(id),
  warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id), status text NOT NULL CHECK (status IN ('draft','receiving','qc','completed','cancelled')),
  received_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE inventory.transfer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transfer_number text NOT NULL UNIQUE,
  source_warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id), destination_warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id),
  status inventory.transfer_status NOT NULL DEFAULT 'draft', reason text NOT NULL, requested_by uuid NOT NULL,
  approved_by uuid, dispatched_by uuid, received_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_warehouse_id <> destination_warehouse_id)
);
CREATE TABLE inventory.transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transfer_id uuid NOT NULL REFERENCES inventory.transfer_orders(id) ON DELETE CASCADE,
  device_id uuid REFERENCES inventory.devices(id), variant_id uuid, quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  CHECK (device_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE TABLE inventory.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid REFERENCES inventory.devices(id), variant_id uuid,
  warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id), order_reference text, customer_reference uuid,
  status inventory.reservation_status NOT NULL DEFAULT 'active', priority smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (device_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE TABLE inventory.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid REFERENCES inventory.devices(id), variant_id uuid,
  from_warehouse_id uuid REFERENCES inventory.warehouses(id), to_warehouse_id uuid REFERENCES inventory.warehouses(id),
  movement_type text NOT NULL CHECK (movement_type IN ('receive','reserve','release','transfer_dispatch','transfer_receive','sale','return','adjustment','repair')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity <> 0), reference_type text, reference_id uuid, actor_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (device_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE TABLE inventory.stock_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), warehouse_id uuid NOT NULL REFERENCES inventory.warehouses(id),
  status text NOT NULL CHECK (status IN ('draft','counting','review','approved','cancelled')), scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_by uuid NOT NULL, approved_by uuid, opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE TABLE inventory.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL,
  warehouse_id uuid REFERENCES inventory.warehouses(id), before_value jsonb, after_value jsonb, request_id uuid, ip_hash char(64), occurred_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

CREATE INDEX inventory_devices_lookup_idx ON inventory.devices (imei_1_hash, serial_hash);
CREATE INDEX inventory_devices_location_status_idx ON inventory.devices (warehouse_id, status);
CREATE INDEX inventory_balance_variant_idx ON inventory.inventory_balances (variant_id, warehouse_id);
CREATE INDEX inventory_reservation_expiry_idx ON inventory.reservations (expires_at) WHERE status = 'active';
CREATE INDEX inventory_movement_device_time_idx ON inventory.stock_movements (device_id, occurred_at DESC);
CREATE INDEX inventory_movement_location_time_idx ON inventory.stock_movements (to_warehouse_id, occurred_at DESC);
CREATE INDEX inventory_transfer_status_idx ON inventory.transfer_orders (status, created_at DESC);
