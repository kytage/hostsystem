-- O queridômetro é só da equipe: visitas do HOKI não leem o quadro nem entregam emojis.
-- (A migração das visitas tinha liberado a leitura para elas; aqui volta a ser só da equipe,
-- e a entrega passa a exigir ser da equipe, o que antes não era conferido.)
DROP POLICY IF EXISTS "Equipe ve o quadro do termometro" ON public.termometro_votos;
CREATE POLICY "Equipe ve o quadro do termometro" ON public.termometro_votos
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Usuario vota uma vez por dia" ON public.termometro_votos;
CREATE POLICY "Usuario vota uma vez por dia" ON public.termometro_votos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = de_user_id AND public.is_team_member(auth.uid()));
