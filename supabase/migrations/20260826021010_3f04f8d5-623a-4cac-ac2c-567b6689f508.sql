-- Chat geral
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text NOT NULL DEFAULT '',
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le mensagens do chat" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario envia suas mensagens" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Perfil estilo Discord: bio + status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'online';

-- Termômetro diário de emojis (votos anônimos no quadro)
CREATE TABLE public.termometro_votos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  para_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  para_username text NOT NULL DEFAULT '',
  emoji text NOT NULL,
  dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (de_user_id, para_user_id, dia)
);
GRANT SELECT, INSERT ON public.termometro_votos TO authenticated;
GRANT ALL ON public.termometro_votos TO service_role;
ALTER TABLE public.termometro_votos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe ve o quadro do termometro" ON public.termometro_votos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario vota uma vez por dia" ON public.termometro_votos FOR INSERT TO authenticated WITH CHECK (auth.uid() = de_user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.termometro_votos;