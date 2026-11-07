/**
 * Parser server-side da planilha pública "HOST - STAFF" (Google Sheets pubhtml).
 * Roda apenas no servidor (arquivo .server.ts — nunca vai para o bundle do cliente).
 */

const PUB_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSe-opIMw-SncEH1KNmy-S3mVboqSkA_rvUdFewWyNJyXpZBVARaDYQw_Dvz2fFl1nrsLdHh4feUKau/pubhtml/sheet?headers=false&gid=";

const SHEETS = {
  staff: "543865977", // STAFF 2.0
  ids: "815219049", // IDS LIVRES
  cronograma: "451795932", // CRONOGRAMA
} as const;

/** Tons de amarelo usados na planilha para marcar liderança de área */
const YELLOW_COLORS = new Set([
  "#ffff00",
  "#fff200",
  "#ffd966",
  "#ffe599",
  "#f1c232",
  "#ffeb3b",
]);

export interface StaffRow {
  cargo: string;
  token: string;
  id: string;
  nome: string;
  discord: string;
  hex: string;
  areas: string[];
  /** Áreas em que a pessoa é LÍDER (célula amarela na planilha) */
  liderAreas: string[];
}

export interface IdLivreRow {
  id: string;
  status: string;
  obs: string;
}

export interface CronogramaRow {
  data: string;
  tema: string;
  responsavel: string;
}

export interface StaffSheetData {
  staff: StaffRow[];
  idsLivres: IdLivreRow[];
  cronograma: CronogramaRow[];
  fetchedAt: string;
}

/** Célula parseada com texto e classes CSS (para detectar cor de fundo) */
interface SheetCell {
  text: string;
  classes: string[];
}

/** Decodifica as entidades HTML comuns do pubhtml */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extrai o mapa classe CSS -> cor de fundo a partir do bloco <style> do pubhtml
 * (as cores das células vêm em classes como .s13, não em estilo inline).
 */
function parseClassColors(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const ruleRegex = /\.ritz \.waffle \.(s\d+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRegex.exec(html)) !== null) {
    const bg = /background-color:\s*(#[0-9a-fA-F]{3,6})/.exec(m[2] ?? "");
    if (bg) map.set(m[1] ?? "", (bg[1] ?? "").toLowerCase());
  }
  return map;
}

/** Retorna o conjunto de classes CSS cujo fundo é amarelo (liderança) */
function yellowClasses(html: string): Set<string> {
  const colors = parseClassColors(html);
  const set = new Set<string>();
  for (const [cls, color] of colors) {
    if (YELLOW_COLORS.has(color)) set.add(cls);
  }
  return set;
}

/** Extrai as linhas (apenas células <td>, ignorando o header de linha <th>) de uma tabela waffle */
function parseSheetCells(html: string): SheetCell[][] {
  const rows: SheetCell[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cellRegex = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
    const cells: SheetCell[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1] ?? "")) !== null) {
      // Ignora células de header de linha (números 1,2,3... na primeira coluna)
      if ((cellMatch[1] ?? "").toLowerCase() === "th") continue;
      const attrs = cellMatch[2] ?? "";
      const classAttr = /class="([^"]*)"/.exec(attrs);
      const classes = (classAttr?.[1] ?? "").split(/\s+/).filter(Boolean);
      const text = decodeEntities((cellMatch[3] ?? "").replace(/<[^>]+>/g, ""));
      cells.push({ text, classes });
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** Localiza a linha de cabeçalho que contém determinado texto e retorna seu índice */
function findHeaderIndex(rows: string[][], marker: string): number {
  return rows.findIndex((r) => r.some((c) => c.toUpperCase() === marker.toUpperCase()));
}

