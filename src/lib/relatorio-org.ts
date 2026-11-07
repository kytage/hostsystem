import {
  FAIXAS_HORARIAS,
  INTERVALO_VAZIO,
  labelPeriodoComIntervalo,
  picoPorHora,
  resumoHistorico,
  serieHistoricoSetagem,
  type FaixaHoraria,
  type IntervaloDatas,
  type OnlinePeriodo,
  type SetOnlineRow,
} from "./ilegal-online";
import type { IlegalDetalhes, IlegalOrg } from "./ilegal-data";
import type { PunicaoRow } from "./punicoes";
import {
  cartao,
  carregarLogoHost,
  graficoBarras,
  graficoLinha,
  kpi,
  PDF_THEME,
  tituloSecao,
  type PdfDoc,
} from "./relatorio-pdf-ui";

/** Opções do relatório individual de uma organização ilegal. */
export interface RelatorioOrgConfig {
  titulo: string;
  /** Recorte do histórico de online. */
  periodo: OnlinePeriodo;
  /** Datas do período "Personalizado" (YYYY-MM-DD). */
  intervalo: IntervaloDatas;
  faixa: FaixaHoraria;
  incluirLogo: boolean;
  incluirContatos: boolean;
  incluirVips: boolean;
  incluirOnlineResumo: boolean;
  incluirPicoPorHora: boolean;
  incluirOnlineRegistros: boolean;
  /** Quantos registros brutos de online listar (0 = nenhum). */
  limiteRegistros: number;
  incluirDenuncias: boolean;
  incluirPunicoes: boolean;
  observacao: string;
  orientacao: "portrait" | "landscape";
}

export const RELATORIO_ORG_DEFAULT: RelatorioOrgConfig = {
  titulo: "Relatório da Organização",
  periodo: "7d",
  intervalo: INTERVALO_VAZIO,
  faixa: "todas",
  incluirLogo: true,
  incluirContatos: true,
  incluirVips: true,
  incluirOnlineResumo: true,
  incluirPicoPorHora: true,
  incluirOnlineRegistros: false,
  limiteRegistros: 30,
  incluirDenuncias: true,
  incluirPunicoes: true,
  observacao: "",
  orientacao: "portrait",
};

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface RelatorioOrgDados {
  org: IlegalOrg;
  categoriaNome: string;
  detalhes: IlegalDetalhes;
  /** Registros de online já limitados ao período e ao marco de limpeza. */
  online: SetOnlineRow[];
  /** Registros de punições já filtrados pelo marco de limpeza. */
  registros: PunicaoRow[];
}

/**
 * Gera e baixa o PDF consolidado da organização (detalhes + online + jurídico).
 * Imports dinâmicos mantêm o jspdf fora do bundle de SSR.
 */
