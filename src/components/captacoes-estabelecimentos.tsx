import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Bookmark,
  CircleCheck,
  CircleDashed,
  CircleOff,
} from "lucide-react";
import { Indice, Indices } from "@/components/indice";
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
  /** Sem `onCaptar` o botão "Captar" some (ex.: na página pública de Organizações livres). */
  onCaptar?: (est: Estabelecimento, categoria: string) => void;
  /** `false` esconde criar, editar e remover (quem só pode ver). */
  podeEditar?: boolean;
}

export function CaptacoesEstabelecimentos({ onCaptar, podeEditar = true }: Props) {
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
    <div className="flex min-w-0 flex-1 flex-col gap-3.5">
      {/* ações e números, no padrão da tela inicial */}
      {podeEditar && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setNovaCategoria(true)} className="pilula rounded-full">
            <Building2 className="size-3.5" /> Nova categoria
          </button>
          <button
            type="button"
            onClick={() => setNovoEstab(true)}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Novo estabelecimento
          </button>
        </div>
      )}
      <Indices>
        <Indice valor={totais.total} titulo="Estabelecimentos" nota="cadastrados" icone={Building2} />
        <Indice valor={totais.livres} titulo="Livres" nota="esperando alguém" cor="#10b981" icone={CircleDashed} />
        <Indice valor={totais.reservados} titulo="Reservados" nota="em conversa" cor="#3b82f6" icone={Bookmark} />
        <Indice valor={totais.ocupados} titulo="Ocupados" nota="com dono" cor="#ef4444" icone={CircleCheck} />
        <Indice valor={totais.desativados} titulo="Desativados" nota="fora de uso" cor="#a1a1aa" icone={CircleOff} />
      </Indices>

      {/* Categorias */}
      <div className="grid gap-3.5 xl:grid-cols-2">
        {(categorias ?? []).map((cat) => {
          const itens = (estabelecimentos ?? []).filter((e) => e.categoriaId === cat.id);
          const livres = itens.filter((e) => e.status === "livre").length;
          return (
            <section key={cat.id} className="glass hc p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="hc-icone mr-1">
                    <Building2 className="size-4" strokeWidth={1.75} />
                  </span>
                  <h3 className="hc-titulo truncate">{cat.nome}</h3>
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
                {podeEditar && <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    title="Adicionar estabelecimento"
                    onClick={() => {
                      setEditEst(null);
                      setNovoEstab(true);
                    }}
                    className="hc-seta"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Editar categoria"
                    onClick={() => setEditCat(cat)}
                    className="hc-seta"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </div>}
              </div>
              <p className="hc-nota mb-3 mt-3">
                {livres} livre{livres === 1 ? "" : "s"},{" "}
                {itens.filter((e) => e.status === "reservado" || e.status === "ocupado").length} reservados/ocupados
                {itens.some((e) => e.status === "desativado") && `, ${itens.filter((e) => e.status === "desativado").length} desativados`}
                {cat.id && cat.nome === "Outros" && " • Staff definido por estabelecimento"}
              </p>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
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
                        "border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.03]",
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
                        <div className="flex items-center justify-end gap-1.5">
                          {e.status === "livre" && onCaptar && (
                            <button
                              type="button"
                              onClick={() => onCaptar(e, cat.nome)}
                              className="hc-pilula"
                            >
                              <Plus className="size-3" /> Captar
                            </button>
                          )}
                          {podeEditar && <>
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => setEditEst(e)}
                            className="hc-seta !size-7"
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
                            className="hc-seta !size-7 hover:!border-destructive/40 hover:!bg-destructive/15 hover:!text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                          </>}
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
              </div>
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
  "w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const labelCls =
  "hc-sobre mb-1.5 block";

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
          <DialogTitle className="hc-titulo">{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
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
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
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
          <DialogTitle className="hc-titulo">
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
            <div className="segmentos w-full" role="group" aria-label="Status do estabelecimento">
              {(Object.keys(ESTAB_STATUS_LABELS) as EstabStatus[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={status === s ? "default" : "outline"}
                  size="sm"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className="flex-1 justify-center border-0 bg-transparent hover:bg-transparent"
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
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
