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

/** A tela para onde levam os avisos e atalhos do HOKI. */
export const ROTA_DO_HOKI = HOKI_NA_HOME ? "/" : "/hoki";

/** Diz se, nesta tela, o HOKI já está aparecendo inteiro. */
export const hokiNaTela = (pathname: string) =>
  pathname === "/hoki" || (HOKI_NA_HOME && pathname === "/");
