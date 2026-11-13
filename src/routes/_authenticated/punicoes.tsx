import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Plus, Loader2, Search, Gauge, ShieldAlert, Siren, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { useRealtimeTable } from "@/lib/realtime";
import { useMyRole, useMyAreas, isCoordinatorPlus } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Indice, Indices } from "@/components/indice";
import { PunicoesGrafico } from "@/components/punicoes-grafico";
import { PunicoesDistribuicao } from "@/components/punicoes-distribuicao";
import { PunicoesLista } from "@/components/punicoes-lista";
import { PunicaoDialog } from "@/components/punicao-dialog";
import { RelatorioDialog } from "@/components/relatorio-dialog";
import {
  atualizarPunicao,
  criarPunicao,
  excluirPunicao,
  fetchPunicoes,
  filtrarPorPeriodo,
  PERIODOS,
  rankingStaff,
  PUNICAO_TIPOS,
  type PunicaoInput,
  type PunicaoRow,
  type PunicaoTipo,
} from "@/lib/punicoes";

export const Route = createFileRoute("/_authenticated/punicoes")({
  head: () => ({
    meta: [
      { title: "Registro de Punições — HOST Admin" },
      {
        name: "description",
        content:
          "Dashboard de registro de punições do servidor: denúncias normais e punições de hack (VAR).",
      },
      { property: "og:title", content: "Registro de Punições — HOST Admin" },
      {
        property: "og:description",
        content: "Controle de denúncias e punições de hack (VAR) do servidor FiveM.",
      },
    ],
  }),
  component: PunicoesPage,
});

function useMyIdentity() {
  return useQuery({
    queryKey: ["my-punicoes-identity"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) throw new Error("Sessão não disponível.");
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { id: auth.user.id, username: data?.username ?? "" };
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay: 500,
  });
}

