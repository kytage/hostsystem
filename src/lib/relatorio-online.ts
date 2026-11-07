import {
  labelPeriodo,
  type FaixaHoraria,
  type OnlinePeriodo,
  type RankingSetOnline,
  FAIXAS_HORARIAS,
} from "./ilegal-online";

export type OrdenacaoRelatorio = "pico" | "media" | "registros" | "nome" | "categoria";

export const ORDENACOES_RELATORIO: { value: OrdenacaoRelatorio; label: string }[] = [
  { value: "pico", label: "Maior pico" },
  { value: "media", label: "Maior média" },
  { value: "registros", label: "Mais registros" },
  { value: "nome", label: "Nome (A-Z)" },
  { value: "categoria", label: "Categoria" },
];

export interface RelatorioOnlineConfig {
  titulo: string;
  periodo: OnlinePeriodo;
  categoria: string | "todas";
  /** Setagem/organização específica ("todas" = todas do recorte). */
  setagem: string | "todas";
  faixa: FaixaHoraria;
  busca: string;
  /** Ignora setagens com pico abaixo deste valor. */
  minimo: number;
  limite: number;
  ordenar: OrdenacaoRelatorio;
  observacao: string;
  incluirMedia: boolean;
  incluirRegistros: boolean;
  incluirHora: boolean;
  incluirQuando: boolean;
  /** Bloco de totais agrupados por categoria antes da tabela. */
  incluirResumoCategoria: boolean;
  orientacao: "portrait" | "landscape";
}

export const RELATORIO_ONLINE_DEFAULT: RelatorioOnlineConfig = {
  titulo: "Relatório de Online — Facções",
  periodo: "7d",
  categoria: "todas",
  setagem: "todas",
  faixa: "todas",
  busca: "",
  minimo: 0,
  limite: 50,
  ordenar: "pico",
  observacao: "",
  incluirMedia: true,
  incluirRegistros: true,
  incluirHora: true,
  incluirQuando: true,
  incluirResumoCategoria: true,
  orientacao: "portrait",
};

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Aplica os filtros/ordenação do relatório sobre o ranking base. */
export function aplicarFiltrosRelatorio(
  ranking: RankingSetOnline[],
  cfg: RelatorioOnlineConfig
): RankingSetOnline[] {
  const filtrado = ranking.filter((r) => {
    if (cfg.categoria !== "todas" && r.category !== cfg.categoria) return false;
    if (cfg.setagem !== "todas" && r.setName !== cfg.setagem) return false;
    if (r.pico < cfg.minimo) return false;
    return true;
  });

  const ordenado = [...filtrado].sort((a, b) => {
    switch (cfg.ordenar) {
      case "media":
        return b.media - a.media || b.pico - a.pico;
      case "registros":
        return b.registros - a.registros || b.pico - a.pico;
      case "nome":
        return a.setLabel.localeCompare(b.setLabel);
      case "categoria":
        return a.category.localeCompare(b.category) || b.pico - a.pico;
      default:
        return b.pico - a.pico || a.setLabel.localeCompare(b.setLabel);
    }
  });

  return cfg.limite > 0 ? ordenado.slice(0, cfg.limite) : ordenado;
}

/**
 * Gera e baixa o PDF do ranking de online. Roda apenas no browser
 * (imports dinâmicos evitam quebrar o SSR).
 */
