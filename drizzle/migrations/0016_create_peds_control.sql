CREATE OR REPLACE FUNCTION public.can_access_peds(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_team_member(_user_id) AND (public.is_coordinator_plus(_user_id) OR public.has_area(_user_id, 'peds') OR public.has_area(_user_id, 'ped') OR public.has_area(_user_id, 'kids')); $$;
GRANT EXECUTE ON FUNCTION public.can_access_peds(uuid) TO authenticated, service_role;
CREATE TABLE public.peds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 categoria text NOT NULL DEFAULT 'Crianças' CHECK (categoria IN ('Crianças','PréTeenTeen','AnãoAdultos','StaffFilhos','Removidos')),
 responsavel text NOT NULL DEFAULT '', tamanho text NOT NULL DEFAULT '',
 grupo text NOT NULL DEFAULT 'N/ Setado' CHECK (grupo IN ('Setado','N/ Setado','Removido')),
 discord_ped text NOT NULL DEFAULT '', passaporte_ped text NOT NULL DEFAULT '', arquivo text NOT NULL DEFAULT '',
 discord_responsavel text NOT NULL DEFAULT '', passaporte_responsavel text NOT NULL DEFAULT '',
 adicao text NOT NULL DEFAULT '', observacao text NOT NULL DEFAULT '', source_key text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peds TO authenticated;
GRANT ALL ON public.peds TO service_role;
ALTER TABLE public.peds ENABLE ROW LEVEL SECURITY;
CREATE POLICY peds_select ON public.peds FOR SELECT TO authenticated USING (public.can_access_peds(auth.uid()));
CREATE POLICY peds_insert ON public.peds FOR INSERT TO authenticated WITH CHECK (public.can_access_peds(auth.uid()));
CREATE POLICY peds_update ON public.peds FOR UPDATE TO authenticated USING (public.can_access_peds(auth.uid())) WITH CHECK (public.can_access_peds(auth.uid()));
CREATE POLICY peds_delete ON public.peds FOR DELETE TO authenticated USING (public.can_access_peds(auth.uid()));
CREATE INDEX peds_categoria_idx ON public.peds(categoria);
CREATE OR REPLACE FUNCTION public.update_peds_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER peds_updated_at BEFORE UPDATE ON public.peds FOR EACH ROW EXECUTE FUNCTION public.update_peds_updated_at();