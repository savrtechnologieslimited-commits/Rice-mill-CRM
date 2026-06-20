CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, phone TEXT, address TEXT, gstin TEXT,
  outstanding NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_s_u BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, phone TEXT, address TEXT, gstin TEXT,
  outstanding NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_c_u BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.govt_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.govt_agencies TO authenticated;
GRANT ALL ON public.govt_agencies TO service_role;
ALTER TABLE public.govt_agencies ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.owner_type AS ENUM ('government','private');
CREATE TYPE public.batch_status AS ENUM ('available','drying','in_production','consumed');
CREATE TYPE public.storage_choice AS ENUM ('stored','drying','direct_production');

CREATE SEQUENCE public.batch_seq START 1;

CREATE TABLE public.paddy_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  owner_type owner_type NOT NULL,
  owner_name TEXT NOT NULL,
  govt_agency_id UUID REFERENCES public.govt_agencies(id),
  variety TEXT,
  net_quantity_qtl NUMERIC(12,3) NOT NULL,
  remaining_qtl NUMERIC(12,3) NOT NULL,
  moisture_pct NUMERIC(5,2),
  storage_choice storage_choice NOT NULL,
  location TEXT,
  status batch_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddy_batches TO authenticated;
GRANT ALL ON public.paddy_batches TO service_role;
ALTER TABLE public.paddy_batches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_b_u BEFORE UPDATE ON public.paddy_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.next_batch_number()
RETURNS TEXT LANGUAGE sql SET search_path = public AS $$
  SELECT 'PB-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.batch_seq')::text, 4, '0')
$$;

CREATE TABLE public.paddy_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.paddy_batches(id) ON DELETE CASCADE,
  intake_date DATE NOT NULL DEFAULT CURRENT_DATE,
  truck_number TEXT,
  gross_weight_qtl NUMERIC(12,3) NOT NULL,
  tare_weight_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  deduction_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  net_quantity_qtl NUMERIC(12,3) NOT NULL,
  moisture_pct NUMERIC(5,2),
  remarks TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddy_intakes TO authenticated;
GRANT ALL ON public.paddy_intakes TO service_role;
ALTER TABLE public.paddy_intakes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.govt_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.govt_agencies(id),
  batch_id UUID REFERENCES public.paddy_batches(id),
  paddy_received_qtl NUMERIC(12,3) NOT NULL,
  rice_due_qtl NUMERIC(12,3) NOT NULL,
  rice_returned_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.govt_obligations TO authenticated;
GRANT ALL ON public.govt_obligations TO service_role;
ALTER TABLE public.govt_obligations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_govt_obligation_for_batch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_type = 'government' THEN
    INSERT INTO public.govt_obligations (agency_id, batch_id, paddy_received_qtl, rice_due_qtl)
    VALUES (NEW.govt_agency_id, NEW.id, NEW.net_quantity_qtl, ROUND(NEW.net_quantity_qtl * 0.67, 3));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_batch_oblig AFTER INSERT ON public.paddy_batches FOR EACH ROW EXECUTE FUNCTION public.create_govt_obligation_for_batch();

CREATE TYPE public.payment_mode AS ENUM ('cash','bank','upi','cheque','credit');

CREATE TABLE public.procurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.paddy_batches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  purchase_rate NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurements TO authenticated;
GRANT ALL ON public.procurements TO service_role;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.proc_outstanding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_mode = 'credit' THEN
    UPDATE public.suppliers SET outstanding = outstanding + NEW.total_amount WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_pr_out AFTER INSERT ON public.procurements FOR EACH ROW EXECUTE FUNCTION public.proc_outstanding();

CREATE TYPE public.product_type AS ENUM ('paddy','rice','bran','broken_rice','husk');

