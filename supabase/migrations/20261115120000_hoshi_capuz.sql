-- HOSHI de capuz: recompensas por nível, catálogo adaptado e conferência das peças vestidas. Idempotente.
ALTER TABLE public.hoshi_loja ADD COLUMN IF NOT EXISTS nivel integer CHECK (nivel IS NULL OR nivel >= 1);
COMMENT ON COLUMN public.hoshi_loja.nivel IS 'Preenchido = recompensa gratuita ao atingir este nível; vazio = item de loja (ou básico, se o preço for 0).';

-- Preços e níveis: edite aqui (ou direto na tabela) para reconfigurar a loja.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES
  ('traje:hoshi', 0, NULL),
  ('traje:urso', 120, NULL),
  ('traje:gato', 120, NULL),
  ('traje:raposa', 160, NULL),
  ('traje:coelho', 0, 10),
  ('traje:panda', 0, 20),
  ('traje:original', 0, 30),
  ('traje:veterano', 0, 50),
  ('roupa:preta', 30, NULL),
  ('roupa:branca', 30, NULL),
  ('roupa:listrada', 50, NULL),
  ('roupa:orgulho', 60, NULL),
  ('roupa:ouro', 90, NULL),
  ('calca:preta', 20, NULL),
  ('calca:cinza', 20, NULL),
  ('calca:vermelha', 25, NULL),
  ('calca:jeans', 30, NULL),
  ('chapeu:bone-vermelho', 25, NULL),
  ('chapeu:bone-preto', 25, NULL),
  ('chapeu:bone-branco', 25, NULL),
  ('chapeu:festa', 40, NULL),
  ('chapeu:cartola', 60, NULL),
  ('chapeu:coroa', 150, NULL),
  ('chapeu:estrela', 0, 5),
  ('oculos:escuros', 30, NULL),
  ('oculos:visor', 80, NULL),
  ('luvas:fofas', 35, NULL),
  ('luvas:ouro', 70, NULL),
  ('calcado:botas', 35, NULL),
  ('calcado:tenis', 40, NULL),
  ('capa:vermelha', 50, NULL),
  ('capa:noite', 70, NULL),
  ('costas:mochila', 45, NULL),
  ('bandeira:host', 40, NULL),
  ('bandeira:orgulho', 40, NULL),
  ('bandeira:trans', 40, NULL),
  ('bandeira:brasil', 40, NULL),
  ('costas:asas', 0, 15),
  ('efeito:glitter', 60, NULL),
  ('efeito:glitter-rosa', 60, NULL),
  ('efeito:glitter-iris', 90, NULL),
  ('efeito:aureola', 70, NULL),
  ('efeito:aura-vermelha', 80, NULL),
  ('efeito:aura-ouro', 80, NULL),
  ('efeito:aura-iris', 120, NULL)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;

-- Nível do pet, pela mesma conta usada no site.
CREATE OR REPLACE FUNCTION public.hoshi_nivel(p_xp integer) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT least(99, 1 + floor(sqrt(greatest(0, p_xp) / 40.0))::integer) $$;

-- Coins e peças só mudam pelas funções; e ninguém veste peça que não tem.
CREATE OR REPLACE FUNCTION public.hoshi_protege_coins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text;
  v text;
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
  IF TG_OP = 'UPDATE' AND NEW.visual IS DISTINCT FROM OLD.visual AND jsonb_typeof(NEW.visual) = 'object' THEN
    FOREACH k IN ARRAY ARRAY['traje', 'roupa', 'calca', 'chapeu', 'oculos', 'luvas', 'calcado', 'costas', 'efeito'] LOOP
      v := NEW.visual ->> k;
      -- só confere ids no formato novo ("grupo:peca"); o formato da versão anterior do site passa direto
      IF v IS NOT NULL AND position(':' in v) > 0 AND NOT (NEW.itens ? v)
         AND NOT EXISTS (SELECT 1 FROM public.hoshi_loja WHERE item = v AND preco = 0 AND nivel IS NULL) THEN
        NEW.visual := jsonb_set(NEW.visual, ARRAY[k], coalesce(OLD.visual -> k, '""'::jsonb));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

-- Compra na loja: só itens de loja (os de nível são resgatados, não comprados).
CREATE OR REPLACE FUNCTION public.hoshi_comprar(p_item text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loja public.hoshi_loja%ROWTYPE;
  v_pet public.hoshi_pets%ROWTYPE;
BEGIN
  SELECT * INTO v_loja FROM public.hoshi_loja WHERE item = p_item;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Essa peça não existe na loja.';
  END IF;
  IF v_loja.nivel IS NOT NULL THEN
    RAISE EXCEPTION 'Essa peça é recompensa de nível e não pode ser comprada.';
  END IF;
  SELECT * INTO v_pet FROM public.hoshi_pets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOSHI.';
  END IF;
  IF v_pet.itens ? p_item THEN
    RETURN v_pet.coins;
  END IF;
  IF v_pet.coins < v_loja.preco THEN
    RAISE EXCEPTION 'Staff Coins insuficientes.';
  END IF;
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets SET coins = coins - v_loja.preco, itens = itens || to_jsonb(p_item), updated_at = now()
    WHERE user_id = auth.uid();
  RETURN v_pet.coins - v_loja.preco;
END $$;

-- Resgate de recompensa de nível: de graça, uma vez, e só com o nível exigido.
CREATE OR REPLACE FUNCTION public.hoshi_resgatar(p_item text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loja public.hoshi_loja%ROWTYPE;
  v_pet public.hoshi_pets%ROWTYPE;
BEGIN
  SELECT * INTO v_loja FROM public.hoshi_loja WHERE item = p_item;
  IF NOT FOUND OR v_loja.nivel IS NULL THEN
    RAISE EXCEPTION 'Essa peça não é uma recompensa de nível.';
  END IF;
  SELECT * INTO v_pet FROM public.hoshi_pets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOSHI.';
  END IF;
  IF v_pet.itens ? p_item THEN
    RETURN v_loja.nivel;
  END IF;
  IF public.hoshi_nivel(v_pet.xp) < v_loja.nivel THEN
    RAISE EXCEPTION 'Essa recompensa libera no nível %.', v_loja.nivel;
  END IF;
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets SET itens = itens || to_jsonb(p_item), updated_at = now() WHERE user_id = auth.uid();
  RETURN v_loja.nivel;
END $$;

REVOKE ALL ON FUNCTION public.hoshi_resgatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoshi_resgatar(text) TO authenticated;
