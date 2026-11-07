-- Entradas do financeiro (apenas Founder)
CREATE TABLE public.financeiro_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,
  titulo text NOT NULL DEFAULT '',
  valor numeric(14,2) NOT NULL DEFAULT 0,
  observacao text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT '',
  criado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_entradas TO authenticated;
GRANT ALL ON public.financeiro_entradas TO service_role;
ALTER TABLE public.financeiro_entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder le entradas" ON public.financeiro_entradas
  FOR SELECT TO authenticated USING (public.is_founder(auth.uid()));
CREATE POLICY "Founder cria entradas" ON public.financeiro_entradas
  FOR INSERT TO authenticated WITH CHECK (public.is_founder(auth.uid()));
CREATE POLICY "Founder edita entradas" ON public.financeiro_entradas
  FOR UPDATE TO authenticated USING (public.is_founder(auth.uid())) WITH CHECK (public.is_founder(auth.uid()));
CREATE POLICY "Founder apaga entradas" ON public.financeiro_entradas
  FOR DELETE TO authenticated USING (public.is_founder(auth.uid()));

-- Saídas / despesas
CREATE TABLE public.financeiro_saidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,
  titulo text NOT NULL DEFAULT '',
  valor numeric(14,2) NOT NULL DEFAULT 0,
  data_pagamento date,
  tipo text NOT NULL DEFAULT 'variavel' CHECK (tipo IN ('fixa','variavel','contrato')),
  subtipo text NOT NULL DEFAULT 'outro' CHECK (subtipo IN ('staff','servico','outro')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','atrasado','pago','cancelado')),
  observacao text NOT NULL DEFAULT '',
  comprovante text NOT NULL DEFAULT '',
  recorrencia_pai uuid REFERENCES public.financeiro_saidas(id) ON DELETE SET NULL,
  criado_por text NOT NULL DEFAULT '',
  criado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financeiro_saidas_mes_idx ON public.financeiro_saidas (mes);
CREATE INDEX financeiro_entradas_mes_idx ON public.financeiro_entradas (mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_saidas TO authenticated;
GRANT ALL ON public.financeiro_saidas TO service_role;
ALTER TABLE public.financeiro_saidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder le saidas" ON public.financeiro_saidas
  FOR SELECT TO authenticated USING (public.is_founder(auth.uid()));
CREATE POLICY "Founder cria saidas" ON public.financeiro_saidas
  FOR INSERT TO authenticated WITH CHECK (public.is_founder(auth.uid()));
CREATE POLICY "Founder edita saidas" ON public.financeiro_saidas
  FOR UPDATE TO authenticated USING (public.is_founder(auth.uid())) WITH CHECK (public.is_founder(auth.uid()));
CREATE POLICY "Founder apaga saidas" ON public.financeiro_saidas
  FOR DELETE TO authenticated USING (public.is_founder(auth.uid()));

-- Configuração por mês: entrada prevista e saldo inicial
CREATE TABLE public.financeiro_meses (
  mes date PRIMARY KEY,
  entrada_prevista numeric(14,2) NOT NULL DEFAULT 0,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  observacao text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_meses TO authenticated;
GRANT ALL ON public.financeiro_meses TO service_role;
ALTER TABLE public.financeiro_meses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder le meses" ON public.financeiro_meses
  FOR SELECT TO authenticated USING (public.is_founder(auth.uid()));
CREATE POLICY "Founder cria meses" ON public.financeiro_meses
  FOR INSERT TO authenticated WITH CHECK (public.is_founder(auth.uid()));
CREATE POLICY "Founder edita meses" ON public.financeiro_meses
  FOR UPDATE TO authenticated USING (public.is_founder(auth.uid())) WITH CHECK (public.is_founder(auth.uid()));
CREATE POLICY "Founder apaga meses" ON public.financeiro_meses
  FOR DELETE TO authenticated USING (public.is_founder(auth.uid()));

-- updated_at automático
CREATE OR REPLACE FUNCTION public.update_financeiro_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER financeiro_entradas_updated_at BEFORE UPDATE ON public.financeiro_entradas
  FOR EACH ROW EXECUTE FUNCTION public.update_financeiro_updated_at();
CREATE TRIGGER financeiro_saidas_updated_at BEFORE UPDATE ON public.financeiro_saidas
  FOR EACH ROW EXECUTE FUNCTION public.update_financeiro_updated_at();
CREATE TRIGGER financeiro_meses_updated_at BEFORE UPDATE ON public.financeiro_meses
  FOR EACH ROW EXECUTE FUNCTION public.update_financeiro_updated_at();