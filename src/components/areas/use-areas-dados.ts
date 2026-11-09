import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchPendenciasArea, type PendenciaArea } from "@/lib/area-manager";
import { listEquipeAreas } from "@/lib/areas.functions";
import type { EquipeUser } from "@/lib/equipe-merge";
import { useAreas, type AreaRow } from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";

/** Áreas que têm tela completa em /areas/<chave>. */
export const AREAS_COM_PAGINA = new Set([
  "hospital", "judiciario", "mecanica", "restaurantes", "jornal", "creators",
  "kids", "ilegal", "policia", "eventos", "competitive", "cars",
]);

export const GRUPOS_AREA: { key: string; label: string; descricao: string }[] = [
  { key: "legal", label: "Legal", descricao: "Empresas e serviços da cidade" },
  { key: "confronto", label: "Base padrão", descricao: "Ilegal × Polícia" },
  { key: "entretenimento", label: "Entretenimento", descricao: "Eventos e competições" },
  { key: "operacao", label: "Operação", descricao: "Bastidores da cidade" },
];

export interface AreaVisao {
  def: AreaRow;
  lideres: EquipeUser[];
  membros: EquipeUser[];
  pendencias: PendenciaArea[];
  abertas: PendenciaArea[];
  standby: PendenciaArea[];
  altas: number;
}

export type Saude = { label: string; dot: string };

export function saudeDaArea(a: AreaVisao): Saude {
  if (a.membros.length === 0) return { label: "Sem equipe", dot: "bg-primary" };
  if (a.lideres.length === 0) return { label: "Sem líder", dot: "bg-amber-400" };
  if (a.abertas.length > Math.max(3, a.membros.length * 3)) return { label: "Sobrecarregada", dot: "bg-amber-400" };
  return { label: "Fluindo", dot: "bg-emerald-400" };
}

const PESO: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

/** Prioridade mais alta primeiro; dentro dela, a mais antiga. */
export function ordenarPendencias(lista: PendenciaArea[]): PendenciaArea[] {
  return [...lista].sort(
    (a, b) => (PESO[a.prioridade] ?? 1) - (PESO[b.prioridade] ?? 1) || a.createdAt.localeCompare(b.createdAt),
  );
}

export const isOnline = (u: EquipeUser) =>
  !!u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 5 * 60 * 1000;

export function useAreasDados() {
  useRealtimeTable("pendencias", [["pendencias-area"]]);
  const listar = useServerFn(listEquipeAreas);
  const areas = useAreas();
  const equipe = useQuery({ queryKey: ["areas-equipe"], queryFn: () => listar(), staleTime: 60_000 });
  const pendencias = useQuery({ queryKey: ["pendencias-area"], queryFn: fetchPendenciasArea, staleTime: 20_000 });

  const visoes = useMemo<AreaVisao[]>(() => {
    const pessoas = equipe.data ?? [];
    return (areas.data ?? []).map((def) => {
      const membros = pessoas.filter((u) => u.areas.includes(def.key));
      const doArea = (pendencias.data ?? []).filter((p) => p.area === def.key);
      const abertas = ordenarPendencias(doArea.filter((p) => p.status === "pendente"));
      return {
        def,
        membros,
        lideres: membros.filter((u) => u.areaNiveis?.[def.key] === "lider"),
        pendencias: doArea,
        abertas,
        standby: ordenarPendencias(doArea.filter((p) => p.status === "standby")),
        altas: abertas.filter((p) => p.prioridade === "alta").length,
      };
    });
  }, [areas.data, equipe.data, pendencias.data]);

  return {
    visoes,
    equipe: equipe.data ?? [],
    carregando: areas.isLoading || equipe.isLoading || pendencias.isLoading,
    erro: equipe.error ?? pendencias.error ?? areas.error,
  };
}
