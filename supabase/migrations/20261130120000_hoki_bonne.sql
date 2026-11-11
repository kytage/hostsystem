-- Novas peças exclusivas do usuário henrique: o ped "Bonne" (o corpo inteiro é outro
-- modelo 3D) e as asas de aço com fogo dourado. Como as outras exclusivas, não estão
-- à venda (preço proibitivo, sem recompensa de nível) e só entram nas peças dele.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES
  ('traje:bonne', 2000000000, NULL),
  ('costas:asas-aco', 2000000000, NULL)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;

DO $$
BEGIN
  -- libera a troca das peças só dentro deste bloco (a trava normal só deixa mexer pelas funções)
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets
     SET itens = (
       SELECT coalesce(jsonb_agg(DISTINCT x), '[]'::jsonb)
         FROM jsonb_array_elements_text(
           coalesce(itens, '[]'::jsonb) || '["traje:bonne", "costas:asas-aco"]'::jsonb
         ) AS x
     )
   WHERE lower(username) = 'henrique';
END $$;
