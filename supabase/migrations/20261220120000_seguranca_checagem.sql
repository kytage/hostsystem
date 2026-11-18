-- Checagem de segurança (18/11/2026): fecha os buracos achados no banco.

-- 1) Staff Coins: só a conta do henrique entrega coins. A checagem era pelo NOME de usuário, e
--    qualquer um podia trocar o próprio nome para "Henrique" e passar. Agora é pelo ID da conta.
CREATE OR REPLACE FUNCTION public.hoshi_dar_coins(p_alvo uuid, p_qtd integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM '2073dce4-5157-48e4-a581-6695c9cece04'::uuid THEN
    RAISE EXCEPTION 'Apenas o henrique pode entregar Staff Coins.';
  END IF;
  IF p_qtd IS NULL OR p_qtd = 0 OR abs(p_qtd) > 100000 THEN
    RAISE EXCEPTION 'Quantidade inválida.';
  END IF;
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets SET coins = greatest(0, coins + p_qtd), updated_at = now()
    WHERE user_id = p_alvo RETURNING coins INTO v_saldo;
  IF v_saldo IS NULL THEN
    RAISE EXCEPTION 'Esse staff ainda não tem um HOSHI.';
  END IF;
  RETURN v_saldo;
END $function$;

-- 2) Perfil: cada um continua editando foto, banner, bio, status, Discord e ID HOST, mas não o
--    próprio nome de usuário (troca de nome é pelo painel de Usuários) nem a marcação de
--    "precisa trocar a senha".
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (avatar_url, banner_url, bio, status, discord_id, host_id, last_seen_at, updated_at)
  ON public.profiles TO authenticated;
-- nomes iguais com maiúsculas diferentes ("Henrique" x "henrique") não podem mais coexistir
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));

-- 3) Chat: o nome e a foto da mensagem vêm do perfil de quem enviou (não dá para assinar como outro).
CREATE OR REPLACE FUNCTION public.chat_autor_do_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
    SELECT p.username, coalesce(p.avatar_url, NEW.avatar_url)
      INTO NEW.username, NEW.avatar_url
      FROM public.profiles p WHERE p.id = auth.uid();
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.chat_autor_do_perfil() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS chat_autor_do_perfil ON public.chat_messages;
CREATE TRIGGER chat_autor_do_perfil BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_autor_do_perfil();

-- 4) Anotações de staff: o nome de quem escreveu vem do perfil.
CREATE OR REPLACE FUNCTION public.staff_anotacao_autor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.autor_id := auth.uid();
    NEW.autor_nome := (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid());
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.staff_anotacao_autor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS staff_anotacao_autor ON public.staff_anotacoes;
CREATE TRIGGER staff_anotacao_autor BEFORE INSERT ON public.staff_anotacoes
  FOR EACH ROW EXECUTE FUNCTION public.staff_anotacao_autor();

-- 5) Cartas do HOKI: só quem pode usar o HOKI (equipe ou visita convidada) envia.
DROP POLICY IF EXISTS "Enviar cartas" ON public.hoki_cartas;
CREATE POLICY "Enviar cartas" ON public.hoki_cartas FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_usar_hoki(auth.uid())
    AND ((tipo = 'direta') OR (tipo = 'direcao' AND public.is_coordinator_plus(auth.uid())))
  );

-- 6) Arquivos: banner de evento só é trocado por quem enviou ou Coordinator+; uploads com
--    limite de tamanho e só imagens comuns (SVG fica de fora: pode carregar script).
DROP POLICY IF EXISTS "Autenticados atualizam banners" ON storage.objects;
CREATE POLICY "Autenticados atualizam banners" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'eventos-banners' AND public.is_team_member(auth.uid())
         AND (owner_id = auth.uid()::text OR public.is_coordinator_plus(auth.uid())))
  WITH CHECK (bucket_id = 'eventos-banners' AND public.is_team_member(auth.uid()));
UPDATE storage.buckets
   SET file_size_limit = 10485760,
       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']
 WHERE id IN ('avatars', 'eventos-banners');

-- 7) Funções internas que não precisam ser chamadas por quem não está logado.
--    As de checagem continuam liberadas para quem está logado (as regras de acesso usam).
REVOKE EXECUTE ON FUNCTION public.can_access_captacoes(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_peds(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hoki_visitante(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_usar_hoki(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_captacoes(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_peds(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_hoki_visitante(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_usar_hoki(uuid) TO authenticated, service_role;
-- funções de gatilho: ninguém chama direto (o gatilho roda sem precisar desse acesso)
REVOKE EXECUTE ON FUNCTION public.hoki_carta_antes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hoshi_protege_coins() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ilegal_log_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tarefa_staff_coins() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
