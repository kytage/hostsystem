// Tarefas: meu dia, semana, todas, decisões, reuniões e rotinas.
import { useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "@/avancado/roteador";
import { CalendarClock, ListChecks, Plus, Repeat, Scale } from "lucide-react";
import { AREAS, TAREFA_PRIORIDADES, TAREFA_STATUS, TAREFA_TIPOS, corDe, nomeDe } from "@/avancado/shared/dominio";
import type { Tarefa } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useConcluirTarefa, useSalvarTarefa, useTarefas } from "@/avancado/lib/consultas";
import { diasAte, formatarData, hoje, prazoRelativo, somarDias } from "@/avancado/lib/datas";
import { abrirTarefa } from "@/avancado/lib/gavetas";
import { Botao, CampoBusca, Carregando, Cartao, ErroDeCarga, Etiqueta, EtiquetaDe, Indice, Indices, Marcar, Pagina, Segmentos, Selecao, Vazio, aviso, cn } from "@/avancado/ui/kit";

type Aba = "dia" | "semana" | "todas" | "decisoes" | "reunioes" | "rotinas";
const ABERTAS = ["a_fazer", "fazendo", "aguardando"];

function Linha({ t }: { t: Tarefa }) {
  const concluir = useConcluirTarefa();
  const salvar = useSalvarTarefa();
  const feita = t.status === "feito";
  const atrasada = !feita && t.prazo !== null && diasAte(t.prazo) < 0;
  const feitos = t.checklist.filter((i) => i.feito).length;
  const alternar = (marcar: boolean) => {
    if (marcar) concluir.mutate(t.id, { onSuccess: (r) => aviso.ok(r.proxima ? `Feita. Próxima em ${formatarData(r.proxima.prazo)}` : "Feita"), onError: (e) => aviso.erro(mensagemDe(e)) });
    else salvar.mutate({ id: t.id, dados: { status: "a_fazer" } }, { onError: (e) => aviso.erro(mensagemDe(e)) });
  };
  return (
    <div className="linha-item cursor-pointer" role="button" tabIndex={0} onClick={() => abrirTarefa(t.id)} onKeyDown={(e) => e.key === "Enter" && abrirTarefa(t.id)}>
      <Marcar marcado={feita} rotulo={feita ? "Reabrir" : "Marcar como feita"} aoMudar={alternar} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13.5px]", feita && "text-tx-3 line-through")}>{t.titulo}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-tx-3">
          {t.tipo !== "tarefa" && <span className="font-medium text-tx-2">{nomeDe(TAREFA_TIPOS, t.tipo)}</span>}
          <span>{nomeDe(AREAS, t.area)}</span>
          {t.responsavel && <span>· {t.responsavel}</span>}
          {t.recorrencia && (
            <span className="inline-flex items-center gap-1">
              <Repeat size={11} /> repete
            </span>
          )}
          {t.checklist.length > 0 && (
            <span>
              {feitos}/{t.checklist.length} {t.tipo === "reuniao" ? "da pauta" : "passos"}
            </span>
          )}
          {t.status === "aguardando" && <span className="text-[#b58bf5]">aguardando alguém</span>}
          {t.status === "fazendo" && <span className="text-[#e8b339]">fazendo</span>}
        </span>
      </span>
      <i className="ponto" style={{ "--cor": corDe(TAREFA_PRIORIDADES, t.prioridade) } as CSSProperties} title={`Prioridade ${nomeDe(TAREFA_PRIORIDADES, t.prioridade).toLowerCase()}`} />
      <span className={cn("w-[92px] shrink-0 text-right text-[12px]", atrasada ? "vencido font-medium" : "text-tx-3")}>
        {t.prazo ? prazoRelativo(t.prazo) : "sem prazo"}
        {t.hora && <span className="block text-[11px]">{t.hora}</span>}
      </span>
    </div>
  );
}

