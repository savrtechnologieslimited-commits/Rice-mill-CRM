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
  UPDATE public.inventory SET quantity_qtl = 0, updated_at = now() WHERE product IS NOT NULL;
  UPDATE public.mill_settings SET opening_balances_set = false, opening_cash = 0, opening_bank = 0, set_at = NULL, updated_at = now() WHERE id = 1;
END $$;