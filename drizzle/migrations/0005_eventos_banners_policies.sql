CREATE POLICY "Autenticados enviam banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'eventos-banners');
CREATE POLICY "Autenticados atualizam banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'eventos-banners');
CREATE INDEX IF NOT EXISTS eventos_gestao_data_idx ON public.eventos_gestao (data_evento DESC, horario);