// Captação: lista de oportunidades, funil, triagem do radar e indicadores.
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "@/avancado/roteador";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Download, FileUp, Inbox, Plus, Timer, TrendingUp, Upload, Users, X } from "lucide-react";
import { ETAPAS, LEAD_TIPOS, ORIGENS, PLATAFORMAS, PRIORIDADES, corDe, nomeDe, type EtapaId } from "@/avancado/shared/dominio";
import type { Lead, ResultadoImportacao } from "@/avancado/shared/tipos";
import { baixarArquivo, consulta, mensagemDe } from "@/avancado/lib/api";
import { Banco } from "@/avancado/servidor/banco";
import { exportarLeads } from "@/avancado/servidor/leads";
import { useAlterarLead, useExcluirLead, useImportarLeads, useIndicadoresCaptacao, useLeads } from "@/avancado/lib/consultas";
import { diasAte, formatarData, numeroCurto, prazoRelativo, relativo } from "@/avancado/lib/datas";
import { abrirLead } from "@/avancado/lib/gavetas";
import { AreaTexto, Botao, CampoBusca, Carregando, Cartao, Demo, ErroDeCarga, Etiqueta, EtiquetaConfianca, EtiquetaDe, Indice, Indices, Pagina, Segmentos, Selecao, Vazio, aviso, cn, useAtrasado } from "@/avancado/ui/kit";
import { LinksDeRede } from "@/avancado/ui/plataformas";
import { Quadro } from "@/avancado/ui/quadro";
import { Janela, confirmar } from "@/avancado/ui/sobrepostos";

type Aba = "lista" | "funil" | "triagem" | "indicadores";
const FOLLOWUPS = [
  { id: "atrasado", nome: "Acompanhamento atrasado" },
  { id: "hoje", nome: "Acompanhar hoje" },
  { id: "semana", nome: "Acompanhar em 7 dias" },
  { id: "sem", nome: "Sem data de acompanhamento" },
];
const ORDENS = [
  { id: "prioridade", nome: "Por prioridade" },
  { id: "atualizado", nome: "Alteradas por último" },
  { id: "nome", nome: "Por nome" },
  { id: "followup", nome: "Por acompanhamento" },
  { id: "alcance", nome: "Por seguidores" },
];

function Tamanho({ l }: { l: Lead }) {
  if (l.tamanho === null && l.alcance === null) return <span className="text-tx-3">—</span>;
  return (
    <span className="text-[12.5px]">
      {l.tamanho !== null && (
        <span title={l.tamanho_texto}>
          {l.tamanho} integr. <EtiquetaConfianca valor={l.tamanho_confianca} />
        </span>
      )}
      {l.tamanho !== null && l.alcance !== null && <br />}
      {l.alcance !== null && (
        <span className="text-tx-2" title={l.alcance_texto}>
          {numeroCurto(l.alcance)} seguid.
        </span>
      )}
    </span>
  );
}

function Acompanhamento({ l }: { l: Lead }) {
  if (!l.proximo_followup) return <span className="text-tx-3">—</span>;
  const atrasado = diasAte(l.proximo_followup) < 0 && !["na_cidade", "perdida", "pausada"].includes(l.etapa);
  return <span className={cn("text-[12.5px]", atrasado ? "vencido font-medium" : "text-tx-2")}>{prazoRelativo(l.proximo_followup)}</span>;
}

/* ================= LISTA ================= */

