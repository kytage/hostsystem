-- Peças exclusivas do usuário henrique: o conjunto Sombra (todo preto) e a aura prateada.
-- Não estão à venda: o preço é proibitivo e não são recompensa de nível. Só entram
-- nas peças de quem as recebe aqui.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES
  ('traje:sombra', 2000000000, NULL),
  ('efeito:aura-prata', 2000000000, NULL)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;

DO $$
BEGIN
  -- libera a troca das peças só dentro deste bloco (a trava normal só deixa mexer pelas funções)
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets
     SET itens = (
       SELECT coalesce(jsonb_agg(DISTINCT x), '[]'::jsonb)
         FROM jsonb_array_elements_text(
           coalesce(itens, '[]'::jsonb) || '["traje:sombra", "efeito:aura-prata"]'::jsonb
         ) AS x
     )
   WHERE lower(username) = 'henrique';
END $$;
