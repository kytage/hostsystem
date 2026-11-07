import {
  contagemPor,
  parseLista,
  rankingStaff,
  USERSETS,
  type PunicaoRow,
  type PunicaoTipo,
} from "@/lib/punicoes";

/** Configuração completa do relatório escolhida pelo usuário no dialog. */
export interface RelatorioConfig {
  titulo: string;
  observacao: string;
  /** "denuncia" | "var" | "ambos" */
  tipo: PunicaoTipo | "ambos";
  /** ISO (yyyy-mm-dd) — vazio = sem limite. */
  de: string;
  ate: string;
  usersets: string[];
  motivos: string[];
  punicoes: string[];
  staffs: string[];
  jogador: string;
  /** Seções incluídas no PDF. */
  incluirResumo: boolean;
  incluirMotivos: boolean;
  incluirUsersets: boolean;
  incluirRanking: boolean;
  incluirTabela: boolean;
  incluirObservacoes: boolean;
  /** Layout. */
  orientacao: "portrait" | "landscape";
  ordem: "recentes" | "antigos";
  limite: number;
}

export const RELATORIO_PADRAO: RelatorioConfig = {
  titulo: "Relatório de Punições",
  observacao: "",
  tipo: "ambos",
  de: "",
  ate: "",
  usersets: [],
  motivos: [],
  punicoes: [],
  staffs: [],
  jogador: "",
  incluirResumo: true,
  incluirMotivos: true,
  incluirUsersets: true,
  incluirRanking: true,
  incluirTabela: true,
  incluirObservacoes: false,
  orientacao: "landscape",
  ordem: "recentes",
  limite: 0,
};

