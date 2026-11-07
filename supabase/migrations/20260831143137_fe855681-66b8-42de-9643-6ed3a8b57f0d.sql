CREATE TABLE public.casting (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  host_id text NOT NULL DEFAULT '',
  discord_id text NOT NULL DEFAULT '',
  obs text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.casting TO authenticated;
GRANT ALL ON public.casting TO service_role;

ALTER TABLE public.casting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casting_select" ON public.casting FOR SELECT TO authenticated USING (true);
CREATE POLICY "casting_insert" ON public.casting FOR INSERT TO authenticated WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "casting_update" ON public.casting FOR UPDATE TO authenticated USING (public.is_coordinator_plus(auth.uid())) WITH CHECK (public.is_coordinator_plus(auth.uid()));
CREATE POLICY "casting_delete" ON public.casting FOR DELETE TO authenticated USING (public.is_coordinator_plus(auth.uid()));

CREATE TRIGGER trg_casting_updated_at BEFORE UPDATE ON public.casting
FOR EACH ROW EXECUTE FUNCTION public.update_kanban_cards_updated_at();