CREATE TABLE public.inventory (
  product product_type PRIMARY KEY,
  quantity_qtl NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
INSERT INTO public.inventory (product) VALUES ('paddy'),('rice'),('bran'),('broken_rice'),('husk');

CREATE OR REPLACE FUNCTION public.batch_add_inv()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.storage_choice <> 'direct_production' THEN
    UPDATE public.inventory SET quantity_qtl = quantity_qtl + NEW.net_quantity_qtl, updated_at = now() WHERE product = 'paddy';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_batch_inv AFTER INSERT ON public.paddy_batches FOR EACH ROW EXECUTE FUNCTION public.batch_add_inv();

CREATE TABLE public.production_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_id UUID NOT NULL REFERENCES public.paddy_batches(id),
  paddy_used_qtl NUMERIC(12,3) NOT NULL,
  rice_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  bran_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  broken_rice_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  husk_qtl NUMERIC(12,3) NOT NULL DEFAULT 0,
  recovery_pct NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN paddy_used_qtl > 0 THEN ROUND((rice_qtl / paddy_used_qtl)*100, 2) ELSE 0 END
  ) STORED,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_runs TO authenticated;
GRANT ALL ON public.production_runs TO service_role;
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prod_apply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b RECORD;
BEGIN
  SELECT * INTO b FROM public.paddy_batches WHERE id = NEW.batch_id FOR UPDATE;
  IF NEW.paddy_used_qtl > b.remaining_qtl THEN
    RAISE EXCEPTION 'Used quantity (%) exceeds batch remaining (%)', NEW.paddy_used_qtl, b.remaining_qtl;
  END IF;
  UPDATE public.paddy_batches
    SET remaining_qtl = remaining_qtl - NEW.paddy_used_qtl,
        status = CASE WHEN remaining_qtl - NEW.paddy_used_qtl <= 0 THEN 'consumed'::batch_status ELSE 'in_production'::batch_status END
    WHERE id = NEW.batch_id;
  IF b.storage_choice <> 'direct_production' THEN
    UPDATE public.inventory SET quantity_qtl = quantity_qtl - NEW.paddy_used_qtl, updated_at = now() WHERE product = 'paddy';
  END IF;
  UPDATE public.inventory SET quantity_qtl = quantity_qtl + NEW.rice_qtl, updated_at = now() WHERE product = 'rice';
  UPDATE public.inventory SET quantity_qtl = quantity_qtl + NEW.bran_qtl, updated_at = now() WHERE product = 'bran';
  UPDATE public.inventory SET quantity_qtl = quantity_qtl + NEW.broken_rice_qtl, updated_at = now() WHERE product = 'broken_rice';
  UPDATE public.inventory SET quantity_qtl = quantity_qtl + NEW.husk_qtl, updated_at = now() WHERE product = 'husk';
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_prod_apply AFTER INSERT ON public.production_runs FOR EACH ROW EXECUTE FUNCTION public.prod_apply();

CREATE TYPE public.dispatch_type AS ENUM ('sale','government_return');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dispatch_type dispatch_type NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  agency_id UUID REFERENCES public.govt_agencies(id),
  product product_type NOT NULL,
  quantity_qtl NUMERIC(12,3) NOT NULL,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  truck_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sales_apply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE iq NUMERIC;
BEGIN
  SELECT quantity_qtl INTO iq FROM public.inventory WHERE product = NEW.product FOR UPDATE;
  IF NEW.quantity_qtl > iq THEN
    RAISE EXCEPTION 'Insufficient % stock: have %, need %', NEW.product, iq, NEW.quantity_qtl;
  END IF;
  UPDATE public.inventory SET quantity_qtl = quantity_qtl - NEW.quantity_qtl, updated_at = now() WHERE product = NEW.product;
  IF NEW.dispatch_type = 'sale' AND NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers SET outstanding = outstanding + NEW.total_amount WHERE id = NEW.customer_id;
  ELSIF NEW.dispatch_type = 'government_return' AND NEW.agency_id IS NOT NULL AND NEW.product = 'rice' THEN
    UPDATE public.govt_obligations SET rice_returned_qtl = rice_returned_qtl + NEW.quantity_qtl
      WHERE id = (SELECT id FROM public.govt_obligations WHERE agency_id = NEW.agency_id AND (rice_due_qtl - rice_returned_qtl) > 0 ORDER BY created_at LIMIT 1);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_sales_apply AFTER INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_apply();

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.coll_apply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.customers SET outstanding = outstanding - NEW.amount WHERE id = NEW.customer_id; RETURN NEW; END; $$;
CREATE TRIGGER trg_coll AFTER INSERT ON public.collections FOR EACH ROW EXECUTE FUNCTION public.coll_apply();

CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sp_apply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.suppliers SET outstanding = outstanding - NEW.amount WHERE id = NEW.supplier_id; RETURN NEW; END; $$;
CREATE TRIGGER trg_sp AFTER INSERT ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.sp_apply();

CREATE TYPE public.expense_category AS ENUM ('labour','diesel','electricity','repairs','transport','packing','miscellaneous');

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category expense_category NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.cash_movements WITH (security_invoker=on) AS
  SELECT receipt_date AS dt, 'in'::text AS direction, amount, payment_mode, 'Collection'::text AS source FROM public.collections
  UNION ALL
  SELECT payment_date, 'out', amount, payment_mode, 'Supplier Payment' FROM public.supplier_payments
  UNION ALL
  SELECT expense_date, 'out', amount, payment_mode, 'Expense' FROM public.expenses
  UNION ALL
  SELECT created_at::date, 'out', total_amount, payment_mode, 'Procurement' FROM public.procurements WHERE payment_mode <> 'credit';
GRANT SELECT ON public.cash_movements TO authenticated;

CREATE TABLE public.batch_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.paddy_batches(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_email text,
  actor_roles text,
  action text NOT NULL,
  entity text NOT NULL,
  summary text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX batch_audit_log_batch_idx ON public.batch_audit_log(batch_id, created_at DESC);
GRANT SELECT ON public.batch_audit_log TO authenticated;
GRANT ALL ON public.batch_audit_log TO service_role;
ALTER TABLE public.batch_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.write_batch_audit(
  _batch_id uuid, _action text, _entity text, _summary text, _details jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text; rs text;
BEGIN
  SELECT email INTO em FROM public.profiles WHERE id = uid;
  SELECT string_agg(role::text, ',') INTO rs FROM public.user_roles WHERE user_id = uid;
  INSERT INTO public.batch_audit_log(batch_id, actor_id, actor_email, actor_roles, action, entity, summary, details)
  VALUES (_batch_id, uid, em, rs, _action, _entity, _summary, _details);
END $$;

CREATE OR REPLACE FUNCTION public.tr_audit_batch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_batch_audit(NEW.id, 'created', 'batch',
      'Batch '||NEW.batch_number||' created · '||NEW.net_quantity_qtl||' qtl '||NEW.owner_type, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.write_batch_audit(NEW.id, 'updated', 'batch',
      'Batch updated (status '||OLD.status||' → '||NEW.status||', remaining '||OLD.remaining_qtl||' → '||NEW.remaining_qtl||')',
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_batch_audit(OLD.id, 'deleted', 'batch', 'Batch '||OLD.batch_number||' deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_audit_ins AFTER INSERT ON public.paddy_batches FOR EACH ROW EXECUTE FUNCTION public.tr_audit_batch();
CREATE TRIGGER batch_audit_upd AFTER UPDATE ON public.paddy_batches FOR EACH ROW EXECUTE FUNCTION public.tr_audit_batch();
CREATE TRIGGER batch_audit_del AFTER DELETE ON public.paddy_batches FOR EACH ROW EXECUTE FUNCTION public.tr_audit_batch();

CREATE OR REPLACE FUNCTION public.tr_audit_intake() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.write_batch_audit(NEW.batch_id, 'intake_recorded', 'intake',
    'Truck '||COALESCE(NEW.truck_number,'—')||' · gross '||NEW.gross_weight_qtl||' qtl · net '||NEW.net_quantity_qtl||' qtl',
    to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER batch_audit_intake AFTER INSERT ON public.paddy_intakes FOR EACH ROW EXECUTE FUNCTION public.tr_audit_intake();

CREATE OR REPLACE FUNCTION public.tr_audit_proc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sname text;
BEGIN
  SELECT name INTO sname FROM public.suppliers WHERE id = NEW.supplier_id;
  PERFORM public.write_batch_audit(NEW.batch_id, 'procurement_linked', 'procurement',
    'Linked to supplier '||COALESCE(sname,'—')||' · rate ₹'||NEW.purchase_rate||'/qtl · '||NEW.payment_mode,
    to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER batch_audit_proc AFTER INSERT ON public.procurements FOR EACH ROW EXECUTE FUNCTION public.tr_audit_proc();

CREATE OR REPLACE FUNCTION public.tr_audit_prod() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.write_batch_audit(NEW.batch_id, 'production_run', 'production_run',
    'Milled '||NEW.paddy_used_qtl||' qtl → rice '||NEW.rice_qtl||' qtl ('||COALESCE(round(NEW.recovery_pct::numeric,1)::text,'—')||'% recovery)',
    to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER batch_audit_prod AFTER INSERT ON public.production_runs FOR EACH ROW EXECUTE FUNCTION public.tr_audit_prod();

CREATE OR REPLACE FUNCTION public.prod_update_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rice_qtl <> OLD.rice_qtl THEN
    UPDATE public.inventory SET quantity_qtl = quantity_qtl + (NEW.rice_qtl - OLD.rice_qtl), updated_at = now() WHERE product = 'rice';
  END IF;
  IF NEW.bran_qtl <> OLD.bran_qtl THEN
    UPDATE public.inventory SET quantity_qtl = quantity_qtl + (NEW.bran_qtl - OLD.bran_qtl), updated_at = now() WHERE product = 'bran';
  END IF;
  IF NEW.broken_rice_qtl <> OLD.broken_rice_qtl THEN
    UPDATE public.inventory SET quantity_qtl = quantity_qtl + (NEW.broken_rice_qtl - OLD.broken_rice_qtl), updated_at = now() WHERE product = 'broken_rice';
  END IF;
  IF NEW.husk_qtl <> OLD.husk_qtl THEN
    UPDATE public.inventory SET quantity_qtl = quantity_qtl + (NEW.husk_qtl - OLD.husk_qtl), updated_at = now() WHERE product = 'husk';
  END IF;
  IF (NEW.rice_qtl + NEW.bran_qtl + NEW.broken_rice_qtl + NEW.husk_qtl) > 0
     AND (OLD.rice_qtl + OLD.bran_qtl + OLD.broken_rice_qtl + OLD.husk_qtl) = 0 THEN
    UPDATE public.paddy_batches SET status = 'consumed', updated_at = now()
      WHERE id = NEW.batch_id AND status = 'in_production';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prod_update_apply_t AFTER UPDATE ON public.production_runs
  FOR EACH ROW EXECUTE FUNCTION public.prod_update_apply();

ALTER TABLE public.supplier_payments ADD COLUMN batch_id uuid REFERENCES public.paddy_batches(id) ON DELETE SET NULL;
ALTER TABLE public.collections      ADD COLUMN batch_id uuid REFERENCES public.paddy_batches(id) ON DELETE SET NULL;
ALTER TABLE public.sales            ADD COLUMN batch_id uuid REFERENCES public.paddy_batches(id) ON DELETE SET NULL;

CREATE INDEX sp_batch_idx   ON public.supplier_payments(batch_id);
CREATE INDEX coll_batch_idx ON public.collections(batch_id);
CREATE INDEX sales_batch_idx ON public.sales(batch_id);

CREATE OR REPLACE VIEW public.batch_payables WITH (security_invoker=on) AS
SELECT b.id AS batch_id, b.batch_number, b.owner_name, b.owner_type, b.variety, b.net_quantity_qtl,
       b.created_at AS batch_date,
       pr.supplier_id, s.name AS supplier_name,
       pr.purchase_rate, pr.total_amount, pr.payment_mode, pr.due_date, pr.created_at AS procurement_date,
       COALESCE(p.paid, 0) AS paid_amount,
       CASE WHEN pr.id IS NULL THEN NULL::numeric ELSE pr.total_amount - COALESCE(p.paid, 0) END AS outstanding,
       (pr.id IS NULL) AS procurement_pending
  FROM public.paddy_batches b
  LEFT JOIN public.procurements pr ON pr.batch_id = b.id
  LEFT JOIN public.suppliers s ON s.id = pr.supplier_id
  LEFT JOIN (SELECT batch_id, sum(amount) AS paid FROM public.supplier_payments WHERE batch_id IS NOT NULL GROUP BY batch_id) p ON p.batch_id = b.id
 WHERE b.owner_type = 'private'::public.owner_type;

CREATE OR REPLACE VIEW public.batch_receivables WITH (security_invoker=on) AS
SELECT b.id AS batch_id, b.batch_number, b.owner_name, b.variety,
       sl.customer_id, c.name AS customer_name,
       COALESCE(SUM(sl.total_amount),0) AS sold_amount,
       COALESCE(MAX(col.collected),0) AS collected_amount,
       CASE WHEN count(sl.id) = 0 THEN NULL::numeric ELSE COALESCE(SUM(sl.total_amount),0) - COALESCE(MAX(col.collected),0) END AS outstanding,
       MAX(sl.sale_date) AS last_sale_date,
       (count(sl.id) = 0) AS sale_pending
  FROM public.paddy_batches b
  LEFT JOIN public.sales sl ON sl.batch_id = b.id AND sl.dispatch_type = 'sale'::public.dispatch_type AND sl.customer_id IS NOT NULL
  LEFT JOIN public.customers c ON c.id = sl.customer_id
  LEFT JOIN (SELECT batch_id, customer_id, sum(amount) AS collected FROM public.collections WHERE batch_id IS NOT NULL GROUP BY batch_id, customer_id) col
         ON col.batch_id = b.id AND col.customer_id = sl.customer_id
 GROUP BY b.id, b.batch_number, b.owner_name, b.variety, sl.customer_id, c.name;

GRANT SELECT ON public.batch_payables TO authenticated;
GRANT SELECT ON public.batch_receivables TO authenticated;
GRANT ALL ON public.batch_payables TO service_role;
GRANT ALL ON public.batch_receivables TO service_role;

DO $do$
DECLARE t text;
  tables text[] := ARRAY['paddy_batches','paddy_intakes','procurements','production_runs','sales','collections','customers','suppliers','supplier_payments','expenses','govt_agencies','govt_obligations','inventory','batch_audit_log'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||'_read_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||'_write_all', t);
  END LOOP;
END $do$;

CREATE OR REPLACE FUNCTION public.tr_audit_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE party text;
BEGIN
  IF NEW.dispatch_type = 'sale' AND NEW.customer_id IS NOT NULL THEN
    SELECT name INTO party FROM public.customers WHERE id = NEW.customer_id;
  ELSIF NEW.agency_id IS NOT NULL THEN
    SELECT name INTO party FROM public.govt_agencies WHERE id = NEW.agency_id;
  END IF;
  PERFORM public.write_batch_audit(
    NEW.batch_id, 'sale_recorded', 'sale',
    'Sold '||NEW.quantity_qtl||' qtl '||replace(NEW.product::text,'_',' ')||
      ' · '||replace(NEW.dispatch_type::text,'_',' ')||
      COALESCE(' · '||party,'')||
      COALESCE(' · ₹'||NEW.total_amount,''),
    to_jsonb(NEW)
  );
  RETURN NEW;
END $$;
CREATE TRIGGER tr_audit_sale AFTER INSERT ON public.sales FOR EACH ROW WHEN (NEW.batch_id IS NOT NULL) EXECUTE FUNCTION public.tr_audit_sale();

CREATE OR REPLACE FUNCTION public.tr_audit_prod_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.rice_qtl + NEW.bran_qtl + NEW.broken_rice_qtl + NEW.husk_qtl) >
     (OLD.rice_qtl + OLD.bran_qtl + OLD.broken_rice_qtl + OLD.husk_qtl) THEN
    PERFORM public.write_batch_audit(
      NEW.batch_id, 'output_recorded', 'production_run',
      'Output recorded · rice '||NEW.rice_qtl||' qtl · bran '||NEW.bran_qtl||
        ' qtl · broken '||NEW.broken_rice_qtl||' qtl · husk '||NEW.husk_qtl||
        ' qtl ('||COALESCE(round(NEW.recovery_pct::numeric,1)::text,'—')||'% recovery)',
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_audit_prod_update AFTER UPDATE ON public.production_runs FOR EACH ROW EXECUTE FUNCTION public.tr_audit_prod_update();