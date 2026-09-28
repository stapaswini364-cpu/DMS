-- Splits vehicle-sale posting into component revenue ledgers plus contra
-- treatment for discount and exchange trade-in. Adds:
--
--   • 9 revenue component ledgers (I0003–I0011) under existing Sales sub-group
--   • 1 asset ledger A0006 "Used Vehicle Inventory" under existing Vehicle
--     Inventory sub-group (holds trade-in exchange value)
--   • 1 expense ledger EX0007 "Discount Given" under a NEW hierarchy branch
--     Expense → Others → Discount Allowed → Discount, per Ind AS presentation
--
-- I0001 "Sales - Vehicles" is intentionally left untouched — historical
-- delivery JEs continue to reference it accurately. postDeliveryEntry() will
-- stop writing to it going forward.
--
-- Fully idempotent: every INSERT is ON CONFLICT DO NOTHING against the
-- (tenant_id, code)/(tenant_id, ledger_code) unique indices.

-- ── New COA hierarchy: Expense → Others → Discount Allowed → Discount ──────

INSERT INTO coa_major_heads (tenant_id, account_type_id, name, code)
SELECT tenant_id, id, 'Others', 'EX-OTH'
FROM coa_account_types
WHERE code = 'EX'
ON CONFLICT (tenant_id, code) DO NOTHING;--> statement-breakpoint

INSERT INTO coa_groups (tenant_id, major_head_id, name, code)
SELECT tenant_id, id, 'Discount Allowed', 'EX-OTH-DA'
FROM coa_major_heads
WHERE code = 'EX-OTH'
ON CONFLICT (tenant_id, code) DO NOTHING;--> statement-breakpoint

INSERT INTO coa_sub_groups (tenant_id, group_id, name, code)
SELECT tenant_id, id, 'Discount', 'EX-OTH-DA-DISC'
FROM coa_groups
WHERE code = 'EX-OTH-DA'
ON CONFLICT (tenant_id, code) DO NOTHING;--> statement-breakpoint

-- ── EX0007 Discount Given (contra-revenue as an expense) ──────────────────

INSERT INTO coa_ledgers (tenant_id, sub_group_id, ledger_code, ledger_name, balance_type)
SELECT tenant_id, id, 'EX0007', 'Discount Given', 'debit'::balance_type
FROM coa_sub_groups
WHERE code = 'EX-OTH-DA-DISC'
ON CONFLICT (tenant_id, ledger_code) DO NOTHING;--> statement-breakpoint

-- ── 9 revenue component ledgers under existing Sales sub-group ────────────

INSERT INTO coa_ledgers (tenant_id, sub_group_id, ledger_code, ledger_name, balance_type)
SELECT sg.tenant_id, sg.id, v.code, v.name, 'credit'::balance_type
FROM coa_sub_groups sg
CROSS JOIN (VALUES
  ('I0003', 'Sales - Ex-Showroom'),
  ('I0004', 'Sales - RTO'),
  ('I0005', 'Sales - Insurance'),
  ('I0006', 'Sales - Extended Warranty'),
  ('I0007', 'Sales - AMC'),
  ('I0008', 'Sales - Handling Charges'),
  ('I0009', 'Sales - ETC Charges'),
  ('I0010', 'Sales - HP/Hypothecation'),
  ('I0011', 'Sales - Accessories')
) AS v(code, name)
WHERE sg.code = 'I-REV-OR-SAL'
ON CONFLICT (tenant_id, ledger_code) DO NOTHING;--> statement-breakpoint

-- ── A0006 Used Vehicle Inventory (trade-in asset) ─────────────────────────

INSERT INTO coa_ledgers (tenant_id, sub_group_id, ledger_code, ledger_name, balance_type)
SELECT tenant_id, id, 'A0006', 'Used Vehicle Inventory', 'debit'::balance_type
FROM coa_sub_groups
WHERE code = 'A-CA-INV-VI'
ON CONFLICT (tenant_id, ledger_code) DO NOTHING;
