/**
 * Lê uma log do servidor (o mesmo JSON que foi para o Discord) e separa só o que importa para
 * mostrar na tela /logs: o título, as linhas "nome: valor", quem fez (nome e ID), as coordenadas
 * (CDS) e os IDs do Discord, para os botões de copiar.
 */

export interface LinhaDaLog {
  /** "Item", "Saldo novo"... (vazio quando a linha é só um texto). */
  rotulo: string;
  valor: string;
}

export interface LogLida {
  titulo: string;
  linhas: LinhaDaLog[];
  jogador: { id: string | null; nome: string | null } | null;
  /** Coordenadas encontradas, já no formato "x, y, z". */
  cds: string[];
  /** IDs do Discord (17 a 20 dígitos). */
  discord: string[];
}

interface Embed {
  title?: string;
  description?: string;
  author?: { name?: string };
  fields?: { name?: string; value?: string }[];
  footer?: { text?: string };
}

/** Tira a formatação do Discord (blocos de código, negrito, sublinhado). */
const limpar = (t: string) =>
  t
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\r/g, "")
    .trim();

/** Rodapé que é só a data e a hora (a tela já mostra quando foi). */
const soData = (t: string) => /^\d{2}\/\d{2}\/\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(t.trim());

const COORD = /(-?\d{1,5}\.\d+)\s*,\s*(-?\d{1,5}\.\d+)\s*,\s*(-?\d{1,5}\.\d+)/g;
const DISCORD = /\b\d{17,20}\b/g;
/** "#1 Henrique Bonne", "1 - Henrique Bonne", "#1 - Henrique Bonne". */
const JOGADOR =
  /(?:^|[\s:])#?(\d{1,7})\s*(?:-\s*)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]+(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]+){0,3})(?![\w])/;
/** Rótulos que dizem quem fez (o valor é "1", "#1 Nome" ou "1 - Nome"). */
const ROTULO_JOGADOR =
  /^(passaporte|id|user[_ ]?id|usu[aá]rio|respons[aá]vel|jogador|player|staff|admin)$/i;
/** Campos que não ajudam a ler a log (identificadores técnicos). */
const ROTULO_ESCONDIDO =
  /^(identificador|license( id)?|license2|xbox( id)?|live( id)?|fivem( id)?)$/i;

function quebrarEmLinhas(texto: string): LinhaDaLog[] {
  return limpar(texto)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !soData(l))
    .map((l) => {
      const m = l.match(/^([^:]{1,40}):\s*(.+)$/);
      // "12:30" não é rótulo: só vale se o rótulo tiver letras
      return m && /[A-Za-zÀ-ÿ]/.test(m[1]!)
        ? { rotulo: m[1]!.trim(), valor: m[2]!.trim() }
        : { rotulo: "", valor: l };
    });
}

/** Deixa o rótulo com cara de título ("QUEM RECEBEU" → "Quem recebeu"). */
const rotuloBonito = (r: string) =>
  r === r.toUpperCase() && /[A-Z]/.test(r) ? r.charAt(0) + r.slice(1).toLowerCase() : r;

export function lerLog(
  mensagem: string,
  dados: unknown,
  jogadorId: string | null,
  jogadorNome: string | null,
): LogLida {
  let titulo = "";
  let linhas: LinhaDaLog[] = [];
  const payload = dados && typeof dados === "object" ? (dados as Record<string, unknown>) : null;
  const embeds = payload && Array.isArray(payload["embeds"]) ? (payload["embeds"] as Embed[]) : [];

  if (payload && (embeds.length > 0 || typeof payload["content"] === "string")) {
    if (typeof payload["content"] === "string") linhas.push(...quebrarEmLinhas(payload["content"]));
    for (const e of embeds) {
      if (!titulo && e.title) titulo = limpar(e.title);
      else if (e.title) linhas.push({ rotulo: "", valor: limpar(e.title) });
      if (e.author?.name) linhas.push({ rotulo: "", valor: limpar(e.author.name) });
      if (e.description) linhas.push(...quebrarEmLinhas(e.description));
      for (const f of e.fields ?? []) {
        const nome = limpar(f.name ?? "");
        const valor = limpar(f.value ?? "");
        if (!nome && !valor) continue;
        if (nome && valor && !valor.includes("\n")) linhas.push({ rotulo: nome, valor });
        else {
          if (nome) linhas.push({ rotulo: "", valor: nome });
          linhas.push(...quebrarEmLinhas(valor));
        }
      }
      if (e.footer?.text && !soData(e.footer.text))
        linhas.push({ rotulo: "", valor: limpar(e.footer.text) });
    }
  } else {
    linhas = quebrarEmLinhas(mensagem);
    if (linhas[0] && !linhas[0].rotulo) titulo = linhas.shift()!.valor;
  }
  // a primeira linha curta e sem rótulo ("USOU", "ITEM", "Saida") é o título
  const primeira = linhas[0];
  if (
    !titulo &&
    primeira &&
    !primeira.rotulo &&
    primeira.valor.length <= 40 &&
    !/\d{3,}/.test(primeira.valor)
  ) {
    titulo = linhas.shift()!.valor;
  }
  linhas = linhas
    .filter(
      (l) => !ROTULO_ESCONDIDO.test(l.rotulo) && !/^(n\/e|nil|null|undefined|-)$/i.test(l.valor),
    )
    .map((l) => ({
      rotulo: rotuloBonito(l.rotulo),
      // menção do Discord "<@123>" vira só o número
      valor: l.valor.replace(/<@!?(\d{17,20})>/g, "$1"),
    }));
  if (titulo === titulo.toUpperCase() && /[A-Z]/.test(titulo)) titulo = rotuloBonito(titulo);

  const tudo = [titulo, ...linhas.map((l) => `${l.rotulo}: ${l.valor}`)].join("\n");
  const cds = [...new Set([...tudo.matchAll(COORD)].map((m) => `${m[1]}, ${m[2]}, ${m[3]}`))];
  // ID do Discord: só de campos "Discord" ou de linha que começa com o número (a Steam também tem 17 dígitos)
  const discord = [
    ...new Set(
      linhas.flatMap((l) =>
        /discord/i.test(l.rotulo)
          ? (l.valor.match(DISCORD) ?? [])
          : !l.rotulo && /^\d{17,20}\b/.test(l.valor)
            ? (l.valor.match(DISCORD) ?? []).slice(0, 1)
            : [],
      ),
    ),
  ];

  let jogador: LogLida["jogador"] =
    jogadorId || jogadorNome ? { id: jogadorId, nome: jogadorNome } : null;
  if (!jogador || !jogador.nome) {
    // procura "1 - Nome" ou "#1 Nome" (sem pegar um ID do Discord nem uma coordenada)
    for (const l of linhas) {
      // só nos campos que dizem quem fez (Passaporte, Usuário, Responsável...) ou em texto solto
      if (l.rotulo && !ROTULO_JOGADOR.test(l.rotulo)) continue;
      const v = l.valor.replace(DISCORD, " ").replace(COORD, " ");
      const m = v.match(JOGADOR);
      if (m) {
        jogador = { id: jogador?.id ?? m[1]!, nome: m[2]!.trim() };
        break;
      }
      if (l.rotulo && !jogador && /^\d{1,7}$/.test(l.valor)) jogador = { id: l.valor, nome: null };
    }
  }
  return { titulo, linhas, jogador, cds, discord };
}
