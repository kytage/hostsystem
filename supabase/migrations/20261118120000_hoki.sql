-- HOKI: novo nome do mascote, nome do pet com até 6 letras e pódios como cosméticos. Idempotente.
-- (As tabelas continuam se chamando hoshi_*: trocar o nome delas quebraria quem está com o site aberto.)
ALTER TABLE public.hoshi_pets ALTER COLUMN nome SET DEFAULT 'Hoki';
-- Pets que nunca foram batizados (ainda com o nome padrão antigo) acompanham o novo nome do mascote.
UPDATE public.hoshi_pets SET nome = 'Hoki' WHERE nome = 'Hoshi';

-- Pódios: o de pedra é básico, os demais são da loja e o de cristal é recompensa do nível 25.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES
  ('podio:pedra', 0, NULL),
  ('podio:grama', 60, NULL),
  ('podio:nuvem', 120, NULL),
  ('podio:lava', 180, NULL),
  ('podio:campeao', 300, NULL),
  ('podio:cristal', 0, 25)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;

-- Mesma trava de antes (coins e peças só mudam pelas funções; ninguém veste o que não tem),
-- agora também para o espaço "podio" e com o nome limitado a 6 caracteres.
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
  -- o nome vira letreiro 3D: no máximo 6 caracteres (nomes antigos maiores ficam como estão até serem trocados)
  IF TG_OP = 'INSERT' OR NEW.nome IS DISTINCT FROM OLD.nome THEN
    NEW.nome := left(btrim(coalesce(NEW.nome, '')), 6);
    IF char_length(NEW.nome) < 2 THEN
      NEW.nome := CASE WHEN TG_OP = 'INSERT' THEN 'Hoki' ELSE OLD.nome END;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.visual IS DISTINCT FROM OLD.visual AND jsonb_typeof(NEW.visual) = 'object' THEN
    FOREACH k IN ARRAY ARRAY['traje', 'roupa', 'calca', 'chapeu', 'oculos', 'luvas', 'calcado', 'costas', 'efeito', 'podio'] LOOP
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
