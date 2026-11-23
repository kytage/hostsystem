// Hooks de dados (React Query) para todas as áreas do painel.
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  AmostraMercado,
  Automacao,
  BackupInfo,
  Conteudo,
  ConteudoEntrada,
  Duplicado,
  Execucao,
  IndicadoresCaptacao,
  Lead,
  LeadCompleto,
  LeadEntrada,
  Lista,
  Material,
  MaterialEntrada,
  Modelo,
  ModeloEntrada,
  Novidade,
  Painel,
  Pesquisa,
  Quadro,
  QuadroEntrada,
  RegistroHistorico,
  ResultadoImportacao,
  Resumo,
  Saude,
  ServidorMercado,
  ServidorMercadoEntrada,
  Tarefa,
  TarefaEntrada,
} from "@/avancado/shared/tipos";
import { api, consulta } from "./api.ts";

type Filtros = Record<string, string | number | boolean | null | undefined>;
const itens = <T>(r: Lista<T>) => r.itens;

/** Depois de qualquer alteração: recarrega a área e a visão geral. */
function invalidar(qc: QueryClient, ...chaves: string[]) {
  for (const c of [...chaves, "painel"]) void qc.invalidateQueries({ queryKey: [c] });
}

/* ---------------- captação ---------------- */
export const useLeads = (filtros: Filtros = {}) => useQuery({ queryKey: ["leads", filtros], queryFn: () => api.get<Lista<Lead>>(`/leads${consulta(filtros)}`).then(itens) });
export const useLead = (id: string | null) => useQuery({ queryKey: ["leads", "um", id], enabled: !!id, queryFn: () => api.get<LeadCompleto>(`/leads/${id}`) });
export const useIndicadoresCaptacao = () => useQuery({ queryKey: ["leads", "indicadores"], queryFn: () => api.get<IndicadoresCaptacao>("/leads/indicadores") });

export function useCriarLead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dados: LeadEntrada) => api.post<LeadCompleto>("/leads", dados), onSuccess: () => invalidar(qc, "leads") });
}
export function useAlterarLead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, dados }: { id: string; dados: LeadEntrada }) => api.patch<LeadCompleto>(`/leads/${id}`, dados), onSuccess: () => invalidar(qc, "leads") });
}
export function useExcluirLead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/leads/${id}`), onSuccess: () => invalidar(qc, "leads") });
}
export function useMesclarLead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, outro_id }: { id: string; outro_id: string }) => api.post<LeadCompleto>(`/leads/${id}/mesclar`, { outro_id }), onSuccess: () => invalidar(qc, "leads") });
}
export function useImportarLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: { formato: "json" | "csv"; conteudo: string; simular: boolean; origem?: string; triagem?: string }) => api.post<ResultadoImportacao>("/leads/importar", dados),
    onSuccess: (_r, v) => {
      if (!v.simular) invalidar(qc, "leads");
    },
  });
}
export const verDuplicados = (nome: string, links: Array<{ url: string }>, ignorar_id?: string) =>
  api.post<{ duplicados: Duplicado[] }>("/leads/duplicados", { nome, links, ignorar_id }).then((r) => r.duplicados);

type TipoFilha = "evidencias" | "contatos" | "interacoes";
/** Evidências, contatos e histórico de um lead: criar, alterar e apagar. */
export function useFilhaDoLead(leadId: string, tipo: TipoFilha) {
  const qc = useQueryClient();
  const onSuccess = () => invalidar(qc, "leads");
  return {
    criar: useMutation({ mutationFn: (dados: Record<string, unknown>) => api.post<LeadCompleto>(`/leads/${leadId}/${tipo}`, dados), onSuccess }),
    alterar: useMutation({ mutationFn: ({ id, dados }: { id: string; dados: Record<string, unknown> }) => api.patch<LeadCompleto>(`/leads/${leadId}/${tipo}/${id}`, dados), onSuccess }),
    excluir: useMutation({ mutationFn: (id: string) => api.del<LeadCompleto>(`/leads/${leadId}/${tipo}/${id}`), onSuccess }),
  };
}

/* ---------------- conteúdo ---------------- */
export const useConteudos = (filtros: Filtros = {}) => useQuery({ queryKey: ["conteudos", filtros], queryFn: () => api.get<Lista<Conteudo>>(`/conteudos${consulta(filtros)}`).then(itens) });
export const useConteudo = (id: string | null) => useQuery({ queryKey: ["conteudos", "um", id], enabled: !!id, queryFn: () => api.get<Conteudo>(`/conteudos/${id}`) });
export function useSalvarConteudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: ConteudoEntrada }) => (id ? api.patch<Conteudo>(`/conteudos/${id}`, dados) : api.post<Conteudo>("/conteudos", dados)),
    onSuccess: () => invalidar(qc, "conteudos"),
  });
}
export function useExcluirConteudo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/conteudos/${id}`), onSuccess: () => invalidar(qc, "conteudos") });
}
export function useDuplicarConteudo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<Conteudo>(`/conteudos/${id}/duplicar`), onSuccess: () => invalidar(qc, "conteudos") });
}
export const useQuadros = () => useQuery({ queryKey: ["quadros"], queryFn: () => api.get<Lista<Quadro>>("/quadros").then(itens) });
export function useSalvarQuadro() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, dados }: { id?: string; dados: QuadroEntrada }) => (id ? api.patch<Quadro>(`/quadros/${id}`, dados) : api.post<Quadro>("/quadros", dados)), onSuccess: () => invalidar(qc, "quadros") });
}
export function useExcluirQuadro() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/quadros/${id}`), onSuccess: () => invalidar(qc, "quadros", "conteudos") });
}
export const useModelos = (tipo?: string) => useQuery({ queryKey: ["modelos", tipo ?? ""], queryFn: () => api.get<Lista<Modelo>>(`/modelos${consulta({ tipo })}`).then(itens) });
export function useSalvarModelo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, dados }: { id?: string; dados: ModeloEntrada }) => (id ? api.patch<Modelo>(`/modelos/${id}`, dados) : api.post<Modelo>("/modelos", dados)), onSuccess: () => invalidar(qc, "modelos") });
}
export function useExcluirModelo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/modelos/${id}`), onSuccess: () => invalidar(qc, "modelos") });
}

