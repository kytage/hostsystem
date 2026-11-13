-- Cosméticos do boneco novo (13/11/2026): coroa de glitter (1000 coins) e capa preta de glitter (500 coins).
-- A compra continua pelo hoshi_comprar, que confere o preço nesta tabela.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES
  ('chapeu:coroa-glitter', 1000, NULL),
  ('costas:capa-glitter', 500, NULL)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;

-- VIP BLACK (traje completo: látex preto, viseira laranja neon e rastro de faíscas laranja ao andar): 2500 coins.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES ('traje:vip-black', 2500, NULL)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;
