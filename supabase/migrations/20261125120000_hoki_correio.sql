-- Correio da praça (cartão postal):
--   * carta da direção: só Coordinator+ escreve; vai para todos e cada um confirma a leitura;
--   * carta direta: para uma pessoa, assinada ou anônima, com uma flor/presente anexado (opcional).
-- Quem mandou fica guardado (de_user_id) mas nenhum usuário consegue ler essa coluna:
-- nas anônimas, o destinatário só vê "anônimo".
CREATE TABLE IF NOT EXISTS public.hoki_cartas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('direcao', 'direta')),
  de_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  de_nome text NOT NULL DEFAULT '',
  para_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT '' CHECK (char_length(titulo) <= 80),
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 1200),
  flor text NOT NULL DEFAULT '' CHECK (char_length(flor) <= 32),
  anonima boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tipo = 'direcao' AND para_user_id IS NULL) OR (tipo = 'direta' AND para_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hoki_cartas_para_idx ON public.hoki_cartas (para_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.hoki_cartas_lidas (
  carta_id uuid NOT NULL REFERENCES public.hoki_cartas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (carta_id, user_id)
);

-- quem manda é sempre quem está logado; o nome vem do perfil (vazio se for anônima);
-- carta da direção nunca é anônima
CREATE OR REPLACE FUNCTION public.hoki_carta_antes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.de_user_id := auth.uid();
  IF NEW.tipo = 'direcao' THEN
    NEW.anonima := false;
  END IF;
  IF NEW.para_user_id = NEW.de_user_id THEN
    RAISE EXCEPTION 'Não dá para mandar carta para você mesmo.';
  END IF;
  NEW.de_nome := CASE WHEN NEW.anonima THEN ''
    ELSE coalesce((SELECT username FROM public.profiles WHERE id = auth.uid()), '') END;
  NEW.created_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hoki_carta_antes ON public.hoki_cartas;
CREATE TRIGGER hoki_carta_antes BEFORE INSERT ON public.hoki_cartas
  FOR EACH ROW EXECUTE FUNCTION public.hoki_carta_antes();

ALTER TABLE public.hoki_cartas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoki_cartas_lidas ENABLE ROW LEVEL SECURITY;

-- leitura: as da direção para todos; as diretas só para quem recebeu
DROP POLICY IF EXISTS "Cartas da direção e as minhas" ON public.hoki_cartas;
CREATE POLICY "Cartas da direção e as minhas" ON public.hoki_cartas FOR SELECT TO authenticated
  USING (tipo = 'direcao' OR para_user_id = auth.uid());
-- envio: carta direta qualquer um; carta da direção só Coordinator+
DROP POLICY IF EXISTS "Enviar cartas" ON public.hoki_cartas;
CREATE POLICY "Enviar cartas" ON public.hoki_cartas FOR INSERT TO authenticated
  WITH CHECK (tipo = 'direta' OR (tipo = 'direcao' AND public.is_coordinator_plus(auth.uid())));

DROP POLICY IF EXISTS "Confirmar a minha leitura" ON public.hoki_cartas_lidas;
CREATE POLICY "Confirmar a minha leitura" ON public.hoki_cartas_lidas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Ver leituras" ON public.hoki_cartas_lidas;
CREATE POLICY "Ver leituras" ON public.hoki_cartas_lidas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator_plus(auth.uid()));

-- ninguém lê quem mandou (de_user_id): só as outras colunas
REVOKE ALL ON public.hoki_cartas FROM anon, authenticated;
GRANT SELECT (id, tipo, de_nome, para_user_id, titulo, texto, flor, anonima, created_at) ON public.hoki_cartas TO authenticated;
GRANT INSERT (tipo, para_user_id, titulo, texto, flor, anonima) ON public.hoki_cartas TO authenticated;
GRANT SELECT, INSERT ON public.hoki_cartas_lidas TO authenticated;
GRANT ALL ON public.hoki_cartas, public.hoki_cartas_lidas TO service_role;
