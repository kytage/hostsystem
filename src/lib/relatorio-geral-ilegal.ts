/**
 * Relatório GERAL do painel Ilegal: consolida todas as setagens cadastradas
 * com histórico de online (picos, médias, faixas horárias) e o jurídico
 * (denúncias e VAR), gerando rankings comparativos em PDF.
 *
 * Toda a filtragem é feita aqui (funções puras) para que a interface apenas
 * escolha opções e a geração do PDF seja previsível e testável.
 */
import {
  FAIXAS_HORARIAS,
  filtrarPorFaixa,
  INTERVALO_VAZIO,
  labelPeriodoComIntervalo,
  picoPorHora,
  seriePicoDiario,
  horasDaFaixa,
  type FaixaHoraria,
  type IntervaloDatas,
  type OnlinePeriodo,
  type SetOnlineRow,
} from "./ilegal-online";
import type { IlegalCategoria, IlegalOrg } from "./ilegal-data";
import type { PunicaoRow } from "./punicoes";
import {
  carregarLogoHost,
  graficoBarras,
  graficoLinha,
  kpi,
  PDF_THEME,
  tituloSecao,
  type PdfDoc,
} from "./relatorio-pdf-ui";

export type OrdenacaoGeral = "pico" | "media" | "punicoes" | "nome" | "categoria";

export const ORDENACOES_GERAL: { id: OrdenacaoGeral; label: string }[] = [
  { id: "pico", label: "Maior pico online" },
  { id: "media", label: "Maior média online" },
  { id: "punicoes", label: "Mais punições" },
  { id: "nome", label: "Nome da setagem" },
  { id: "categoria", label: "Categoria" },
];

export interface RelatorioGeralConfig {
  titulo: string;
  periodo: OnlinePeriodo;
  /** Datas do período "Personalizado" (YYYY-MM-DD). */
  intervalo: IntervaloDatas;
  faixa: FaixaHoraria;
  /** id da categoria (ilegal_orgs.categoria) ou "todas". */
  categoria: string;
  /** status da organização ou "todos". */
  status: string;
  /** Ignora setagens com pico abaixo deste valor. */
  minimoPico: number;
  /** Quantas linhas nos rankings (0 = todas). */
  limiteRanking: number;
  ordenacao: OrdenacaoGeral;
  /** Considera apenas setagens que possuem organização assumida. */
  somenteComOrganizacao: boolean;

  incluirKpis: boolean;
  incluirGraficoPicoDiario: boolean;
  incluirGraficoPicoHora: boolean;
  incluirRankingOnline: boolean;
  incluirRankingPunicoes: boolean;
  incluirComparativoCategoria: boolean;
  incluirTabelaGeral: boolean;
  incluirListaPunicoes: boolean;
  incluirListaVar: boolean;
  /** Máximo de registros jurídicos listados. */
  limiteRegistros: number;

  observacao: string;
  orientacao: "portrait" | "landscape";
}

export const RELATORIO_GERAL_DEFAULT: RelatorioGeralConfig = {
  titulo: "Relatório Geral — Ilegal",
  periodo: "7d",
  intervalo: INTERVALO_VAZIO,
  faixa: "pico",
  categoria: "todas",
  status: "todos",
  minimoPico: 0,
  limiteRanking: 15,
  ordenacao: "pico",
  somenteComOrganizacao: false,

  incluirKpis: true,
  incluirGraficoPicoDiario: true,
  incluirGraficoPicoHora: true,
  incluirRankingOnline: true,
  incluirRankingPunicoes: true,
  incluirComparativoCategoria: true,
  incluirTabelaGeral: true,
  incluirListaPunicoes: false,
  incluirListaVar: false,
  limiteRegistros: 40,

  observacao: "",
  orientacao: "portrait",
};

/** Linha consolidada de uma setagem no relatório geral. */
export interface LinhaGeral {
  setagem: string;
  organizacao: string;
  categoriaId: string;
  categoriaNome: string;
  status: string;
  pico: number;
  picoHora: number | null;
  picoAt: string | null;
  media: number;
  registros: number;
  denuncias: number;
  var: number;
  banimentos: number;
  total: number;
}

