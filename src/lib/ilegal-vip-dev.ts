import { createCard } from "@/lib/kanban";
import type { IlegalOrg, IlegalVip, IlegalVipConfig } from "@/lib/ilegal-data";

/**
 * Monta o texto padronizado do "COLOCAR VIP FAC" que o Desenvolvimento usa
 * para configurar o VIP dentro do jogo.
 *
 * Campos vazios entram como "—" para o dev perceber o que ficou pendente,
 * em vez de simplesmente desaparecerem do texto.
 */
export function montarTextoVipFac(
  org: IlegalOrg,
  config: IlegalVipConfig,
  vips: IlegalVip[]
): string {
  const v = (value: string) => (value.trim() ? value.trim() : "—");
  const linhas: string[] = [
    "**COLOCAR VIP FAC**",
    "",
    `**USERSET:** ${v(org.setagem)}${org.organizacao ? ` — ${org.organizacao}` : ""}`,
    "",
    `**LOJA DE ROUPA:** ${v(config.lojaRoupa)}`,
    `**BARBEARIA:** ${v(config.barbearia)}`,
    `**TATUAGEM:** ${v(config.tatuagem)}`,
    "",
    "**→ GARAGEM CARRO COMUM / Todos os Níveis**",
    `BLIP: ${v(config.garagemComumBlip)}`,
    `SPAWN: ${v(config.garagemComumSpawn)}`,
    `CARRO: ${v(config.garagemComumCarro)}`,
    "",
    "**→ GARAGEM CAMINHÃO / Apenas Nível 1**",
    `BLIP: ${v(config.garagemCaminhaoBlip)}`,
    `SPAWN: ${v(config.garagemCaminhaoSpawn)}`,
    `CAMINHÃO: ${v(config.garagemCaminhaoIndex || "pounder")}`,
    "",
    "**→ RÁDIO PRIVADA**",
    `NÚMERO: ${v(config.radioPrivada)}`,
    "",
    "**→ BAÚ**",
    `Membros: ${v(config.bauMembro)}`,
    `Líder: ${v(config.bauLider)}`,
    "",
    `**SALÁRIO:** ${v(config.salario)}`,
  ];

  if (vips.length > 0) {
    linhas.push("", "**→ ITENS VIP ADICIONAIS**");
    for (const item of vips) {
      linhas.push(`- ${item.label || "Item VIP"}: ${v(item.cds)}`);
    }
  }

  if (config.textoExtra.trim()) {
    linhas.push("", "**→ OBSERVAÇÕES**", config.textoExtra.trim());
  }

  return linhas.join("\n");
}

/** Cria a pendência de Desenvolvimento (categoria Ilegal) com o VIP FAC. */
export async function enviarVipFacParaDev(
  org: IlegalOrg,
  config: IlegalVipConfig,
  vips: IlegalVip[],
  autor: string
): Promise<void> {
  const texto = montarTextoVipFac(org, config, vips);
  await createCard({
    titulo: `Colocar VIP FAC — ${org.setagem}${org.organizacao ? ` (${org.organizacao})` : ""}`,
    descricao: `${texto}\n\n_Solicitado por ${autor} pelo painel Ilegal._`,
    categoria: "ilegal",
    prioridade: "alta",
    criadoPor: autor,
  });
}
