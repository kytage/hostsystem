CREATE OR REPLACE FUNCTION public.ilegal_transferir_org(_origem text, _destino text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.ilegal_orgs; d public.ilegal_orgs; od public.ilegal_detalhes; agora timestamptz := now();
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_edit_ilegal(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para transferir';
  END IF;
  IF _origem = _destino THEN RAISE EXCEPTION 'Origem e destino iguais'; END IF;
  SELECT * INTO o FROM public.ilegal_orgs WHERE id = _origem FOR UPDATE;
  SELECT * INTO d FROM public.ilegal_orgs WHERE id = _destino FOR UPDATE;
  IF o.id IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'Setagem não encontrada'; END IF;

  UPDATE public.ilegal_orgs SET organizacao = o.organizacao, status = o.status,
    situacao = o.situacao, observacao = o.observacao, limpo_em = o.limpo_em,
    limpo_por = o.limpo_por, updated_at = agora WHERE id = d.id;
  UPDATE public.ilegal_orgs SET organizacao = '', status = 'Livre', situacao = '.',
    observacao = '', limpo_em = agora, limpo_por = 'transferência', updated_at = agora WHERE id = o.id;

  SELECT * INTO od FROM public.ilegal_detalhes WHERE org_id = o.id;
  IF od.org_id IS NOT NULL THEN
    INSERT INTO public.ilegal_detalhes (org_id, logo, nome1, telefone1, nome2, telefone2, nome3, telefone3,
      cds_bau_lider, cds_bau_membro, cds_craft, cds_shop, cds_rota, garagem_blip, garagem_spawn,
      uniforme, cor_veiculo, cds_blip_desmanche, anotacoes_sobre, vips, vip_config)
    VALUES (d.id, od.logo, od.nome1, od.telefone1, od.nome2, od.telefone2, od.nome3, od.telefone3,
      od.cds_bau_lider, od.cds_bau_membro, od.cds_craft, od.cds_shop, od.cds_rota, od.garagem_blip, od.garagem_spawn,
      od.uniforme, od.cor_veiculo, od.cds_blip_desmanche, od.anotacoes_sobre, od.vips, od.vip_config)
    ON CONFLICT (org_id) DO UPDATE SET logo = EXCLUDED.logo, nome1 = EXCLUDED.nome1, telefone1 = EXCLUDED.telefone1,
      nome2 = EXCLUDED.nome2, telefone2 = EXCLUDED.telefone2, nome3 = EXCLUDED.nome3, telefone3 = EXCLUDED.telefone3,
      cds_bau_lider = EXCLUDED.cds_bau_lider, cds_bau_membro = EXCLUDED.cds_bau_membro, cds_craft = EXCLUDED.cds_craft,
      cds_shop = EXCLUDED.cds_shop, cds_rota = EXCLUDED.cds_rota, garagem_blip = EXCLUDED.garagem_blip,
      garagem_spawn = EXCLUDED.garagem_spawn, cds_blip_desmanche = EXCLUDED.cds_blip_desmanche,
      uniforme = EXCLUDED.uniforme, cor_veiculo = EXCLUDED.cor_veiculo, anotacoes_sobre = EXCLUDED.anotacoes_sobre,
      vips = EXCLUDED.vips, vip_config = EXCLUDED.vip_config, updated_at = agora;
    UPDATE public.ilegal_detalhes SET logo = '', nome1 = '', telefone1 = '', nome2 = '', telefone2 = '',
      nome3 = '', telefone3 = '', uniforme = '', cor_veiculo = '', anotacoes_sobre = '', vips = '[]'::jsonb,
      vip_config = '{}'::jsonb, updated_at = agora WHERE org_id = o.id;
  END IF;

  IF o.setagem <> '' AND d.setagem <> '' THEN
    UPDATE public.punicoes SET userset_sub = d.setagem WHERE userset = 'ilegal' AND userset_sub = o.setagem;
    UPDATE public.ilegal_coroas SET setagem = d.setagem, organizacao = o.organizacao WHERE setagem = o.setagem;
    UPDATE public.ilegal_cronograma SET setagem = d.setagem WHERE setagem = o.setagem;
    PERFORM public.ilegal_trocar_historico_online(o.setagem, d.setagem, agora);
  END IF;
END $function$;