export interface DadosGerais {
  linhas: LinhaGeral[];
  /** Registros de online já filtrados (categoria/status/faixa/limpeza). */
  online: SetOnlineRow[];
  /** Registros jurídicos já filtrados. */
  registros: PunicaoRow[];
}

function chave(v: string): string {
  return (v ?? "").trim().toLowerCase();
}

function ehBanimento(r: PunicaoRow): boolean {
  const p = chave(r.punicao);
  return p.includes("banimento") || p === "banido";
}

/**
 * Consolida orgs + online + punições respeitando o marco de limpeza de cada
 * facção (`limpoEm`), que oculta histórico anterior apenas na visão do Ilegal.
 */
export function montarDadosGerais(
  categorias: IlegalCategoria[],
  onlineRows: SetOnlineRow[],
  punicoes: PunicaoRow[],
  cfg: RelatorioGeralConfig
): DadosGerais {
  const horas = new Set(horasDaFaixa(cfg.faixa));

  const orgs: { org: IlegalOrg; categoriaNome: string }[] = [];
  for (const cat of categorias) {
    if (cfg.categoria !== "todas" && cat.id !== cfg.categoria) continue;
    for (const org of cat.orgs) {
      if (!org.setagem.trim()) continue;
      if (cfg.status !== "todos" && org.status !== cfg.status) continue;
      if (cfg.somenteComOrganizacao && !org.organizacao.trim()) continue;
      orgs.push({ org, categoriaNome: cat.nome });
    }
  }

  const porSetagem = new Map<string, { org: IlegalOrg; categoriaNome: string }>();
  for (const item of orgs) porSetagem.set(chave(item.org.setagem), item);

  // ---- Online válido para o recorte ----
  const online: SetOnlineRow[] = [];
  for (const r of onlineRows) {
    const alvo = porSetagem.get(chave(r.set_name));
    if (!alvo) continue;
    if (!horas.has(r.hour)) continue;
    if (alvo.org.limpoEm && r.captured_at < alvo.org.limpoEm) continue;
    online.push(r);
  }

  // ---- Jurídico válido para o recorte ----
  const registros: PunicaoRow[] = [];
  for (const r of punicoes) {
    if (chave(r.userset) !== "ilegal") continue;
    const alvo = porSetagem.get(chave(r.userset_sub));
    if (!alvo) continue;
    if (alvo.org.limpoEm && r.data_punicao < alvo.org.limpoEm) continue;
    registros.push(r);
  }

  // ---- Agregações por setagem ----
  const agregado = new Map<
    string,
    { pico: number; picoHora: number | null; picoAt: string | null; soma: number; n: number }
  >();
  for (const r of online) {
    const k = chave(r.set_name);
    const cur =
      agregado.get(k) ?? { pico: 0, picoHora: null as number | null, picoAt: null as string | null, soma: 0, n: 0 };
    const v = Number(r.amount);
    cur.soma += v;
    cur.n += 1;
    if (v > cur.pico) {
      cur.pico = v;
      cur.picoHora = r.hour;
      cur.picoAt = r.captured_at;
    }
    agregado.set(k, cur);
  }

  const juri = new Map<string, { denuncias: number; var: number; banimentos: number }>();
  for (const r of registros) {
    const k = chave(r.userset_sub);
    const cur = juri.get(k) ?? { denuncias: 0, var: 0, banimentos: 0 };
    if (chave(r.tipo) === "var") cur.var += 1;
    else cur.denuncias += 1;
    if (ehBanimento(r)) cur.banimentos += 1;
    juri.set(k, cur);
  }

  let linhas: LinhaGeral[] = orgs.map(({ org, categoriaNome }) => {
    const k = chave(org.setagem);
    const a = agregado.get(k);
    const j = juri.get(k) ?? { denuncias: 0, var: 0, banimentos: 0 };
    return {
      setagem: org.setagem,
      organizacao: org.organizacao,
      categoriaId: org.categoria,
      categoriaNome,
      status: org.status,
      pico: a?.pico ?? 0,
      picoHora: a?.picoHora ?? null,
      picoAt: a?.picoAt ?? null,
      media: a && a.n > 0 ? Math.round((a.soma / a.n) * 10) / 10 : 0,
      registros: a?.n ?? 0,
      denuncias: j.denuncias,
      var: j.var,
      banimentos: j.banimentos,
      total: j.denuncias + j.var,
    };
  });

  if (cfg.minimoPico > 0) linhas = linhas.filter((l) => l.pico >= cfg.minimoPico);

  linhas.sort((a, b) => {
    switch (cfg.ordenacao) {
      case "media":
        return b.media - a.media || a.setagem.localeCompare(b.setagem);
      case "punicoes":
        return b.total - a.total || b.pico - a.pico;
      case "nome":
        return a.setagem.localeCompare(b.setagem);
      case "categoria":
        return (
          a.categoriaNome.localeCompare(b.categoriaNome) || b.pico - a.pico
        );
      default:
        return b.pico - a.pico || a.setagem.localeCompare(b.setagem);
    }
  });

  return { linhas, online, registros };
}

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

