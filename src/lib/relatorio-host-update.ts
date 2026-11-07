import type { DevTask, ColumnId } from "@/lib/dev-tasks";
import { supabase } from "@/integrations/supabase/client";
import { carregarLogoHost, type RGB } from "@/lib/relatorio-pdf-ui";
import { parseEstrutura, progressoEstrutura, type EstruturaGrupo } from "@/lib/update-estrutura";

/**
 * Relatório HOST UPDATE 2.1 em formato de apresentação horizontal 1920x1080,
 * com gráficos (rosca de status, barras por projeto e por responsável) e
 * um slide por projeto com subtítulos/itens da estrutura.
 */

const STATUS: { id: ColumnId; label: string; color: RGB }[] = [
  { id: "backlog", label: "Planejado", color: [130, 130, 140] },
  { id: "doing", label: "Em andamento", color: [244, 196, 48] },
  { id: "review", label: "Em teste", color: [74, 144, 226] },
  { id: "done", label: "Concluído", color: [52, 199, 120] },
];
const BG: RGB = [12, 12, 14];
const CARD: RGB = [24, 24, 28];
const LINE: RGB = [44, 44, 50];
const INK: RGB = [245, 245, 247];
const SOFT: RGB = [150, 150, 160];
const ACCENT: RGB = [244, 207, 40];
const W = 1920;
const H = 1080;
const M = 96;

function plain(value: string): string {
  return value.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, "")
    .replace(/```/g, "").replace(/\*\*|`/g, "").replace(/_([^_]+)_/g, "$1")
    .replace(/➡|→/g, "-").trim();
}
const statusOf = (id: ColumnId): (typeof STATUS)[number] => STATUS.find((s) => s.id === id) ?? STATUS[0]!;

/** Busca a estrutura atual de cada projeto; falha silenciosa mantém o relatório. */
async function carregarEstruturas(ids: string[]): Promise<Map<string, EstruturaGrupo[]>> {
  const map = new Map<string, EstruturaGrupo[]>();
  if (!ids.length) return map;
  const { data } = await supabase.from("dev_tasks").select("id, estrutura").in("id", ids);
  for (const row of data ?? []) map.set(row.id as string, parseEstrutura((row as { estrutura: unknown }).estrutura));
  return map;
}

