// Início: o que precisa da sua atenção hoje.
import type { CSSProperties } from "react";
import { useNavigate } from "@/avancado/roteador";
import { ArrowUpRight, Bot, BookOpen, CalendarDays, Clapperboard, Inbox, ListChecks, Plus, Scale, Target, Timer, Users } from "lucide-react";
import { AUTOMACAO_STATUS, CONTEUDO_STATUS, ETAPAS, PILARES, TAREFA_PRIORIDADES, corDe, nomeDe } from "@/avancado/shared/dominio";
import type { Lead, Tarefa } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useConcluirTarefa, useMateriais, usePainel } from "@/avancado/lib/consultas";
import { diasAte, formatarData, formatarDataLonga, prazoRelativo, relativo, saudacao } from "@/avancado/lib/datas";
import { abrirConteudo, abrirLead, abrirTarefa } from "@/avancado/lib/gavetas";
import { Botao, Carregando, Cartao, ErroDeCarga, Etiqueta, EtiquetaDe, Indice, Indices, Marcar, Vazio, aviso, cn } from "@/avancado/ui/kit";
import { Markdown } from "@/avancado/ui/markdown";

function LinhaTarefa({ t }: { t: Tarefa }) {
  const concluir = useConcluirTarefa();
  const atrasada = t.prazo !== null && diasAte(t.prazo) < 0;
  return (
    <div className="linha-item cursor-pointer" role="button" tabIndex={0} onClick={() => abrirTarefa(t.id)} onKeyDown={(e) => e.key === "Enter" && abrirTarefa(t.id)}>
      <Marcar marcado={false} rotulo="Marcar como feita" aoMudar={() => concluir.mutate(t.id, { onSuccess: () => aviso.ok("Feita"), onError: (e) => aviso.erro(mensagemDe(e)) })} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{t.titulo}</span>
        {t.responsavel && <span className="block truncate text-[11.5px] text-tx-3">{t.responsavel}</span>}
      </span>
      <i className="ponto" style={{ "--cor": corDe(TAREFA_PRIORIDADES, t.prioridade) } as CSSProperties} title={`Prioridade ${nomeDe(TAREFA_PRIORIDADES, t.prioridade).toLowerCase()}`} />
      <span className={cn("shrink-0 text-[12px]", atrasada ? "vencido font-medium" : "text-tx-3")}>{prazoRelativo(t.prazo)}</span>
    </div>
  );
}

function LinhaLead({ l, mostrarAtraso }: { l: Lead; mostrarAtraso?: boolean }) {
  const atraso = l.proximo_followup ? -diasAte(l.proximo_followup) : 0;
  return (
    <button type="button" className="linha-item" onClick={() => abrirLead(l.id)}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{l.nome}</span>
        <span className="block truncate text-[11.5px] text-tx-3">{l.proximo_passo || l.cidade_atual || nomeDe(ETAPAS, l.etapa)}</span>
      </span>
      <EtiquetaDe lista={ETAPAS} id={l.etapa} fraca />
      {mostrarAtraso && <span className={cn("shrink-0 text-[12px]", atraso > 0 ? "vencido font-medium" : "text-tx-3")}>{atraso > 0 ? `${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso` : "hoje"}</span>}
    </button>
  );
}

