-- Pet HOSHI de cada staff (tela inicial): cuidados, nível e ranking. Idempotente.
CREATE TABLE IF NOT EXISTS public.hoshi_pets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT 'Hoshi',
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  fome integer NOT NULL DEFAULT 70 CHECK (fome BETWEEN 0 AND 100),
  sede integer NOT NULL DEFAULT 70 CHECK (sede BETWEEN 0 AND 100),
  energia integer NOT NULL DEFAULT 80 CHECK (energia BETWEEN 0 AND 100),
  carinho integer NOT NULL DEFAULT 70 CHECK (carinho BETWEEN 0 AND 100),
  recorde_petiscos integer NOT NULL DEFAULT 0,
  recorde_reflexo integer NOT NULL DEFAULT 0,
  -- Momento em que as barras acima foram calculadas; o desgaste é contado a partir dele.
  cuidado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hoshi_pets ENABLE ROW LEVEL SECURITY;
-- A equipe toda vê (ranking); cada um só cria e altera o próprio pet.
DROP POLICY IF EXISTS "Equipe ve os pets" ON public.hoshi_pets;
CREATE POLICY "Equipe ve os pets" ON public.hoshi_pets FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Cada um cria o proprio pet" ON public.hoshi_pets;
CREATE POLICY "Cada um cria o proprio pet" ON public.hoshi_pets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Cada um cuida do proprio pet" ON public.hoshi_pets;
CREATE POLICY "Cada um cuida do proprio pet" ON public.hoshi_pets FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hoshi_pets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
