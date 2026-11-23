// Leitura e escrita de CSV simples (aspas duplas, separador ; ou ,).

/** Lê um CSV com cabeçalho e devolve uma lista de objetos { coluna: valor }. */
export function lerCsv(texto: string): Record<string, string>[] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((c) => c.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((c) => c.trim() !== "")) linhas.push(linha);
  if (linhas.length === 0) return [];
  const cabecalho = (linhas[0] ?? []).map((c) => c.trim());
  return linhas.slice(1).map((l) => Object.fromEntries(cabecalho.map((c, i) => [c, (l[i] ?? "").trim()])));
}

const escapar = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Gera CSV com ; (abre certo no Excel brasileiro). */
export function paraCsv(colunas: string[], linhas: Record<string, unknown>[]) {
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";"))].join("\r\n");
}
