-- Reorganiza as áreas em 4 grupos: LEGAL, BASE PADRÃO (Ilegal x Polícia),
-- ENTRETENIMENTO e OPERAÇÃO. Idempotente.
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS grupo text;

-- "Peds e Kids" usa a chave 'kids' (é a que libera a página Peds); 'peds' é absorvida.
UPDATE public.user_areas ua SET area = 'kids'
WHERE ua.area = 'peds'
  AND NOT EXISTS (SELECT 1 FROM public.user_areas x WHERE x.user_id = ua.user_id AND x.area = 'kids');
-- 'restaurante' (duplicada) é absorvida por 'restaurantes'.
UPDATE public.user_areas ua SET area = 'restaurantes'
WHERE ua.area = 'restaurante'
  AND NOT EXISTS (SELECT 1 FROM public.user_areas x WHERE x.user_id = ua.user_id AND x.area = 'restaurantes');
DELETE FROM public.user_areas WHERE area IN ('peds', 'restaurante', 'id_pre_acess_free');
DELETE FROM public.areas WHERE key IN ('peds', 'restaurante', 'id_pre_acess_free');

INSERT INTO public.areas (key, label, emoji, ordem)
VALUES ('desenvolvimento', 'Desenvolvimento', '💻', 99)
ON CONFLICT (key) DO NOTHING;

UPDATE public.areas a
SET grupo = v.grupo, ordem = v.ordem, label = v.label, emoji = v.emoji
FROM (VALUES
  ('hospital',        'legal',          1,  'Hospital',        '🏥'),
  ('judiciario',      'legal',          2,  'Judiciário',      '⚖️'),
  ('mecanica',        'legal',          3,  'Mecânica',        '🔧'),
  ('restaurantes',    'legal',          4,  'Restaurantes',    '🍽️'),
  ('jornal',          'legal',          5,  'Jornal',          '📰'),
  ('creators',        'legal',          6,  'Creators',        '🎬'),
  ('kids',            'legal',          7,  'Peds e Kids',     '🧸'),
  ('ilegal',          'confronto',      8,  'Ilegal',          '💀'),
  ('policia',         'confronto',      9,  'Policia',         '👮'),
  ('eventos',         'entretenimento', 10, 'Eventos',         '🎉'),
  ('competitive',     'entretenimento', 11, 'Competitive',     '🏆'),
  ('var',             'operacao',       12, 'VAR',             '🎥'),
  ('cars',            'operacao',       13, 'Cars',            '🚗'),
  ('clotches',        'operacao',       14, 'Clotches',        '👕'),
  ('denuncias',       'operacao',       15, 'Denuncias',       '🚨'),
  ('financeiro',      'operacao',       16, 'Financeiro',      '💰'),
  ('marketing',       'operacao',       17, 'Marketing',       '📣'),
  ('staff',           'operacao',       18, 'Staff',           '🛡️'),
  ('desenvolvimento', 'operacao',       19, 'Desenvolvimento', '💻')
) AS v(key, grupo, ordem, label, emoji)
WHERE a.key = v.key;
