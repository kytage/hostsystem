/**
 * HOST FAZENDAS — a fazenda de quem está na ilha agora: se já tem fazenda, o nível,
 * a privacidade e se dá para entrar direto (a ilha aberta recebe qualquer membro).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fazendaIlhasDe, type IlhaDeAlguem } from "@/lib/fazenda.functions";
import type { Visual } from "@/lib/hoki";

/** Quem está na ilha (no Mundo HOST) agora: no lobby, dormindo no berço ou numa fazenda. */
export interface PresenteNaIlha {
  id: string;
  nome: string;
  visual: Visual;
  tag?: string;
  dorme: boolean;
  naFazenda: boolean;
}

/** A fazenda de cada pessoa da lista (por id); some da tela quem ainda não respondeu. */
export function useIlhasDe(ids: string[]) {
  const buscar = useServerFn(fazendaIlhasDe);
  const chave = [...new Set(ids)].sort();
  const { data } = useQuery({
    queryKey: ["fazenda-ilhas-de", chave.join(",")],
    queryFn: async () => (chave.length ? await buscar({ data: { ids: chave } }) : []),
    staleTime: 20_000,
  });
  const porId: Record<string, IlhaDeAlguem> = {};
  for (const f of data ?? []) porId[f.id] = f;
  return porId;
}

/** O que aparece no lugar do botão Visitar quando não dá para entrar direto. */
export function motivoSemVisita(f: IlhaDeAlguem | undefined) {
  if (!f) return "…";
  if (!f.temIlha) return "sem fazenda";
  if (f.podeEntrar) return "";
  if (f.privacidade === "privada") return "privada";
  return "só por convite";
}

/** Onde a pessoa está agora, em poucas palavras. */
export const ondeEsta = (p: Pick<PresenteNaIlha, "dorme" | "naFazenda">) =>
  p.dorme ? "dormindo" : p.naFazenda ? "na HOST FAZENDAS" : "no lobby";
