import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  createEstabCategoria,
  createEstabelecimento,
  deleteEstabCategoria,
  deleteEstabelecimento,
  ESTAB_STATUS_LABELS,
  fetchEstabCategorias,
  fetchEstabelecimentos,
  updateEstabCategoria,
  updateEstabelecimento,
  type EstabCategoria,
  type Estabelecimento,
  type EstabStatus,
} from "@/lib/captacoes";
import { toast } from "sonner";

const STATUS_CORES: Record<EstabStatus, string> = {
  livre: "bg-emerald-500/15 text-emerald-400",
  reservado: "bg-blue-500/15 text-blue-400",
  ocupado: "bg-destructive/15 text-destructive",
  desativado: "bg-muted text-muted-foreground",
};

interface Props {
  onCaptar: (est: Estabelecimento, categoria: string) => void;
}

export function CaptacoesEstabelecimentos({ onCaptar }: Props) {
  const qc = useQueryClient();
  const [novaCategoria, setNovaCategoria] = useState(false);
  const [novoEstab, setNovoEstab] = useState(false);
  const [editCat, setEditCat] = useState<EstabCategoria | null>(null);
  const [editEst, setEditEst] = useState<Estabelecimento | null>(null);

  const { data: categorias } = useQuery({
    queryKey: ["captacoes-estab-categorias"],
    queryFn: fetchEstabCategorias,
  });
  const { data: estabelecimentos } = useQuery({
    queryKey: ["captacoes-estabelecimentos"],
    queryFn: fetchEstabelecimentos,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["captacoes-estabelecimentos"] });
    void qc.invalidateQueries({ queryKey: ["captacoes-estab-categorias"] });
  };

  const totais = useMemo(() => {
    const list = estabelecimentos ?? [];
    return {
      total: list.length,
      livres: list.filter((e) => e.status === "livre").length,
      reservados: list.filter((e) => e.status === "reservado").length,
      ocupados: list.filter((e) => e.status === "ocupado").length,
      desativados: list.filter((e) => e.status === "desativado").length,
    };
  }, [estabelecimentos]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {/* Resumo + ações */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl glass p-4">
        <div>
          <p className="text-[11px] text-muted-foreground">Estabelecimentos</p>
          <p className="text-2xl font-semibold text-foreground font-display">{totais.total}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" /> Livres
          </p>
          <p className="text-2xl font-semibold text-foreground font-display">{totais.livres}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-blue-500" /> Reservados
          </p>
          <p className="text-2xl font-semibold text-foreground font-display">{totais.reservados}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-destructive" /> Ocupados
          </p>
          <p className="text-2xl font-semibold text-foreground font-display">{totais.ocupados}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground" /> Desativados
          </p>
          <p className="text-2xl font-semibold text-foreground font-display">{totais.desativados}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setNovaCategoria(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Building2 className="size-3.5" /> Nova categoria
          </button>
          <button
            type="button"
            onClick={() => setNovoEstab(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" /> Novo estabelecimento
          </button>
        </div>
      </div>

      {/* Categorias */}
      <div className="grid gap-4 xl:grid-cols-2">
        {(categorias ?? []).map((cat) => {
          const itens = (estabelecimentos ?? []).filter((e) => e.categoriaId === cat.id);
          const livres = itens.filter((e) => e.status === "livre").length;
          return (
            <section key={cat.id} className="rounded-2xl glass p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">{cat.nome}</h3>
                  {cat.staff &&
                    cat.staff.split(",").map((s) => (
                      <span
                        key={s}
                        title={s.trim()}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-foreground"
                      >
                        {s.trim().slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Adicionar estabelecimento"
                    onClick={() => {
                      setEditEst(null);
                      setNovoEstab(true);
                    }}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Editar categoria"
                    onClick={() => setEditCat(cat)}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {livres} livre{livres === 1 ? "" : "s"},{" "}
                {itens.filter((e) => e.status === "reservado" || e.status === "ocupado").length} reservados/ocupados
                {itens.some((e) => e.status === "desativado") && `, ${itens.filter((e) => e.status === "desativado").length} desativados`}
                {cat.id && cat.nome === "Outros" && " • Staff definido por estabelecimento"}
              </p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-2">Nome</th>
                    <th className="py-1.5 pr-2">Status</th>
                    <th className="py-1.5 pr-2">Observação</th>
                    {cat.nome === "Outros" && <th className="py-1.5 pr-2">Staff</th>}
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((e) => (
                    <tr
                      key={e.id}
                      className={cn(
                        "border-b border-border/50 last:border-0",
                        e.status === "livre" && "border-l-2 border-l-emerald-500",
                      )}
                    >
                      <td className="py-2 pl-1.5 pr-2 font-semibold text-foreground">{e.nome}</td>
                      <td className="py-2 pr-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CORES[e.status])}>
                          ● {ESTAB_STATUS_LABELS[e.status]}
                        </span>
                      </td>
                      <td className="max-w-32 truncate py-2 pr-2 text-muted-foreground">
                        {e.observacao || "—"}
                      </td>
                      {cat.nome === "Outros" && (
                        <td className="py-2 pr-2 text-muted-foreground">{e.staff || "—"}</td>
                      )}
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {e.status === "livre" && (
                            <button
                              type="button"
                              onClick={() => onCaptar(e, cat.nome)}
                              className="flex items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                            >
                              <Plus className="size-3" /> Captar
                            </button>
                          )}
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => setEditEst(e)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Remover"
                            onClick={() => {
                              if (window.confirm(`Remover ${e.nome}?`))
                                void deleteEstabelecimento(e.id).then(() => {
                                  toast.success("Removido");
                                  invalidar();
                                });
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {itens.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        Nenhum estabelecimento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      {(novaCategoria || editCat) && (
        <CategoriaDialog
          categoria={editCat}
          onClose={() => {
            setNovaCategoria(false);
            setEditCat(null);
          }}
          onSaved={invalidar}
          onDelete={(id) => {
            void deleteEstabCategoria(id).then(() => {
              toast.success("Categoria removida");
              invalidar();
              setEditCat(null);
            });
          }}
        />
      )}
      {(novoEstab || editEst) && (
        <EstabelecimentoDialog
          estabelecimento={editEst}
          categorias={categorias ?? []}
          onClose={() => {
            setNovoEstab(false);
            setEditEst(null);
          }}
          onSaved={invalidar}
        />
      )}
    </div>
  );
}

/* ---------- Dialogs ---------- */

const inputCls =
  "w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function CategoriaDialog({
  categoria,
  onClose,
  onSaved,
  onDelete,
}: {
  categoria: EstabCategoria | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [staff, setStaff] = useState(categoria?.staff ?? "");
  const [salvando, setSalvando] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Staff responsável (separar por vírgula)</label>
            <input
              className={inputCls}
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              placeholder="Ex.: Karol, Gabrielly"
            />
          </div>
          <button
            type="button"
            disabled={!nome.trim() || salvando}
            onClick={() => {
              setSalvando(true);
              const p = categoria
                ? updateEstabCategoria(categoria.id, nome.trim(), staff.trim())
                : createEstabCategoria(nome.trim(), staff.trim());
              void p
                .then(() => {
                  toast.success("Categoria salva");
                  onSaved();
                  onClose();
                })
                .catch(() => toast.error("Falha ao salvar"))
                .finally(() => setSalvando(false));
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
          {categoria && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remover a categoria ${categoria.nome} e todos os estabelecimentos dela?`))
                  onDelete(categoria.id);
              }}
              className="text-xs font-semibold text-destructive hover:underline"
            >
              Remover categoria
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EstabelecimentoDialog({
  estabelecimento,
  categorias,
  onClose,
  onSaved,
}: {
  estabelecimento: Estabelecimento | null;
  categorias: EstabCategoria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(estabelecimento?.nome ?? "");
  const [categoriaId, setCategoriaId] = useState(
    estabelecimento?.categoriaId ?? categorias[0]?.id ?? "",
  );
  const [status, setStatus] = useState<EstabStatus>(estabelecimento?.status ?? "livre");
  const [observacao, setObservacao] = useState(estabelecimento?.observacao ?? "");
  const [staff, setStaff] = useState(estabelecimento?.staff ?? "");
  const [salvando, setSalvando] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {estabelecimento ? "Editar estabelecimento" : "Novo estabelecimento"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Categoria</label>
            <select
              className={inputCls}
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Status do estabelecimento">
              {(Object.keys(ESTAB_STATUS_LABELS) as EstabStatus[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={status === s ? "default" : "outline"}
                  size="sm"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                    status === s
                      ? "border-white/15 bg-white/[0.09] text-foreground"
                      : "border-border bg-black/25 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ESTAB_STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Observação (dono/contato)</label>
            <input
              className={inputCls}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Staff (opcional)</label>
            <input className={inputCls} value={staff} onChange={(e) => setStaff(e.target.value)} />
          </div>
          <button
            type="button"
            disabled={!nome.trim() || !categoriaId || salvando}
            onClick={() => {
              setSalvando(true);
              const p = estabelecimento
                ? updateEstabelecimento(estabelecimento.id, {
                    nome: nome.trim(),
                    categoriaId,
                    status,
                    observacao: observacao.trim(),
                    staff: staff.trim(),
                  })
                : createEstabelecimento({
                    nome: nome.trim(),
                    categoriaId,
                    status,
                    observacao: observacao.trim(),
                    staff: staff.trim(),
                  });
              void p
                .then(() => {
                  toast.success("Estabelecimento salvo");
                  onSaved();
                  onClose();
                })
                .catch(() => toast.error("Falha ao salvar"))
                .finally(() => setSalvando(false));
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
