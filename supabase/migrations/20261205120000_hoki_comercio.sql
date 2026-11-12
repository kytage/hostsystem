-- Comércio do lobby do HOKI: mercado entre jogadores. Idempotente.
-- Quem vende anuncia itens da mochila por um preço em Staff Coins: os itens saem da mochila
-- e ficam guardados no anúncio até alguém comprar (ou a pessoa retirar). Quem compra paga e
-- recebe os itens na mochila; as moedas vão para quem vendeu. Ninguém cria moeda nova: elas
-- só passam de um para outro. Ninguém escreve direto na tabela; tudo passa pelas funções
-- abaixo, cada uma numa transação só.

CREATE TABLE IF NOT EXISTS public.hoki_comercio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item text NOT NULL CHECK (item ~ '^[a-z]{2,24}$'),
  quantidade integer NOT NULL CHECK (quantidade BETWEEN 1 AND 99),
  -- preço do lote inteiro, em Staff Coins
  preco integer NOT NULL CHECK (preco BETWEEN 1 AND 9999),
  criado_em timestamptz NOT NULL DEFAULT now(),
  comprador uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vendido_em timestamptz,
  cancelado_em timestamptz
);
CREATE INDEX IF NOT EXISTS hoki_comercio_abertos ON public.hoki_comercio (criado_em DESC)
  WHERE vendido_em IS NULL AND cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS hoki_comercio_vendedor ON public.hoki_comercio (vendedor, criado_em DESC);

ALTER TABLE public.hoki_comercio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comercio: quem usa o HOKI ve os anuncios" ON public.hoki_comercio;
CREATE POLICY "Comercio: quem usa o HOKI ve os anuncios" ON public.hoki_comercio
  FOR SELECT TO authenticated USING (public.pode_usar_hoki(auth.uid()));

-- Soma (ou tira, com número negativo) unidades de um item na mochila; some a chave quando zera.
CREATE OR REPLACE FUNCTION public.hoki_inventario_somar(p_inv jsonb, p_item text, p_n integer)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH base AS (
    SELECT COALESCE(p_inv, '{}'::jsonb) AS inv,
           CASE WHEN jsonb_typeof(p_inv -> p_item) = 'number'
                THEN (p_inv ->> p_item)::numeric ELSE 0 END + p_n AS total
  )
  SELECT CASE WHEN total <= 0 THEN inv - p_item
              ELSE jsonb_set(inv, ARRAY[p_item], to_jsonb(total)) END
    FROM base
$$;
REVOKE ALL ON FUNCTION public.hoki_inventario_somar(jsonb, text, integer) FROM PUBLIC, anon, authenticated;

-- Anunciar: tira os itens da mochila e cria o anúncio (no máximo 10 abertos por pessoa).
CREATE OR REPLACE FUNCTION public.hoki_comercio_anunciar(p_item text, p_qtd integer, p_preco integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pet public.hoshi_pets%ROWTYPE;
  v_tem numeric;
  v_abertos integer;
  v_id uuid;
BEGIN
  IF v_user IS NULL OR NOT public.pode_usar_hoki(v_user) THEN
    RAISE EXCEPTION 'Sem acesso ao HOKI.';
  END IF;
  IF p_item IS NULL OR p_item !~ '^[a-z]{2,24}$' THEN
    RAISE EXCEPTION 'Item inválido.';
  END IF;
  IF p_qtd IS NULL OR p_qtd < 1 OR p_qtd > 99 THEN
    RAISE EXCEPTION 'Quantidade inválida (de 1 a 99).';
  END IF;
  IF p_preco IS NULL OR p_preco < 1 OR p_preco > 9999 THEN
    RAISE EXCEPTION 'Preço inválido (de 1 a 9999 Staff Coins).';
  END IF;
  SELECT * INTO v_pet FROM public.hoshi_pets WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOKI.';
  END IF;
  SELECT count(*) INTO v_abertos FROM public.hoki_comercio
   WHERE vendedor = v_user AND vendido_em IS NULL AND cancelado_em IS NULL;
  IF v_abertos >= 10 THEN
    RAISE EXCEPTION 'Você já tem 10 anúncios no Comércio. Espere vender ou retire um.';
  END IF;
  v_tem := CASE WHEN jsonb_typeof(v_pet.inventario -> p_item) = 'number'
                THEN (v_pet.inventario ->> p_item)::numeric ELSE 0 END;
  IF v_tem < p_qtd THEN
    RAISE EXCEPTION 'Você não tem tudo isso na mochila.';
  END IF;
  UPDATE public.hoshi_pets
     SET inventario = public.hoki_inventario_somar(inventario, p_item, -p_qtd), updated_at = now()
   WHERE user_id = v_user
  RETURNING * INTO v_pet;
  INSERT INTO public.hoki_comercio (vendedor, item, quantidade, preco)
  VALUES (v_user, p_item, p_qtd, p_preco)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'inventario', v_pet.inventario, 'coins', v_pet.coins);
