
CREATE TABLE IF NOT EXISTS public.mill_settings (
  id INT PRIMARY KEY DEFAULT 1,
  opening_balances_set BOOLEAN NOT NULL DEFAULT false,
  opening_cash NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_bank NUMERIC(14,2) NOT NULL DEFAULT 0,
  set_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mill_settings_singleton CHECK (id = 1)
);

INSERT INTO public.mill_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.mill_settings TO authenticated;
GRANT ALL ON public.mill_settings TO service_role;

ALTER TABLE public.mill_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ms_read_all" ON public.mill_settings;
CREATE POLICY "ms_read_all" ON public.mill_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ms_write_owner" ON public.mill_settings;
CREATE POLICY "ms_write_owner" ON public.mill_settings FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE OR REPLACE VIEW public.cash_movements AS
  SELECT collections.receipt_date AS dt, 'in'::text AS direction, collections.amount, collections.payment_mode, 'Collection'::text AS source FROM collections
  UNION ALL
  SELECT supplier_payments.payment_date AS dt, 'out'::text AS direction, supplier_payments.amount, supplier_payments.payment_mode, 'Supplier Payment'::text AS source FROM supplier_payments
  UNION ALL
  SELECT expenses.expense_date AS dt, 'out'::text AS direction, expenses.amount, expenses.payment_mode, 'Expense'::text AS source FROM expenses
  UNION ALL
  SELECT procurements.created_at::date AS dt, 'out'::text AS direction, procurements.total_amount AS amount, procurements.payment_mode, 'Procurement'::text AS source FROM procurements WHERE procurements.payment_mode <> 'credit'::payment_mode
  UNION ALL
  SELECT COALESCE(ms.set_at::date, CURRENT_DATE) AS dt, 'in'::text AS direction, ms.opening_cash AS amount, 'cash'::payment_mode AS payment_mode, 'Opening Balance'::text AS source FROM public.mill_settings ms WHERE ms.opening_cash > 0
  UNION ALL
  SELECT COALESCE(ms.set_at::date, CURRENT_DATE) AS dt, 'in'::text AS direction, ms.opening_bank AS amount, 'bank'::payment_mode AS payment_mode, 'Opening Balance'::text AS source FROM public.mill_settings ms WHERE ms.opening_bank > 0;

CREATE OR REPLACE FUNCTION public.master_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the owner can perform a master reset';
  END IF;
  TRUNCATE TABLE
    public.batch_audit_log,
    public.collections,
    public.expenses,
    public.govt_obligations,
    public.paddy_intakes,
    public.procurements,
    public.production_runs,
    public.sales,
    public.supplier_payments,
    public.paddy_batches,
    public.customers,
    public.suppliers,
    public.govt_agencies
  RESTART IDENTITY CASCADE;
  UPDATE public.inventory SET quantity_qtl = 0, updated_at = now();
  UPDATE public.mill_settings SET opening_balances_set = false, opening_cash = 0, opening_bank = 0, set_at = NULL, updated_at = now() WHERE id = 1;
END $$;

GRANT EXECUTE ON FUNCTION public.master_reset() TO authenticated;