export async function gerarRelatorioOrgPdf(
  dados: RelatorioOrgDados,
  cfg: RelatorioOrgConfig,
  meta: { autor: string },
  opts: { doc?: import("jspdf").jsPDF | undefined; salvar?: boolean } = {}
): Promise<import("jspdf").jsPDF> {
  const [{ jsPDF }, autoTableModule, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    carregarLogoHost(),
  ]);
  const autoTable = autoTableModule.default;
  const { org, categoriaNome, detalhes, online, registros } = dados;

  // Modo "PDF juntos": continua no documento recebido, em nova página.
  const doc = opts.doc ?? new jsPDF({ orientation: cfg.orientacao, unit: "pt", format: "a4" });
  if (opts.doc) doc.addPage();
  const largura = doc.internal.pageSize.getWidth();
  const margem = 40;
  const conteudo = largura - margem * 2;
  const d = doc as unknown as PdfDoc;

  // ---------- Cabeçalho ----------
  doc.setFillColor(...PDF_THEME.white);
  doc.rect(0, 0, largura, 120, "F");

  if (logo) {
    const logoW = 92;
    const logoH = (logo.height / logo.width) * logoW;
    doc.addImage(logo.dataUrl, "PNG", margem, 34, logoW, logoH);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...PDF_THEME.accent);
    doc.text("HOST", margem, 52);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_THEME.inkSoft);
  doc.text(
    `Gerado em ${fmtDataHora(new Date().toISOString())} · ${meta.autor || "—"}`,
    largura - margem,
    44,
    { align: "right" }
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text(cfg.titulo || "Relatório da Organização", largura - margem, 60, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text(`${org.setagem} · ${org.organizacao || "Sem organização"}`, margem, 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.inkSoft);
  doc.text(`${categoriaNome} · ${org.local || "—"} · ${org.status}`, margem, 111);

  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.6);
  doc.line(margem, 124, largura - margem, 124);

  let y = 146;

  // Logo da organização (data URL apenas)
  const temLogoOrg = cfg.incluirLogo && detalhes.logo.startsWith("data:image");
  if (temLogoOrg) {
    try {
      cartao(d, largura - margem - 84, y, 84, 84, PDF_THEME.white);
      const formato = detalhes.logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(detalhes.logo, formato, largura - margem - 76, y + 8, 68, 68);
    } catch {
      // Logo inválida não deve impedir a geração do relatório.
    }
  }

  if (cfg.observacao.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.ink);
    const obs = doc.splitTextToSize(cfg.observacao.trim(), conteudo - (temLogoOrg ? 100 : 0));
    doc.text(obs, margem, y + 10);
    y += obs.length * 12 + 18;
  }

  const resumo = resumoHistorico(online);

  // ---------- KPIs ----------
  if (cfg.incluirOnlineResumo) {
    const larguraKpi = temLogoOrg ? conteudo - 100 : conteudo;
    const gap = 10;
    const w = (larguraKpi - gap * 2) / 3;
    kpi(
      d,
      margem,
      y,
      w,
      "Média online",
      String(resumo.media),
      labelPeriodoComIntervalo(cfg.periodo, cfg.intervalo)
    );
    kpi(
      d,
      margem + w + gap,
      y,
      w,
      "Maior pico",
      resumo.pico > 0 ? String(resumo.pico) : "—",
      resumo.pico > 0
        ? `${String(resumo.picoHora ?? 0).padStart(2, "0")}h · ${fmtDataHora(resumo.picoAt)}`
        : "sem registros"
    );
    const h = kpi(
      d,
      margem + (w + gap) * 2,
      y,
      w,
      "Capturas",
      String(resumo.registros),
      resumo.ultimo !== null ? `último: ${resumo.ultimo} online` : "—"
    );
    y += h + 18;
  }

  // ---------- Ficha ----------
  const ficha: string[][] = [
    ["Setagem", org.setagem],
    ["Categoria", categoriaNome],
    ["Local", org.local || "—"],
    ["Grupo", org.grupo || "—"],
    ["Organização", org.organizacao || "—"],
    ["Status", org.status],
    ["Situação", org.situacao === "." ? "—" : org.situacao],
    ["Uniforme", detalhes.uniforme === "sim" ? "Sim" : detalhes.uniforme === "nao" ? "Não" : "—"],
    ["Cor do veículo", detalhes.corVeiculo || "—"],
  ];
  if (cfg.incluirContatos) {
    ficha.push(
      ["Contato 1", `${detalhes.nome1 || "—"} · ${detalhes.telefone1 || "—"}`],
      ["Contato 2", `${detalhes.nome2 || "—"} · ${detalhes.telefone2 || "—"}`],
      ["Contato 3", `${detalhes.nome3 || "—"} · ${detalhes.telefone3 || "—"}`]
    );
  }
  if (detalhes.anotacoesSobre.trim()) ficha.push(["Anotações", detalhes.anotacoesSobre.trim()]);

  tituloSecao(d, "Ficha da organização", margem, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    body: ficha,
    theme: "plain",
    margin: { left: margem, right: margem },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: { bottom: 0.5 } as never,
    },
    columnStyles: { 0: { cellWidth: 130, textColor: PDF_THEME.inkSoft } },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;

  const alturaPagina = doc.internal.pageSize.getHeight();
  /** Garante espaço; cria nova página quando necessário. */
  const espaco = (h: number) => {
    if (y + h > alturaPagina - 46) {
      doc.addPage();
      y = 48;
    }
  };

  // ---------- VIP FAC ----------
  if (cfg.incluirVips && detalhes.vips.length > 0) {
    espaco(40 + detalhes.vips.length * 14);
    tituloSecao(d, "VIP FAC", margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      body: detalhes.vips.map((v) => [v.label || "—"]),
      theme: "plain",
      margin: { left: margem, right: margem },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
    });
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;
  }

  // ---------- Gráficos de online ----------
  const faixaLabel = FAIXAS_HORARIAS.find((f) => f.id === cfg.faixa)?.label ?? "Todas as horas";
  const serie = serieHistoricoSetagem(online);

  if (cfg.incluirOnlineResumo && serie.length > 0) {
    espaco(180);
    const amostra = serie.slice(-24);
    graficoLinha(d, {
      x: margem,
      y,
      w: conteudo,
      h: 168,
      titulo: `Evolução do online — ${labelPeriodoComIntervalo(cfg.periodo, cfg.intervalo)} · ${faixaLabel}`,
      dados: amostra.map((p) => ({
        label: new Date(p.capturedAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
        }),
        valor: p.amount,
      })),
    });
    y += 168 + 20;
  }

  if (cfg.incluirPicoPorHora && online.length > 0) {
    const horas = picoPorHora(online).filter((h) => h.pico > 0);
    espaco(180);
    graficoBarras(d, {
      x: margem,
      y,
      w: conteudo,
      h: 168,
      titulo: "Maior pico por hora",
      dados: horas.map((h) => ({ label: h.label, valor: h.pico })),
    });
    y += 168 + 20;
  }

  if (cfg.incluirOnlineRegistros && cfg.limiteRegistros > 0 && serie.length > 0) {
    const lista = serie.slice(-cfg.limiteRegistros).reverse();
    espaco(60);
    tituloSecao(d, "Registros de online", margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["Quando", "Online"]],
      body: lista.map((p) => [fmtDataHora(p.capturedAt), String(p.amount)]),
      theme: "plain",
      margin: { left: margem, right: margem },
      styles: {
        fontSize: 8,
        cellPadding: { top: 4.5, bottom: 4.5, left: 8, right: 8 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
    });
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;
  }

  // ---------- Jurídico ----------
  const blocos: { titulo: string; tipo: "denuncia" | "var" }[] = [];
  if (cfg.incluirDenuncias) blocos.push({ titulo: "Denúncias", tipo: "denuncia" });
  if (cfg.incluirPunicoes) blocos.push({ titulo: "Punições · Júri (VAR)", tipo: "var" });

  for (const bloco of blocos) {
    const lista = registros.filter((r) => r.tipo === bloco.tipo);
    espaco(80);
    tituloSecao(d, `${bloco.titulo} — ${lista.length} registro(s)`, margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Ticket", "ID / Jogador", "Motivo / Resultado", "Punição", "Staff"]],
      body:
        lista.length > 0
          ? lista.map((r) => [
              fmtDataHora(r.data_punicao),
              r.ticket_id || "—",
              `${r.jogador_id || "—"}${r.jogador ? ` · ${r.jogador}` : ""}`,
              r.motivo || r.resultado || "—",
              `${r.punicao || "—"}${r.duracao ? ` · ${r.duracao}` : ""}`,
              r.staff || "—",
            ])
          : [["—", "—", "Nenhum registro no recorte", "—", "—", "—"]],
      theme: "plain",
      margin: { left: margem, right: margem },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 4.5, bottom: 4.5, left: 8, right: 8 },
        overflow: "linebreak",
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
    });
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;
  }

  if (org.limpoEm) {
    espaco(30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.inkSoft);
    doc.text(
      `Recorte a partir da última limpeza da facção (${fmtDataHora(org.limpoEm)}${org.limpoPor ? ` por ${org.limpoPor}` : ""}). Registros anteriores permanecem em /punicoes.`,
      margem,
      Math.min(y, alturaPagina - 24)
    );
  }

  if (opts.salvar === false) return doc;
  doc.save(
    `relatorio-${org.setagem.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`
  );
  return doc;
}

/** Mantém apenas registros jurídicos dentro do período (pela data da punição) e após a limpeza. */
export function filtrarRegistrosPorPeriodo(
  registros: PunicaoRow[],
  inicio: Date | null,
  limpoEm: string | null,
  fim?: Date | null
): PunicaoRow[] {
  const corte = [inicio?.getTime(), limpoEm ? new Date(limpoEm).getTime() : undefined]
    .filter((v): v is number => typeof v === "number")
    .reduce((a, b) => Math.max(a, b), -Infinity);
  const teto = fim?.getTime();
  return registros.filter((r) => {
    const t = new Date(r.data_punicao).getTime();
    if (Number.isNaN(t) || t < corte) return false;
    return teto === undefined || t <= teto;
  });
}
