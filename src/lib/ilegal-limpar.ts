import { supabase } from "@/integrations/supabase/client";
import { createCard } from "@/lib/kanban";
import {
  DETALHES_VAZIO,
  fetchDetalhes,
  saveDetalhesDb,
  type IlegalDetalhes,
  type IlegalOrg,
} from "@/lib/ilegal-data";

/** O que a limpeza deve zerar. Tudo é opcional e confirmado pelo usuário. */
export interface LimparFacOpcoes {
  /** Oculta o histórico de online anterior à limpeza (registros seguem no banco). */
  historicoOnline: boolean;
  /** Oculta denúncias/punições anteriores apenas no Ilegal (o /punicoes segue intacto). */
  registros: boolean;
  /** Limpa nomes/telefones de contato, anotações e nome da organização (status → Livre). */
  contatos: boolean;
  /** Limpa os itens VIP FAC (salários, baú, carro VIP, barbearia, garagem pounder...). */
  vips: boolean;
  /** Cria automaticamente uma pendência de Desenvolvimento na categoria Ilegal. */
  criarPendencia: boolean;
}

export const LIMPAR_FAC_DEFAULT: LimparFacOpcoes = {
  historicoOnline: true,
  registros: true,
  contatos: true,
  vips: true,
  criarPendencia: true,
};

/** Resumo textual do que foi limpo, usado na pendência e no toast. */
function resumoOpcoes(op: LimparFacOpcoes, detalhes: IlegalDetalhes): string[] {
  const linhas: string[] = [];
  if (op.historicoOnline) linhas.push("Histórico de online zerado no painel");
  if (op.registros) linhas.push("Denúncias/punições ocultadas na visão do Ilegal");
  if (op.contatos) linhas.push("Contatos, telefones e nome da organização removidos (status: Livre)");
  if (op.vips && detalhes.vips.length > 0) {
    linhas.push(`VIP FAC removido: ${detalhes.vips.map((v) => v.label || "item").join(", ")}`);
  }
  return linhas;
}

export interface LimparFacResultado {
  linhas: string[];
}

/**
 * Executa a limpeza de uma facção.
 *
 * Nada é apagado em `punicoes` nem em `set_online_log`: gravamos um marco
 * (`limpo_em`) na organização e o painel/relatório passam a ignorar tudo o que
 * for anterior a ele. Assim `/punicoes` continua sendo a fonte da verdade.
 */
export async function limparFac(
  org: IlegalOrg,
  opcoes: LimparFacOpcoes,
  autor: string
): Promise<LimparFacResultado> {
  const detalhes = await fetchDetalhes(org.id);
  const linhas = resumoOpcoes(opcoes, detalhes);
  const agora = new Date().toISOString();

  // 1) Marco de limpeza + liberação da setagem.
  const patch: {
    updated_at: string;
    limpo_em?: string;
    limpo_por?: string;
    organizacao?: string;
    grupo?: string;
    status?: string;
    situacao?: string;
    observacao?: string;
  } = { updated_at: agora };
  if (opcoes.historicoOnline || opcoes.registros) {
    patch.limpo_em = agora;
    patch.limpo_por = autor;
  }
  if (opcoes.contatos) {
    patch.organizacao = "";
    patch.grupo = "#";
    patch.status = "Livre";
    patch.situacao = ".";
    patch.observacao = "";
  }
  const { error } = await supabase.from("ilegal_orgs").update(patch).eq("id", org.id);
  if (error) throw error;

  // 2) Detalhes da facção (contatos, anotações, VIPs).
  if (opcoes.contatos || opcoes.vips) {
    const novo: IlegalDetalhes = {
      ...detalhes,
      ...(opcoes.contatos
        ? {
            logo: "",
            nome1: "",
            telefone1: "",
            nome2: "",
            telefone2: "",
            nome3: "",
            telefone3: "",
            anotacoesSobre: "",
            uniforme: DETALHES_VAZIO.uniforme,
            corVeiculo: "",
          }
        : {}),
      ...(opcoes.vips ? { vips: [] } : {}),
    };
    await saveDetalhesDb(org.id, novo);
  }

  // 3) Pendência automática para o Desenvolvimento — apenas quando há VIP FAC
  //    para remover. Sem itens VIP, a limpeza só reseta os dados do painel.
  if (opcoes.criarPendencia && detalhes.vips.length > 0) {
    const descricao = [
      `Limpeza solicitada para a setagem **${org.setagem}**.`,
      org.organizacao ? `Organização anterior: ${org.organizacao}` : "",
      org.local ? `Local: ${org.local}` : "",
      "",
      "Itens limpos no painel:",
      ...linhas.map((l) => `- ${l}`),
      "",
      `Executado por ${autor}.`,
    ]
      .filter((l) => l !== undefined)
      .join("\n");

    await createCard({
      titulo: `Limpar Fac — ${org.setagem}`,
      descricao,
      categoria: "ilegal",
      prioridade: "alta",
      criadoPor: autor,
    });
  }

  return { linhas };
}
