-- O HOKI não tem mais nível próprio: o único nível é o do HOST FAZENDAS.
-- As recompensas "por nível" da loja passam a conferir o nível da fazenda
-- (fazenda_jogadores.nivel; quem ainda não criou a ilha está no nível 1).
CREATE OR REPLACE FUNCTION public.hoshi_resgatar(p_item text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loja public.hoshi_loja%ROWTYPE;
  v_pet public.hoshi_pets%ROWTYPE;
  v_nivel integer;
BEGIN
  SELECT * INTO v_loja FROM public.hoshi_loja WHERE item = p_item;
  IF NOT FOUND OR v_loja.nivel IS NULL THEN
    RAISE EXCEPTION 'Essa peça não é uma recompensa de nível.';
  END IF;
  SELECT * INTO v_pet FROM public.hoshi_pets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você ainda não tem um HOSHI.';
  END IF;
  IF v_pet.itens ? p_item THEN
    RETURN v_loja.nivel;
  END IF;
  SELECT j.nivel INTO v_nivel FROM public.fazenda_jogadores j WHERE j.user_id = auth.uid();
  IF COALESCE(v_nivel, 1) < v_loja.nivel THEN
    RAISE EXCEPTION 'Essa recompensa libera no nível % do HOST FAZENDAS.', v_loja.nivel;
  END IF;
  PERFORM set_config('hoshi.rpc', '1', true);
  UPDATE public.hoshi_pets SET itens = itens || to_jsonb(p_item), updated_at = now() WHERE user_id = auth.uid();
  RETURN v_loja.nivel;
END $$;