/* ---------------- tarefas ---------------- */
export const useTarefas = (filtros: Filtros = {}) => useQuery({ queryKey: ["tarefas", filtros], queryFn: () => api.get<Lista<Tarefa>>(`/tarefas${consulta(filtros)}`).then(itens) });
export const useTarefa = (id: string | null) => useQuery({ queryKey: ["tarefas", "um", id], enabled: !!id, queryFn: () => api.get<Tarefa>(`/tarefas/${id}`) });
export function useSalvarTarefa() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, dados }: { id?: string; dados: TarefaEntrada }) => (id ? api.patch<Tarefa>(`/tarefas/${id}`, dados) : api.post<Tarefa>("/tarefas", dados)), onSuccess: () => invalidar(qc, "tarefas") });
}
export function useConcluirTarefa() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<{ concluida: Tarefa; proxima: Tarefa | null }>(`/tarefas/${id}/concluir`), onSuccess: () => invalidar(qc, "tarefas") });
}
export function useExcluirTarefa() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/tarefas/${id}`), onSuccess: () => invalidar(qc, "tarefas") });
}

/* ---------------- radar ---------------- */
export const usePesquisas = () => useQuery({ queryKey: ["pesquisas"], queryFn: () => api.get<Lista<Pesquisa>>("/pesquisas").then(itens) });
export const useResumos = () => useQuery({ queryKey: ["resumos"], queryFn: () => api.get<Lista<Resumo>>("/resumos").then(itens) });
export const useNovidades = () => useQuery({ queryKey: ["novidades"], queryFn: () => api.get<Lista<Novidade>>("/novidades").then(itens) });
/** Criar, alterar ou apagar em pesquisas, resumos e novidades. */
export function useRadar(tipo: "pesquisas" | "resumos" | "novidades") {
  const qc = useQueryClient();
  const onSuccess = () => invalidar(qc, tipo);
  return {
    salvar: useMutation({ mutationFn: ({ id, dados }: { id?: string; dados: Record<string, unknown> }) => (id ? api.patch(`/${tipo}/${id}`, dados) : api.post(`/${tipo}`, dados)), onSuccess }),
    excluir: useMutation({ mutationFn: (id: string) => api.del(`/${tipo}/${id}`), onSuccess }),
  };
}
export const useServidoresMercado = () => useQuery({ queryKey: ["mercado", "servidores"], queryFn: () => api.get<Lista<ServidorMercado>>("/mercado/servidores").then(itens) });
export const useAmostrasMercado = (dias: number) => useQuery({ queryKey: ["mercado", "amostras", dias], queryFn: () => api.get<Lista<AmostraMercado>>(`/mercado/amostras?dias=${dias}`).then(itens) });
export function useSalvarServidor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: ServidorMercadoEntrada }) => (id ? api.patch<ServidorMercado>(`/mercado/servidores/${id}`, dados) : api.post<ServidorMercado>("/mercado/servidores", dados)),
    onSuccess: () => invalidar(qc, "mercado"),
  });
}
export function useExcluirServidor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/mercado/servidores/${id}`), onSuccess: () => invalidar(qc, "mercado") });
}
export function useColetarMercado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ coletados: number; total: number; falhas: Array<{ nome: string; erro: string }> }>("/mercado/coletar"),
    onSuccess: () => invalidar(qc, "mercado", "automacoes"),
  });
}

