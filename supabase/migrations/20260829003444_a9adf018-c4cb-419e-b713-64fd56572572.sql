ALTER TABLE public.punicoes
  ADD COLUMN IF NOT EXISTS ticket_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS userset text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS userset_sub text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dias integer,
  ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS punicoes_userset_sub_idx ON public.punicoes (userset_sub);
CREATE INDEX IF NOT EXISTS punicoes_ticket_idx ON public.punicoes (ticket_id);