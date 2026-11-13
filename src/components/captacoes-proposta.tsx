import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Crown,
  Eye,
  FileDown,
  FileText,
  ImageDown,
  Loader2,
  Lock,
  Pencil,
  Shield,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  fetchCaptacoes,
  fetchModelos,
  updateCaptacao,
  updateModelo,
  type NivelModelo,
  type PixFaixa,
} from "@/lib/captacoes";
import { useMyAreas, useMyRole } from "@/lib/permissions";
import { hasCaptacoesAccess } from "@/lib/captacoes-access";
import { getAuthUserData } from "@/lib/auth-cache";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import hostLogo from "@/assets/host-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { ProposalBenefitsEditor } from "@/components/proposal-benefits-editor";
import { benefitLevelsSchema, pixSchema, resolveBenefits } from "@/lib/proposal-benefits";

type NivelKey = "nivel_1" | "nivel_2" | "nivel_3";

const PRODUTOS = ["Armas", "Munição", "Lavagem", "Garagem", "Drogas", "HPI", "Legal"];

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CaptacoesProposta() {
  const qc = useQueryClient();
  const { data: myAreas } = useMyAreas();
  const { data: myRole } = useMyRole();
  const podeEditarModelos = hasCaptacoesAccess(myRole, myAreas);

  const { data: captacoes } = useQuery({ queryKey: ["captacoes"], queryFn: fetchCaptacoes });
  const { data: modelos } = useQuery({ queryKey: ["captacoes-modelos"], queryFn: fetchModelos });

  const [captacaoId, setCaptacaoId] = useState("");
  const [org, setOrg] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [local, setLocal] = useState("");
  const [produto, setProduto] = useState("Armas");
  const [nivel, setNivel] = useState<NivelKey>("nivel_3");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [secoes, setSecoes] = useState({ lideranca: true, gerencia: true, vipFac: true, camp: true, pix: true });
  const [editarModelos, setEditarModelos] = useState(false);
  const [editarBeneficios, setEditarBeneficios] = useState(false);
  const [beneficios, setBeneficios] = useState<Partial<Record<NivelKey, NivelModelo | undefined>>>({});
  const [pixPersonalizado, setPixPersonalizado] = useState<PixFaixa[] | null>(null);
  const [exportando, setExportando] = useState<"png" | "pdf" | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Responsável padrão = usuário logado
  useState(() => {
    void getAuthUserData().then(async (auth) => {
      if (!auth.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (p?.username) setResponsavel(p.username);
    });
  });

  const modeloPadrao: NivelModelo = modelos?.niveis[nivel] ?? {
    titulo: "", faixa: "", liderancaQtd: "", lideranca: "", gerenciaQtd: "", gerencia: "",
    vipFac: [], camp: "", campExtras: "", pix: false,
  };
  const modelo = resolveBenefits(modeloPadrao, beneficios[nivel]);
  const pix: PixFaixa[] = pixPersonalizado ?? modelos?.pix ?? [];
  const vipFacTitulo = modelo.vipFacTitulo ?? "VIP FAC ULTIMATE";
  const vipFacDuracao = modelo.vipFacDuracao ?? "até o WIPE";

  function validarBeneficios(): boolean {
    const result = benefitLevelsSchema.safeParse(beneficios);
    const pixResult = pixSchema.safeParse(pix);
    if (!result.success || !pixResult.success) {
      toast.error("Confira os benefícios e as faixas Pix: valores positivos e online sem repetição.");
      return false;
    }
    return true;
  }

  const salvarNaCaptacao = useMutation({
    mutationFn: () => {
      if (!validarBeneficios()) throw new Error("Benefícios inválidos");
      return updateCaptacao(captacaoId, {
        proposta: { org, data, local, produto, nivel, responsavel, observacoes, secoes,
          beneficios: { ...beneficios, [nivel]: modelo }, pixPersonalizado: pix },
      });
    },
    onSuccess: () => {
      toast.success("Proposta salva na captação");
      void qc.invalidateQueries({ queryKey: ["captacoes"] });
    },
    onError: () => toast.error("Falha ao salvar proposta"),
  });

  const dataFmt = useMemo(() => {
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  }, [data]);

  function textoDiscord(): string {
    const linhas: string[] = [
      `# 📋 PROPOSTA DE PARCERIA — HOST + ${org.toUpperCase()}`,
      `**Data:** ${dataFmt}  •  **Local:** ${local}  •  **Produto:** ${produto}`,
      `**${modelo.titulo} / ${modelo.faixa}**`,
      "",
      "**BENEFÍCIOS**",
    ];
    if (secoes.lideranca) linhas.push(`▶ Liderança (${modelo.liderancaQtd}): ${modelo.lideranca}`);
    if (secoes.gerencia) linhas.push(`▶ Gerência (${modelo.gerenciaQtd}): ${modelo.gerencia}`);
    if (secoes.vipFac) {
      linhas.push(`▶ ${vipFacTitulo} (${vipFacDuracao})`);
      for (const v of modelo.vipFac.filter(v => v.trim())) linhas.push(`• ${v}`);
    }
    if (secoes.camp) linhas.push(`▶ ${modelo.camp} — ${modelo.campExtras}`);
    if (secoes.pix && modelo.pix) {
      linhas.push("", "**Remuneração via Pix (pico diário):**");
      for (const f of pix) linhas.push(`• ${f.online} online: ${brl(f.valor)}`);
    }
    if (observacoes.trim()) linhas.push("", `📝 ${observacoes.trim()}`);
    linhas.push("", `Responsável HOST: ${responsavel}`, "🌐 hostgg.org");
    return linhas.join("\n");
  }

  async function exportarPng(): Promise<HTMLCanvasElement | null> {
    if (!validarBeneficios()) return null;
    if (!previewRef.current) return null;
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(previewRef.current, { backgroundColor: "#0a0a0a", scale: 2 });
  }

  async function baixarPng() {
    setExportando("png");
    try {
      const canvas = await exportarPng();
      if (!canvas) return;
      const a = document.createElement("a");
      a.download = `proposta-${org.toLowerCase() || "host"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("PNG baixado");
    } catch {
      toast.error("Falha ao gerar PNG");
    } finally {
      setExportando(null);
    }
  }

  async function baixarPdf() {
    setExportando("pdf");
    try {
      const canvas = await exportarPng();
      if (!canvas) return;
      const { jsPDF } = await import("jspdf");
      const img = canvas.toDataURL("image/png");
      const w = 210;
      const h = (canvas.height * w) / canvas.width;
      const pdf = new jsPDF({ unit: "mm", format: [w, h] });
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save(`proposta-${org.toLowerCase() || "host"}.pdf`);
      toast.success("PDF baixado");
    } catch {
      toast.error("Falha ao gerar PDF");
    } finally {
      setExportando(null);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "hc-sobre mb-1.5 block";

  return (
    <div className="grid flex-1 gap-3.5 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* -------- Formulário -------- */}
      <div className="glass hc flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <h2 className="hc-titulo">Dados da proposta</h2>
        </div>

        <div>
          <label className={labelCls}>Vincular a uma captação</label>
          <select
            className={inputCls}
            value={captacaoId}
            onChange={(e) => {
              setCaptacaoId(e.target.value);
              const c = (captacoes ?? []).find((x) => x.id === e.target.value);
              const saved = c?.proposta ?? {};
              const savedBenefits = benefitLevelsSchema.safeParse(saved["beneficios"]);
              setBeneficios(savedBenefits.success ? savedBenefits.data : {});
              const savedPix = pixSchema.safeParse(saved["pixPersonalizado"]);
              setPixPersonalizado(savedPix.success ? savedPix.data : null);
              if (c) {
                setOrg(typeof saved["org"] === "string" ? saved["org"] : c.organizacao);
                setLocal(typeof saved["local"] === "string" ? saved["local"] : c.local);
                if (c.proposta?.["produto"]) setProduto(String(c.proposta["produto"]));
                if (saved["nivel"] === "nivel_1" || saved["nivel"] === "nivel_2" || saved["nivel"] === "nivel_3") setNivel(saved["nivel"]);
                if (typeof saved["data"] === "string") setData(saved["data"]);
                if (typeof saved["responsavel"] === "string") setResponsavel(saved["responsavel"]);
                setObservacoes(typeof saved["observacoes"] === "string" ? saved["observacoes"] : "");
                const savedSections = saved["secoes"];
                if (savedSections && typeof savedSections === "object") {
                  setSecoes(previous => Object.fromEntries(Object.entries(previous).map(([key]) => [key, typeof Reflect.get(savedSections, key) === "boolean" ? Reflect.get(savedSections, key) : true])) as typeof previous);
                } else setSecoes({ lideranca: true, gerencia: true, vipFac: true, camp: true, pix: true });
              }
            }}
          >
            <option value="">Sem vínculo</option>
            {(captacoes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.organizacao} — {STATUS_TIPO[c.tipo]}, {c.status}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Preenche organização, local e produto automaticamente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome da organização</label>
            <input className={inputCls} value={org} onChange={(e) => setOrg(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data</label>
            <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Local</label>
            <input className={inputCls} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Favela Chapadão" />
          </div>
          <div>
            <label className={labelCls}>Produto</label>
            <select className={inputCls} value={produto} onChange={(e) => setProduto(e.target.value)}>
              {PRODUTOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Nível</label>
          <div className="grid grid-cols-3 gap-2">
            {(["nivel_1", "nivel_2", "nivel_3"] as NivelKey[]).map((k) => {
              const m = modelos?.niveis[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNivel(k)}
                  className={cn(
                    "hc-dentro relative p-2.5 text-left transition-colors",
                    nivel === k && "!border-foreground/30 !bg-foreground/[0.07]",
                  )}
                >
                  {nivel === k && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-foreground">
                      <Check className="size-2.5 text-background" />
                    </span>
                  )}
                  <p className="text-[11px] font-semibold text-foreground">{m?.titulo || k}</p>
                  <p className="text-sm font-semibold text-foreground">{m?.faixa.split(" ")[0]}</p>
                  <p className="text-[10px] text-muted-foreground">online{m?.pix ? " e Pix" : ""}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelCls}>Responsável HOST</label>
          <input className={inputCls} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="hc-sobre">Conteúdo</label>
            <span className="text-[10px] text-muted-foreground">Modelo do {modelo.titulo}</span>
          </div>
          <div className="hc-dentro divide-y divide-white/[0.06]">
            {(
              [
                ["lideranca", `Até: ${modelo.liderancaQtd} — ${modelo.lideranca}`],
                ["gerencia", `${modelo.gerenciaQtd}: ${modelo.gerencia}`],
                ["vipFac", `${vipFacDuracao}: ${modelo.vipFac.filter(v => v.trim()).join(", ")}`],
                ["camp", modelo.campExtras],
                ["pix", pix.map(f => `${f.online} online: ${brl(f.valor)}`).join(" • ")],
              ] as [keyof typeof secoes, string][]
            ).map(([key, desc]) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={secoes[key]}
                  onClick={() => setSecoes((s) => ({ ...s, [key]: !s[key] }))}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    secoes[key] ? "bg-foreground" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full transition-all",
                      secoes[key] ? "left-4.5 left-[18px] bg-background" : "left-0.5 bg-white",
                    )}
                  />
                </button>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold capitalize text-foreground">
                    {key === "vipFac" ? vipFacTitulo : key === "camp" ? "Camp interno mensal" : key === "pix" ? "Remuneração via Pix" : key}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          <Button variant="outline" className="mt-3 w-full" disabled={!modelos} onClick={() => setEditarBeneficios(true)}>
            <Pencil /> Ajustar benefícios desta proposta
          </Button>
          {podeEditarModelos && (
            <button
              type="button"
              onClick={() => setEditarModelos(true)}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <Lock className="size-3" /> Editar modelos dos níveis
              <span className="font-normal">(padrões compartilhados)</span>
            </button>
          )}
        </div>

        <div>
          <label className={labelCls}>Observações</label>
          <textarea
            className={cn(inputCls, "min-h-16 resize-y")}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Recado para a organização (opcional)"
          />
        </div>

        {captacaoId && (
          <button
            type="button"
            disabled={salvarNaCaptacao.isPending}
            onClick={() => salvarNaCaptacao.mutate()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {salvarNaCaptacao.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar na captação
          </button>
        )}
      </div>

      {/* -------- Pré-visualização -------- */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
            <Eye className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="hc-titulo">Pré-visualização</span>
            <span className="hc-nota">— atualiza enquanto você edita</span>
          </p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!validarBeneficios()) return;
                void navigator.clipboard.writeText(textoDiscord());
                toast.success("Copiado para o Discord");
              }}
              className="hc-pilula"
            >
              <Copy className="size-3.5" /> Copiar p/ Discord
            </button>
            <button
              type="button"
              onClick={() => void baixarPng()}
              disabled={exportando !== null}
              className="hc-pilula disabled:opacity-50"
            >
              {exportando === "png" ? <Loader2 className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />}
              PNG
            </button>
            <button
              type="button"
              onClick={() => void baixarPdf()}
              disabled={exportando !== null}
              className="hc-pilula disabled:opacity-50"
            >
              {exportando === "pdf" ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
              PDF
            </button>
          </div>
        </div>

        {/* Cartão da proposta (visual exportado) */}
        <div
          ref={previewRef}
          className="overflow-hidden rounded-2xl border border-primary/30 bg-[#0d0a0a] text-white"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          <div className="bg-gradient-to-br from-primary/25 via-transparent to-transparent p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={hostLogo.url} alt="HOST" className="size-7 rounded-md" />
                <span className="text-xs font-semibold tracking-[0.3em] text-white/90">HOST ROLEPLAY</span>
              </div>
              <span className="text-[11px] text-white/50">{dataFmt.replaceAll("/", ".")}</span>
            </div>
            <p className="mt-5 text-[11px] font-semibold tracking-[0.35em] text-primary">PROPOSTA DE PARCERIA</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight font-display">
              HOST <span className="text-primary">+</span> {org.toUpperCase() || "ORG"}
            </h1>
          </div>

          <div className="grid grid-cols-4 gap-2 px-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-semibold tracking-widest text-white/50">DATA</p>
              <p className="mt-0.5 text-sm font-semibold">{dataFmt}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-semibold tracking-widest text-white/50">LOCAL</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{local || "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-semibold tracking-widest text-white/50">PRODUTO</p>
              <p className="mt-0.5 text-sm font-semibold">{produto}</p>
            </div>
            <div className="rounded-xl bg-primary p-3">
              <p className="text-[9px] font-semibold tracking-widest text-white/80">{modelo.titulo}</p>
              <p className="mt-0.5 text-sm font-semibold">{modelo.faixa}</p>
            </div>
          </div>

          <div className="px-6 pt-5">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-white/60">BENEFÍCIOS</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {secoes.lideranca && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                    <Crown className="size-3.5 text-primary" /> Liderança
                    <span className="font-normal text-white/40">{modelo.liderancaQtd}</span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-base font-semibold">{modelo.lideranca}</p>
                </div>
              )}
              {secoes.gerencia && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                    <Shield className="size-3.5 text-primary" /> Gerência
                    <span className="font-normal text-white/40">{modelo.gerenciaQtd}</span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-base font-semibold">{modelo.gerencia}</p>
                </div>
              )}
            </div>

            {secoes.vipFac && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                  <Users className="size-3.5 text-primary" /> {vipFacTitulo}
                  <span className="font-normal text-white/40">{vipFacDuracao}</span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {modelo.vipFac.filter(v => v.trim()).map((v, index) => (
                    <p key={`${v}-${index}`} className="flex items-center gap-1.5 break-words text-[11px] text-white/80">
                      <Check className="size-3 shrink-0 text-primary" /> {v}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {secoes.camp && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                  <Trophy className="size-3.5 text-primary" /> {modelo.camp}
                </p>
                <div className="flex flex-wrap gap-2">
                  {modelo.campExtras.split("+").map((parte) => (
                    <span key={parte} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-center text-[10px] font-semibold">
                      {parte.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {secoes.pix && modelo.pix && pix.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold tracking-[0.3em] text-white/60">
                  REMUNERAÇÃO VIA PIX <span className="ml-1 font-normal normal-case tracking-normal text-white/40">por pico diário de online</span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {pix.map((f, i) => (
                    <div
                      key={f.online}
                      className={cn(
                        "rounded-xl border p-3 text-center",
                        i === pix.length - 1
                          ? "border-primary/60 bg-primary/15"
                          : "border-white/10 bg-white/5",
                      )}
                    >
                      <p className="text-lg font-semibold font-display">
                        {f.online} <span className="text-[9px] font-normal text-white/50">online</span>
                      </p>
                      <p className="mt-0.5 text-xs font-semibold">{brl(f.valor)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {observacoes.trim() && (
              <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] italic text-white/70">
                📝 {observacoes.trim()}
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t-2 border-primary bg-white/[0.03] px-6 py-3">
            <p className="text-[11px] text-white/60">
              Responsável HOST: <span className="font-semibold text-white">{responsavel || "—"}</span>
            </p>
            <p className="text-[11px] font-semibold text-white/50">hostgg.org</p>
          </div>
        </div>
      </div>

      {editarBeneficios && (
        <ProposalBenefitsEditor model={modelo} pix={pix}
          onModel={value => setBeneficios(previous => ({ ...previous, [nivel]: value }))}
          onPix={setPixPersonalizado}
          onReset={() => { setBeneficios(previous => ({ ...previous, [nivel]: modeloPadrao })); setPixPersonalizado(null); }}
          onClose={() => { if (validarBeneficios()) setEditarBeneficios(false); }} />
      )}
      {editarModelos && modelos && (
        <ModelosDialog
          niveis={modelos.niveis}
          pix={modelos.pix}
          onClose={() => setEditarModelos(false)}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["captacoes-modelos"] })}
        />
      )}
    </div>
  );
}

const STATUS_TIPO: Record<string, string> = {
  p1_crew: "P1/Crew",
  hibrido: "Híbrido",
  pvp: "PvP",
};

/* ---------- Editor de modelos (Coordinator+) ---------- */

function ModelosDialog({
  niveis,
  pix,
  onClose,
  onSaved,
}: {
  niveis: Record<NivelKey, NivelModelo>;
  pix: PixFaixa[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<NivelKey | "pix">("nivel_1");
  const [forms, setForms] = useState(niveis);
  const [pixForm, setPixForm] = useState(pix);
  const [salvando, setSalvando] = useState(false);

  const f = forms[tab as NivelKey];
  const setF = (patch: Partial<NivelModelo>) =>
    setForms((prev) => ({ ...prev, [tab]: { ...prev[tab as NivelKey], ...patch } }));

  const inputCls =
    "w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "hc-sobre mb-1.5 block";

  async function salvar() {
    setSalvando(true);
    try {
      for (const k of ["nivel_1", "nivel_2", "nivel_3"] as NivelKey[])
        await updateModelo(k, forms[k] as unknown as Record<string, unknown>);
      await updateModelo("pix", { faixas: pixForm });
      toast.success("Modelos atualizados");
      onSaved();
      onClose();
    } catch {
      toast.error("Falha ao salvar modelos");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="hc-titulo flex items-center gap-3">
            <span className="hc-icone">
              <Pencil className="size-4" strokeWidth={1.75} />
            </span>
            Modelos de proposta
          </DialogTitle>
        </DialogHeader>

        <div className="segmentos justify-self-start" role="tablist" aria-label="Modelos de proposta">
          {(["nivel_1", "nivel_2", "nivel_3", "pix"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t === "pix" ? "Pix" : niveis[t].titulo || t}
            </button>
          ))}
        </div>

        {tab !== "pix" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Título</label>
              <input className={inputCls} value={f.titulo} onChange={(e) => setF({ titulo: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Faixa</label>
              <input className={inputCls} value={f.faixa} onChange={(e) => setF({ faixa: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Liderança (qtd)</label>
              <input className={inputCls} value={f.liderancaQtd} onChange={(e) => setF({ liderancaQtd: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Liderança (benefício)</label>
              <input className={inputCls} value={f.lideranca} onChange={(e) => setF({ lideranca: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Gerência (qtd)</label>
              <input className={inputCls} value={f.gerenciaQtd} onChange={(e) => setF({ gerenciaQtd: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Gerência (benefício)</label>
              <input className={inputCls} value={f.gerencia} onChange={(e) => setF({ gerencia: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>VIP FAC (um por linha)</label>
              <textarea
                className={cn(inputCls, "min-h-24")}
                value={f.vipFac.join("\n")}
                onChange={(e) => setF({ vipFac: e.target.value.split("\n").filter((l) => l.trim()) })}
              />
            </div>
            <div>
              <label className={labelCls}>Camp interno</label>
              <input className={inputCls} value={f.camp} onChange={(e) => setF({ camp: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Camp extras</label>
              <input className={inputCls} value={f.campExtras} onChange={(e) => setF({ campExtras: e.target.value })} />
            </div>
            <label className="col-span-2 flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={f.pix}
                onChange={(e) => setF({ pix: e.target.checked })}
                className="size-4 accent-foreground"
              />
              Incluir remuneração via Pix neste nível
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className={labelCls}>Faixas de remuneração (pico diário)</p>
            {pixForm.map((fx, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  className={inputCls}
                  value={fx.online}
                  onChange={(e) =>
                    setPixForm((p) => p.map((x, j) => (j === i ? { ...x, online: Number(e.target.value) } : x)))
                  }
                  placeholder="Online"
                />
                <input
                  type="number"
                  className={inputCls}
                  value={fx.valor}
                  onChange={(e) =>
                    setPixForm((p) => p.map((x, j) => (j === i ? { ...x, valor: Number(e.target.value) } : x)))
                  }
                  placeholder="Valor R$"
                />
                <button
                  type="button"
                  aria-label="Remover faixa"
                  onClick={() => setPixForm((p) => p.filter((_, j) => j !== i))}
                  className="hc-seta !size-9 hover:!border-destructive/40 hover:!bg-destructive/15 hover:!text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPixForm((p) => [...p, { online: 40, valor: 0 }])}
              className="hc-pilula self-start"
            >
              + Adicionar faixa
            </button>
          </div>
        )}

        <button
          type="button"
          disabled={salvando}
          onClick={() => void salvar()}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />} Salvar modelos
        </button>
      </DialogContent>
    </Dialog>
  );
}
