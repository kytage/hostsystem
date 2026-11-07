/**
 * Publicação de eventos no site oficial (https://hostgg.org/eventos).
 *
 * O site é outro projeto, com banco próprio. A comunicação acontece por um
 * endpoint autenticado (`/api/public/hooks/eventos-sync`) que recebe o evento
 * já formatado e grava/atualiza/remove no banco do site.
 *
 * O token nunca chega ao navegador: fica em variável de ambiente do servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const eventoSchema = z.object({
  /** ID do evento no painel — usado pelo site para atualizar em vez de duplicar. */
  externalId: z.string().trim().min(1).max(64),
  nome: z.string().trim().min(1).max(160),
  descricao: z.string().max(4000).default(""),
  /** ISO UTC do início do evento. */
  eventAt: z.string().trim().min(10).max(40),
  local: z.string().max(120).default(""),
  responsavel: z.string().max(200).default(""),
  categoria: z
    .enum(["ilegal", "competitive", "pvp", "diversao", "descoberta"])
    .default("diversao"),
  /** Banner em data URL (base64) ou URL absoluta; vazio = sem banner. */
  banner: z.string().max(9_000_000).default(""),
});

export type EventoSitePayload = z.infer<typeof eventoSchema>;

function config(): { url: string; token: string } {
  const url = (process.env["EVENTOS_SITE_URL"] ?? "https://hostgg.org").replace(/\/+$/, "");
  const token = process.env["EVENTOS_SITE_TOKEN"] ?? "";
  if (token.length < 16) {
    throw new Error(
      "Integração com o site não configurada (token ausente no servidor)."
    );
  }
  return { url, token };
}

async function enviar(body: unknown): Promise<{ id: string }> {
  const { url, token } = config();
  let resp: Response;
  try {
    resp = await fetch(`${url}/api/public/hooks/eventos-sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível falar com o site. Tente novamente.");
  }

  const texto = await resp.text();
  if (!resp.ok) {
    if (resp.status === 401) {
      throw new Error("O site recusou a publicação: chave de integração inválida.");
    }
    if (resp.status === 404) {
      throw new Error(
        "O site ainda não tem o recebedor de eventos instalado. Peça a instalação no projeto do site."
      );
    }
    if (resp.status >= 500) {
      throw new Error(
        "O site recebeu o evento mas não conseguiu salvar na agenda. Avise a equipe do site."
      );
    }
    throw new Error(`O site respondeu com erro ${resp.status}: ${texto.slice(0, 200)}`);
  }

  try {
    const json = JSON.parse(texto) as { id?: string };
    return { id: typeof json.id === "string" ? json.id : "" };
  } catch {
    return { id: "" };
  }
}

/** Cria ou atualiza o evento na agenda pública do site. */
export const publicarEventoNoSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => eventoSchema.parse(input))
  .handler(async ({ data }) => {
    const { id } = await enviar({ acao: "publicar", evento: data });
    return { ok: true as const, siteEventId: id };
  });

/** Remove o evento da agenda pública do site. */
export const removerEventoDoSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ externalId: z.string().trim().min(1).max(64) }).parse(input)
  )
  .handler(async ({ data }) => {
    await enviar({ acao: "remover", evento: { externalId: data.externalId } });
    return { ok: true as const };
  });