export async function gerarRelatorioOnlinePdf(
  ranking: RankingSetOnline[],
  cfg: RelatorioOnlineConfig,
  meta: { autor: string }
): Promise<number> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const dados = aplicarFiltrosRelatorio(ranking, cfg);
  const doc = new jsPDF({ orientation: cfg.orientacao, unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 36;
  const vermelho: [number, number, number] = [206, 14, 14];

  doc.setFillColor(17, 17, 20);
  doc.rect(0, 0, largura, 74, "F");
  doc.setTextColor(...vermelho);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("HOST", margem, 34);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(cfg.titulo || "Relatório de Online", margem, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(190, 190, 195);
  doc.text(
    `Gerado em ${fmtDataHora(new Date().toISOString())} por ${meta.autor || "—"}`,
    largura - margem,
    55,
    { align: "right" }
  );

  let y = 96;
  const faixaLabel =
    FAIXAS_HORARIAS.find((f) => f.id === cfg.faixa)?.label ?? "Todas as horas";
  const ordenarLabel =
    ORDENACOES_RELATORIO.find((o) => o.value === cfg.ordenar)?.label ?? cfg.ordenar;
  const filtros = [
    `Período: ${labelPeriodo(cfg.periodo)}`,
    `Categoria: ${cfg.categoria === "todas" ? "Todas" : cfg.categoria}`,
    `Setagem: ${cfg.setagem === "todas" ? "Todas" : cfg.setagem}`,
    `Horário: ${faixaLabel}`,
    `Ordenado por: ${ordenarLabel}`,
    `Setagens: ${dados.length}`,
  ];
  if (cfg.minimo > 0) filtros.push(`Pico mínimo: ${cfg.minimo}`);
  if (cfg.busca.trim()) filtros.push(`Busca: ${cfg.busca.trim()}`);

  doc.setTextColor(90, 90, 95);
  doc.setFontSize(8.5);
  const linhas = doc.splitTextToSize(filtros.join("   •   "), largura - margem * 2);
  doc.text(linhas, margem, y);
  y += linhas.length * 11 + 10;

  if (cfg.observacao.trim()) {
    doc.setTextColor(40, 40, 45);
    doc.setFontSize(9);
    const obs = doc.splitTextToSize(cfg.observacao.trim(), largura - margem * 2);
    doc.text(obs, margem, y);
    y += obs.length * 12 + 8;
  }

  // Resumo
  const picoGeral = dados.reduce((max, r) => Math.max(max, r.pico), 0);
  const somaPicos = dados.reduce((acc, r) => acc + r.pico, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 25);
  doc.text(
    `Maior pico: ${picoGeral} online   |   Soma dos picos: ${somaPicos}`,
    margem,
    y
  );
  y += 14;

  if (cfg.incluirResumoCategoria && dados.length > 0) {
    const porCategoria = new Map<string, { pico: number; soma: number; n: number }>();
    for (const r of dados) {
      const acc = porCategoria.get(r.category) ?? { pico: 0, soma: 0, n: 0 };
      acc.pico = Math.max(acc.pico, r.pico);
      acc.soma += r.pico;
      acc.n += 1;
      porCategoria.set(r.category, acc);
    }
    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Setagens", "Maior pico", "Soma dos picos"]],
      body: [...porCategoria.entries()]
        .sort((a, b) => b[1].pico - a[1].pico)
        .map(([cat, v]) => [cat, String(v.n), String(v.pico), String(v.soma)]),
      margin: { left: margem, right: margem },
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [40, 40, 45], textColor: 255, fontStyle: "bold" },
    });
    // @ts-expect-error autoTable injeta lastAutoTable no doc
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  const head = [
    [
      "#",
      "Setagem",
      "Categoria",
      "Pico",
      ...(cfg.incluirHora ? ["Hora"] : []),
      ...(cfg.incluirQuando ? ["Quando"] : []),
      ...(cfg.incluirMedia ? ["Média"] : []),
      ...(cfg.incluirRegistros ? ["Registros"] : []),
    ],
  ];
  const body = dados.map((r, i) => [
    String(i + 1),
    r.setLabel,
    r.category,
    String(r.pico),
    ...(cfg.incluirHora ? [`${String(r.picoHora).padStart(2, "0")}h`] : []),
    ...(cfg.incluirQuando ? [fmtDataHora(r.picoAt)] : []),
    ...(cfg.incluirMedia ? [String(r.media)] : []),
    ...(cfg.incluirRegistros ? [String(r.registros)] : []),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margem, right: margem },
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: vermelho, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 246, 248] },
  });

  const alvo = cfg.setagem !== "todas" ? `-${cfg.setagem}` : "";
  const nome = `relatorio-online-${cfg.periodo}${alvo}-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(nome);
  return dados.length;
}

/** Exporta o ranking em CSV (sem dependências externas). */
export function exportarRankingCsv(ranking: RankingSetOnline[]): void {
  const linhas = [
    ["Posicao", "Setagem", "Categoria", "Pico", "Hora", "Quando", "Media", "Registros"],
    ...ranking.map((r, i) => [
      String(i + 1),
      r.setLabel,
      r.category,
      String(r.pico),
      String(r.picoHora),
      r.picoAt,
      String(r.media),
      String(r.registros),
    ]),
  ];
  const csv = linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking-online-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
