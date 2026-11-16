/**
 * Onde o HOKI aparece inteiro.
 *
 * Na reforma da tela inicial (novembro de 2026) o HOKI chegou a sair dela, mas
 * voltou a pedido: ele fica na tela inicial, como sempre foi, e também na tela
 * própria (/hoki). Os avisos e atalhos do HOKI levam para a tela inicial.
 *
 * Para tirar o HOKI da tela inicial de novo, basta trocar HOKI_NA_HOME para false.
 */
export const HOKI_NA_HOME: boolean = true;

/**
 * HOKI em manutenção (16/11/2026, a pedido: foco no HOST 3.0). Ligado, ninguém entra na praça:
 * o botão "Acordar agora" vira o aviso de manutenção e a ilha não abre ao clicar. A tela de
 * entrada (ilha, perfil, quem está online) continua aparecendo. Para liberar, troque para false.
 */
export const HOKI_EM_MANUTENCAO: boolean = true;
export const AVISO_DE_MANUTENCAO = "Em manutenção para foco HOST 3.0";

/** A tela para onde levam os avisos e atalhos do HOKI. */
export const ROTA_DO_HOKI = HOKI_NA_HOME ? "/" : "/hoki";

/** Diz se, nesta tela, o HOKI já está aparecendo inteiro. */
export const hokiNaTela = (pathname: string) =>
  pathname === "/hoki" || (HOKI_NA_HOME && pathname === "/");
