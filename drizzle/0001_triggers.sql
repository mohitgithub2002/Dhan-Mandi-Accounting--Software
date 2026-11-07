-- Integrity rules that must hold no matter which code path writes (PRD §10).

-- 1. A ledger line is either a debit (naam) or a credit (jama), never negative.
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_one_side"
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0) <> (credit = 0));--> statement-breakpoint

-- 2. Every voucher balances: sum(debit) = sum(credit). Checked at COMMIT
--    (deferred) so a posting can insert its lines one by one.
CREATE OR REPLACE FUNCTION check_voucher_balanced() RETURNS trigger AS $$
DECLARE
  d numeric; c numeric;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0) INTO d, c
    FROM ledger_entries WHERE voucher_id = NEW.voucher_id;
  IF d <> c THEN
    RAISE EXCEPTION 'Voucher % is not balanced: debit % <> credit %', NEW.voucher_id, d, c
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_voucher_balanced();--> statement-breakpoint

-- 3. Posted ledger lines and the audit log are append-only.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be changed or deleted; post a reversal instead', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_change();--> statement-breakpoint

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_change();--> statement-breakpoint

-- 4. Vouchers are never deleted (radd sets status and posts a reversal).
CREATE TRIGGER vouchers_no_delete
  BEFORE DELETE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION forbid_change();--> statement-breakpoint

-- 5. Ledger line date always equals its voucher date.
CREATE OR REPLACE FUNCTION ledger_date_matches_voucher() RETURNS trigger AS $$
DECLARE vd date;
BEGIN
  SELECT date INTO vd FROM vouchers WHERE id = NEW.voucher_id;
  IF vd IS DISTINCT FROM NEW.date THEN
    RAISE EXCEPTION 'Ledger line date % differs from voucher date %', NEW.date, vd;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER ledger_entries_date_check
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_date_matches_voucher();