export async function gerarRelatorioHostUpdate(tasks: DevTask[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const [logo, estruturas] = await Promise.all([carregarLogoHost(), carregarEstruturas(tasks.map((t) => t.id))]);
  const doc = new jsPDF({ unit: "px", format: [W, H], orientation: "landscape", compress: true, hotfixes: ["px_scaling"] });
  const generated = new Date();
  const date = generated.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  const text = (v: string, x: number, y: number, size = 20, bold = false, color = INK, align: "left" | "right" | "center" = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(plain(v), x, y, { align });
  };
  const fit = (v: string, maxW: number, size: number, bold = false): string => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    let s = plain(v); if (doc.getTextWidth(s) <= maxW) return s;
    while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
    return s + "…";
  };
  const card = (x: number, y: number, w: number, h: number) => { doc.setFillColor(...CARD); doc.roundedRect(x, y, w, h, 24, 24, "F"); };
  const bar = (x: number, y: number, w: number, h: number, pct: number, color: RGB) => {
    doc.setFillColor(...LINE); doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    if (pct > 0) { doc.setFillColor(...color); doc.roundedRect(x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2, h / 2, "F"); }
  };
  /** Rosca desenhada com triângulos finos (jsPDF não possui arcos preenchidos). */
  const donut = (cx: number, cy: number, r: number, thick: number, parts: { value: number; color: RGB }[]) => {
    const total = parts.reduce((a, p) => a + p.value, 0);
    let ang = -Math.PI / 2;
    const seg = (a0: number, a1: number, color: RGB) => {
      doc.setFillColor(...color);
      const steps = Math.max(2, Math.ceil((a1 - a0) / 0.03));
      for (let i = 0; i < steps; i++) {
        const t0 = a0 + (a1 - a0) * i / steps, t1 = a0 + (a1 - a0) * (i + 1) / steps + 0.004;
        const p = (t: number, rr: number) => [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr] as const;
        const [ax, ay] = p(t0, r), [bx, by] = p(t1, r), [cx2, cy2] = p(t1, r - thick), [dx, dy] = p(t0, r - thick);
        doc.triangle(ax, ay, bx, by, cx2, cy2, "F"); doc.triangle(ax, ay, cx2, cy2, dx, dy, "F");
      }
    };
    if (!total) { seg(0, Math.PI * 2, LINE); return; }
    for (const part of parts) { if (!part.value) continue; const a1 = ang + Math.PI * 2 * part.value / total; seg(ang, a1, part.color); ang = a1; }
  };
  const slide = (section: string, first = false) => {
    if (!first) doc.addPage([W, H], "landscape");
    doc.setFillColor(...BG); doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...ACCENT); doc.rect(M, 64, 56, 6, "F");
    text("HOST UPDATE 2.1", M, 110, 22, true);
    text(section, M + 240, 110, 18, false, SOFT);
    text(`${date} • Brasília`, W - M, 110, 18, false, SOFT, "right");
  };

  doc.setProperties({ title: "HOST UPDATE 2.1 — Relatório de progresso", author: "HOST" });

  // ---------- Slide 1: visão geral ----------
  const counts = STATUS.map((s) => ({ ...s, count: tasks.filter((t) => t.column === s.id).length }));
  const done = counts[3]?.count ?? 0;
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const allItems = tasks.flatMap((t) => (estruturas.get(t.id) ?? []).flatMap((g) => g.itens));
  const itemsDone = allItems.filter((i) => i.status === "done").length;

  slide("RELATÓRIO DE PROGRESSO", true);
  if (logo) { const lw = 150; doc.addImage(logo.dataUrl, "PNG", M, 170, lw, lw * logo.height / logo.width); }
  text("Uma visão completa", M, 380, 76, true);
  text("da próxima atualização.", M, 470, 76, true, ACCENT);
  text("Panorama de todos os projetos, entregas e responsáveis.", M, 530, 26, false, SOFT);

  const kpis: [string, string][] = [
    [`${percent}%`, "Projetos concluídos"], [String(tasks.length), "Projetos no total"],
    [`${itemsDone}/${allItems.length}`, "Itens entregues"], [String((counts[1]?.count ?? 0) + (counts[2]?.count ?? 0)), "Em execução"],
  ];
  const kw = (1000 - 3 * 24) / 4;
  kpis.forEach(([v, l], i) => {
    const x = M + i * (kw + 24); card(x, 620, kw, 200);
    text(v, x + 32, 720, 64, true, i === 0 ? ACCENT : INK); text(l.toUpperCase(), x + 32, 776, 16, true, SOFT);
  });
  text("PROGRESSO GERAL", M, 890, 16, true, SOFT);
  bar(M, 912, 1000, 18, tasks.length ? done / tasks.length : 0, ACCENT);

  const cx = 1500, cy = 520;
  card(1180, 170, 644, 820);
  donut(cx, cy - 40, 220, 56, counts.map((c) => ({ value: c.count, color: c.color })));
  text(`${percent}%`, cx, cy - 30, 72, true, INK, "center");
  text("CONCLUÍDO", cx, cy + 10, 16, true, SOFT, "center");
  counts.forEach((c, i) => {
    const y = 790 + i * 46;
    doc.setFillColor(...c.color); doc.circle(1240, y - 6, 9, "F");
    text(c.label, 1264, y, 24); text(String(c.count), 1764, y, 26, true, INK, "right");
  });

  // ---------- Slide 2: gráficos por projeto e responsável ----------
  slide("ANÁLISE DOS PROJETOS");
  text("Progresso por projeto", M, 200, 44, true);
  card(M, 240, 1060, 760);
  const rows = tasks.slice(0, 14);
  const rh = Math.min(52, 700 / Math.max(1, rows.length));
  rows.forEach((t, i) => {
    const y = 290 + i * rh;
    const st = statusOf(t.column);
    const pr = progressoEstrutura(estruturas.get(t.id) ?? []);
    const pct = pr.total ? pr.feitos / pr.total : t.column === "done" ? 1 : 0;
    text(fit(t.title, 360, 20, true), M + 32, y + 6, 20, true);
    bar(M + 410, y - 8, 480, 16, pct, st.color);
    text(pr.total ? `${pr.feitos}/${pr.total}` : st.label, M + 1030, y + 6, 18, false, SOFT, "right");
  });
  if (!rows.length) text("Nenhum projeto registrado.", M + 32, 300, 22, false, SOFT);
  if (tasks.length > rows.length) text(`+ ${tasks.length - rows.length} projetos`, M + 32, 985, 16, false, SOFT);

  text("Carga por responsável", 1220, 200, 44, true);
  card(1220, 240, 604, 760);
  const load = new Map<string, number>();
  for (const t of tasks) {
    const its = (estruturas.get(t.id) ?? []).flatMap((g) => g.itens);
    if (its.length) for (const it of its) for (const k of it.responsaveis.length ? it.responsaveis : ["Não definido"]) load.set(k, (load.get(k) ?? 0) + 1);
    else { const k = t.assignee || "Não definido"; load.set(k, (load.get(k) ?? 0) + 1); }
  }
  const ranked = [...load.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = ranked[0]?.[1] ?? 1;
  ranked.forEach(([name, n], i) => {
    const y = 300 + i * 68;
    text(fit(name, 380, 20, true), 1252, y, 20, true);
    text(String(n), 1792, y, 20, true, ACCENT, "right");
    bar(1252, y + 16, 540, 12, n / max, ACCENT);
  });

  // ---------- Slides por projeto ----------
  tasks.forEach((t, idx) => {
    const st = statusOf(t.column);
    const grupos = estruturas.get(t.id) ?? [];
    const pr = progressoEstrutura(grupos);
    slide(`PROJETO ${String(idx + 1).padStart(2, "0")} / ${tasks.length}`);
    doc.setFillColor(...st.color); doc.roundedRect(M, 160, 220, 44, 22, 22, "F");
    text(st.label.toUpperCase(), M + 110, 189, 18, true, BG, "center");
    doc.setFont("helvetica", "bold"); doc.setFontSize(60);
    const title: string[] = doc.splitTextToSize(plain(t.title), 640);
    title.slice(0, 2).forEach((l, i) => text(l, M, 290 + i * 70, 60, true));
    let y = 290 + Math.min(2, title.length) * 70;
    text(`${t.tag}  •  ${t.priority.toUpperCase()}  •  ${t.assignee || "Sem responsável"}`, M, y, 20, false, SOFT); y += 60;

    const pct = pr.total ? pr.feitos / pr.total : t.column === "done" ? 1 : 0;
    donut(M + 110, y + 110, 110, 26, [{ value: pct, color: st.color }, { value: 1 - pct, color: LINE }]);
    text(`${Math.round(pct * 100)}%`, M + 110, y + 124, 40, true, INK, "center");
    text(pr.total ? `${pr.feitos} de ${pr.total} itens` : "Sem itens", M + 260, y + 100, 26, true);
    text("concluídos na estrutura", M + 260, y + 134, 18, false, SOFT); y += 270;

    doc.setFont("helvetica", "normal"); doc.setFontSize(20);
    const desc: string[] = doc.splitTextToSize(plain(t.description || "Sem descrição registrada."), 640);
    const maxLines = Math.max(0, Math.floor((H - 90 - y) / 30));
    desc.slice(0, maxLines).forEach((l, i) => text(i === maxLines - 1 && desc.length > maxLines ? l + "…" : l, M, y + i * 30, 20, false, SOFT));

    // Estrutura (direita)
    const X = 860, CW = W - M - X;
    card(X, 160, CW, 840);
    text("ESTRUTURA DO PROJETO", X + 40, 214, 16, true, SOFT);
    let gy = 270;
    if (!grupos.length) text("Nenhum subtítulo cadastrado.", X + 40, gy, 22, false, SOFT);
    for (const g of grupos) {
      if (gy > 940) { text("…", X + 40, gy, 22, true, SOFT); break; }
      const gp = progressoEstrutura([g]);
      text(fit(g.titulo || "Sem título", CW - 220, 26, true), X + 40, gy, 26, true);
      text(`${gp.feitos}/${gp.total}`, X + CW - 40, gy, 20, true, ACCENT, "right");
      gy += 20; doc.setDrawColor(...LINE); doc.setLineWidth(1); doc.line(X + 40, gy, X + CW - 40, gy); gy += 38;
      for (const it of g.itens) {
        if (gy > 960) break;
        const s = statusOf(it.status);
        doc.setFillColor(...s.color); doc.circle(X + 50, gy - 7, 7, "F");
        text(fit(it.titulo || "Item", 360, 20, true), X + 72, gy, 20, true);
        text(fit(it.responsaveis.join(", ") || "—", 220, 18), X + 470, gy, 18, false, SOFT);
        doc.setFillColor(...s.color); doc.roundedRect(X + CW - 200, gy - 24, 160, 32, 16, 16, "F");
        text(s.label, X + CW - 120, gy - 2, 15, true, BG, "center");
        gy += 26;
        if (it.descricao) { text(fit(it.descricao, CW - 150, 15), X + 72, gy, 15, false, SOFT); gy += 22; }
        gy += 14;
      }
      gy += 18;
    }
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    text("HOST / UPDATE 2.1", M, H - 40, 14, true, SOFT);
    text(`${p} / ${pages}`, W - M, H - 40, 14, false, SOFT, "right");
  }
  doc.save(`HOST-UPDATE-2.1-${generated.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}.pdf`);
}
