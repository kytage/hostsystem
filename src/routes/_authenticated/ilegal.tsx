import { createFileRoute } from "@tanstack/react-router";
import {
  Skull,
  Pencil,
  Plus,
  MapPin,
  Copy,
  Check,
  Search,
  X,
  Loader2,
  StickyNote,
  CalendarClock,
  ClipboardList,
  Eye,
  Scale,
  Crown,
  ChevronDown,
  Trash2,
  Activity,
  FileText,
  Eraser,
  Send,
  KeyRound,




} from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrg,
  DETALHES_VAZIO,
  fetchCategorias,
  fetchDetalhes,
  saveDetalhesDb,
  updateOrg,
  type IlegalCategoria,
  type IlegalDetalhes,
  type IlegalOrg,
  type IlegalVip,
  type IlegalVipConfig,
  type IlegalStatus,
  type IlegalSituacao,
} from "@/lib/ilegal-data";
import { useRealtimeTable } from "@/lib/realtime";
import { useCanEditIlegal } from "@/lib/permissions";
import { toast } from "sonner";
import { getCurrentUsername } from "@/lib/kanban";
import { enviarVipFacParaDev } from "@/lib/ilegal-vip-dev";

import { MinimalSelect } from "@/components/ui/minimal-select";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { IlegalLogButton } from "@/components/ilegal-log-modal";
import { IlegalAnotacoes } from "@/components/ilegal-anotacoes";
import { IlegalCronograma } from "@/components/ilegal-cronograma";
import { IlegalOnline, SetHistoricoOnline } from "@/components/ilegal-online";
import {
  fetchSetOnline,
  mediaPorSetagem,
  HORAS_MEDIA,
  serieDoPico,
  type SerieIlegal,
  type SetagemOnlineResumo,
} from "@/lib/ilegal-online";
import { IlegalJuridicoModal } from "@/components/ilegal-juridico-modal";
import { IlegalRegistrosSet } from "@/components/ilegal-registros-set";
import { IlegalOrgRelatorioModal } from "@/components/ilegal-org-relatorio-modal";
import { IlegalRelatorioGeralModal } from "@/components/ilegal-relatorio-geral-modal";
import { IlegalRelatorioMultiModal } from "@/components/ilegal-relatorio-multi-modal";
import { IlegalLimparFacModal } from "@/components/ilegal-limpar-fac-modal";
import { IlegalTransferirModal } from "@/components/ilegal-transferir-modal";
import { IlegalExcluirModal } from "@/components/ilegal-excluir-modal";
import { IlegalPlanilha } from "@/components/ilegal-planilha";
import { IlegalResumo, type FiltroIlegal } from "@/components/ilegal-resumo";
import { HEX_SERIE, HEX_SITUACAO, HEX_STATUS } from "@/lib/ilegal-cores";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";
import { IlegalCoroasModal } from "@/components/ilegal-coroas-modal";
import { fetchCoroasSemanaAtual } from "@/lib/ilegal-coroas";




import { IlegalSolicitacoes } from "@/components/ilegal-solicitacoes";
import { IlegalPaineis } from "@/components/ilegal-paineis";



export const Route = createFileRoute("/_authenticated/ilegal")({
  head: () => ({
    meta: [
      { title: "Ilegal — FiveM Host" },
      {
        name: "description",
        content:
          "Controle das organizações ilegais por categoria: armas, munição, lavagem, garagem, drogas e HPI.",
      },
      { property: "og:title", content: "Ilegal — FiveM Host" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Controle das organizações ilegais por categoria: armas, munição, lavagem, garagem, drogas e HPI.",
      },
    ],
  }),
  component: IlegalDashboard,
});

const statusStyle: Record<IlegalStatus, string> = {
  Assumida: "bg-primary/15 text-primary",
  Reservada: "bg-warning/15 text-warning",
  Livre: "bg-success/15 text-success",
  Fechado: "bg-white/[0.05] text-muted-foreground",
};

const situacaoStyle: Record<IlegalSituacao, string> = {
  Entregue: "bg-success/15 text-success",
  Pendente: "bg-warning/15 text-warning",
  ".": "bg-white/[0.05] text-muted-foreground",
};

const STATUS_OPTIONS: IlegalStatus[] = ["Assumida", "Reservada", "Livre", "Fechado"];
const SITUACAO_OPTIONS: IlegalSituacao[] = ["Entregue", "Pendente", "."];

/** Cor da linha inteira por série (somente organizações assumidas). */
const SERIE_ROW: Record<SerieIlegal, string> = {
  A: "bg-warning/25 shadow-[inset_4px_0_0_var(--warning)] hover:bg-warning/35",
  B: "bg-success/25 shadow-[inset_4px_0_0_var(--success)] hover:bg-success/35",
  C: "bg-destructive/25 shadow-[inset_4px_0_0_var(--destructive)] hover:bg-destructive/35",
};

