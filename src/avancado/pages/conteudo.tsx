// Conteúdo: calendário, esteira de produção, roteiros, quadros recorrentes e modelos de texto.
import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "@/avancado/roteador";
import { CalendarDays, ChevronLeft, ChevronRight, Clapperboard, LayoutGrid, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { CONTEUDO_FORMATOS, CONTEUDO_STATUS, MODELO_TIPOS, PILARES, corDe, nomeDe } from "@/avancado/shared/dominio";
import type { Conteudo, Modelo, Quadro as QuadroTipo } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useConteudos, useExcluirModelo, useExcluirQuadro, useModelos, useQuadros, useSalvarConteudo, useSalvarModelo, useSalvarQuadro } from "@/avancado/lib/consultas";
import { diaDaSemanaCurto, formatarData, hoje, nomeDoMes, paraData } from "@/avancado/lib/datas";
import { abrirConteudo } from "@/avancado/lib/gavetas";
import { roteiroEmTexto } from "@/avancado/features/gaveta-conteudo";
import { AreaTexto, Botao, BotaoCopiar, BotaoIcone, Campo, CampoBusca, Carregando, Cartao, ErroDeCarga, Etiqueta, EtiquetaDe, Indice, Indices, Pagina, Segmentos, Selecao, Vazio, aviso, cn } from "@/avancado/ui/kit";
import { Quadro } from "@/avancado/ui/quadro";
import { Janela, confirmar } from "@/avancado/ui/sobrepostos";

type Aba = "calendario" | "esteira" | "roteiros" | "quadros";
const ABERTOS = ["ideia", "roteiro", "captacao", "edicao", "revisao", "agendado"];

/* ================= CALENDÁRIO ================= */

