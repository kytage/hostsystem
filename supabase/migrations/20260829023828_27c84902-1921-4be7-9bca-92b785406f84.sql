CREATE TABLE public.set_online_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  webhook text NOT NULL,
  category text NOT NULL,
  set_name text NOT NULL,
  set_label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  hour smallint NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_set_online_log_webhook_captured ON public.set_online_log (webhook, captured_at);

GRANT SELECT ON public.set_online_log TO authenticated;
GRANT ALL ON public.set_online_log TO service_role;

ALTER TABLE public.set_online_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ler set_online_log"
ON public.set_online_log
FOR SELECT
TO authenticated
USING (true);