/** Cor forte aplicada ao texto da setagem, reforçando a série da linha. */
const SERIE_TEXT: Record<SerieIlegal, string> = {
  A: "text-warning",
  B: "text-success",
  C: "text-destructive",
};

/** Célula "Média": apenas o número do maior pico — detalhes por horário no hover. */
function MediaOnlineCell({ info }: { info: SetagemOnlineResumo | undefined }) {
  if (!info) return <span className="text-xs text-muted-foreground/50">—</span>;
  const detalhes = HORAS_MEDIA.map(
    (h) => `${String(h).padStart(2, "0")}h: ${info.porHora[h] ?? "sem dado"}`,
  ).join("  ·  ");
  const titulo = info.picoHora !== null
    ? `${detalhes}\nMaior pico — ${String(info.picoHora).padStart(2, "0")}h`
    : `${detalhes}\nMaior pico`;
  return (
    <span title={titulo} className="inline-flex cursor-help items-center">
      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
        {info.pico}
      </span>
    </span>
  );
}

function CdsCell({ cds }: { cds: string }) {
  const [copied, setCopied] = useState(false);
  if (!cds) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  const copy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cds).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={copy}
      title={copied ? "Coordenadas copiadas!" : `Copiar: ${cds}`}
      className="mx-auto flex items-center justify-center rounded-md bg-white/[0.05] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
    >
      {copied ? (
        <Check className="size-3.5 shrink-0 text-success" />
      ) : (
        <Copy className="size-3.5 shrink-0" />
      )}
    </button>
  );
}

interface CopyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  mono?: boolean | undefined;
  maxLength?: number | undefined;
  inputMode?: "numeric" | "text" | undefined;
  /** Quando true, o campo é apenas leitura (mas ainda copiável). */
  readOnly?: boolean | undefined;
}

function CopyInput({
  value,
  onChange,
  placeholder,
  mono,
  maxLength,
  inputMode,
  readOnly,
}: CopyInputProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="relative">
      <input
        className={cn(
          "w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary/60",
          mono && "font-mono text-xs",
          readOnly && "cursor-default text-muted-foreground focus:border-border"
        )}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        type="button"
        onClick={copy}
        title="Copiar"
        disabled={!value}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  );
}

interface EditModalProps {
  org: IlegalOrg;
  categoriaNome: string;
  /** Lista de categorias para escolher (troca a categoria da organização). */
  categorias?: { id: string; nome: string }[];
  isNew?: boolean;
  onClose: () => void;
  onSave: (updated: IlegalOrg) => void;
  saving: boolean;
}

