CREATE TABLE public.avisos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  texto text NOT NULL DEFAULT ''::text,
  criado_por text NOT NULL DEFAULT ''::text,
  criado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.avisos TO authenticated;
GRANT ALL ON public.avisos TO service_role;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada ve avisos" ON public.avisos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinator+ cria avisos" ON public.avisos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'direcao') OR has_role(auth.uid(), 'c_level') OR has_role(auth.uid(), 'founder'));
CREATE POLICY "Coordinator+ exclui avisos" ON public.avisos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'direcao') OR has_role(auth.uid(), 'c_level') OR has_role(auth.uid(), 'founder'));

CREATE TABLE public.aviso_confirmacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT ''::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.aviso_confirmacoes TO authenticated;
GRANT ALL ON public.aviso_confirmacoes TO service_role;
ALTER TABLE public.aviso_confirmacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada ve confirmacoes" ON public.aviso_confirmacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario confirma aviso" ON public.aviso_confirmacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario remove propria confirmacao" ON public.aviso_confirmacoes FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aviso_confirmacoes;