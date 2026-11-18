/**
 * Quem pode ver as logs do servidor (tela /logs). Uma regra só, usada pelo menu, pela tela e,
 * do mesmo jeito, pelo banco (public.pode_ver_logs nas políticas de public.server_logs):
 *
 * - Coordinator e acima veem todas as categorias e editam quem mais pode ver cada uma;
 * - os outros veem uma categoria se o cargo ou uma das áreas estiver liberado nela
 *   (public.server_log_permissoes; as facções do "Host - Ilegal" já vêm liberadas para a área Ilegal).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyAreas, useMyRole } from "@/lib/permissions";
import { isCoordinatorPlus } from "@/lib/permissoes-regras";
import type { AppRole } from "@/lib/roles";

export interface PermissaoDeLog {
  categoria: string;
  cargos: string[];
  areas: string[];
}

export const CHAVE_PERMISSOES_LOGS = ["server-log-permissoes"];

/** As liberações de cada categoria (quem, além de Coordinator+, pode ver). */
export function usePermissoesDeLogs(ativo = true) {
  return useQuery({
    queryKey: CHAVE_PERMISSOES_LOGS,
    queryFn: async (): Promise<PermissaoDeLog[]> => {
      const { data, error } = await supabase
        .from("server_log_permissoes")
        .select("categoria, cargos, areas");
      // (tabela ainda não criada no banco: ninguém além de Coordinator+ vê)
      if (error) return [];
      return (data ?? []) as PermissaoDeLog[];
    },
    enabled: ativo,
    staleTime: 30_000,
  });
}

/** A regra em si: este cargo, com estas áreas, vê esta categoria? */
export function podeVerCategoria(
  role: AppRole | undefined,
  areas: string[],
  permissao: PermissaoDeLog | undefined,
) {
  if (isCoordinatorPlus(role)) return true;
  if (!permissao) return false;
  return (
    (!!role && permissao.cargos.includes(role)) || areas.some((a) => permissao.areas.includes(a))
  );
}

/** O acesso do usuário logado às logs. */
export function useAcessoLogs() {
  const { data: role, isLoading: carregandoCargo } = useMyRole();
  const { data: areas = [], isLoading: carregandoAreas } = useMyAreas();
  const { data: permissoes = [], isLoading: carregandoPermissoes } = usePermissoesDeLogs(!!role);
  const porCategoria = new Map(permissoes.map((p) => [p.categoria, p]));
  const editor = isCoordinatorPlus(role);
  const podeVer = (categoria: string) => podeVerCategoria(role, areas, porCategoria.get(categoria));
  return {
    carregando: carregandoCargo || carregandoAreas || (!!role && carregandoPermissoes),
    /** Coordinator+: vê tudo e edita quem pode ver. */
    editor,
    /** Vê pelo menos uma categoria (mostra o item no menu). */
    temAcesso: editor || permissoes.some((p) => podeVerCategoria(role, areas, p)),
    podeVer,
    porCategoria,
  };
}
