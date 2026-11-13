-- Looks e cosméticos novos do boneco (lojinha da HUD).
-- A compra continua pelo hoshi_comprar, que confere o preço nesta tabela.
-- Os looks grátis (traje:look-m-clean e traje:look-f-fofa) não entram aqui:
-- com preço 0 no código eles já vêm de graça para todo mundo.
-- As roupas dos times do HOST SIEGE (evento:time-vermelho e evento:time-azul) não são vendidas.
INSERT INTO public.hoshi_loja (item, preco, nivel) VALUES
  -- looks masculinos
  ('traje:look-m-street', 60, NULL),
  ('traje:look-m-surfista', 90, NULL),
  ('traje:look-m-lenhador', 120, NULL),
  ('traje:look-m-camuflado', 150, NULL),
  ('traje:look-m-neon', 200, NULL),
  -- looks femininos
  ('traje:look-f-jeans', 60, NULL),
  ('traje:look-f-marinheira', 90, NULL),
  ('traje:look-f-colegial', 120, NULL),
  ('traje:look-f-pastel', 150, NULL),
  ('traje:look-f-neon', 200, NULL),
  -- cabeça
  ('chapeu:laco-fofo', 60, NULL),
  ('chapeu:orelhas-gato', 70, NULL),
  ('chapeu:orelhas-urso', 70, NULL),
  ('chapeu:bone-host', 80, NULL),
  ('chapeu:gorro-inverno', 90, NULL),
  ('chapeu:gorro-natal', 120, NULL),
  ('chapeu:cowboy', 150, NULL),
  ('chapeu:pirata-capitao', 180, NULL),
  ('chapeu:aureola-anjo', 200, NULL),
  ('chapeu:capacete-viking', 250, NULL),
  -- costas
  ('costas:ursinho', 120, NULL),
  ('costas:asas-fada', 220, NULL),
  ('costas:asas-anjo', 300, NULL),
  -- efeitos
  ('efeito:coracoes-flutuando', 160, NULL)
ON CONFLICT (item) DO UPDATE SET preco = EXCLUDED.preco, nivel = EXCLUDED.nivel;
