// Conversa com os dados do HOST AVANÇADO. As telas chamam as mesmas rotas do HOST CENTRAL local;
// quem responde é servidor/rotas.ts, direto no banco do site.
import type { Duplicado } from "@/avancado/shared/tipos";
import { atender } from "@/avancado/servidor/rotas";
import { ErroHttp } from "@/avancado/servidor/banco";

export class ErroApi extends Error {
  status: number;
  duplicados: Duplicado[] | undefined;
  constructor(status: number, mensagem: string, duplicados?: Duplicado[]) {
    super(mensagem);
    this.status = status;
    this.duplicados = duplicados;
  }
}

async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  try {
    // copia o corpo como o JSON faria (tira undefined, datas viram texto)
    const dados = corpo === undefined ? undefined : JSON.parse(JSON.stringify(corpo));
    return (await atender(metodo, caminho, dados)) as T;
  } catch (e) {
    if (e instanceof ErroHttp) throw new ErroApi(e.status, e.message, e.extra?.["duplicados"] as Duplicado[] | undefined);
    if (e instanceof ErroApi) throw e;
    console.error("[host-avancado]", e);
    throw new ErroApi(0, "Sem conexão com o banco do site. Confira a internet e tente de novo.");
  }
}

/** Baixa um arquivo gerado na hora (planilha, exportação). */
export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Monta "?a=1&b=2" ignorando vazios. */
export function consulta(filtros: Record<string, string | number | boolean | null | undefined> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v === null || v === undefined || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  get: <T>(caminho: string) => pedir<T>("GET", caminho),
  post: <T>(caminho: string, corpo?: unknown) => pedir<T>("POST", caminho, corpo ?? {}),
  patch: <T>(caminho: string, corpo: unknown) => pedir<T>("PATCH", caminho, corpo),
  put: <T>(caminho: string, corpo: unknown) => pedir<T>("PUT", caminho, corpo),
  del: <T = void>(caminho: string) => pedir<T>("DELETE", caminho),
};

export const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