function Grupo({ titulo, tarefas, vazio }: { titulo: string; tarefas: Tarefa[]; vazio?: string }) {
  if (tarefas.length === 0 && !vazio) return null;
  return (
    <Cartao titulo={titulo} nota={tarefas.length ? `${tarefas.length} ${tarefas.length === 1 ? "item" : "itens"}` : undefined}>
      {tarefas.length === 0 ? <p className="py-3 text-[12.5px] text-tx-3">{vazio}</p> : <div className="-mx-1.5 grid">{tarefas.map((t) => <Linha key={t.id} t={t} />)}</div>}
    </Cartao>
  );
}

export default function Tarefas() {
  const [parametros, setParametros] = useSearchParams();
  const aba = (parametros.get("aba") as Aba) || "dia";
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [situacao, setSituacao] = useState("abertas");
  const [rapida, setRapida] = useState("");
  const salvar = useSalvarTarefa();
  const { data: todas, isLoading, error } = useTarefas({ status: "todas" });

  const d = hoje();
  const abertas = useMemo(() => (todas ?? []).filter((t) => ABERTAS.includes(t.status)), [todas]);
  const ordenar = (lista: Tarefa[]) =>
    [...lista].sort((a, b) => {
      const pa = a.prazo ?? "9999";
      const pb = b.prazo ?? "9999";
      if (pa !== pb) return pa < pb ? -1 : 1;
      const o = ["urgente", "alta", "media", "baixa"];
      return o.indexOf(a.prioridade) - o.indexOf(b.prioridade);
    });
  const atrasadas = ordenar(abertas.filter((t) => t.prazo !== null && t.prazo < d));
  const deHoje = ordenar(abertas.filter((t) => t.prazo === d));
  const importantesSemPrazo = abertas.filter((t) => t.prazo === null && ["urgente", "alta"].includes(t.prioridade) && t.tipo !== "rotina");
  const daSemana = ordenar(abertas.filter((t) => t.prazo !== null && t.prazo > d && t.prazo <= somarDias(d, 7)));
  const decisoes = ordenar(abertas.filter((t) => t.tipo === "decisao"));
  const reunioes = ordenar((todas ?? []).filter((t) => t.tipo === "reuniao"));
  const rotinas = ordenar(abertas.filter((t) => t.recorrencia !== "" || t.tipo === "rotina"));
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ordenar(
      (todas ?? []).filter((t) => {
        if (situacao === "abertas" && !ABERTAS.includes(t.status)) return false;
        if (situacao !== "abertas" && situacao !== "todas" && t.status !== situacao) return false;
        if (area && t.area !== area) return false;
        if (termo && !`${t.titulo} ${t.notas} ${t.responsavel}`.toLowerCase().includes(termo)) return false;
        return true;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas, busca, area, situacao]);

  const criarRapida = async () => {
    const titulo = rapida.trim();
    if (!titulo) return;
    try {
      await salvar.mutateAsync({ dados: { titulo, prazo: aba === "dia" ? d : null, tipo: aba === "decisoes" ? "decisao" : aba === "reunioes" ? "reuniao" : "tarefa" } });
      setRapida("");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  return (
    <Pagina
      sobretitulo="Geral"
      titulo="Tarefas"
      descricao="Suas prioridades, decisões, reuniões e rotinas num lugar só."
      acoes={
        <Botao variante="principal" icone={Plus} onClick={() => abrirTarefa("novo", { tipo: aba === "decisoes" ? "decisao" : aba === "reunioes" ? "reuniao" : "tarefa" })}>
          Nova
        </Botao>
      }
    >
      <Indices colunas={4}>
        <Indice valor={atrasadas.length} titulo="Atrasadas" icone={CalendarClock} alerta={atrasadas.length > 0} aoClicar={() => setParametros({ aba: "dia" })} />
        <Indice valor={deHoje.length} titulo="Para hoje" icone={ListChecks} aoClicar={() => setParametros({ aba: "dia" })} />
        <Indice valor={decisoes.length} titulo="Decisões pendentes" icone={Scale} aoClicar={() => setParametros({ aba: "decisoes" })} />
        <Indice valor={abertas.length} titulo="Abertas no total" icone={ListChecks} aoClicar={() => setParametros({ aba: "todas" })} />
      </Indices>

      <Segmentos
        rotulo="Visões"
        valor={aba}
        aoMudar={(v) => setParametros(v === "dia" ? {} : { aba: v })}
        abas={[
          { id: "dia", nome: "Meu dia", contador: atrasadas.length + deHoje.length, alerta: atrasadas.length > 0 },
          { id: "semana", nome: "Semana", contador: daSemana.length },
          { id: "todas", nome: "Todas" },
          { id: "decisoes", nome: "Decisões", contador: decisoes.length },
          { id: "reunioes", nome: "Reuniões" },
          { id: "rotinas", nome: "Rotinas" },
        ]}
      />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void criarRapida();
        }}
      >
        <input className="campo solto" style={{ borderRadius: 999, paddingLeft: 16 }} placeholder={aba === "decisoes" ? "Nova decisão: digite e aperte Enter" : aba === "reunioes" ? "Nova reunião: digite o assunto e aperte Enter" : "Nova tarefa: digite e aperte Enter"} value={rapida} onChange={(e) => setRapida(e.target.value)} aria-label="Adicionar rápido" />
        <Botao type="submit" icone={Plus} carregando={salvar.isPending}>
          Adicionar
        </Botao>
      </form>

      {isLoading ? (
        <Carregando linhas={5} />
      ) : error ? (
        <ErroDeCarga erro={error} />
      ) : aba === "dia" ? (
        atrasadas.length + deHoje.length + importantesSemPrazo.length === 0 ? (
          <Cartao>
            <Vazio icone={ListChecks} titulo="Dia livre" texto="Nada atrasado nem marcado para hoje. Veja a semana ou adicione uma tarefa." />
          </Cartao>
        ) : (
          <>
            <Grupo titulo="Atrasadas" tarefas={atrasadas} />
            <Grupo titulo="Hoje" tarefas={deHoje} />
            <Grupo titulo="Importantes sem data" tarefas={importantesSemPrazo} />
          </>
        )
      ) : aba === "semana" ? (
        <Grupo titulo="Próximos 7 dias" tarefas={daSemana} vazio="Nada com prazo para os próximos 7 dias." />
      ) : aba === "decisoes" ? (
        <Grupo titulo="Decisões que dependem de você" tarefas={decisoes} vazio="Nenhuma decisão pendente." />
      ) : aba === "reunioes" ? (
        <>
          <Grupo titulo="Próximas reuniões" tarefas={reunioes.filter((t) => ABERTAS.includes(t.status))} vazio="Nenhuma reunião marcada." />
          <Grupo titulo="Já aconteceram" tarefas={reunioes.filter((t) => !ABERTAS.includes(t.status)).slice(0, 15)} />
        </>
      ) : aba === "rotinas" ? (
        <Grupo titulo="Rotinas (repetem sozinhas ao concluir)" tarefas={rotinas} vazio="Nenhuma rotina cadastrada. Crie uma tarefa e escolha em “Repete”." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar tarefa" className="min-w-[200px] flex-1" />
            <div className="w-[170px]">
              <Selecao opcoes={[{ id: "abertas", nome: "Abertas" }, { id: "todas", nome: "Todas" }, ...TAREFA_STATUS]} value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação" className="solto" />
            </div>
            <div className="w-[170px]">
              <Selecao opcoes={AREAS} vazio="Todas as áreas" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className="solto" />
            </div>
          </div>
          <Cartao nota={`${filtradas.length} ${filtradas.length === 1 ? "tarefa" : "tarefas"}`}>
            {filtradas.length === 0 ? (
              <Vazio icone={ListChecks} titulo="Nada encontrado" />
            ) : (
              <div className="-mx-1.5 grid">
                {filtradas.map((t) => (
                  <Linha key={t.id} t={t} />
                ))}
              </div>
            )}
          </Cartao>
        </>
      )}
      <p className="px-1 text-[11.5px] text-tx-3">
        <Etiqueta fraca>Dica</Etiqueta> Marque o quadradinho para concluir. Rotina concluída volta sozinha na próxima data. <EtiquetaDe lista={TAREFA_PRIORIDADES} id="urgente" fraca /> e <EtiquetaDe lista={TAREFA_PRIORIDADES} id="alta" fraca /> aparecem em “Meu dia” mesmo sem prazo.
      </p>
    </Pagina>
  );
}