function Lista() {
  const [p, setP] = useSearchParams();
  const [busca, setBusca] = useState(p.get("busca") ?? "");
  const termo = useAtrasado(busca);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const alterar = useAlterarLead();
  const excluir = useExcluirLead();
  const filtros = {
    busca: termo,
    etapa: p.get("etapa") ?? "",
    prioridade: p.get("prioridade") ?? "",
    tipo: p.get("tipo") ?? "",
    plataforma: p.get("plataforma") ?? "",
    origem: p.get("origem") ?? "",
    followup: p.get("followup") ?? "",
    ordenar: p.get("ordenar") ?? "prioridade",
    demo: p.get("demo") ?? "0",
  };
  const { data: leads, isLoading, error } = useLeads(filtros);
  const mudar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(p);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setP(novo, { replace: true });
  };
  const chips = [
    ["etapa", nomeDe(ETAPAS, filtros.etapa)],
    ["prioridade", filtros.prioridade ? `Prioridade ${nomeDe(PRIORIDADES, filtros.prioridade).toLowerCase()}` : ""],
    ["tipo", nomeDe(LEAD_TIPOS, filtros.tipo)],
    ["plataforma", nomeDe(PLATAFORMAS, filtros.plataforma)],
    ["origem", nomeDe(ORIGENS, filtros.origem)],
    ["followup", FOLLOWUPS.find((f) => f.id === filtros.followup)?.nome ?? ""],
    ["demo", filtros.demo === "todos" ? "Incluindo demonstração" : ""],
  ].filter(([, rotulo]) => rotulo) as Array<[string, string]>;

  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const emLote = async (dados: Partial<Lead> | "excluir") => {
    const ids = [...selecionados];
    if (dados === "excluir" && !(await confirmar({ titulo: `Excluir ${ids.length} ${ids.length === 1 ? "oportunidade" : "oportunidades"}?`, confirmar: "Excluir", perigo: true }))) return;
    try {
      for (const id of ids) {
        if (dados === "excluir") await excluir.mutateAsync(id);
        else await alterar.mutateAsync({ id, dados });
      }
      setSelecionados(new Set());
      aviso.ok("Feito");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const exportar = async (formato: "csv" | "json") => {
    try {
      const q = Object.fromEntries(new URLSearchParams(consulta(filtros).slice(1)));
      const arq = await exportarLeads(new Banco(), formato, q);
      baixarArquivo(arq.nome, arq.corpo, arq.tipo);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar por nome, cidade, líder ou etiqueta" className="min-w-[220px] flex-1" />
        <Botao variante="principal" icone={Plus} onClick={() => abrirLead("novo")}>
          Nova oportunidade
        </Botao>
        <Botao icone={Upload} onClick={() => setImportando(true)}>
          Importar
        </Botao>
        <Botao icone={Download} onClick={() => exportar("csv")} title="Baixa uma planilha (CSV) com o que está na lista">
          Exportar
        </Botao>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Selecao className="solto" aria-label="Etapa" opcoes={ETAPAS} vazio="Todas as etapas" value={filtros.etapa} onChange={(e) => mudar("etapa", e.target.value)} />
        <Selecao className="solto" aria-label="Prioridade" opcoes={PRIORIDADES} vazio="Toda prioridade" value={filtros.prioridade} onChange={(e) => mudar("prioridade", e.target.value)} />
        <Selecao className="solto" aria-label="Tipo" opcoes={LEAD_TIPOS} vazio="Todos os tipos" value={filtros.tipo} onChange={(e) => mudar("tipo", e.target.value)} />
        <Selecao className="solto" aria-label="Rede" opcoes={PLATAFORMAS} vazio="Todas as redes" value={filtros.plataforma} onChange={(e) => mudar("plataforma", e.target.value)} />
        <Selecao className="solto" aria-label="Acompanhamento" opcoes={FOLLOWUPS} vazio="Acompanhamento" value={filtros.followup} onChange={(e) => mudar("followup", e.target.value)} />
        <Selecao className="solto" aria-label="Ordem" opcoes={ORDENS} value={filtros.ordenar} onChange={(e) => mudar("ordenar", e.target.value)} />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map(([chave, rotulo]) => (
            <span key={chave} className="chip">
              {rotulo}
              <button type="button" aria-label={`Tirar filtro ${rotulo}`} onClick={() => mudar(chave, "")}>
                <X size={12} />
              </button>
            </span>
          ))}
          <Botao pequeno variante="fantasma" onClick={() => setP({}, { replace: true })}>
            Limpar filtros
          </Botao>
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="vidro flex flex-wrap items-center gap-2 px-3.5 py-2.5">
          <span className="text-[13px] font-medium">
            {selecionados.size} {selecionados.size === 1 ? "selecionada" : "selecionadas"}
          </span>
          <div className="w-[190px]">
            <Selecao aria-label="Mudar etapa" opcoes={ETAPAS} vazio="Mudar etapa para…" value="" onChange={(e) => e.target.value && void emLote({ etapa: e.target.value as EtapaId })} />
          </div>
          <div className="w-[190px]">
            <Selecao aria-label="Mudar prioridade" opcoes={PRIORIDADES} vazio="Mudar prioridade para…" value="" onChange={(e) => e.target.value && void emLote({ prioridade: e.target.value as Lead["prioridade"] })} />
          </div>
          <Botao pequeno variante="perigo" onClick={() => void emLote("excluir")}>
            Excluir
          </Botao>
          <Botao pequeno variante="fantasma" className="ml-auto" onClick={() => setSelecionados(new Set())}>
            Cancelar
          </Botao>
        </div>
      )}

      <Cartao semPadding nota={undefined}>
        {isLoading ? (
          <div className="p-4">
            <Carregando linhas={6} />
          </div>
        ) : error ? (
          <ErroDeCarga erro={error} />
        ) : !leads || leads.length === 0 ? (
          <Vazio
            icone={Users}
            titulo={chips.length || termo ? "Nada encontrado com esses filtros" : "Nenhuma oportunidade ainda"}
            texto={chips.length || termo ? "Tire algum filtro ou mude a busca." : "Cadastre a primeira, importe uma planilha ou aprove os achados do radar na Triagem."}
            acao={
              <Botao pequeno icone={Plus} onClick={() => abrirLead("novo")}>
                Nova oportunidade
              </Botao>
            }
          />
        ) : (
          <>
            <p className="px-4 pt-3 text-[12px] text-tx-3">
              {leads.length} {leads.length === 1 ? "oportunidade" : "oportunidades"}
            </p>
            {/* computador: tabela */}
            <div className="so-computador overflow-x-auto px-1 pb-1">
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Nome</th>
                    <th>Redes</th>
                    <th>Cidade atual</th>
                    <th>Tamanho</th>
                    <th>Etapa</th>
                    <th>Último contato</th>
                    <th>Acompanhar</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="clicavel" onClick={() => abrirLead(l.id)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="size-4 accent-white" checked={selecionados.has(l.id)} onChange={() => alternar(l.id)} aria-label={`Selecionar ${l.nome}`} />
                      </td>
                      <td className="max-w-[280px]">
                        <span className="flex items-center gap-2">
                          <i className="ponto" style={{ "--cor": corDe(PRIORIDADES, l.prioridade) } as CSSProperties} title={`Prioridade ${nomeDe(PRIORIDADES, l.prioridade).toLowerCase()}`} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {l.nome} {l.demo && <Demo />}
                            </span>
                            <span className="block truncate text-[11.5px] text-tx-3">
                              {nomeDe(LEAD_TIPOS, l.tipo)}
                              {l.indicio ? ` · ${l.indicio}` : ""}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <LinksDeRede links={l.links} maximo={4} />
                      </td>
                      <td>
                        {l.cidade_atual ? (
                          <span className="text-[12.5px]">
                            {l.cidade_atual}
                            <br />
                            <EtiquetaConfianca valor={l.cidade_confianca} />
                          </span>
                        ) : (
                          <span className="text-tx-3">—</span>
                        )}
                      </td>
                      <td>
                        <Tamanho l={l} />
                      </td>
                      <td>
                        <EtiquetaDe lista={ETAPAS} id={l.etapa} />
                      </td>
                      <td className="text-[12.5px] text-tx-2">{l.ultimo_contato ? formatarData(l.ultimo_contato) : <span className="text-tx-3">nunca</span>}</td>
                      <td>
                        <Acompanhamento l={l} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* celular: cartões */}
            <div className="so-celular grid gap-1.5 p-2.5">
              {leads.map((l) => (
                <button key={l.id} type="button" className="veu grid gap-1.5 p-3 text-left" onClick={() => abrirLead(l.id)}>
                  <span className="flex items-center gap-2">
                    <i className="ponto" style={{ "--cor": corDe(PRIORIDADES, l.prioridade) } as CSSProperties} />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{l.nome}</span>
                    <EtiquetaDe lista={ETAPAS} id={l.etapa} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tx-2">
                    <LinksDeRede links={l.links} maximo={4} />
                    {l.cidade_atual && (
                      <span>
                        {l.cidade_atual} <EtiquetaConfianca valor={l.cidade_confianca} />
                      </span>
                    )}
                    {l.proximo_followup && <Acompanhamento l={l} />}
                  </span>
                  {l.indicio && <span className="line-clamp-2 text-[12px] text-tx-3">{l.indicio}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </Cartao>
      <p className="px-1 text-[11.5px] text-tx-3">
        Exportar em outro formato:{" "}
        <button type="button" className="underline underline-offset-2 hover:text-white" onClick={() => exportar("json")}>
          arquivo completo (JSON), com evidências e histórico
        </button>
        . Para ver dados de demonstração, se houver:{" "}
        <button type="button" className="underline underline-offset-2 hover:text-white" onClick={() => mudar("demo", filtros.demo === "todos" ? "" : "todos")}>
          {filtros.demo === "todos" ? "esconder" : "mostrar"}
        </button>
        .
      </p>
      {importando && <Importar aoFechar={() => setImportando(false)} />}
    </>
  );
}

function Importar({ aoFechar }: { aoFechar: () => void }) {
  const importar = useImportarLeads();
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const formato: "json" | "csv" = texto.trim().startsWith("[") || texto.trim().startsWith("{") ? "json" : "csv";
  const rodar = async (simular: boolean) => {
    try {
      const r = await importar.mutateAsync({ formato, conteudo: texto, simular, origem: "importacao" });
      if (simular) setPrevia(r);
      else {
        aviso.ok(`${r.novos.length} ${r.novos.length === 1 ? "oportunidade importada" : "oportunidades importadas"}`);
        aoFechar();
      }
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  return (
    <Janela
      larga
      titulo="Importar oportunidades"
      descricao="Cole uma planilha (CSV) ou um arquivo do painel (JSON). Nada é gravado antes de você conferir a prévia, e repetidos nunca entram."
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          {previa ? (
            <Botao variante="principal" icone={Check} disabled={previa.novos.length === 0} carregando={importar.isPending} onClick={() => void rodar(false)}>
              Importar {previa.novos.length}
            </Botao>
          ) : (
            <Botao variante="principal" disabled={!texto.trim()} carregando={importar.isPending} onClick={() => void rodar(true)}>
              Ver prévia
            </Botao>
          )}
        </>
      }
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Botao pequeno icone={FileUp} onClick={() => arquivo.current?.click()}>
            Escolher arquivo
          </Botao>
          <span className="text-[12px] text-tx-3">CSV: primeira linha com os nomes das colunas (nome; links; cidade_atual; lider; prioridade; observacoes…).</span>
          <input
            ref={arquivo}
            type="file"
            accept=".csv,.json,.txt"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                setTexto(await f.text());
                setPrevia(null);
              }
            }}
          />
        </div>
        <AreaTexto
          linhas={7}
          className="font-mono text-[12px]"
          placeholder={"nome;links;cidade_atual;prioridade\nTropa X;https://instagram.com/tropax;Cidade Y;alta"}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setPrevia(null);
          }}
        />
        {previa && (
          <div className="grid gap-2 text-[12.5px]">
            <div className="flex flex-wrap gap-2">
              <Etiqueta cor="#46C37B">{previa.novos.length} novas</Etiqueta>
              <Etiqueta cor="#E8B339">{previa.duplicados.length} repetidas (não entram)</Etiqueta>
              <Etiqueta cor="#CE0E0E">{previa.erros.length} com erro</Etiqueta>
            </div>
            {previa.novos.length > 0 && <p className="text-tx-2">Novas: {previa.novos.map((n) => n.nome).join(", ")}</p>}
            {previa.duplicados.length > 0 && (
              <p className="text-tx-3">
                Repetidas: {previa.duplicados.map((d) => `${d.nome} (${d.existente.motivo})`).join("; ")}
              </p>
            )}
            {previa.erros.length > 0 && <p className="vencido">Erros: {previa.erros.map((x) => `linha ${x.linha}: ${x.erro}`).join("; ")}</p>}
          </div>
        )}
      </div>
    </Janela>
  );
}

/* ================= FUNIL ================= */

function Funil() {
  const [busca, setBusca] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [tipo, setTipo] = useState("");
  const termo = useAtrasado(busca);
  const { data: leads, isLoading, error } = useLeads({ busca: termo, prioridade, tipo, ordenar: "prioridade" });
  const alterar = useAlterarLead();
  const [perdendo, setPerdendo] = useState<Lead | null>(null);
  const [motivo, setMotivo] = useState("");
  const mover = (l: Lead, etapa: string) => {
    if (etapa === "perdida") {
      setMotivo(l.motivo_perda);
      return setPerdendo(l);
    }
    alterar.mutate({ id: l.id, dados: { etapa: etapa as EtapaId } }, { onError: (e) => aviso.erro(mensagemDe(e)) });
  };
  const colunas = ETAPAS.map((e) => ({ id: e.id, nome: e.nome, cor: e.cor, dica: e.dica, discreta: e.situacao === "pausada" || e.situacao === "perdida" }));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar no funil" className="min-w-[200px] flex-1" />
        <div className="w-[170px]">
          <Selecao className="solto" aria-label="Prioridade" opcoes={PRIORIDADES} vazio="Toda prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </div>
        <div className="w-[170px]">
          <Selecao className="solto" aria-label="Tipo" opcoes={LEAD_TIPOS} vazio="Todos os tipos" value={tipo} onChange={(e) => setTipo(e.target.value)} />
        </div>
        <Botao variante="principal" icone={Plus} onClick={() => abrirLead("novo")}>
          Nova
        </Botao>
      </div>
      {isLoading ? (
        <Carregando linhas={4} />
      ) : error ? (
        <ErroDeCarga erro={error} />
      ) : (
        <Quadro
          colunas={colunas}
          itens={leads ?? []}
          colunaDe={(l) => l.etapa}
          aoMover={mover}
          aoAbrir={(l) => abrirLead(l.id)}
          vazio="Arraste para cá"
          cartao={(l) => {
            const dias = Math.max(0, Math.floor((Date.now() - new Date(l.etapa_desde).getTime()) / 86_400_000));
            const vencido = l.proximo_followup !== null && diasAte(l.proximo_followup) < 0;
            return (
              <div className="grid gap-1.5 pr-6">
                <p className="flex items-start gap-2 text-[13px] font-medium leading-snug">
                  <i className="ponto mt-[5px]" style={{ "--cor": corDe(PRIORIDADES, l.prioridade) } as CSSProperties} />
                  <span className="min-w-0 break-words">{l.nome}</span>
                </p>
                {l.cidade_atual && <p className="truncate text-[11.5px] text-tx-3">{l.cidade_atual}</p>}
                <div className="flex items-center justify-between gap-2">
                  <LinksDeRede links={l.links} maximo={3} />
                  <span className={cn("shrink-0 text-[11px]", vencido ? "vencido font-medium" : "text-tx-3")}>{vencido ? `acompanhar: ${prazoRelativo(l.proximo_followup)}` : dias === 0 ? "hoje" : `${dias} d na etapa`}</span>
                </div>
              </div>
            );
          }}
        />
      )}
      <p className="px-1 text-[11.5px] text-tx-3">Arraste o cartão para mudar a etapa. No celular, use o botão de setas do cartão. De “Proposta” em diante, a negociação segue no painel da staff (Captações).</p>
      {perdendo && (
        <Janela
          titulo={`Marcar "${perdendo.nome}" como perdida`}
          descricao="Anote o motivo: isso ajuda a entender por que as organizações recusam."
          aoFechar={() => setPerdendo(null)}
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => setPerdendo(null)}>
                Cancelar
              </Botao>
              <Botao
                variante="principal"
                disabled={!motivo.trim()}
                onClick={() =>
                  alterar.mutate(
                    { id: perdendo.id, dados: { etapa: "perdida", motivo_perda: motivo.trim() } },
                    { onSuccess: () => setPerdendo(null), onError: (e) => aviso.erro(mensagemDe(e)) },
                  )
                }
              >
                Marcar como perdida
              </Botao>
            </>
          }
        >
          <AreaTexto linhas={3} placeholder="Ex.: preferiu ficar onde está; pediu mais benefícios; não respondeu" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Janela>
      )}
    </>
  );
}