export default function Inicio() {
  const { data: p, isLoading, error } = usePainel();
  const { data: materiais } = useMateriais();
  const ir = useNavigate();
  const fixado = materiais?.find((m) => m.fixado);

  if (isLoading) return <div className="pagina"><Carregando linhas={6} /></div>;
  if (error || !p) return <div className="pagina"><ErroDeCarga erro={error} /></div>;

  const urgentes = p.tarefas.atrasadas + p.tarefas.para_hoje + p.captacao.followups_atrasados + p.tarefas.decisoes.length;
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <p className="sobretitulo">{formatarDataLonga(p.hoje)}</p>
          <h1 className="pagina-titulo">
            <span className="text-tx-2">{saudacao()},</span> Henrique
          </h1>
          <p className="pagina-descricao">
            {urgentes > 0 ? (
              <span className="inline-flex items-center gap-2">
                <i className="ponto" style={{ "--cor": "#ce0e0e" } as CSSProperties} /> {urgentes} {urgentes === 1 ? "item pede" : "itens pedem"} você hoje
              </span>
            ) : (
              "Nada urgente por agora."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao icone={Plus} onClick={() => abrirTarefa("novo")}>
            Tarefa
          </Botao>
          <Botao icone={Plus} onClick={() => abrirLead("novo")}>
            Oportunidade
          </Botao>
          <Botao icone={Plus} onClick={() => abrirConteudo("novo")}>
            Ideia de conteúdo
          </Botao>
        </div>
      </header>

      <Indices colunas={5}>
        <Indice valor={p.captacao.total_abertos} titulo="Oportunidades em aberto" nota={`${p.captacao.novos_7d} novas em 7 dias`} icone={Users} aoClicar={() => ir("/captacao")} />
        <Indice valor={p.captacao.para_triagem} titulo="Para olhar na triagem" nota="achados do radar" icone={Inbox} alerta={p.captacao.para_triagem > 0} aoClicar={() => ir("/captacao/triagem")} />
        <Indice valor={p.captacao.followups_atrasados} titulo="Acompanhamentos atrasados" nota="captação" icone={Timer} alerta={p.captacao.followups_atrasados > 0} aoClicar={() => ir("/captacao?followup=atrasado")} />
        <Indice valor={`${p.conteudo.publicados_semana}/${p.conteudo.planejados_semana}`} titulo="Conteúdos da semana" nota={p.conteudo.atrasados > 0 ? `${p.conteudo.atrasados} atrasados` : "publicados / planejados"} icone={Clapperboard} alerta={p.conteudo.atrasados > 0} aoClicar={() => ir("/conteudo")} />
        <Indice valor={p.tarefas.abertas} titulo="Tarefas abertas" nota={p.tarefas.atrasadas > 0 ? `${p.tarefas.atrasadas} atrasadas` : `${p.tarefas.para_hoje} para hoje`} icone={ListChecks} alerta={p.tarefas.atrasadas > 0} aoClicar={() => ir("/tarefas")} />
      </Indices>

      {fixado && (
        <button type="button" className="vidro flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:brightness-125" onClick={() => ir(`/materiais/${fixado.id}`)}>
          <span className="indice-icone">
            <BookOpen size={15} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="sobretitulo block">Comece por aqui</span>
            <span className="cartao-titulo mt-1 block truncate">{fixado.titulo}</span>
            {fixado.resumo && <span className="mt-0.5 block truncate text-[12.5px] text-tx-2">{fixado.resumo}</span>}
          </span>
          <ArrowUpRight size={17} className="shrink-0 text-tx-2" />
        </button>
      )}

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Cartao titulo="Próximas ações" nota="Suas tarefas, das mais urgentes para as menos" acao={<Botao pequeno variante="fantasma" onClick={() => ir("/tarefas")}>Ver todas</Botao>}>
          {p.tarefas.proximas.length === 0 ? <Vazio icone={ListChecks} titulo="Nenhuma tarefa aberta" acao={<Botao pequeno icone={Plus} onClick={() => abrirTarefa("novo")}>Nova tarefa</Botao>} /> : <div className="-mx-1.5 grid">{p.tarefas.proximas.map((t) => <LinhaTarefa key={t.id} t={t} />)}</div>}
        </Cartao>

        <Cartao titulo="Decisões que dependem de você" nota="Só você pode destravar" acao={<Botao pequeno variante="fantasma" onClick={() => ir("/tarefas?aba=decisoes")}>Ver todas</Botao>}>
          {p.tarefas.decisoes.length === 0 ? (
            <Vazio icone={Scale} titulo="Nenhuma decisão pendente" />
          ) : (
            <div className="-mx-1.5 grid">
              {p.tarefas.decisoes.map((t) => (
                <button key={t.id} type="button" className="linha-item" onClick={() => abrirTarefa(t.id)}>
                  <i className="ponto" style={{ "--cor": corDe(TAREFA_PRIORIDADES, t.prioridade) } as CSSProperties} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{t.titulo}</span>
                  {t.prazo && <span className={cn("shrink-0 text-[12px]", diasAte(t.prazo) < 0 ? "vencido" : "text-tx-3")}>{prazoRelativo(t.prazo)}</span>}
                </button>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao titulo="Acompanhar agora" nota="Captações com retorno combinado para hoje ou antes" acao={<Botao pequeno variante="fantasma" onClick={() => ir("/captacao/funil")}>Abrir funil</Botao>}>
          {p.captacao.followups.length === 0 ? <Vazio icone={Timer} titulo="Nenhum acompanhamento vencido" texto="Quando você marcar um próximo acompanhamento numa oportunidade, ela aparece aqui no dia." /> : <div className="-mx-1.5 grid">{p.captacao.followups.map((l) => <LinhaLead key={l.id} l={l} mostrarAtraso />)}</div>}
        </Cartao>

        <Cartao titulo="Prioridades de captação" nota="Prioridade alta, ainda sem primeiro contato" acao={<Botao pequeno variante="fantasma" onClick={() => ir("/captacao?prioridade=alta")}>Ver lista</Botao>}>
          {p.captacao.prioridades.length === 0 ? <Vazio icone={Target} titulo="Nenhuma prioridade parada" /> : <div className="-mx-1.5 grid">{p.captacao.prioridades.map((l) => <LinhaLead key={l.id} l={l} />)}</div>}
        </Cartao>

        <Cartao titulo="Conteúdo dos próximos 7 dias" acao={<Botao pequeno variante="fantasma" onClick={() => ir("/conteudo")}>Calendário</Botao>}>
          {p.conteudo.proximos.length === 0 ? (
            <Vazio icone={CalendarDays} titulo="Nada planejado para os próximos dias" acao={<Botao pequeno icone={Plus} onClick={() => abrirConteudo("novo")}>Planejar conteúdo</Botao>} />
          ) : (
            <div className="-mx-1.5 grid">
              {p.conteudo.proximos.map((c) => (
                <button key={c.id} type="button" className="linha-item" onClick={() => abrirConteudo(c.id)}>
                  <i className="ponto" style={{ "--cor": corDe(PILARES, c.pilar) } as CSSProperties} />
                  <span className="w-[74px] shrink-0 text-[12px] text-tx-2">{formatarData(c.data_planejada)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{c.titulo}</span>
                  <EtiquetaDe lista={CONTEUDO_STATUS} id={c.status} fraca />
                </button>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao titulo="Automações" nota="O que roda sozinho e quando rodou" acao={<Botao pequeno variante="fantasma" onClick={() => ir("/automacoes")}>Detalhes</Botao>}>
          {p.automacoes.length === 0 ? (
            <Vazio icone={Bot} titulo="Nenhuma automação cadastrada" />
          ) : (
            <div className="grid gap-1.5">
              {p.automacoes.map((a) => (
                <div key={a.id} className="veu flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{a.nome}</span>
                    <span className="block truncate text-[11.5px] text-tx-3">{a.ultima_execucao ? `Rodou ${relativo(a.ultima_execucao)}${a.ultimo_resumo ? ` · ${a.ultimo_resumo}` : ""}` : "Ainda não rodou"}</span>
                  </span>
                  <EtiquetaDe lista={AUTOMACAO_STATUS} id={a.status} />
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>

      <Cartao
        titulo={p.radar.ultimo_resumo ? p.radar.ultimo_resumo.titulo : "Resumo do radar"}
        nota={p.radar.ultimo_resumo ? `${formatarData(p.radar.ultimo_resumo.data)} · ${p.radar.ultimo_resumo.novos_leads} ${p.radar.ultimo_resumo.novos_leads === 1 ? "oportunidade nova" : "oportunidades novas"}` : "Pesquisa diária de organizações e do mercado"}
        acao={<Botao pequeno variante="fantasma" onClick={() => ir("/radar")}>Abrir radar</Botao>}
      >
        {p.radar.ultimo_resumo ? (
          <div className="relative max-h-[280px] overflow-hidden">
            <Markdown texto={p.radar.ultimo_resumo.markdown} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#131213] to-transparent" />
          </div>
        ) : (
          <Vazio titulo="Ainda não há resumo" texto="O resumo diário aparece aqui depois que a pesquisa automática rodar." />
        )}
        {p.radar.novidades.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.radar.novidades.map((n) => (
              <a key={n.id} href={n.url || undefined} target="_blank" rel="noreferrer noopener" className="max-w-full">
                <Etiqueta fraca className="max-w-full">
                  <span className="truncate">{n.titulo}</span>
                </Etiqueta>
              </a>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
}