function Calendario() {
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const [pilar, setPilar] = useState("");
  const [status, setStatus] = useState("");
  const chave = `${mes.ano}-${String(mes.mes + 1).padStart(2, "0")}`;
  // pega o mês com uma semana de folga de cada lado (dias vizinhos que aparecem na grade)
  const inicioGrade = useMemo(() => {
    const primeiro = new Date(mes.ano, mes.mes, 1);
    const d = new Date(primeiro);
    d.setDate(1 - primeiro.getDay());
    return d;
  }, [mes]);
  const dias = useMemo(() => Array.from({ length: 42 }, (_, i) => paraData(new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i))), [inicioGrade]);
  const { data: itens, isLoading, error } = useConteudos({ de: dias[0], ate: dias[41], pilar, status });
  const { data: semData } = useConteudos({ status: ABERTOS.join(",") });
  const salvar = useSalvarConteudo();
  const d = hoje();
  const porDia = useMemo(() => {
    const m = new Map<string, Conteudo[]>();
    for (const c of itens ?? []) if (c.data_planejada) m.set(c.data_planejada, [...(m.get(c.data_planejada) ?? []), c]);
    return m;
  }, [itens]);
  const doMes = (itens ?? []).filter((c) => c.data_planejada?.startsWith(chave));
  const semDataLista = (semData ?? []).filter((c) => !c.data_planejada);
  const andar = (n: number) => setMes((m) => {
    const dt = new Date(m.ano, m.mes + n, 1);
    return { ano: dt.getFullYear(), mes: dt.getMonth() };
  });
  // seis semanas só quando o mês precisa
  const semanas = dias.slice(35).some((x) => x.startsWith(chave)) ? 6 : 5;
  const soltar = (dia: string, id: string) => salvar.mutate({ id, dados: { data_planejada: dia } }, { onError: (e) => aviso.erro(mensagemDe(e)) });

  return (
    <>
      <Indices colunas={4}>
        <Indice valor={doMes.length} titulo="Planejados no mês" icone={CalendarDays} />
        <Indice valor={doMes.filter((c) => c.status === "publicado").length} titulo="Publicados no mês" icone={Clapperboard} />
        <Indice valor={doMes.filter((c) => c.status !== "publicado" && c.status !== "arquivado" && c.data_planejada! < d).length} titulo="Atrasados" alerta={doMes.some((c) => c.status !== "publicado" && c.status !== "arquivado" && c.data_planejada! < d)} icone={CalendarDays} />
        <Indice valor={semDataLista.length} titulo="Ideias sem data" icone={LayoutGrid} />
      </Indices>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <BotaoIcone icone={ChevronLeft} rotulo="Mês anterior" className="solto" onClick={() => andar(-1)} />
          <span className="min-w-[150px] text-center font-display text-[15px] font-semibold capitalize">{nomeDoMes(mes.ano, mes.mes)}</span>
          <BotaoIcone icone={ChevronRight} rotulo="Próximo mês" className="solto" onClick={() => andar(1)} />
        </div>
        <Botao pequeno variante="fantasma" onClick={() => setMes({ ano: new Date().getFullYear(), mes: new Date().getMonth() })}>
          Hoje
        </Botao>
        <div className="ml-auto flex flex-wrap gap-2">
          <div className="w-[160px]">
            <Selecao className="solto" aria-label="Tema" opcoes={PILARES} vazio="Todos os temas" value={pilar} onChange={(e) => setPilar(e.target.value)} />
          </div>
          <div className="w-[170px]">
            <Selecao className="solto" aria-label="Etapa" opcoes={CONTEUDO_STATUS} vazio="Todas as etapas" value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <Botao variante="principal" icone={Plus} onClick={() => abrirConteudo("novo", { data_planejada: d })}>
            Novo conteúdo
          </Botao>
        </div>
      </div>

      {isLoading ? (
        <Carregando linhas={5} />
      ) : error ? (
        <ErroDeCarga erro={error} />
      ) : (
        <>
          {/* computador: grade do mês */}
          <Cartao className="so-computador">
            <div className="cal-grade mb-1.5">
              {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((x) => (
                <div key={x} className="cal-cabeca">
                  {x}
                </div>
              ))}
            </div>
            <div className="cal-grade">
              {dias.slice(0, semanas * 7).map((dia) => (
                <div
                  key={dia}
                  className="cal-dia"
                  data-fora={!dia.startsWith(chave)}
                  data-hoje={dia === d}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/conteudo");
                    if (id) soltar(dia, id);
                  }}
                >
                  <button type="button" className="cal-dia-numero flex items-center justify-between" onClick={() => abrirConteudo("novo", { data_planejada: dia })} title="Criar conteúdo neste dia">
                    {Number(dia.slice(8))}
                    <Plus size={12} className="opacity-0 transition-opacity [.cal-dia:hover_&]:opacity-60" />
                  </button>
                  {(porDia.get(dia) ?? []).map((c) => (
                    <button key={c.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/conteudo", c.id)} className="cal-item" data-feito={c.status === "publicado"} style={{ "--cor": corDe(PILARES, c.pilar) } as CSSProperties} onClick={() => abrirConteudo(c.id)} title={`${c.titulo} · ${nomeDe(CONTEUDO_STATUS, c.status)}`}>
                      <span>{c.titulo}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-tx-3">
              {PILARES.map((pl) => (
                <span key={pl.id} className="inline-flex items-center gap-1.5">
                  <i className="ponto" style={{ "--cor": pl.cor } as CSSProperties} /> {pl.nome}
                </span>
              ))}
              <span className="ml-auto">Arraste um item para mudar a data.</span>
            </div>
          </Cartao>
          {/* celular: lista por dia */}
          <div className="so-celular grid gap-2">
            {dias.filter((x) => x.startsWith(chave) && (porDia.get(x)?.length ?? 0) > 0).length === 0 && (
              <Cartao>
                <Vazio icone={CalendarDays} titulo="Nada planejado neste mês" />
              </Cartao>
            )}
            {dias
              .filter((x) => x.startsWith(chave) && (porDia.get(x)?.length ?? 0) > 0)
              .map((dia) => (
                <Cartao key={dia} titulo={`${diaDaSemanaCurto(dia)}, ${formatarData(dia)}`} className={cn(dia === d && "!border-[rgba(206,14,14,0.6)]")}>
                  <div className="grid gap-1.5">
                    {(porDia.get(dia) ?? []).map((c) => (
                      <button key={c.id} type="button" className="cal-item !py-2.5 !text-[13px]" style={{ "--cor": corDe(PILARES, c.pilar) } as CSSProperties} onClick={() => abrirConteudo(c.id)}>
                        <span className="min-w-0 flex-1">{c.titulo}</span>
                        <EtiquetaDe lista={CONTEUDO_STATUS} id={c.status} fraca />
                      </button>
                    ))}
                  </div>
                </Cartao>
              ))}
          </div>
        </>
      )}

      {semDataLista.length > 0 && (
        <Cartao titulo="Ideias ainda sem data" nota="Abra e escolha um dia para entrar no calendário">
          <div className="flex flex-wrap gap-1.5">
            {semDataLista.map((c) => (
              <button key={c.id} type="button" className="cal-item !w-auto max-w-full" style={{ "--cor": corDe(PILARES, c.pilar) } as CSSProperties} onClick={() => abrirConteudo(c.id)}>
                <span>{c.titulo}</span>
              </button>
            ))}
          </div>
        </Cartao>
      )}
    </>
  );
}

/* ================= ESTEIRA ================= */

function Esteira() {
  const { data: itens, isLoading, error } = useConteudos({});
  const salvar = useSalvarConteudo();
  const colunas = CONTEUDO_STATUS.filter((s) => s.id !== "arquivado").map((s) => ({ id: s.id, nome: s.nome, cor: s.cor }));
  const visiveis = (itens ?? []).filter((c) => c.status !== "arquivado");
  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-tx-2">Cada conteúdo anda da esquerda para a direita: ideia, roteiro, gravação, edição, revisão, agendado e publicado.</p>
        <Botao variante="principal" icone={Plus} onClick={() => abrirConteudo("novo")}>
          Novo conteúdo
        </Botao>
      </div>
      <Quadro
        colunas={colunas}
        itens={visiveis}
        colunaDe={(c) => c.status}
        aoMover={(c, status) => salvar.mutate({ id: c.id, dados: { status: status as Conteudo["status"] } }, { onError: (e) => aviso.erro(mensagemDe(e)) })}
        aoAbrir={(c) => abrirConteudo(c.id)}
        vazio="Arraste para cá"
        cartao={(c) => (
          <div className="grid gap-1.5 pr-6">
            <p className="text-[13px] font-medium leading-snug">{c.titulo}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tx-3">
              {c.pilar && (
                <span className="inline-flex items-center gap-1.5">
                  <i className="ponto" style={{ "--cor": corDe(PILARES, c.pilar) } as CSSProperties} /> {nomeDe(PILARES, c.pilar)}
                </span>
              )}
              <span>{nomeDe(CONTEUDO_FORMATOS, c.formato)}</span>
              {c.data_planejada && <span className={cn(c.status !== "publicado" && c.data_planejada < hoje() && "vencido")}>{formatarData(c.data_planejada)}</span>}
              {c.responsavel && <span>· {c.responsavel}</span>}
            </div>
          </div>
        )}
      />
    </>
  );
}

/* ================= ROTEIROS ================= */

function Roteiros() {
  const { data: itens, isLoading, error } = useConteudos({});
  const { data: quadros } = useQuadros();
  const [busca, setBusca] = useState("");
  const [pilar, setPilar] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const comRoteiro = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (itens ?? []).filter((c) => (c.gancho || c.cenas.length > 0 || c.narracao) && (!pilar || c.pilar === pilar) && (!t || `${c.titulo} ${c.gancho} ${c.narracao} ${c.legenda}`.toLowerCase().includes(t)));
  }, [itens, busca, pilar]);
  const atual = comRoteiro.find((c) => c.id === aberto) ?? comRoteiro[0];
  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar roteiro" className="min-w-[200px] flex-1" />
        <div className="w-[170px]">
          <Selecao className="solto" aria-label="Tema" opcoes={PILARES} vazio="Todos os temas" value={pilar} onChange={(e) => setPilar(e.target.value)} />
        </div>
        <Botao variante="principal" icone={Plus} onClick={() => abrirConteudo("novo", { status: "roteiro" })}>
          Novo roteiro
        </Botao>
      </div>
      {comRoteiro.length === 0 ? (
        <Cartao>
          <Vazio icone={Clapperboard} titulo="Nenhum roteiro ainda" texto="Um conteúdo vira roteiro quando ganha gancho, cenas ou narração." />
        </Cartao>
      ) : (
        <div className="grid items-start gap-3.5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Cartao semPadding className="nao-imprimir max-h-[70vh] overflow-y-auto p-1.5">
            {comRoteiro.map((c) => (
              <button key={c.id} type="button" className={cn("linha-item", atual?.id === c.id && "bg-white/[0.07]")} onClick={() => setAberto(c.id)}>
                <i className="ponto" style={{ "--cor": corDe(PILARES, c.pilar) } as CSSProperties} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{c.titulo}</span>
                  <span className="block truncate text-[11.5px] text-tx-3">
                    {nomeDe(CONTEUDO_STATUS, c.status)}
                    {c.data_planejada ? ` · ${formatarData(c.data_planejada)}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </Cartao>
          {atual && (
            <Cartao
              titulo={atual.titulo}
              nota={[nomeDe(CONTEUDO_FORMATOS, atual.formato), nomeDe(PILARES, atual.pilar), quadros?.find((q) => q.id === atual.quadro_id)?.nome, atual.data_planejada ? formatarData(atual.data_planejada) : ""].filter(Boolean).join(" · ")}
              acao={
                <span className="nao-imprimir flex items-center gap-1.5">
                  <BotaoCopiar texto={roteiroEmTexto(atual)} rotulo="Copiar tudo" />
                  <BotaoIcone icone={Printer} rotulo="Imprimir" onClick={() => window.print()} />
                  <BotaoIcone icone={Pencil} rotulo="Editar" onClick={() => abrirConteudo(atual.id)} />
                </span>
              }
            >
              <div className="grid gap-4 text-[13.5px]">
                {atual.gancho && (
                  <div className="rounded-xl border-l-[3px] border-host bg-white/[0.04] px-4 py-3">
                    <p className="sobretitulo mb-1">Gancho · 3 primeiros segundos</p>
                    <p className="font-display text-[16px] font-semibold leading-snug">{atual.gancho}</p>
                  </div>
                )}
                {atual.cenas.length > 0 && (
                  <div>
                    <p className="sobretitulo mb-2">Cenas</p>
                    <ol className="grid gap-1.5">
                      {atual.cenas.map((cena, i) => (
                        <li key={i} className="veu flex items-start gap-3 px-3 py-2.5">
                          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.08] text-[11.5px] font-semibold">{i + 1}</span>
                          <span className="min-w-0 flex-1">{cena.descricao}</span>
                          {cena.duracao && <span className="shrink-0 text-[12px] text-tx-3">{cena.duracao}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {atual.texto_tela.length > 0 && (
                  <div>
                    <p className="sobretitulo mb-2">Texto na tela</p>
                    <div className="flex flex-wrap gap-1.5">
                      {atual.texto_tela.map((t, i) => (
                        <span key={i} className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[13px] font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {atual.narracao && (
                  <div>
                    <p className="sobretitulo mb-1.5 flex items-center justify-between">Fala ou narração <BotaoCopiar texto={atual.narracao} /></p>
                    <p className="whitespace-pre-wrap text-tx-1">{atual.narracao}</p>
                  </div>
                )}
                {atual.legenda && (
                  <div>
                    <p className="sobretitulo mb-1.5 flex items-center justify-between">Legenda <BotaoCopiar texto={[atual.legenda, atual.hashtags].filter(Boolean).join("\n\n")} /></p>
                    <p className="whitespace-pre-wrap rounded-xl bg-black/30 p-3">{atual.legenda}</p>
                    {atual.hashtags && <p className="mt-1.5 text-[12.5px] text-tx-3">{atual.hashtags}</p>}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {atual.cta && (
                    <div className="veu px-3 py-2.5">
                      <p className="sobretitulo mb-1">Chamada para ação</p>
                      <p className="font-medium">{atual.cta}</p>
                    </div>
                  )}
                  {atual.material_necessario && (
                    <div className="veu px-3 py-2.5">
                      <p className="sobretitulo mb-1">Material necessário</p>
                      <p>{atual.material_necessario}</p>
                    </div>
                  )}
                </div>
              </div>
            </Cartao>
          )}
        </div>
      )}
    </>
  );
}

/* ================= QUADROS E MODELOS ================= */

function QuadrosEModelos() {
  const { data: quadros, isLoading } = useQuadros();
  const { data: conteudos } = useConteudos({});
  const { data: modelos } = useModelos();
  const salvarQuadro = useSalvarQuadro();
  const excluirQuadro = useExcluirQuadro();
  const salvarModelo = useSalvarModelo();
  const excluirModelo = useExcluirModelo();
  const [quadro, setQuadro] = useState<Partial<QuadroTipo> | null>(null);
  const [modelo, setModelo] = useState<Partial<Modelo> | null>(null);
  const [tipo, setTipo] = useState("legenda");
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of conteudos ?? []) if (c.quadro_id) m.set(c.quadro_id, (m.get(c.quadro_id) ?? 0) + 1);
    return m;
  }, [conteudos]);
  const doTipo = (modelos ?? []).filter((m) => m.tipo === tipo);

  const gravarQuadro = async () => {
    if (!quadro?.nome?.trim()) return aviso.erro("Dê um nome ao quadro.");
    try {
      const { id, ...dados } = quadro;
      await salvarQuadro.mutateAsync(id ? { id, dados } : { dados });
      setQuadro(null);
      aviso.ok("Quadro salvo");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const gravarModelo = async () => {
    if (!modelo?.titulo?.trim() || !modelo.texto?.trim()) return aviso.erro("Preencha o título e o texto.");
    try {
      const { id, ...dados } = modelo;
      await salvarModelo.mutateAsync(id ? { id, dados } : { dados });
      setModelo(null);
      aviso.ok("Modelo salvo");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  return (
    <>
      <Cartao titulo="Quadros recorrentes" nota="Formatos que se repetem toda semana e criam hábito no público" acao={<Botao pequeno icone={Plus} onClick={() => setQuadro({ nome: "", ativo: true })}>Novo quadro</Botao>}>
        {isLoading ? (
          <Carregando />
        ) : !quadros || quadros.length === 0 ? (
          <Vazio icone={LayoutGrid} titulo="Nenhum quadro ainda" />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {quadros.map((q) => (
              <div key={q.id} className={cn("veu grid gap-1.5 p-3.5", !q.ativo && "opacity-55")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-[14.5px] font-semibold">{q.nome}</p>
                  <span className="flex shrink-0 items-center">
                    <BotaoIcone icone={Pencil} rotulo="Editar quadro" className="size-7" onClick={() => setQuadro(q)} />
                    <BotaoIcone icone={Trash2} rotulo="Excluir quadro" className="size-7" onClick={async () => (await confirmar({ titulo: `Excluir o quadro "${q.nome}"?`, texto: "Os conteúdos dele continuam existindo.", confirmar: "Excluir", perigo: true })) && excluirQuadro.mutate(q.id)} />
                  </span>
                </div>
                <p className="text-[12.5px] text-tx-2">{q.descricao}</p>
                {q.exemplo && <p className="text-[12px] text-tx-3">Exemplo: {q.exemplo}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {q.frequencia && <Etiqueta fraca>{q.frequencia}</Etiqueta>}
                  {q.formato && <Etiqueta fraca>{nomeDe(CONTEUDO_FORMATOS, q.formato)}</Etiqueta>}
                  <span className="text-[11.5px] text-tx-3">
                    {contagem.get(q.id) ?? 0} {(contagem.get(q.id) ?? 0) === 1 ? "conteúdo" : "conteúdos"}
                  </span>
                  <Botao pequeno className="ml-auto" icone={Plus} onClick={() => abrirConteudo("novo", { quadro_id: q.id, formato: q.formato || "reels", titulo: `${q.nome}: ` })}>
                    Criar conteúdo
                  </Botao>
                </div>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao
        titulo="Modelos de texto"
        nota="Legendas, chamadas para ação e mensagens. Variáveis: {nome_org}, {lider}, {cidade_atual}, {meu_nome}"
        acao={
          <Botao pequeno icone={Plus} onClick={() => setModelo({ tipo: tipo as Modelo["tipo"], titulo: "", texto: "" })}>
            Novo modelo
          </Botao>
        }
      >
        <Segmentos rotulo="Tipos de modelo" valor={tipo} aoMudar={setTipo} abas={MODELO_TIPOS.map((t) => ({ id: t.id, nome: t.nome, contador: (modelos ?? []).filter((m) => m.tipo === t.id).length }))} />
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {doTipo.length === 0 && <p className="py-4 text-[12.5px] text-tx-3">Nenhum modelo deste tipo.</p>}
          {doTipo.map((m) => (
            <div key={m.id} className="veu grid gap-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13.5px] font-medium">{m.titulo}</p>
                <span className="flex shrink-0 items-center gap-0.5">
                  <BotaoCopiar texto={m.texto} />
                  <BotaoIcone icone={Pencil} rotulo="Editar modelo" className="size-7" onClick={() => setModelo(m)} />
                  <BotaoIcone icone={Trash2} rotulo="Excluir modelo" className="size-7" onClick={async () => (await confirmar({ titulo: `Excluir "${m.titulo}"?`, confirmar: "Excluir", perigo: true })) && excluirModelo.mutate(m.id)} />
                </span>
              </div>
              <p className="whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-[12.5px] leading-relaxed">{m.texto}</p>
              {m.observacao && <p className="text-[11.5px] text-tx-3">{m.observacao}</p>}
            </div>
          ))}
        </div>
      </Cartao>

      {quadro && (
        <Janela titulo={quadro.id ? "Editar quadro" : "Novo quadro"} aoFechar={() => setQuadro(null)} rodape={<><Botao variante="fantasma" onClick={() => setQuadro(null)}>Cancelar</Botao><Botao variante="principal" carregando={salvarQuadro.isPending} onClick={() => void gravarQuadro()}>Salvar</Botao></>}>
          <div className="grid gap-3">
            <Campo rotulo="Nome do quadro" value={quadro.nome ?? ""} onChange={(e) => setQuadro({ ...quadro, nome: e.target.value })} autoFocus />
            <AreaTexto rotulo="O que é" linhas={2} value={quadro.descricao ?? ""} onChange={(e) => setQuadro({ ...quadro, descricao: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Quando sai" value={quadro.frequencia ?? ""} onChange={(e) => setQuadro({ ...quadro, frequencia: e.target.value })} placeholder="Ex.: toda terça" />
              <Selecao rotulo="Formato" opcoes={CONTEUDO_FORMATOS} vazio="Qualquer" value={quadro.formato ?? ""} onChange={(e) => setQuadro({ ...quadro, formato: e.target.value as QuadroTipo["formato"] })} />
            </div>
            <Campo rotulo="Exemplo de episódio" value={quadro.exemplo ?? ""} onChange={(e) => setQuadro({ ...quadro, exemplo: e.target.value })} />
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="size-4 accent-white" checked={quadro.ativo ?? true} onChange={(e) => setQuadro({ ...quadro, ativo: e.target.checked })} /> Quadro ativo
            </label>
          </div>
        </Janela>
      )}
      {modelo && (
        <Janela larga titulo={modelo.id ? "Editar modelo" : "Novo modelo"} aoFechar={() => setModelo(null)} rodape={<><Botao variante="fantasma" onClick={() => setModelo(null)}>Cancelar</Botao><Botao variante="principal" carregando={salvarModelo.isPending} onClick={() => void gravarModelo()}>Salvar</Botao></>}>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
              <Campo rotulo="Título" value={modelo.titulo ?? ""} onChange={(e) => setModelo({ ...modelo, titulo: e.target.value })} autoFocus />
              <Selecao rotulo="Tipo" opcoes={MODELO_TIPOS} value={modelo.tipo ?? "legenda"} onChange={(e) => setModelo({ ...modelo, tipo: e.target.value as Modelo["tipo"] })} />
            </div>
            <AreaTexto rotulo="Texto" linhas={7} value={modelo.texto ?? ""} onChange={(e) => setModelo({ ...modelo, texto: e.target.value })} />
            <Campo rotulo="Quando usar (observação)" value={modelo.observacao ?? ""} onChange={(e) => setModelo({ ...modelo, observacao: e.target.value })} />
          </div>
        </Janela>
      )}
    </>
  );
}

/* ================= PÁGINA ================= */

export default function ConteudoPagina() {
  const { aba: abaUrl } = useParams();
  const aba: Aba = abaUrl === "esteira" || abaUrl === "roteiros" || abaUrl === "quadros" ? abaUrl : "calendario";
  const ir = useNavigate();
  return (
    <Pagina sobretitulo="Conteúdo" titulo="Reels, TikTok e redes" descricao="Planeje o mês, acompanhe a produção e guarde os roteiros e os textos prontos.">
      <Segmentos
        rotulo="Áreas do conteúdo"
        valor={aba}
        aoMudar={(v) => ir(v === "calendario" ? "/conteudo" : `/conteudo/${v}`)}
        abas={[
          { id: "calendario", nome: "Calendário" },
          { id: "esteira", nome: "Esteira" },
          { id: "roteiros", nome: "Roteiros" },
          { id: "quadros", nome: "Quadros e modelos" },
        ]}
      />
      {aba === "calendario" && <Calendario />}
      {aba === "esteira" && <Esteira />}
      {aba === "roteiros" && <Roteiros />}
      {aba === "quadros" && <QuadrosEModelos />}
    </Pagina>
  );
}