function EditModal({ org, categoriaNome, categorias = [], isNew = false, onClose, onSave, saving }: EditModalProps) {
  const [form, setForm] = useState<IlegalOrg>({ ...org });
  const set = <K extends keyof IlegalOrg>(key: K, value: IlegalOrg[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const inputCls =
    "w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl glass p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground font-display">
              {isNew ? "Nova organização" : `Editar ${org.setagem || org.local}`}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isNew ? "Preencha os dados da setagem. Deixe a organização vazia se estiver livre." : `${categoriaNome} · ${org.local}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Setagem (painel)
            </span>
            <input
              className={inputCls}
              value={form.setagem}
              onChange={(e) => set("setagem", e.target.value)}
            />
          </label>
          {categorias.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Categoria
              </span>
              <MinimalSelect
                value={form.categoria}
                onChange={(v) => set("categoria", v)}
                options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Localização (nome)
            </span>
            <input
              className={inputCls}
              value={form.local}
              onChange={(e) => set("local", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Grupo
            </span>
            <input
              className={inputCls}
              value={form.grupo}
              onChange={(e) => set("grupo", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Nome da organização
            </span>
            <input
              className={inputCls}
              value={form.organizacao}
              onChange={(e) => set("organizacao", e.target.value)}
              placeholder="— vazio se livre —"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Coordenadas (CDS)
            </span>
            <input
              className={cn(inputCls, "font-mono text-xs")}
              value={form.cds}
              onChange={(e) => set("cds", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Status
            </span>
            <MinimalSelect
              value={form.status}
              onChange={(v) => set("status", v as IlegalStatus)}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Situação
            </span>
            <MinimalSelect
              value={form.situacao}
              onChange={(v) => set("situacao", v as IlegalSituacao)}
              options={SITUACAO_OPTIONS.map((s) => ({
                value: s,
                label: s === "." ? "—" : s,
              }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Observação
            </span>
            <textarea
              className={cn(inputCls, "min-h-20 resize-y")}
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Anotações da staff..."
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

interface DetalhesModalProps {
  org: IlegalOrg;
  categoriaNome: string;
  isGaragem: boolean;
  /** Coordinator+ edita; demais cargos apenas visualizam. */
  canEdit: boolean;
  onClose: () => void;
}

function DetalhesModal({
  org,
  categoriaNome,
  isGaragem,
  canEdit,
  onClose,
}: DetalhesModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<IlegalDetalhes>({ ...DETALHES_VAZIO });

  const { data, isLoading } = useQuery({
    queryKey: ["ilegal-detalhes", org.id],
    queryFn: () => fetchDetalhes(org.id),
  });

  // Preenche o formulário quando os dados chegam da nuvem
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (data && loadedFor !== org.id) {
      setForm(data);
      setLoadedFor(org.id);
    }
  }, [data, loadedFor, org.id]);

  const saveMutation = useMutation({
    mutationFn: (d: IlegalDetalhes) => saveDetalhesDb(org.id, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ilegal-detalhes", org.id] });
      onClose();
    },
  });

  const set = <K extends keyof IlegalDetalhes>(key: K, value: IlegalDetalhes[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const inputCls =
    "w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  const [vipOpen, setVipOpen] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [limparOpen, setLimparOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [abaModal, setAbaModal] = useState<
    "detalhes" | "historico" | "denuncias" | "punicoes"
  >("detalhes");


  const setVip = (index: number, patch: Partial<IlegalVip>) =>
    setForm((prev) => ({
      ...prev,
      vips: prev.vips.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  const addVip = () =>
    setForm((prev) => ({ ...prev, vips: [...prev.vips, { label: "", cds: "" }] }));

  const removeVip = (index: number) =>
    setForm((prev) => ({ ...prev, vips: prev.vips.filter((_, i) => i !== index) }));

  /** Atualiza um campo da configuração do VIP FAC. */
  const setVipCfg = <K extends keyof IlegalVipConfig>(
    key: K,
    value: IlegalVipConfig[K]
  ) =>
    setForm((prev) => ({ ...prev, vipConfig: { ...prev.vipConfig, [key]: value } }));

  const vipField = (
    label: string,
    key: keyof IlegalVipConfig,
    opts?: { placeholder?: string }
  ) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <CopyInput
        value={form.vipConfig[key]}
        placeholder={opts?.placeholder}
        mono
        readOnly={!canEdit}
        onChange={(v) => setVipCfg(key, v)}
      />
    </label>
  );

  /**
   * Salva a configuração atual e cria a pendência de Desenvolvimento
   * (categoria Ilegal) com o texto padronizado do VIP FAC.
   */
  const enviarDevMutation = useMutation({
    mutationFn: async () => {
      const autor = await getCurrentUsername();
      await saveDetalhesDb(org.id, form);
      await enviarVipFacParaDev(org, form.vipConfig, form.vips, autor);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ilegal-detalhes", org.id] });
      toast.success("VIP FAC enviado para o Desenvolvimento (categoria Ilegal).");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar para o DEV.");
    },
  });


  const handleLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  };

  const field = (
    label: string,
    key: keyof IlegalDetalhes,
    opts?: { mono?: boolean; span?: boolean; placeholder?: string }
  ) => (
    <label className={opts?.span ? "block md:col-span-3" : "block"}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <CopyInput
        value={form[key] as string}
        placeholder={opts?.placeholder}
        mono={opts?.mono}
        readOnly={!canEdit}
        onChange={(v) => set(key, v as never)}
      />
    </label>
  );

  const telField = (label: string, key: keyof IlegalDetalhes) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <CopyInput
        value={form[key] as string}
        mono
        placeholder="000000"
        maxLength={6}
        inputMode="numeric"
        readOnly={!canEdit}
        onChange={(v) => set(key, v.replace(/\D/g, "").slice(0, 6) as never)}
      />
    </label>
  );


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground font-display">
              {org.organizacao || org.setagem}
            </h2>
            <p className="text-xs text-muted-foreground">
              {categoriaNome} · {org.local} · {org.grupo}
            </p>
            {org.limpoEm && (
              <p className="mt-1 text-[11px] font-semibold text-warning">
                Facção limpa em {new Date(org.limpoEm).toLocaleDateString("pt-BR")}
                {org.limpoPor ? ` por ${org.limpoPor}` : ""} — exibindo apenas o que veio depois
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setRelatorioOpen(true)}
              title="Gerar relatório desta organização"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <FileText className="size-3.5" /> Relatório
            </button>
            {canEdit && (
              <button
                onClick={() => setTransferirOpen(true)}
                title="Transferir facção para outro set (mantém histórico)"
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <ArrowRightLeft className="size-3.5" /> Transferir
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setLimparOpen(true)}
                title="Limpar facção (libera a setagem e zera o painel)"
                className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Eraser className="size-3.5" /> Limpar Fac
              </button>
            )}
            {canEdit && (
              <Button variant="destructive" size="sm" onClick={() => setExcluirOpen(true)}>
                <Trash2 className="size-3.5" /> Excluir setagem
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Abas do modal: Detalhes / Histórico / Denúncias / Punições (júri) */}
        <div className="mt-4 flex items-center gap-1 rounded-full glass-inset p-1">
          {(
            [
              { id: "detalhes", label: "Detalhes" },
              { id: "historico", label: "Histórico de Online" },
              { id: "denuncias", label: "Denúncias" },
              { id: "punicoes", label: "Punições" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setAbaModal(t.id)}
              className={cn(
                "flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                abaModal === t.id
                  ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                  : "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {relatorioOpen && (
          <IlegalOrgRelatorioModal
            org={org}
            categoriaNome={categoriaNome}
            onClose={() => setRelatorioOpen(false)}
          />
        )}
        {excluirOpen && canEdit && (
          <IlegalExcluirModal org={org} onClose={() => setExcluirOpen(false)} onDone={onClose} />
        )}
        {transferirOpen && canEdit && (
          <IlegalTransferirModal
            org={org}
            onClose={() => setTransferirOpen(false)}
            onDone={() => {
              setTransferirOpen(false);
              onClose();
            }}
          />
        )}
        {limparOpen && canEdit && (
          <IlegalLimparFacModal
            org={org}
            categoriaNome={categoriaNome}
            onClose={() => setLimparOpen(false)}
            onDone={() => {
              setLimparOpen(false);
              onClose();
            }}
          />
        )}

        {abaModal === "historico" ? (
          <SetHistoricoOnline setName={org.setagem} limpoEm={org.limpoEm} />
        ) : abaModal === "denuncias" ? (
          <IlegalRegistrosSet setagem={org.setagem} tipo="denuncia" desde={org.limpoEm} />
        ) : abaModal === "punicoes" ? (
          <IlegalRegistrosSet setagem={org.setagem} tipo="var" desde={org.limpoEm} />
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando detalhes...
          </div>
        ) : (

          <>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Logo 1x1 */}
              <div className="md:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Logo (foto 1x1)
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-white/[0.05]">
                    {form.logo ? (
                      <img
                        src={form.logo}
                        alt={`Logo ${org.organizacao || org.setagem}`}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Skull className="size-6 text-muted-foreground/40" />
                    )}
                  </div>
                  {canEdit && (
                    <>
                      <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                        {form.logo ? "Trocar logo" : "Enviar logo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogo(e.target.files?.[0])}
                        />
                      </label>
                      {form.logo && (
                        <button
                          onClick={() => set("logo", "")}
                          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                        >
                          Remover
                        </button>
                      )}
                    </>
                  )}

                </div>
              </div>

              {/* Contato 01 */}
              <div className="md:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-primary">
                  Contato 01
                </span>
              </div>
              {field("Nome 01", "nome1", { placeholder: "Nome do contato" })}
              {telField("Telefone 01 (6 dígitos)", "telefone1")}

              {/* Contato 02 */}
              <div className="md:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-primary">
                  Contato 02
                </span>
              </div>
              {field("Nome 02", "nome2", { placeholder: "Nome do contato" })}
              {telField("Telefone 02 (6 dígitos)", "telefone2")}

              {/* Contato 03 */}
              <div className="md:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-primary">
                  Contato 03
                </span>
              </div>
              {field("Nome 03", "nome3", { placeholder: "Nome do contato" })}
              {telField("Telefone 03 (6 dígitos)", "telefone3")}

              {field("CDS Baú Líder", "cdsBauLider", { mono: true })}
              {field("CDS Baú Membro", "cdsBauMembro", { mono: true })}
              {field("CDS Craft", "cdsCraft", { mono: true })}
              {field("CDS Shop", "cdsShop", { mono: true })}
              {field("CDS Rota", "cdsRota", { mono: true, span: true })}
              {field("Garagem Blip", "garagemBlip", { mono: true })}
              {field("Garagem Spawn", "garagemSpawn", { mono: true })}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Uniforme
                </span>
                {canEdit ? (
                  <MinimalSelect
                    value={form.uniforme}
                    onChange={(v) =>
                      set("uniforme", v as IlegalDetalhes["uniforme"])
                    }
                    options={[
                      { value: "", label: "—" },
                      { value: "sim", label: "Sim" },
                      { value: "nao", label: "Não" },
                    ]}
                  />
                ) : (
                  <div className={cn(inputCls, "text-muted-foreground")}>
                    {form.uniforme === "sim"
                      ? "Sim"
                      : form.uniforme === "nao"
                        ? "Não"
                        : "—"}
                  </div>
                )}

              </label>
              {field("Cor do veículo registrada", "corVeiculo", {
                placeholder: "Ex: Preto fosco",
              })}

              {isGaragem &&
                field("CD's Blip Desmanche", "cdsBlipDesmanche", {
                  mono: true,
                  span: true,
                })}
            </div>

            {/* VIP FAC */}
            <div className="mt-5 overflow-hidden rounded-xl border border-warning/40 bg-warning/5">
              <button
                type="button"
                onClick={() => setVipOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-warning/10"
              >
                <Crown className="size-4 text-warning" />
                <span className="text-xs font-semibold uppercase tracking-wide text-warning">
                  VIP FAC
                </span>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  {form.vips.length}
                </span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 text-warning transition-transform",
                    vipOpen && "rotate-180"
                  )}
                />
              </button>

              {vipOpen && (
                <div className="space-y-5 border-t border-warning/30 px-4 py-4">
                  {/* Locais */}
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warning/80">
                      Locais
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {vipField("Loja de roupa (CDS)", "lojaRoupa")}
                      {vipField("Barbearia (CDS)", "barbearia")}
                      {vipField("Tatuagem (CDS)", "tatuagem")}
                    </div>
                  </div>

                  {/* Garagem carro comum */}
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warning/80">
                      Garagem carro comum · todos os níveis
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {vipField("Blip (CDS)", "garagemComumBlip")}
                      {vipField("Spawn (CDS)", "garagemComumSpawn")}
                      {vipField("Carro (spawn/index)", "garagemComumCarro", {
                        placeholder: "Ex: lancer",
                      })}
                    </div>
                  </div>

                  {/* Garagem caminhão */}
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warning/80">
                      Garagem caminhão · apenas nível 1
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {vipField("Blip (CDS)", "garagemCaminhaoBlip")}
                      {vipField("Spawn (CDS)", "garagemCaminhaoSpawn")}
                      {vipField("Caminhão (index)", "garagemCaminhaoIndex", {
                        placeholder: "pounder",
                      })}
                    </div>
                  </div>

                  {/* Rádio, baú e salário */}
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warning/80">
                      Rádio privada · baú · salário
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      {vipField("Rádio privada (número)", "radioPrivada")}
                      {vipField("Baú membros", "bauMembro", { placeholder: "3000kg" })}
                      {vipField("Baú líder", "bauLider", { placeholder: "5000kg" })}
                      {vipField("Salário", "salario", { placeholder: "R$ 2.000" })}
                    </div>
                  </div>

                  {/* Itens VIP extras */}
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warning/80">
                      Itens VIP adicionais
                    </p>
                    <div className="space-y-3">
                      {form.vips.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum item VIP extra cadastrado (garagem com veículo próprio,
                          Pounder, etc.).
                        </p>
                      )}
                      {form.vips.map((vip, i) => (
                        <div
                          key={`${vip.label}-${i}`}
                          className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.4fr_auto] md:items-end"
                        >
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                              Item VIP
                            </span>
                            <CopyInput
                              value={vip.label}
                              placeholder="Ex: Garagem VIP — UPlanceris9"
                              readOnly={!canEdit}
                              onChange={(v) => setVip(i, { label: v })}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                              Coordenada
                            </span>
                            <CopyInput
                              value={vip.cds}
                              mono
                              readOnly={!canEdit}
                              onChange={(v) => setVip(i, { cds: v })}
                            />
                          </label>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => removeVip(i)}
                              title="Remover item VIP"
                              className="mb-1 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={addVip}
                          className="rounded-full border border-warning/50 px-4 py-2 text-xs font-semibold text-warning transition-colors hover:bg-warning hover:text-background"
                        >
                          + Adicionar item VIP
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Texto extra */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Texto extra para o DEV
                    </span>
                    <textarea
                      className={cn(
                        inputCls,
                        "min-h-20 resize-y",
                        !canEdit &&
                          "cursor-default text-muted-foreground focus:border-border"
                      )}
                      value={form.vipConfig.textoExtra}
                      readOnly={!canEdit}
                      onChange={(e) => setVipCfg("textoExtra", e.target.value)}
                      placeholder="Observações adicionais que o DEV precisa saber..."
                    />
                  </label>

                  {/* Enviar pra DEV */}
                  <div className="flex flex-col gap-2 border-t border-warning/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Gera uma pendência na categoria <strong>Ilegal</strong> com o texto
                      pronto para o DEV ativar o VIP FAC.
                    </p>
                    <button
                      type="button"
                      disabled={!canEdit || enviarDevMutation.isPending}
                      onClick={() => enviarDevMutation.mutate()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-warning px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {enviarDevMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Enviar pra DEV
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* ANOTAÇÕES SOBRE */}
            <div className="mt-5">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anotações sobre
              </span>
              <textarea
                className={cn(
                  inputCls,
                  "min-h-28 resize-y",
                  !canEdit && "cursor-default text-muted-foreground focus:border-border"
                )}
                value={form.anotacoesSobre}
                readOnly={!canEdit}
                onChange={(e) => set("anotacoesSobre", e.target.value)}
                placeholder="Anotações gerais sobre a organização..."
              />

            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
          >
            Fechar
          </button>
          {canEdit && abaModal === "detalhes" && (
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={isLoading || saveMutation.isPending}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar detalhes
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

/** Abas do painel Ilegal. */
type IlegalView = "orgs" | "anotacoes" | "cronograma" | "solicitacoes" | "online" | "paineis";

const ILEGAL_VIEWS: {
  id: IlegalView;
  label: string;
  Icon: typeof Skull;
  /** Cor do ícone (e do fundo quando a aba está aberta). */
  cor: string;
  ativa: string;
}[] = [
  { id: "orgs", label: "Organizações", Icon: Skull, cor: "text-red-400", ativa: "bg-red-500/15 ring-red-500/30" },
  { id: "anotacoes", label: "Anotações", Icon: StickyNote, cor: "text-amber-300", ativa: "bg-amber-500/15 ring-amber-500/30" },
  { id: "cronograma", label: "Cronograma de RP", Icon: CalendarClock, cor: "text-sky-300", ativa: "bg-sky-500/15 ring-sky-500/30" },
  { id: "online", label: "Online", Icon: Activity, cor: "text-emerald-300", ativa: "bg-emerald-500/15 ring-emerald-500/30" },
  { id: "paineis", label: "Painéis dos líderes", Icon: KeyRound, cor: "text-violet-300", ativa: "bg-violet-500/15 ring-violet-500/30" },
];


function IlegalDashboard() {
  const queryClient = useQueryClient();
  const canEdit = useCanEditIlegal();
  const [view, setView] = useState<IlegalView>("orgs");

  const [aba, setAba] = useState<string>("todas");

  const [busca, setBusca] = useState("");
  const [filtroStat, setFiltroStat] = useState<FiltroIlegal>("todas");
  const [filtroSerie, setFiltroSerie] = useState<"todas" | SerieIlegal>("todas");
  const [editando, setEditando] = useState<{
    org: IlegalOrg;
    categoriaNome: string;
    isNew: boolean;
  } | null>(null);
  const [detalhes, setDetalhes] = useState<{
    org: IlegalOrg;
    categoriaNome: string;
    isGaragem: boolean;
  } | null>(null);
  const [juridico, setJuridico] = useState<{
    setagem: string;
    organizacao: string;
  } | null>(null);
  const [relGeral, setRelGeral] = useState(false);
  const [relMulti, setRelMulti] = useState(false);
  const [excluindo, setExcluindo] = useState<IlegalOrg | null>(null);
  const [coroas, setCoroas] = useState<{
    setagem: string;
    organizacao: string;
  } | null>(null);


  useRealtimeTable("ilegal_orgs", [["ilegal-orgs"]]);
  useRealtimeTable("ilegal_detalhes", [["ilegal-detalhes"]]);
  useRealtimeTable("ilegal_coroas", [["ilegal-coroas-semana"]]);

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
  });

  // Coroas (contatos de RP) da semana atual por setagem
  const { data: coroasSemana = new Map<string, number>() } = useQuery({
    queryKey: ["ilegal-coroas-semana"],
    queryFn: fetchCoroasSemanaAtual,
  });

  // Online recente por setagem (coluna "Média" — maior pico 20h-00h)
  const { data: onlineRows = [] } = useQuery({
    queryKey: ["set-online-setagens"],
    queryFn: () => fetchSetOnline("7d"),
    refetchInterval: 60_000,
  });
  const mediasOnline = useMemo(() => mediaPorSetagem(onlineRows), [onlineRows]);


  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ilegal-orgs"] });

  const saveMutation = useMutation({
    mutationFn: async ({ org, isNew }: { org: IlegalOrg; isNew: boolean }) => {
      if (isNew) await createOrg(org);
      else await updateOrg(org);
    },
    onSuccess: () => {
      invalidate();
      setEditando(null);
    },
  });

  const allOrgs = useMemo(() => categorias.flatMap((c) => c.orgs), [categorias]);
  const stats = useMemo(() => {
    const count = (fn: (o: IlegalOrg) => boolean) => allOrgs.filter(fn).length;
    return {
      // Setagens Fechado (sem local) não entram na contagem.
      total: count((o) => o.status !== "Fechado"),
      assumidas: count((o) => o.status === "Assumida"),
      reservadas: count((o) => o.status === "Reservada"),
      livres: count((o) => o.status === "Livre"),
      pendentes: count((o) => o.situacao === "Pendente"),
      comObs: count((o) => o.observacao.trim().length > 0),
    };
  }, [allOrgs]);

  const assumidasPorSerie = useMemo(() => {
    const c = { todas: 0, A: 0, B: 0, C: 0 };
    for (const o of allOrgs) {
      if (o.status !== "Assumida") continue;
      c.todas++;
      c[serieDoPico(mediasOnline.get(o.setagem)?.pico)]++;
    }
    return c;
  }, [allOrgs, mediasOnline]);

  const statFilter = (o: IlegalOrg) => {
    switch (filtroStat) {
      case "assumidas":
        return (
          o.status === "Assumida" &&
          (filtroSerie === "todas" ||
            serieDoPico(mediasOnline.get(o.setagem)?.pico) === filtroSerie)
        );
      case "reservadas":
        return o.status === "Reservada";
      case "livres":
        return o.status === "Livre";
      case "pendentes":
        return o.situacao === "Pendente";
      case "comObs":
        return o.observacao.trim().length > 0;
      default:
        return true;
    }
  };


  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return categorias
      .filter((c) => aba === "todas" || c.id === aba)
      .map((c) => ({
        ...c,
        orgs: (q
          ? c.orgs.filter((o) =>
              [o.setagem, o.local, o.grupo, o.organizacao, o.observacao, o.status]
                .join(" ")
                .toLowerCase()
                .includes(q)
            )
          : c.orgs
        ).filter(statFilter),
      }))
      .filter((c) => c.orgs.length > 0);
  }, [categorias, aba, busca, filtroStat, filtroSerie, mediasOnline]);

  const handleSave = (updated: IlegalOrg) => {
    if (!editando) return;
    saveMutation.mutate({ org: updated, isNew: editando.isNew });
  };

  const handleAdd = (categoria: IlegalCategoria) => {
    const nova: IlegalOrg = {
      id: `custom-${Date.now()}`,
      categoria: categoria.id,
      ordem: categoria.orgs.length,
      setagem: "",
      local: "",
      grupo: "",
      cds: "",
      organizacao: "",
      status: "Livre",
      situacao: ".",
      observacao: "",
      limpoEm: null,
      limpoPor: "",
    };
    setEditando({ org: nova, categoriaNome: categoria.nome, isNew: true });
  };

  return (
    <div className="pagina">
      <PageHeader
        title="Painel Ilegal"
        subtitle="Sincronizado na nuvem — toda a equipe vê as mesmas informações em tempo real"
        actions={
          <>
            {view === "orgs" && (
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar org, local, grupo..."
                  className="pilula w-56 rounded-full !pl-8 !pr-3 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            )}
            <IlegalLogButton />
            <button
              onClick={() => setView("solicitacoes")}
              className={cn(
                "pilula flex items-center gap-1.5 rounded-full",
                view === "solicitacoes" ? "pilula-ativa" : "!border-primary/40 !text-red-300",
              )}
            >
              <ClipboardList className="size-3.5" /> Solicitações
            </button>
          </>
        }
      />

      {/* abas da área (cada uma com a sua cor) e ações */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="segmentos">
          {ILEGAL_VIEWS.filter((v) => v.id !== "paineis" || canEdit).map(({ id, label, Icon, cor }) => (
            <button key={id} onClick={() => setView(id)} data-ativo={view === id}>
              <Icon className={cn("size-3.5", cor)} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>
        {view === "orgs" && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setRelMulti(true)}
              title="Gerar relatório de várias setagens"
              className="pilula flex !h-[30px] items-center gap-1.5 rounded-full !text-[11.5px]"
            >
              <FileText className="size-3.5 text-sky-300" /> Relatório por setagens
            </button>
            <button
              onClick={() => setRelGeral(true)}
              title="Relatório geral de todas as setagens (online, picos, punições)"
              className="pilula flex !h-[30px] items-center gap-1.5 rounded-full !text-[11.5px]"
            >
              <FileText className="size-3.5 text-violet-300" /> Relatório geral
            </button>
            {canEdit && (
              <button
                onClick={() =>
                  handleAdd(
                    categorias.find((c) => c.id === aba) ??
                      categorias.find((c) => c.id === "a_definir") ??
                      categorias[0]!,
                  )
                }
                className="flex h-[30px] items-center gap-1 rounded-full bg-white px-3 text-[11.5px] font-semibold text-black transition-opacity hover:opacity-90"
              >
                <Plus className="size-3.5" /> Nova organização
              </button>
            )}
          </div>
        )}
      </div>

      {view === "anotacoes" ? (
        <IlegalAnotacoes />
      ) : view === "cronograma" ? (
        <IlegalCronograma />
      ) : view === "online" ? (
        <IlegalOnline />
      ) : view === "solicitacoes" ? (
        <IlegalSolicitacoes />
      ) : view === "paineis" ? (
        <IlegalPaineis orgs={allOrgs} />
      ) : (
        <>
          <IlegalResumo
            total={stats.total}
            filtro={filtroStat}
            onFiltro={setFiltroStat}
            categorias={categorias}
            aba={aba}
            onAba={setAba}
            numeros={[
              { id: "todas", rotulo: "Setagens", valor: stats.total, cor: "#ff7a66" },
              { id: "assumidas", rotulo: "Assumidas", valor: stats.assumidas, cor: HEX_STATUS.Assumida },
              { id: "reservadas", rotulo: "Reservadas", valor: stats.reservadas, cor: HEX_STATUS.Reservada },
              { id: "livres", rotulo: "Livres", valor: stats.livres, cor: HEX_STATUS.Livre },
              { id: "pendentes", rotulo: "Entregas pendentes", valor: stats.pendentes, cor: HEX_SITUACAO.Pendente },
              { id: "comObs", rotulo: "Com observação", valor: stats.comObs, cor: "#a78bfa" },
            ]}
          />

          {filtroStat === "assumidas" && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "todas", label: "Todas as assumidas", cor: "#ffffff" },
                  { id: "A", label: "Série A · 10+", cor: HEX_SERIE.A },
                  { id: "B", label: "Série B · 5–9", cor: HEX_SERIE.B },
                  { id: "C", label: "Série C · 0–4", cor: HEX_SERIE.C },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroSerie(f.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 text-[10.5px] font-medium leading-[20px] transition-colors",
                    filtroSerie === f.id
                      ? "border-white/25 bg-white/[0.09] text-white"
                      : "border-white/[0.07] text-zinc-400 hover:text-white",
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ background: f.cor }} />
                  {f.label}
                  <span className="tabular-nums text-muted-foreground">{assumidasPorSerie[f.id]}</span>
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando organizações...
            </div>
          ) : (
            <>
              {visiveis.length === 0 ? (
                <div className="glass mt-2 rounded-[24px] p-8 text-center text-xs text-muted-foreground">
                  {busca.trim() || filtroStat !== "todas" ? "Nenhum resultado para a busca." : canEdit ? "Nenhuma organização cadastrada ainda. Use “Nova organização” para criar." : "Nenhuma organização cadastrada ainda."}
                </div>
              ) : (
                <IlegalPlanilha
                  categorias={visiveis}
                  medias={mediasOnline}
                  coroas={coroasSemana}
                  canEdit={canEdit}
                  onAbrir={(o, cat) => setDetalhes({ org: o, categoriaNome: cat.nome, isGaragem: cat.id === "garagem" })}
                  onEditar={(o, cat) => setEditando({ org: o, categoriaNome: cat.nome, isNew: false })}
                  onExcluir={(o) => setExcluindo(o)}
                  onCoroas={(o) => setCoroas({ setagem: o.setagem, organizacao: o.organizacao })}
                  onJuridico={(o) => setJuridico({ setagem: o.setagem, organizacao: o.organizacao })}
                  onAdicionar={handleAdd}
                />
              )}
            </>
          )}
        </>
      )}

      {excluindo && canEdit && (
        <IlegalExcluirModal org={excluindo} onClose={() => setExcluindo(null)} onDone={() => setExcluindo(null)} />
      )}

      {editando && canEdit && (
        <EditModal
          org={editando.org}
          categoriaNome={editando.categoriaNome}
          categorias={categorias}
          isNew={editando.isNew}
          onClose={() => setEditando(null)}
          onSave={handleSave}
          saving={saveMutation.isPending}
        />
      )}
      {detalhes && (
        <DetalhesModal
          org={detalhes.org}
          categoriaNome={detalhes.categoriaNome}
          isGaragem={detalhes.isGaragem}
          canEdit={canEdit}
          onClose={() => setDetalhes(null)}
        />
      )}
      {coroas && (
        <IlegalCoroasModal
          setagem={coroas.setagem}
          organizacao={coroas.organizacao}
          canEdit={canEdit}
          onClose={() => setCoroas(null)}
        />
      )}

      {relMulti && (
        <IlegalRelatorioMultiModal categorias={categorias} onClose={() => setRelMulti(false)} />
      )}
      {relGeral && (
        <IlegalRelatorioGeralModal
          categorias={categorias}
          onClose={() => setRelGeral(false)}
        />
      )}
      {juridico && (
        <IlegalJuridicoModal
          setagem={juridico.setagem}
          organizacao={juridico.organizacao}
          onClose={() => setJuridico(null)}
        />
      )}


    </div>
  );
}
