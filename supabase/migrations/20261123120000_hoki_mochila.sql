-- Mochila do HOKI (itens de comida e bebida, por quantidade) e as colheitas da fazenda
-- (quando cada canteiro foi colhido pela última vez, para saber quando nasce de novo).
-- Todo mundo começa com um lanche: 3 maçãs e 3 águas.
ALTER TABLE public.hoshi_pets
  ADD COLUMN IF NOT EXISTS inventario jsonb NOT NULL DEFAULT '{"maca": 3, "agua": 3}'::jsonb,
  ADD COLUMN IF NOT EXISTS colheitas jsonb NOT NULL DEFAULT '{}'::jsonb;