function limitar<T>(arr: T[], limite: number): T[] {
  return limite > 0 ? arr.slice(0, limite) : arr;
}

interface AutoTableDoc {
  lastAutoTable?: { finalY: number };
}

/** Gera e baixa o PDF do relatório geral do Ilegal. */
export async function gerarRelatorioGeralPdf(
  dados: DadosGerais,
  cfg: RelatorioGeralConfig,
  meta: { autor: string }
): Promise<void> {
  const [{ jsPDF }, autoTableModule, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    carregarLogoHost(),
  ]);
  const autoTable = autoTableModule.default;
  const { linhas, online, registros } = dados;

  const doc = new jsPDF({ orientation: cfg.orientacao, unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margem = 40;
  const conteudo = largura - margem * 2;
  const d = doc as unknown as PdfDoc;
  const faixaLabel = FAIXAS_HORARIAS.find((f) => f.id === cfg.faixa)?.label ?? "Todas as horas";

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
  doc.setFontSize(21);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text(cfg.titulo || "Relatório Geral — Ilegal", margem, 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.inkSoft);
  doc.text(
    [
      labelPeriodoComIntervalo(cfg.periodo, cfg.intervalo),
      faixaLabel,
      cfg.categoria === "todas" ? "Todas as categorias" : cfg.categoria,
      cfg.status === "todos" ? "Todos os status" : cfg.status,
      `${linhas.length} setagens`,
    ].join(" · "),
    margem,
    111
  );

  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.6);
  doc.line(margem, 124, largura - margem, 124);

  let y = 146;
  const espaco = (h: number) => {
    if (y + h > alturaPagina - 46) {
      doc.addPage();
      y = 48;
    }
  };

  if (cfg.observacao.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.ink);
    const obs = doc.splitTextToSize(cfg.observacao.trim(), conteudo);
    doc.text(obs, margem, y);
    y += obs.length * 12 + 16;
  }

  // ---------- KPIs ----------
  if (cfg.incluirKpis) {
    const topPico = linhas.reduce<LinhaGeral | null>(
      (max, l) => (max === null || l.pico > max.pico ? l : max),
      null
    );
    const somaPicos = linhas.reduce((acc, l) => acc + l.pico, 0);
    const mediaGeral =
      linhas.length > 0
        ? Math.round((linhas.reduce((acc, l) => acc + l.media, 0) / linhas.length) * 10) / 10
        : 0;
    const totalDen = linhas.reduce((acc, l) => acc + l.denuncias, 0);
    const totalVar = linhas.reduce((acc, l) => acc + l.var, 0);
    const totalBan = linhas.reduce((acc, l) => acc + l.banimentos, 0);

    const gap = 10;
    const w = (conteudo - gap * 3) / 4;
    espaco(90);
    kpi(
      d,
      margem,
      y,
      w,
      "Maior pico",
      topPico && topPico.pico > 0 ? String(topPico.pico) : "—",
      topPico && topPico.pico > 0
        ? `${topPico.setagem} · ${String(topPico.picoHora ?? 0).padStart(2, "0")}h`
        : "sem registros"
    );
    kpi(d, margem + w + gap, y, w, "Soma dos picos", String(somaPicos), `${linhas.length} setagens`);
    kpi(d, margem + (w + gap) * 2, y, w, "Média online", String(mediaGeral), faixaLabel);
    const h = kpi(
      d,
      margem + (w + gap) * 3,
      y,
      w,
      "Punições",
      String(totalDen + totalVar),
      `${totalDen} denúncias · ${totalVar} VAR · ${totalBan} bans`
    );
    y += h + 20;
  }

  // ---------- Gráfico: pico diário ----------
  if (cfg.incluirGraficoPicoDiario) {
    const serie = seriePicoDiario(online, horasDaFaixa(cfg.faixa)).slice(-21);
    espaco(190);
    graficoLinha(d, {
      x: margem,
      y,
      w: conteudo,
      h: 176,
      titulo: `Pico diário (todas as setagens) — ${labelPeriodoComIntervalo(cfg.periodo, cfg.intervalo)} · ${faixaLabel}`,
      dados: serie.map((p) => ({ label: p.label, valor: p.pico })),
    });
    y += 176 + 20;
  }

  // ---------- Gráfico: pico por hora ----------
  if (cfg.incluirGraficoPicoHora) {
    const horas = picoPorHora(online).filter((h) => h.pico > 0);
    espaco(190);
    graficoBarras(d, {
      x: margem,
      y,
      w: conteudo,
      h: 176,
      titulo: "Maior pico por hora do dia",
      dados: horas.map((h) => ({ label: h.label, valor: h.pico })),
    });
    y += 176 + 20;
  }

  // ---------- Ranking online ----------
  if (cfg.incluirRankingOnline) {
    const rank = limitar(
      [...linhas].sort((a, b) => b.pico - a.pico || b.media - a.media),
      cfg.limiteRanking
    );
    espaco(200);
    graficoBarras(d, {
      x: margem,
      y,
      w: conteudo,
      h: 176,
      titulo: "Ranking — maiores picos de online",
      dados: rank.slice(0, 12).map((l) => ({ label: l.setagem, valor: l.pico })),
    });
    y += 176 + 18;

    espaco(70);
    tituloSecao(d, "Ranking de online por setagem", margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["#", "Setagem", "Organização", "Categoria", "Pico", "Hora", "Quando", "Média"]],
      body: rank.map((l, i) => [
        String(i + 1),
        l.setagem,
        l.organizacao || "—",
        l.categoriaNome,
        String(l.pico),
        l.picoHora !== null ? `${String(l.picoHora).padStart(2, "0")}h` : "—",
        fmtDataHora(l.picoAt),
        String(l.media),
      ]),
      theme: "plain",
      margin: { left: margem, right: margem },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
      styles: {
        fontSize: 8,
        cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
    });
    y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 24;
  }

  // ---------- Ranking punições ----------
  if (cfg.incluirRankingPunicoes) {
    const rank = limitar(
      [...linhas].sort((a, b) => b.total - a.total || b.banimentos - a.banimentos),
      cfg.limiteRanking
    ).filter((l) => l.total > 0);

    espaco(200);
    graficoBarras(d, {
      x: margem,
      y,
      w: conteudo,
      h: 176,
      titulo: "Ranking — setagens com mais punições",
      dados: rank.slice(0, 12).map((l) => ({ label: l.setagem, valor: l.total })),
    });
    y += 176 + 18;

    espaco(70);
    tituloSecao(d, "Ranking jurídico por setagem", margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["#", "Setagem", "Organização", "Denúncias", "VAR", "Banimentos", "Total"]],
      body:
        rank.length > 0
          ? rank.map((l, i) => [
              String(i + 1),
              l.setagem,
              l.organizacao || "—",
              String(l.denuncias),
              String(l.var),
              String(l.banimentos),
              String(l.total),
            ])
          : [["—", "Nenhuma punição no recorte", "—", "0", "0", "0", "0"]],
      theme: "plain",
      margin: { left: margem, right: margem },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
      styles: {
        fontSize: 8,
        cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
    });
    y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 24;
  }

  // ---------- Comparativo por categoria ----------
  if (cfg.incluirComparativoCategoria) {
    const mapa = new Map<string, { pico: number; soma: number; n: number; punicoes: number }>();
    for (const l of linhas) {
      const cur = mapa.get(l.categoriaNome) ?? { pico: 0, soma: 0, n: 0, punicoes: 0 };
      cur.pico = Math.max(cur.pico, l.pico);
      cur.soma += l.media;
      cur.n += 1;
      cur.punicoes += l.total;
      mapa.set(l.categoriaNome, cur);
    }
    const cats = [...mapa.entries()].sort((a, b) => b[1].pico - a[1].pico);

    espaco(200);
    graficoBarras(d, {
      x: margem,
      y,
      w: conteudo,
      h: 176,
      titulo: "Comparativo por categoria — maior pico",
      dados: cats.map(([nome, v]) => ({ label: nome, valor: v.pico })),
    });
    y += 176 + 18;

    espaco(70);
    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Setagens", "Maior pico", "Média das médias", "Punições"]],
      body: cats.map(([nome, v]) => [
        nome,
        String(v.n),
        String(v.pico),
        String(Math.round((v.soma / Math.max(1, v.n)) * 10) / 10),
        String(v.punicoes),
      ]),
      theme: "plain",
      margin: { left: margem, right: margem },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
      styles: {
        fontSize: 8,
        cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
    });
    y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 24;
  }

  // ---------- Tabela geral ----------
  if (cfg.incluirTabelaGeral) {
    espaco(70);
    tituloSecao(d, "Visão geral das setagens", margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [
        ["Setagem", "Organização", "Categoria", "Status", "Pico", "Média", "Capturas", "Den.", "VAR"],
      ],
      body: linhas.map((l) => [
        l.setagem,
        l.organizacao || "—",
        l.categoriaNome,
        l.status,
        String(l.pico),
        String(l.media),
        String(l.registros),
        String(l.denuncias),
        String(l.var),
      ]),
      theme: "plain",
      margin: { left: margem, right: margem },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
    });
    y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 24;
  }

  // ---------- Listas jurídicas ----------
  const listar = (titulo: string, itens: PunicaoRow[]) => {
    espaco(70);
    tituloSecao(d, titulo, margem, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Setagem", "Jogador", "ID", "Motivo/Resultado", "Punição", "Staff"]],
      body:
        itens.length > 0
          ? itens.map((r) => [
              fmtDataHora(r.data_punicao),
              r.userset_sub || "—",
              r.jogador || "—",
              r.jogador_id || "—",
              (r.motivo || r.resultado || "—").slice(0, 42),
              r.punicao || "—",
              r.staff || "—",
            ])
          : [["—", "—", "Nenhum registro no recorte", "—", "—", "—", "—"]],
      theme: "plain",
      margin: { left: margem, right: margem },
      headStyles: { fontStyle: "bold", textColor: PDF_THEME.inkSoft, fontSize: 7.5 },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        textColor: PDF_THEME.ink,
        lineColor: PDF_THEME.line,
        lineWidth: { bottom: 0.5 } as never,
      },
    });
    y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 24;
  };

  const ordenados = [...registros].sort((a, b) => b.data_punicao.localeCompare(a.data_punicao));
  if (cfg.incluirListaPunicoes) {
    listar(
      "Denúncias",
      limitar(
        ordenados.filter((r) => chave(r.tipo) !== "var"),
        cfg.limiteRegistros
      )
    );
  }
  if (cfg.incluirListaVar) {
    listar(
      "Punições · VAR",
      limitar(
        ordenados.filter((r) => chave(r.tipo) === "var"),
        cfg.limiteRegistros
      )
    );
  }

  doc.save(`relatorio-geral-ilegal-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Exporta a visão geral em CSV, para análise em planilha. */
export function exportarGeralCsv(linhas: LinhaGeral[]): void {
  const head = [
    "setagem",
    "organizacao",
    "categoria",
    "status",
    "pico",
    "pico_hora",
    "pico_em",
    "media",
    "capturas",
    "denuncias",
    "var",
    "banimentos",
  ];
  const corpo = linhas.map((l) =>
    [
      l.setagem,
      l.organizacao,
      l.categoriaNome,
      l.status,
      l.pico,
      l.picoHora ?? "",
      l.picoAt ?? "",
      l.media,
      l.registros,
      l.denuncias,
      l.var,
      l.banimentos,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";")
  );
  const csv = [head.join(";"), ...corpo].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-geral-ilegal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reexport utilitário para a interface (prévia usando os mesmos filtros). */
export { filtrarPorFaixa };