function parseStaff(cells: SheetCell[][], yellow: Set<string>): StaffRow[] {
  const rows = cells.map((r) => r.map((c) => c.text));
  const headerIdx = findHeaderIndex(rows, "CARGO");
  if (headerIdx === -1) return [];
  const header = rows[headerIdx]!;
  const col = (name: string) => header.findIndex((c) => c.toUpperCase() === name.toUpperCase());
  const cCargo = col("CARGO");
  const cToken = col("TOKEN");
  const cId = col("ID");
  const cNome = col("NOME");
  const cDiscord = col("ID DISCORD");
  const cHex = col("HEX");
  const cAreasStart = col("ÁREA");
  if (cCargo === -1 || cNome === -1) return [];

  const result: StaffRow[] = [];
  for (let i = headerIdx + 1; i < cells.length; i++) {
    const rowCells = cells[i]!;
    const r = rowCells.map((c) => c.text);
    const nome = (r[cNome] ?? "").trim();
    const cargo = (r[cCargo] ?? "").trim();
    if (!nome && !cargo) continue;
    const areas: string[] = [];
    const liderAreas: string[] = [];
    if (cAreasStart !== -1) {
      for (let c = cAreasStart; c < rowCells.length; c++) {
        const cell = rowCells[c]!;
        const a = cell.text.trim();
        if (!a) continue;
        // Áreas compostas ("Competitive / VAR") viram áreas separadas
        const partes = a.split("/").map((p) => p.trim()).filter(Boolean);
        const isLider = cell.classes.some((cls) => yellow.has(cls));
        for (const parte of partes) {
          if (!areas.includes(parte)) areas.push(parte);
          if (isLider && !liderAreas.includes(parte)) liderAreas.push(parte);
        }
      }
    }
    result.push({
      cargo,
      token: (r[cToken] ?? "").trim(),
      id: (r[cId] ?? "").trim(),
      nome,
      discord: cDiscord !== -1 ? (r[cDiscord] ?? "").trim() : "",
      hex: cHex !== -1 ? (r[cHex] ?? "").trim() : "",
      areas,
      liderAreas,
    });
  }
  return result;
}

function parseIdsLivres(cells: SheetCell[][]): IdLivreRow[] {
  const rows = cells.map((r) => r.map((c) => c.text));
  const headerIdx = findHeaderIndex(rows, "ID");
  if (headerIdx === -1) return [];
  const result: IdLivreRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]!;
    const id = (r[0] ?? "").trim();
    if (!id) continue;
    result.push({ id, status: (r[1] ?? "").trim(), obs: (r[2] ?? "").trim() });
  }
  return result;
}

function parseCronograma(cells: SheetCell[][]): CronogramaRow[] {
  const rows = cells.map((r) => r.map((c) => c.text));
  const headerIdx = findHeaderIndex(rows, "Data");
  if (headerIdx === -1) return [];
  const result: CronogramaRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]!;
    const data = (r[0] ?? "").trim();
    const tema = (r[1] ?? "").trim();
    const responsavel = (r[2] ?? "").trim();
    if (!data && !tema && !responsavel) continue;
    result.push({ data, tema, responsavel });
  }
  return result;
}

/** Busca e faz o parse das 3 abas da planilha pública */
export async function fetchStaffSheet(): Promise<StaffSheetData> {
  const fetchSheet = async (gid: string): Promise<string> => {
    const res = await fetch(PUB_BASE + gid, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Falha ao acessar a planilha (HTTP ${res.status})`);
    return res.text();
  };

  const [staffHtml, idsHtml, cronoHtml] = await Promise.all([
    fetchSheet(SHEETS.staff),
    fetchSheet(SHEETS.ids),
    fetchSheet(SHEETS.cronograma),
  ]);

  return {
    staff: parseStaff(parseSheetCells(staffHtml), yellowClasses(staffHtml)),
    idsLivres: parseIdsLivres(parseSheetCells(idsHtml)),
    cronograma: parseCronograma(parseSheetCells(cronoHtml)),
    fetchedAt: new Date().toISOString(),
  };
}
