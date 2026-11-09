-- Players do servidor (painel Info-Player). Escrita via webhook (service role) ou Founder.
CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license text NOT NULL UNIQUE,
  passaporte text,
  nome text NOT NULL DEFAULT '',
  idade integer,
  telefone text,
  banco numeric(16,2) NOT NULL DEFAULT 0,
  carteira numeric(16,2) NOT NULL DEFAULT 0,
  grupos text[] NOT NULL DEFAULT '{}',
  inventario jsonb NOT NULL DEFAULT '[]'::jsonb,
  veiculos text[] NOT NULL DEFAULT '{}',
  discord_id text,
  discord_nome text,
  online boolean NOT NULL DEFAULT false,
  ultimo_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_nome_idx ON public.players (lower(nome));
CREATE INDEX IF NOT EXISTS players_passaporte_idx ON public.players (passaporte);

-- Quem pode ver: Coordinator+ ou cargo liberado na categoria "players".
CREATE OR REPLACE FUNCTION public.can_view_players(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_coordinator_plus(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role = ur.role
        WHERE ur.user_id = _user_id AND rp.category = 'players'
      );
$$;
REVOKE ALL ON FUNCTION public.can_view_players(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_players(uuid) TO authenticated, service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe autorizada ve players" ON public.players;
CREATE POLICY "Equipe autorizada ve players" ON public.players FOR SELECT TO authenticated
  USING (public.can_view_players(auth.uid()));
DROP POLICY IF EXISTS "Founder gerencia players" ON public.players;
CREATE POLICY "Founder gerencia players" ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Exemplo inicial (painel Info-Player do Henrique).
INSERT INTO public.players (license, passaporte, nome, idade, telefone, banco, grupos, inventario, veiculos, discord_nome)
VALUES (
  '110000172b0d8b0', '1', 'Henrique Bonne', 25, '1', 17638061.00,
  ARRAY['Admin','Altura','Armas04','Att','Babytroller1','Babytroller2','Boss','Crew','Doors','FastFurious','Garagem08','Hoshi','Hospital','Imperio','Peds','Risadinha','Ultimate','Verify'],
  '[{"item":"cake-1793737046","qtd":1},{"item":"biotonico","qtd":5},{"item":"banana","qtd":1},
    {"item":"WEAPON_SPECIALCARBINE_MK2-1794018419","qtd":1},{"item":"doce3","qtd":1},{"item":"tablet-1793927807","qtd":1},
    {"item":"cellphone-1794023603","qtd":1},{"item":"WEAPON_RIFLE_AMMO","qtd":181},{"item":"pirulitosonic","qtd":8},
    {"item":"smarthost-1794018419","qtd":1},{"item":"radio-1794018419","qtd":1},{"item":"doce1","qtd":1},
    {"item":"probiotico","qtd":5},{"item":"doce1","qtd":1},{"item":"cellphone-1793415818","qtd":1}]'::jsonb,
  ARRAY['34rgttfurious','35rsilhouette','884walk','AddonStone','amoLBWK','carlton','dc_skullbike','gonzo_iq','havalh6','HTBLINDADOS006','HTHYPER001','HTHYPER009','ikx3_76521b','nagasaki','r31wagon','r34sb','segway5','soarerjzx','terbyte','tfa80','tfm140i','tfr32','tfrx7','TFs1000DD','tm09black','tunak','UP400x','UPBOOS004','UPBOOS005','UPBOOS008','UPCHARGERDOM','UPEVOSPIDER','UPhellLevi','UPHPIGX','UPveoz'],
  'Bonne'
)
ON CONFLICT (license) DO NOTHING;
