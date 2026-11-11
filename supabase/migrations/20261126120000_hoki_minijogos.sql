-- Novos mini-games nas partidas da praça: desafios de 1 contra 1 (dama, ligue 4, pedra-papel-tesoura)
-- e as salas de festa (2 a 20 pessoas: reflexo e quiz).
ALTER TABLE public.hoshi_jogos DROP CONSTRAINT IF EXISTS hoshi_jogos_tipo_check;
ALTER TABLE public.hoshi_jogos ADD CONSTRAINT hoshi_jogos_tipo_check
  CHECK (tipo IN ('velha', 'cartas', 'dama', 'ligue4', 'ppt', 'festa'));