/* ---------------- automações e materiais ---------------- */
export const useAutomacoes = () => useQuery({ queryKey: ["automacoes"], queryFn: () => api.get<Lista<Automacao>>("/automacoes").then(itens) });
export const useExecucoes = (id: string | null) => useQuery({ queryKey: ["automacoes", "execucoes", id], enabled: !!id, queryFn: () => api.get<Lista<Execucao>>(`/automacoes/${id}/execucoes`).then(itens) });
export function useExecutarAutomacao() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<Execucao>(`/automacoes/${id}/executar`), onSuccess: () => invalidar(qc, "automacoes", "mercado", "backups") });
}
export function useAlterarAutomacao() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, dados }: { id: string; dados: Partial<Automacao> }) => api.patch<Automacao>(`/automacoes/${id}`, dados), onSuccess: () => invalidar(qc, "automacoes") });
}
export const useMateriais = () => useQuery({ queryKey: ["materiais"], queryFn: () => api.get<Lista<Material>>("/materiais").then(itens) });
export function useSalvarMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados, novo }: { id?: string; dados: MaterialEntrada; novo?: boolean }) => (id && !novo ? api.patch<Material>(`/materiais/${id}`, dados) : api.post<Material>("/materiais", dados)),
    onSuccess: () => invalidar(qc, "materiais"),
  });
}
export function useExcluirMaterial() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/materiais/${id}`), onSuccess: () => invalidar(qc, "materiais") });
}

/* ---------------- visão geral e sistema ---------------- */
export const usePainel = () => useQuery({ queryKey: ["painel"], queryFn: () => api.get<Painel>("/painel"), refetchInterval: 120_000 });
export const useSaude = () => useQuery({ queryKey: ["saude"], queryFn: () => api.get<Saude>("/saude"), staleTime: 60_000 });
export const useConfig = () => useQuery({ queryKey: ["config"], queryFn: () => api.get<Record<string, unknown>>("/config") });
export function useSalvarConfig() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ chave, valor }: { chave: string; valor: unknown }) => api.put<Record<string, unknown>>(`/config/${chave}`, { valor }), onSuccess: () => invalidar(qc, "config") });
}
export const useBackups = () => useQuery({ queryKey: ["backups"], queryFn: () => api.get<Lista<BackupInfo>>("/backups").then(itens) });
export function useCriarBackup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<BackupInfo>("/backup"), onSuccess: () => invalidar(qc, "backups") });
}
export const useHistorico = () => useQuery({ queryKey: ["historico"], queryFn: () => api.get<Lista<RegistroHistorico>>("/historico?limite=80").then(itens) });