/** Card de ranking de staff por tipo de registro (VAR ou denúncias). */
function RankingStaffCard({
  titulo,
  itens,
}: {
  titulo: string;
  itens: { staff: string; total: number }[];
}) {
  return (
    <div className="glass hc p-5">
      <p className="hc-sobre">{titulo}</p>
      <div className="mt-4 space-y-3">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
        ) : (
          itens.map((r, i) => (
            <div key={r.staff} className="flex items-center gap-3">
              <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {r.staff}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{r.total}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


function PunicoesPage() {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["punicoes"],
    queryFn: fetchPunicoes,
  });
  const { data: me } = useMyIdentity();
  const { data: role } = useMyRole();
  const { data: minhasAreas } = useMyAreas();
  const areas = minhasAreas ?? [];
  /** VAR: Coordinator+ ou área "var". Denúncias: Coordinator+ ou área "denuncias". */
  const podeVar = isCoordinatorPlus(role) || areas.includes("var");
  const podeDenuncia = isCoordinatorPlus(role) || areas.includes("denuncias");
  useRealtimeTable("punicoes", [["punicoes"]]);

  const abasDisponiveis = useMemo(
    () => PUNICAO_TIPOS.filter((t) => (t.key === "var" ? podeVar : podeDenuncia)),
    [podeVar, podeDenuncia]
  );

  const [abaEscolhida, setAba] = useState<PunicaoTipo>("denuncia");
  const aba: PunicaoTipo = abasDisponiveis.some((t) => t.key === abaEscolhida)
    ? abaEscolhida
    : (abasDisponiveis[0]?.key ?? "denuncia");
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<number>(7);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<PunicaoRow | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["punicoes"] });

  const criar = useMutation({
    mutationFn: (input: PunicaoInput) =>
      criarPunicao(input, { id: me?.id ?? null, username: me?.username ?? "" }),
    onSuccess: () => {
      toast.success("Punição registrada.");
      setDialogAberto(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editar = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PunicaoInput }) =>
      atualizarPunicao(id, input),
    onSuccess: () => {
      toast.success("Registro atualizado.");
      setEditando(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id: string) => excluirPunicao(id),
    onSuccess: () => {
      toast.success("Registro excluído.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Registros dentro do período selecionado — alimentam cards, gráficos e ranking. */
  const dashboardRows = useMemo(
    () => filtrarPorPeriodo(rows, periodo),
    [rows, periodo]
  );

  const totais = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      total: dashboardRows.length,
      denuncia: dashboardRows.filter((r) => r.tipo === "denuncia").length,
      var: dashboardRows.filter((r) => r.tipo === "var").length,
      hoje: rows.filter((r) => r.data_punicao.slice(0, 10) === hoje).length,
    };
  }, [dashboardRows, rows]);

  const rankingVar = useMemo(
    () => rankingStaff(dashboardRows.filter((r) => r.tipo === "var")),
    [dashboardRows]
  );
  const rankingDenuncias = useMemo(
    () => rankingStaff(dashboardRows.filter((r) => r.tipo !== "var")),
    [dashboardRows]
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.tipo !== aba) return false;
      if (!termo) return true;
      return [r.jogador, r.jogador_id, r.motivo, r.punicao, r.staff]
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [rows, aba, busca]);

  /** Autor, Coordinator+ ou qualquer membro da área VAR (em registros VAR) podem alterar. */
  const podeEditar = (row: PunicaoRow) =>
    isCoordinatorPlus(role) ||
    (!!me?.id && row.staff_id === me.id) ||
    (row.tipo === "var" && areas.includes("var"));
  /** Exclusão e relatórios são exclusivos de Coordinator+. */
  const podeGerenciar = isCoordinatorPlus(role);

  return (
    <div className="pagina space-y-4">
      <PageHeader
        kicker="Registros"
        title="Punições"
        subtitle="Denúncias normais e punições de hack (VAR) em um só lugar."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="campo-busca w-72">
              <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar jogador, motivo, staff..."
                aria-label="Buscar punição"
              />
            </label>
            {podeGerenciar ? (
            <button
              type="button"
              onClick={() => setRelatorioAberto(true)}
              className="pilula rounded-full"
            >
              <FileText className="size-4" /> Gerar relatório
            </button>
            ) : null}
            {podeDenuncia || podeVar ? (
              <button
                type="button"
                onClick={() => setDialogAberto(true)}
                className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
              >
                <Plus className="size-4" /> Nova punição
              </button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="segmentos" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={periodo === p.key}
              onClick={() => setPeriodo(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {totais.total} {totais.total === 1 ? "registro" : "registros"} no período
        </p>
      </div>

      <Indices>
        <Indice valor={totais.total} titulo="Total" nota="registros no período" icone={Gavel} />
        <Indice valor={totais.denuncia} titulo="Denúncias" nota="punições normais" icone={Siren} />
        <Indice valor={totais.var} titulo="VAR (hack)" nota="punições de hack" icone={ShieldAlert} />
        <Indice valor={totais.hoje} titulo="Hoje" nota="registrados hoje" icone={Gauge} />
      </Indices>

      <div className="grid gap-3.5 lg:grid-cols-[1fr_300px]">
        <PunicoesGrafico rows={dashboardRows} dias={periodo > 0 ? periodo : 30} />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
          <RankingStaffCard titulo="Ranking staff VAR" itens={rankingVar} />
          <RankingStaffCard titulo="Ranking staff denúncias" itens={rankingDenuncias} />
        </div>
      </div>

      <PunicoesDistribuicao rows={dashboardRows} />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
          <div className="segmentos" role="tablist" aria-label="Tipo de registro">
            {abasDisponiveis.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={aba === t.key}
                onClick={() => setAba(t.key)}
              >
                {t.label}
                <span className="text-xs tabular-nums opacity-60">
                  {t.key === "var" ? totais.var : totais.denuncia}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {filtradas.length} {filtradas.length === 1 ? "resultado" : "resultados"}
            {busca.trim() ? ` para "${busca.trim()}"` : ""}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          {PUNICAO_TIPOS.find((t) => t.key === aba)?.descricao}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando registros...
        </div>
      ) : (
        <PunicoesLista
          rows={filtradas}
          podeEditar={podeEditar}
          podeExcluir={() => podeGerenciar}
          onEdit={(row) => setEditando(row)}
          onDelete={(row) => remover.mutate(row.id)}
        />
      )}

      {relatorioAberto && podeGerenciar ? (
        <RelatorioDialog
          rows={rows}
          autor={me?.username ?? ""}
          onClose={() => setRelatorioAberto(false)}
        />
      ) : null}

      {dialogAberto ? (
        <PunicaoDialog
          podeVar={podeVar}
          podeDenuncia={podeDenuncia}
          saving={criar.isPending}
          onClose={() => setDialogAberto(false)}
          onSubmit={(input) => criar.mutate(input)}
        />
      ) : null}


      {editando ? (
        <PunicaoDialog
          tipo={editando.tipo as PunicaoTipo}
          podeVar={podeVar}
          podeDenuncia={podeDenuncia}
          registro={editando}
          saving={editar.isPending}
          onClose={() => setEditando(null)}
          onSubmit={(input) => editar.mutate({ id: editando.id, input })}
        />
      ) : null}
    </div>
  );
}
