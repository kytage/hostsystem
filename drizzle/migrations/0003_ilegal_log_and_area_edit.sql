CREATE OR REPLACE FUNCTION public.can_edit_ilegal(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_coordinator_plus(_user_id) OR public.has_area(_user_id, 'ilegal')
$$;

CREATE TABLE public.ilegal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('INSERT','UPDATE','DELETE')),
  registro text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  campos text[] NOT NULL DEFAULT '{}',
  usuario text NOT NULL DEFAULT '',
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ilegal_log TO authenticated;
GRANT ALL ON public.ilegal_log TO service_role;
ALTER TABLE public.ilegal_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem ilegal_log" ON public.ilegal_log FOR SELECT TO authenticated USING (true);
CREATE INDEX ilegal_log_created_idx ON public.ilegal_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.ilegal_log_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r jsonb; o jsonb; nome text; reg text; cs text[] := '{}'; k text;
BEGIN
  IF TG_OP = 'DELETE' THEN r := to_jsonb(OLD); ELSE r := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    FOR k IN SELECT jsonb_object_keys(r) LOOP
      IF k NOT IN ('updated_at') AND (r->k) IS DISTINCT FROM (o->k) THEN cs := cs || k; END IF;
    END LOOP;
    IF array_length(cs,1) IS NULL THEN RETURN NEW; END IF;
  END IF;
  SELECT username INTO nome FROM public.profiles WHERE id = auth.uid();
  reg := COALESCE(
    NULLIF(r->>'setagem',''), NULLIF(r->>'organizacao',''), NULLIF(r->>'titulo',''),
    NULLIF(r->>'org_id',''), r->>'id', '');
  INSERT INTO public.ilegal_log (tabela, acao, registro, resumo, campos, usuario, usuario_id)
  VALUES (TG_TABLE_NAME, TG_OP, reg,
    COALESCE(NULLIF(r->>'organizacao',''), NULLIF(r->>'titulo',''), NULLIF(r->>'motivo',''), ''),
    cs, COALESCE(nome, 'sistema'), auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ilegal_log_orgs AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_orgs FOR EACH ROW EXECUTE FUNCTION public.ilegal_log_trigger();
CREATE TRIGGER ilegal_log_detalhes AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_detalhes FOR EACH ROW EXECUTE FUNCTION public.ilegal_log_trigger();
CREATE TRIGGER ilegal_log_coroas AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_coroas FOR EACH ROW EXECUTE FUNCTION public.ilegal_log_trigger();
CREATE TRIGGER ilegal_log_cronograma AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_cronograma FOR EACH ROW EXECUTE FUNCTION public.ilegal_log_trigger();
CREATE TRIGGER ilegal_log_avisos AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_avisos FOR EACH ROW EXECUTE FUNCTION public.ilegal_log_trigger();
CREATE TRIGGER ilegal_log_anotacoes AFTER INSERT OR UPDATE OR DELETE ON public.ilegal_anotacoes FOR EACH ROW EXECUTE FUNCTION public.ilegal_log_trigger();