const labelUserset = (key: string) =>
  USERSETS.find((u) => u.key === key)?.label ?? (key || "—");

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDia = (iso: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Aplica todos os filtros da configuração sobre os registros. */
export function filtrarRelatorio(rows: PunicaoRow[], cfg: RelatorioConfig): PunicaoRow[] {
  const termo = cfg.jogador.trim().toLowerCase();
  const de = cfg.de ? new Date(`${cfg.de}T00:00:00`) : null;
  const ate = cfg.ate ? new Date(`${cfg.ate}T23:59:59`) : null;

  const out = rows.filter((r) => {
    if (cfg.tipo !== "ambos" && r.tipo !== cfg.tipo) return false;
    const data = new Date(r.data_punicao);
    if (de && data < de) return false;
    if (ate && data > ate) return false;
    if (cfg.usersets.length > 0 && !cfg.usersets.includes(r.userset)) return false;
    if (cfg.motivos.length > 0 && !cfg.motivos.includes(r.motivo)) return false;
    if (cfg.punicoes.length > 0 && !cfg.punicoes.includes(r.punicao)) return false;
    if (cfg.staffs.length > 0 && !cfg.staffs.includes(r.staff)) return false;
    if (termo) {
      const alvo = [r.jogador, r.jogador_id, r.ticket_id].join(" ").toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  out.sort((a, b) => {
    const diff = new Date(b.data_punicao).getTime() - new Date(a.data_punicao).getTime();
    return cfg.ordem === "recentes" ? diff : -diff;
  });

  return cfg.limite > 0 ? out.slice(0, cfg.limite) : out;
}

/** Gera e baixa o PDF do relatório. Roda apenas no browser. */
export async function gerarRelatorioPdf(
  rows: PunicaoRow[],
  cfg: RelatorioConfig,
  meta: { autor: string }
): Promise<number> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const dados = filtrarRelatorio(rows, cfg);
  const doc = new jsPDF({ orientation: cfg.orientacao, unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 36;
  const vermelho: [number, number, number] = [206, 14, 14];
  let y = margem;

  // Cabeçalho
  doc.setFillColor(17, 17, 20);
  doc.rect(0, 0, largura, 74, "F");
  doc.setTextColor(...vermelho);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("HOST", margem, 34);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(cfg.titulo || "Relatório de Punições", margem, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(190, 190, 195);
  doc.text(`Gerado em ${fmtData(new Date().toISOString())} por ${meta.autor || "—"}`, largura - margem, 55, {
    align: "right",
  });
  y = 96;

  // Filtros aplicados
  const filtros: string[] = [];
  filtros.push(
    `Tipo: ${cfg.tipo === "ambos" ? "Denúncias + VAR" : cfg.tipo === "var" ? "VAR" : "Denúncias"}`
  );
  const periodo =
    fmtDia(cfg.de) || fmtDia(cfg.ate)
      ? `${fmtDia(cfg.de) ?? "início"} até ${fmtDia(cfg.ate) ?? "hoje"}`
      : "Histórico completo";
  filtros.push(`Período: ${periodo}`);
  if (cfg.usersets.length) filtros.push(`Userset: ${cfg.usersets.map(labelUserset).join(", ")}`);
  if (cfg.motivos.length) filtros.push(`Motivos: ${cfg.motivos.join(", ")}`);
  if (cfg.punicoes.length) filtros.push(`Punições: ${cfg.punicoes.join(", ")}`);
  if (cfg.staffs.length) filtros.push(`Staff: ${cfg.staffs.join(", ")}`);
  if (cfg.jogador.trim()) filtros.push(`Busca: ${cfg.jogador.trim()}`);

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

  const secao = (titulo: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(20, 20, 25);
    doc.text(titulo.toUpperCase(), margem, y);
    doc.setDrawColor(...vermelho);
    doc.setLineWidth(1.4);
    doc.line(margem, y + 4, margem + 28, y + 4);
    doc.setFont("helvetica", "normal");
    y += 18;
  };

  const tabela = (head: string[], body: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.length ? body : [head.map(() => "—")],
      margin: { left: margem, right: margem },
      styles: { fontSize: 8, cellPadding: 4, textColor: [45, 45, 50], overflow: "linebreak" },
      headStyles: { fillColor: [24, 24, 28], textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [246, 246, 248] },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  };

  const quebra = (altura = 90) => {
    if (y + altura > doc.internal.pageSize.getHeight() - margem) {
      doc.addPage();
      y = margem;
    }
  };

  if (cfg.incluirResumo) {
    quebra(110);
    secao("Resumo");
    const denuncias = dados.filter((r) => r.tipo === "denuncia").length;
    const vars = dados.filter((r) => r.tipo === "var").length;
    const bans = dados.filter((r) => /ban/i.test(r.punicao)).length;
    const cards: [string, string][] = [
      ["Total de registros", String(dados.length)],
      ["Denúncias", String(denuncias)],
      ["VAR (hack)", String(vars)],
      ["Banimentos", String(bans)],
      ["Jogadores distintos", String(new Set(dados.map((r) => r.jogador_id || r.jogador)).size)],
      ["Staffs envolvidos", String(new Set(dados.map((r) => r.staff)).size)],
    ];
    const largCard = (largura - margem * 2 - 5 * 8) / 6;
    cards.forEach(([label, valor], i) => {
      const x = margem + i * (largCard + 8);
      doc.setFillColor(246, 246, 248);
      doc.setDrawColor(225, 225, 230);
      doc.setLineWidth(0.6);
      doc.roundedRect(x, y, largCard, 46, 5, 5, "FD");
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 118);
      doc.text(doc.splitTextToSize(label.toUpperCase(), largCard - 12), x + 7, y + 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(20, 20, 25);
      doc.text(valor, x + 7, y + 38);
      doc.setFont("helvetica", "normal");
    });
    y += 46 + 24;
  }

  if (cfg.incluirMotivos) {
    quebra();
    secao("Motivos");
    const total = dados.length || 1;
    tabela(
      ["Motivo", "Registros", "% do total"],
      contagemPor(dados, "motivo").map((m) => [
        m.nome,
        m.total,
        `${((m.total / total) * 100).toFixed(1)}%`,
      ])
    );
  }

  if (cfg.incluirUsersets) {
    quebra();
    secao("Usersets");
    const total = dados.length || 1;
    tabela(
      ["Userset", "Registros", "% do total"],
      contagemPor(dados, "userset").map((m) => [
        m.nome,
        m.total,
        `${((m.total / total) * 100).toFixed(1)}%`,
      ])
    );
  }

  if (cfg.incluirRanking) {
    quebra();
    secao("Ranking de staff");
    tabela(
      ["#", "Staff", "Punições aplicadas"],
      rankingStaff(dados, 20).map((r, i) => [i + 1, r.staff, r.total])
    );
  }

  if (cfg.incluirTabela) {
    quebra();
    secao(`Registros detalhados (${dados.length})`);
    const head = [
      "Data",
      "Tipo",
      "Ticket",
      "Jogador",
      "ID",
      "Userset",
      "Motivo / Resultado",
      "Punição",
      "Staff",
    ];
    const body = dados.map((r) => [
      fmtData(r.data_punicao),
      r.tipo === "var" ? "VAR" : "Denúncia",
      r.ticket_id || "—",
      r.jogador || "—",
      r.jogador_id || "—",
      [labelUserset(r.userset), r.userset_sub].filter(Boolean).join(" / "),
      r.tipo === "var" ? r.resultado || "—" : r.motivo || "—",
      [r.punicao, r.dias ? `${r.dias}d` : ""].filter(Boolean).join(" "),
      r.staff || "—",
    ]);
    if (cfg.incluirObservacoes) {
      head.push("Observação");
      dados.forEach((r, i) => {
        const extra = [r.observacao, parseLista(r.responsaveis).length ? `Resp.: ${parseLista(r.responsaveis).join(", ")}` : ""]
          .filter(Boolean)
          .join(" | ");
        body[i]!.push(extra || "—");
      });
    }
    tabela(head, body);
  }

  // Rodapé em todas as páginas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 148);
    doc.text("HOST — Registro de Punições", margem, doc.internal.pageSize.getHeight() - 16);
    doc.text(
      `Página ${i} de ${paginas}`,
      largura - margem,
      doc.internal.pageSize.getHeight() - 16,
      { align: "right" }
    );
  }

  const nome = `relatorio-punicoes-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nome);
  return dados.length;
}