END $$;

-- Retirar um anúncio: os itens voltam para a mochila de quem anunciou.
CREATE OR REPLACE FUNCTION public.hoki_comercio_cancelar(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_a public.hoki_comercio%ROWTYPE;
  v_pet public.hoshi_pets%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.hoki_comercio WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_a.vendedor IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Anúncio não encontrado.';
  END IF;
  IF v_a.vendido_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esse anúncio já foi vendido.';
  END IF;
  IF v_a.cancelado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esse anúncio já foi retirado.';
  END IF;
  UPDATE public.hoshi_pets
     SET inventario = public.hoki_inventario_somar(inventario, v_a.item, v_a.quantidade),
         updated_at = now()
   WHERE user_id = v_user
  RETURNING * INTO v_pet;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOKI.';
  END IF;
  UPDATE public.hoki_comercio SET cancelado_em = now() WHERE id = p_id;
  RETURN jsonb_build_object('inventario', v_pet.inventario, 'coins', v_pet.coins);
END $$;

-- Comprar: confere o saldo, passa as moedas para quem vendeu e os itens para a mochila de quem
-- comprou, e fecha o anúncio. Um anúncio só é vendido uma vez (trava a linha).
CREATE OR REPLACE FUNCTION public.hoki_comercio_comprar(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_a public.hoki_comercio%ROWTYPE;
  v_pet public.hoshi_pets%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.pode_usar_hoki(v_user) THEN
    RAISE EXCEPTION 'Sem acesso ao HOKI.';
  END IF;
  SELECT * INTO v_a FROM public.hoki_comercio WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_a.cancelado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esse anúncio não está mais à venda.';
  END IF;
  IF v_a.vendido_em IS NOT NULL THEN
    RAISE EXCEPTION 'Alguém comprou antes de você.';
  END IF;
  IF v_a.vendedor = v_user THEN
    RAISE EXCEPTION 'Esse anúncio é seu.';
  END IF;
  -- trava os dois HOKIs sempre na mesma ordem (duas compras cruzadas não se travam)
  PERFORM 1 FROM public.hoshi_pets WHERE user_id IN (v_user, v_a.vendedor) ORDER BY user_id FOR UPDATE;
  SELECT * INTO v_pet FROM public.hoshi_pets WHERE user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOKI.';
  END IF;
  IF v_pet.coins < v_a.preco THEN
    RAISE EXCEPTION 'Staff Coins insuficientes.';
  END IF;
  PERFORM 1 FROM public.hoshi_pets WHERE user_id = v_a.vendedor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quem anunciou não tem mais um HOKI.';
  END IF;
  -- as moedas só mudam com esta chave ligada (trava hoshi_protege_coins)
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets
     SET coins = coins - v_a.preco,
         inventario = public.hoki_inventario_somar(inventario, v_a.item, v_a.quantidade),
         updated_at = now()
   WHERE user_id = v_user
  RETURNING * INTO v_pet;
  UPDATE public.hoshi_pets SET coins = coins + v_a.preco, updated_at = now()
   WHERE user_id = v_a.vendedor;
  UPDATE public.hoki_comercio SET vendido_em = now(), comprador = v_user WHERE id = p_id;
  RETURN jsonb_build_object(
    'inventario', v_pet.inventario,
    'coins', v_pet.coins,
    'vendedor', v_a.vendedor,
    'item', v_a.item,
    'quantidade', v_a.quantidade,
    'preco', v_a.preco
  );
END $$;

REVOKE ALL ON FUNCTION public.hoki_comercio_anunciar(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hoki_comercio_cancelar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hoki_comercio_comprar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoki_comercio_anunciar(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hoki_comercio_cancelar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hoki_comercio_comprar(uuid) TO authenticated;

-- anúncios novos, vendidos e retirados aparecem na hora para todo mundo
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hoki_comercio;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
