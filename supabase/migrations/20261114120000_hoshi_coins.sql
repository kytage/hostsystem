-- Staff Coins e loja do HOSHI. Idempotente.
ALTER TABLE public.hoshi_pets ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0);
ALTER TABLE public.hoshi_pets ADD COLUMN IF NOT EXISTS itens jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Preço de cada peça: é esta tabela que vale na hora da compra.
CREATE TABLE IF NOT EXISTS public.hoshi_loja (
  item text PRIMARY KEY,
  preco integer NOT NULL CHECK (preco >= 0)
);
ALTER TABLE public.hoshi_loja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe ve a loja" ON public.hoshi_loja;
CREATE POLICY "Equipe ve a loja" ON public.hoshi_loja FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));

INSERT INTO public.hoshi_loja (item, preco) VALUES
  ('roupa:host', 0),
  ('roupa:nenhuma', 0),
  ('roupa:preta', 30),
  ('roupa:branca', 30),
  ('roupa:listrada', 50),
  ('roupa:orgulho', 60),
  ('roupa:ouro', 90),
  ('calca:nenhuma', 0),
  ('calca:preta', 20),
  ('calca:cinza', 20),
  ('calca:vermelha', 25),
  ('calca:jeans', 30),
  ('chapeu:nenhum', 0),
  ('chapeu:bone-vermelho', 25),
  ('chapeu:bone-preto', 25),
  ('chapeu:bone-branco', 25),
  ('chapeu:festa', 40),
  ('chapeu:cartola', 60),
  ('chapeu:coroa', 150),
  ('oculos:nenhum', 0),
  ('oculos:escuros', 30),
  ('oculos:visor', 80),
  ('capa:nenhuma', 0),
  ('capa:vermelha', 50),
  ('capa:noite', 70),
  ('bandeira:nenhuma', 0),
  ('bandeira:host', 40),
  ('bandeira:orgulho', 40),
  ('bandeira:trans', 40),
  ('bandeira:brasil', 40),
  ('efeito:nenhum', 0),
  ('efeito:glitter', 60),
  ('efeito:glitter-rosa', 60),
  ('efeito:glitter-iris', 90),
  ('efeito:aureola', 70),
  ('efeito:aura-vermelha', 80),
  ('efeito:aura-ouro', 80),
  ('efeito:aura-iris', 120)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco;

-- Coins e peças compradas não podem ser alterados direto pela tela:
-- só pelas funções abaixo, que ligam a chave "hoshi.rpc" durante a transação.
CREATE OR REPLACE FUNCTION public.hoshi_protege_coins() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('hoshi.rpc', true), '') <> '1' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.coins := 0;
      NEW.itens := '[]'::jsonb;
    ELSE
      NEW.coins := OLD.coins;
      NEW.itens := OLD.itens;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hoshi_protege_coins ON public.hoshi_pets;
CREATE TRIGGER hoshi_protege_coins BEFORE INSERT OR UPDATE ON public.hoshi_pets
  FOR EACH ROW EXECUTE FUNCTION public.hoshi_protege_coins();

-- Entrega de coins: somente o usuário "henrique".
CREATE OR REPLACE FUNCTION public.hoshi_dar_coins(p_alvo uuid, p_qtd integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_saldo integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(username) = 'henrique') THEN
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
END $$;

-- Compra na loja: desconta o preço do banco e guarda a peça.
CREATE OR REPLACE FUNCTION public.hoshi_comprar(p_item text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_preco integer;
  v_pet public.hoshi_pets%ROWTYPE;
BEGIN
  SELECT preco INTO v_preco FROM public.hoshi_loja WHERE item = p_item;
  IF v_preco IS NULL THEN
    RAISE EXCEPTION 'Essa peça não existe na loja.';
  END IF;
  SELECT * INTO v_pet FROM public.hoshi_pets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOSHI.';
  END IF;
  IF v_pet.itens ? p_item THEN
    RETURN v_pet.coins;
  END IF;
  IF v_pet.coins < v_preco THEN
    RAISE EXCEPTION 'Staff Coins insuficientes.';
  END IF;
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets SET coins = coins - v_preco, itens = itens || to_jsonb(p_item), updated_at = now()
    WHERE user_id = auth.uid();
  RETURN v_pet.coins - v_preco;
END $$;

REVOKE ALL ON FUNCTION public.hoshi_dar_coins(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hoshi_comprar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoshi_dar_coins(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hoshi_comprar(text) TO authenticated;
