UPDATE public.punicoes SET userset_sub = 'Muni05' WHERE userset_sub = 'Armas05';
UPDATE public.ilegal_coroas SET setagem = 'Muni05' WHERE setagem = 'Armas05';
UPDATE public.ilegal_cronograma SET setagem = 'Muni05' WHERE setagem = 'Armas05';
UPDATE public.set_online_log SET set_name = 'Muni05', set_label = 'Muni05' WHERE set_name = 'Armas05';
UPDATE public.ilegal_orgs SET organizacao = '', status = 'Livre', situacao = '.', observacao = '', grupo = '', updated_at = now() WHERE id = 'a5';