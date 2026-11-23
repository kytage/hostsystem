// Banco falso, em memória, que imita o pouco do Supabase que o HOST AVANÇADO usa.
// Só para os testes automáticos (rotas.test.ts): nada aqui vai para o site.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = any;

class Consulta implements PromiseLike<{ data: any; error: any; count?: number }> {
  private filtros: ((l: Linha) => boolean)[] = [];
  private ordem: { coluna: string; asc: boolean }[] = [];
  private faixa: [number, number] | null = null;
  private limiteN: number | null = null;
  private unico = false;
  private acao: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private valores: any = null;

  constructor(private tabelas: Map<string, Linha[]>, private nome: string) {}

  private linhas() {
    if (!this.tabelas.has(this.nome)) this.tabelas.set(this.nome, []);
    return this.tabelas.get(this.nome)!;
  }
  select() {
    return this;
  }
  insert(v: any) {
    this.acao = "insert";
    this.valores = v;
    return this;
  }
  upsert(v: any) {
    this.acao = "upsert";
    this.valores = v;
    return this;
  }
  update(v: any) {
    this.acao = "update";
    this.valores = v;
    return this;
  }
  delete() {
    this.acao = "delete";
    return this;
  }
  eq(c: string, v: any) {
    this.filtros.push((l) => l[c] === v);
    return this;
  }
  gte(c: string, v: any) {
    this.filtros.push((l) => l[c] !== null && l[c] !== undefined && l[c] >= v);
    return this;
  }
  order(c: string, o: { ascending?: boolean } = {}) {
    this.ordem.push({ coluna: c, asc: o.ascending !== false });
    return this;
  }
  range(a: number, b: number) {
    this.faixa = [a, b];
    return this;
  }
  limit(n: number) {
    this.limiteN = n;
    return this;
  }
  maybeSingle() {
    this.unico = true;
    return this;
  }

  private executar() {
    const todas = this.linhas();
    const passa = (l: Linha) => this.filtros.every((f) => f(l));
    const copia = (l: Linha) => JSON.parse(JSON.stringify(l));
    if (this.acao === "insert" || this.acao === "upsert") {
      const lista = Array.isArray(this.valores) ? this.valores : [this.valores];
      for (const v of lista) {
        const chave = "id" in v ? "id" : "chave";
        const i = todas.findIndex((l) => l[chave] === v[chave]);
        if (i >= 0 && this.acao === "insert") return { data: null, error: { code: "23505", message: "duplicate key" } };
        if (i >= 0) todas[i] = { ...todas[i], ...copia(v) };
        else todas.push(copia(v));
      }
      return { data: null, error: null };
    }
    if (this.acao === "update") {
      let n = 0;
      for (const l of todas) if (passa(l)) {
        Object.assign(l, copia(this.valores));
        n++;
      }
      return { data: null, error: null, count: n };
    }
    if (this.acao === "delete") {
      const antes = todas.length;
      const ficam = todas.filter((l) => !passa(l));
      // apagar uma oportunidade apaga evidências, contatos e históricos dela (ON DELETE CASCADE)
      if (this.nome === "avancado_leads") {
        const ids = new Set(todas.filter(passa).map((l) => l.id));
        for (const t of ["avancado_lead_evidencias", "avancado_lead_contatos", "avancado_lead_interacoes"]) {
          this.tabelas.set(t, (this.tabelas.get(t) ?? []).filter((f) => !ids.has(f.lead_id)));
        }
      }
      this.tabelas.set(this.nome, ficam);
      return { data: null, error: null, count: antes - ficam.length };
    }
    let r = todas.filter(passa);
    for (const o of [...this.ordem].reverse()) r = [...r].sort((a, b) => (a[o.coluna] < b[o.coluna] ? -1 : a[o.coluna] > b[o.coluna] ? 1 : 0) * (o.asc ? 1 : -1));
    if (this.faixa) r = r.slice(this.faixa[0], this.faixa[1] + 1);
    if (this.limiteN !== null) r = r.slice(0, this.limiteN);
    if (this.unico) return { data: r[0] ? copia(r[0]) : null, error: null };
    return { data: r.map(copia), error: null };
  }

  then<A, B>(ok?: ((v: { data: any; error: any; count?: number }) => A | PromiseLike<A>) | null, falha?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.executar()).then(ok, falha);
  }
}

export function criarBancoFalso() {
  const tabelas = new Map<string, Linha[]>();
  const cliente = {
    from: (nome: string) => new Consulta(tabelas, nome),
    auth: { getUser: async () => ({ data: { user: null } }) },
  };
  return { cliente: cliente as any, tabelas };
}
