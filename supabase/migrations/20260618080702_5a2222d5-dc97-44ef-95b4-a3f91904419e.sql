-- See attached SQL
CREATE TYPE public.app_role AS ENUM ('owner','intake_clerk','procurement_manager','production_operator','sales_executive','accounts');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT, email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_sel" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "p_upd" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "p_ins" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner')
$$;

CREATE POLICY "ur_sel" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "ur_mgr" ON public.user_roles FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.email_for_username(_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE lower(username) = lower(_username) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uc INT; req TEXT; uname TEXT;
BEGIN
  uname := NEW.raw_user_meta_data->>'username';
  INSERT INTO public.profiles (id, username, full_name, email)
    VALUES (NEW.id, uname, NEW.raw_user_meta_data->>'full_name', NEW.email)
    ON CONFLICT DO NOTHING;
  SELECT COUNT(*) INTO uc FROM auth.users;
  IF uc = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;
  req := NEW.raw_user_meta_data->>'requested_role';
  IF req IN ('intake_clerk','procurement_manager','production_operator','sales_executive','accounts') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, req::app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;