/* ================= TRIAGEM ================= */

function Triagem() {
  const { data: leads, isLoading, error } = useLeads({ triagem: "pendente", ordenar: "prioridade" });
  const alterar = useAlterarLead();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (leads ?? []).filter((l) => !t || `${l.nome} ${l.cidade_atual} ${l.indicio} ${l.descricao}`.toLowerCase().includes(t));
  }, [leads, busca]);
  const decidir = async (ids: string[], aprovar: boolean, etapa: EtapaId = "descoberta") => {
    try {
      for (const id of ids) await alterar.mutateAsync({ id, dados: aprovar ? { triagem: "aprovado", etapa } : { triagem: "descartado" } });
      setSelecionados(new Set());
      aviso.ok(aprovar ? "Aprovado: foi para o funil" : "Descartado");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  if (!leads || leads.length === 0)
    return (
      <Cartao>
        <Vazio icone={Inbox} titulo="Nada novo para olhar" texto="Quando a pesquisa automática achar organizações, criadores ou comunidades, eles aparecem aqui para você aprovar ou descartar." />
      </Cartao>
    );
  return (
    <>
      <p className="px-1 text-[12.5px] text-tx-2">
        Estes achados vieram de pesquisa e <b>ainda não foram conferidos por você</b>. Abra os links, confira, e então aprove (vai para o funil) ou descarte.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar nos achados" className="min-w-[200px] flex-1" />
        <Botao pequeno onClick={() => setSelecionados(selecionados.size === visiveis.length ? new Set() : new Set(visiveis.map((l) => l.id)))}>
          {selecionados.size === visiveis.length && visiveis.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
        </Botao>
        {selecionados.size > 0 && (
          <>
            <Botao pequeno variante="principal" icone={Check} onClick={() => void decidir([...selecionados], true)}>
              Aprovar {selecionados.size}
            </Botao>
            <Botao pequeno variante="perigo" icone={X} onClick={() => void decidir([...selecionados], false)}>
              Descartar {selecionados.size}
            </Botao>
          </>
        )}
        <span className="ml-auto text-[12px] text-tx-3">
          {visiveis.length} para olhar
        </span>
      </div>
      <div className="grid gap-2.5 lg:grid-cols-2">
        {visiveis.map((l) => (
          <article key={l.id} className="vidro grid gap-2.5 p-4">
            <header className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-1 size-4 accent-white" checked={selecionados.has(l.id)} onChange={() => alternar(l.id)} aria-label={`Selecionar ${l.nome}`} />
              <div className="min-w-0 flex-1">
                <h3 className="cartao-titulo break-words">{l.nome}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-tx-3">
                  {nomeDe(LEAD_TIPOS, l.tipo)}
                  {l.cidade_atual && (
                    <span>
                      · {l.cidade_atual} <EtiquetaConfianca valor={l.cidade_confianca} />
                    </span>
                  )}
                  {l.alcance !== null && <span>· {numeroCurto(l.alcance)} seguidores</span>}
                </p>
              </div>
              <EtiquetaDe lista={PRIORIDADES} id={l.prioridade} />
            </header>
            {l.descricao && <p className="text-[13px] text-tx-2">{l.descricao}</p>}
            {l.indicio && (
              <p className="veu px-3 py-2 text-[12.5px]">
                <span className="font-medium">Indício:</span> {l.indicio} <EtiquetaConfianca valor={l.indicio_confianca} />
              </p>
            )}
            {l.alertas.length > 0 && <p className="text-[12px] text-[#f0c869]">{l.alertas.join(" · ")}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <LinksDeRede links={l.links} maximo={6} />
              <span className="text-[11.5px] text-tx-3">
                {l.total_evidencias} {l.total_evidencias === 1 ? "evidência" : "evidências"} · {nomeDe(ORIGENS, l.origem)} · {relativo(l.criado_em)}
              </span>
            </div>
            <footer className="flex flex-wrap items-center gap-2">
              <Botao pequeno onClick={() => abrirLead(l.id)}>
                Ver detalhes
              </Botao>
              <Botao pequeno variante="principal" icone={Check} onClick={() => void decidir([l.id], true, "qualificada")} title="Vai para o funil como Qualificada">
                Aprovar
              </Botao>
              <Botao pequeno variante="fantasma" onClick={() => void decidir([l.id], true, "descoberta")} title="Vai para o funil como Descoberta, para avaliar depois">
                Guardar
              </Botao>
              <Botao pequeno variante="fantasma" icone={X} className="ml-auto" onClick={() => void decidir([l.id], false)}>
                Descartar
              </Botao>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

/* ================= INDICADORES ================= */

const EIXO = { fontSize: 11, fill: "#7c7c84" };
const DICA_GRAFICO = { contentStyle: { background: "rgba(22,21,22,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }, labelStyle: { color: "#f4f4f5" }, cursor: { fill: "rgba(255,255,255,0.04)" } };

function Indicadores() {
  const { data: i, isLoading, error } = useIndicadoresCaptacao();
  const ir = useNavigate();
  if (isLoading) return <Carregando linhas={5} />;
  if (error || !i) return <ErroDeCarga erro={error} />;
  const porEtapa = i.por_etapa.map((e) => ({ nome: nomeDe(ETAPAS, e.etapa), total: e.total, cor: corDe(ETAPAS, e.etapa) ?? "#888" }));
  const semanas = i.novos_por_semana.map((s) => ({ semana: formatarData(s.semana), total: s.total }));
  const barras = (dados: Array<{ nome: string; total: number; cor?: string }>) => (
    <div className="grid gap-2">
      {dados.length === 0 && <p className="py-4 text-center text-[12.5px] text-tx-3">Sem dados ainda.</p>}
      {dados.map((d) => {
        const max = Math.max(1, ...dados.map((x) => x.total));
        return (
          <div key={d.nome} className="grid grid-cols-[130px_minmax(0,1fr)_34px] items-center gap-2 text-[12.5px]">
            <span className="truncate text-tx-2" title={d.nome}>
              {d.nome}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full" style={{ width: `${(d.total / max) * 100}%`, background: d.cor ?? "#f4f4f5" }} />
            </span>
            <span className="text-right font-medium tabular-nums">{d.total}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <>
      <Indices colunas={5}>
        <Indice valor={i.total} titulo="Oportunidades" nota={`${i.novos_30d} novas em 30 dias`} icone={Users} />
        <Indice valor={i.novos_7d} titulo="Novas em 7 dias" icone={TrendingUp} />
        <Indice valor={i.contatados_30d} titulo="Contatadas em 30 dias" nota={`${i.sem_contato} ainda sem contato`} icone={Check} />
        <Indice valor={i.followups_atrasados} titulo="Acompanhamentos atrasados" nota={`${i.followups_semana} para os próximos 7 dias`} icone={Timer} alerta={i.followups_atrasados > 0} aoClicar={() => ir("/captacao?followup=atrasado")} />
        <Indice valor={i.taxa_conversao === null ? "—" : `${Math.round(i.taxa_conversao * 100)}%`} titulo="Taxa de conversão" nota={`${i.ganhos} na cidade · ${i.perdidos} perdidas`} icone={TrendingUp} />
      </Indices>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Cartao titulo="Funil por etapa" nota="Quantas oportunidades em cada etapa">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porEtapa} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="nome" tick={EIXO} tickLine={false} axisLine={false} interval={0} angle={-28} textAnchor="end" height={62} />
                <YAxis tick={EIXO} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...DICA_GRAFICO} />
                <Bar dataKey="total" name="Oportunidades" radius={[6, 6, 0, 0]}>
                  {porEtapa.map((e) => (
                    <Cell key={e.nome} fill={e.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        <Cartao titulo="Entradas por semana" nota="Oportunidades novas nas últimas 8 semanas">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={semanas} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="semana" tick={EIXO} tickLine={false} axisLine={false} />
                <YAxis tick={EIXO} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...DICA_GRAFICO} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
                <Line type="monotone" dataKey="total" name="Novas" stroke="#f4f4f5" strokeWidth={2} dot={{ r: 3, fill: "#ce0e0e", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        <Cartao titulo="Por cidade atual" nota="De onde as oportunidades viriam">
          {barras(i.por_cidade.map((c) => ({ nome: c.cidade || "Não sei", total: c.total })))}
        </Cartao>
        <Cartao titulo="Por origem e prioridade">
          {barras(i.por_origem.map((o) => ({ nome: nomeDe(ORIGENS, o.origem), total: o.total })))}
          <div className="my-3 border-t border-white/[0.06]" />
          {barras(i.por_prioridade.map((p) => ({ nome: `Prioridade ${nomeDe(PRIORIDADES, p.prioridade).toLowerCase()}`, total: p.total, cor: corDe(PRIORIDADES, p.prioridade) ?? "#888" })))}
          <div className="my-3 border-t border-white/[0.06]" />
          {barras(i.por_tipo.map((t) => ({ nome: nomeDe(LEAD_TIPOS, t.tipo), total: t.total })))}
        </Cartao>
      </div>
      <Cartao titulo="Como ler estes números">
        <ul className="grid gap-1.5 text-[12.5px] text-tx-2">
          <li><b className="text-tx-1">Novas:</b> quantas oportunidades entraram no período (cadastradas ou aprovadas na triagem).</li>
          <li><b className="text-tx-1">Contatadas:</b> tiveram mensagem, resposta ou reunião registrada no histórico nos últimos 30 dias.</li>
          <li><b className="text-tx-1">Acompanhamentos atrasados:</b> a data de “próximo acompanhamento” já passou e a negociação continua aberta. A meta é zero.</li>
          <li><b className="text-tx-1">Taxa de conversão:</b> das que já tiveram desfecho, quantas entraram na cidade (na cidade ÷ na cidade + perdidas).</li>
          <li>Só entram na conta oportunidades aprovadas e que não são de demonstração.</li>
        </ul>
      </Cartao>
    </>
  );
}

/* ================= PÁGINA ================= */

export default function Captacao() {
  const { aba: abaUrl } = useParams();
  const aba: Aba = abaUrl === "funil" || abaUrl === "triagem" || abaUrl === "indicadores" ? abaUrl : "lista";
  const ir = useNavigate();
  const { data: pendentes } = useLeads({ triagem: "pendente" });
  return (
    <Pagina sobretitulo="Captação" titulo="Organizações e jogadores" descricao="Da descoberta até a entrada na cidade. Cada informação mostra se é fato, estimativa ou hipótese.">
      <Segmentos
        rotulo="Áreas da captação"
        valor={aba}
        aoMudar={(v) => ir(v === "lista" ? "/captacao" : `/captacao/${v}`)}
        abas={[
          { id: "lista", nome: "Lista" },
          { id: "funil", nome: "Funil" },
          { id: "triagem", nome: "Triagem", contador: pendentes?.length, alerta: true },
          { id: "indicadores", nome: "Indicadores" },
        ]}
      />
      {aba === "lista" && <Lista />}
      {aba === "funil" && <Funil />}
      {aba === "triagem" && <Triagem />}
      {aba === "indicadores" && <Indicadores />}
    </Pagina>
  );
}
