ALTER TABLE public.tarefas_particulares
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'tarefa',
  ADD COLUMN IF NOT EXISTS reuniao_at timestamptz,
  ADD COLUMN IF NOT EXISTS reuniao_confirmada boolean NOT NULL DEFAULT false;

ALTER TABLE public.tarefas_particulares
  DROP CONSTRAINT IF EXISTS tarefas_particulares_tipo_check;

ALTER TABLE public.tarefas_particulares
  ADD CONSTRAINT tarefas_particulares_tipo_check CHECK (tipo IN ('tarefa','reuniao'));

CREATE INDEX IF NOT EXISTS tarefas_particulares_reuniao_at_idx
  ON public.tarefas_particulares (user_id, reuniao_at)
  WHERE tipo = 'reuniao';