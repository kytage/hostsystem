// Automações: o que roda sozinho, o que está pronto para ligar e o que ainda falta.
import { useState } from "react";
import { Bot, ChevronDown, Play } from "lucide-react";
import { AUTOMACAO_STATUS, AUTOMACAO_TIPOS, EXECUCAO_RESULTADOS, nomeDe } from "@/avancado/shared/dominio";
import type { Automacao } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useAutomacoes, useExecucoes, useExecutarAutomacao } from "@/avancado/lib/consultas";
import { formatarMomento, relativo } from "@/avancado/lib/datas";
import { Botao, Carregando, Cartao, ErroDeCarga, Etiqueta, EtiquetaDe, Indice, Indices, Pagina, Vazio, aviso, cn } from "@/avancado/ui/kit";
import { Markdown } from "@/avancado/ui/markdown";

function Execucoes({ id }: { id: string }) {
  const { data, isLoading } = useExecucoes(id);
  if (isLoading) return <Carregando linhas={2} />;
  if (!data || data.length === 0) return <p className="text-[12.5px] text-tx-3">Ainda não rodou nenhuma vez.</p>;
  return (
    <ol className="grid gap-1">
      {data.slice(0, 12).map((e) => (
        <li key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px]">
          <EtiquetaDe lista={EXECUCAO_RESULTADOS} id={e.resultado} />
          <span className="w-[132px] shrink-0 text-tx-3">{formatarMomento(e.iniciado_em)}</span>
          <span className="min-w-0 flex-1 text-tx-2">{e.resumo}</span>
        </li>
      ))}
    </ol>
  );
}

function CartaoAutomacao({ a }: { a: Automacao }) {
  const [aberto, setAberto] = useState(false);
  const executar = useExecutarAutomacao();
  const rodar = () => executar.mutate(a.id, { onSuccess: (e) => (e.resultado === "erro" ? aviso.erro(e.resumo) : aviso.ok(e.resumo || "Executado")), onError: (e) => aviso.erro(mensagemDe(e)) });
  return (
    <article className="vidro grid gap-3 p-4">
      <header className="flex flex-wrap items-start gap-3">
        <span className="indice-icone">
          <Bot size={15} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="cartao-titulo">{a.nome}</h3>
          <p className="mt-0.5 text-[12.5px] text-tx-2">{a.descricao}</p>
        </div>
        <EtiquetaDe lista={AUTOMACAO_STATUS} id={a.status} />
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-tx-3">
        <Etiqueta fraca titulo={AUTOMACAO_TIPOS.find((t) => t.id === a.tipo)?.dica ?? ""}>
          {nomeDe(AUTOMACAO_TIPOS, a.tipo)}
        </Etiqueta>
        {a.frequencia && <span>Quando: {a.frequencia}</span>}
        <span>
          {a.ultima_execucao ? (
            <>
              Última vez: {relativo(a.ultima_execucao)} {a.ultimo_resultado && <EtiquetaDe lista={EXECUCAO_RESULTADOS} id={a.ultimo_resultado} fraca />}
            </>
          ) : (
            "Ainda não rodou"
          )}
        </span>
      </div>
      {a.ultimo_resumo && <p className="veu px-3 py-2 text-[12.5px]">{a.ultimo_resumo}</p>}
      {a.o_que_falta && (
        <p className="rounded-xl border-l-[3px] border-[#E8B339] bg-white/[0.04] px-3.5 py-2.5 text-[12.5px]">
          <b>O que falta:</b> {a.o_que_falta}
        </p>
      )}
      <footer className="flex flex-wrap items-center gap-2">
        {a.tipo === "job_interno" && (
          <Botao pequeno icone={Play} carregando={executar.isPending} onClick={rodar}>
            Executar agora
          </Botao>
        )}
        <Botao pequeno variante="fantasma" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
          Como funciona e histórico <ChevronDown size={14} className={cn("transition-transform", aberto && "rotate-180")} />
        </Botao>
      </footer>
      {aberto && (
        <div className="grid gap-3 border-t border-white/[0.06] pt-3">
          {a.como_funciona && <Markdown texto={a.como_funciona} className="!text-[13px]" />}
          <div>
            <p className="sobretitulo mb-2">Últimas execuções</p>
            <Execucoes id={a.id} />
          </div>
        </div>
      )}
    </article>
  );
}

export default function Automacoes() {
  const { data, isLoading, error } = useAutomacoes();
  const total = (s: string) => (data ?? []).filter((a) => a.status === s).length;
  return (
    <Pagina sobretitulo="Sistema" titulo="Automações" descricao="O que trabalha por você. Cada uma mostra se está ligada, quando rodou pela última vez e o que falta para funcionar.">
      {isLoading ? (
        <Carregando linhas={4} />
      ) : error ? (
        <ErroDeCarga erro={error} />
      ) : !data || data.length === 0 ? (
        <Cartao>
          <Vazio icone={Bot} titulo="Nenhuma automação cadastrada" />
        </Cartao>
      ) : (
        <>
          <Indices colunas={4}>
            <Indice valor={total("ativa")} titulo="Ativas" nota="rodando sozinhas" />
            <Indice valor={total("preparada")} titulo="Prontas para ligar" nota="falta só você ativar" />
            <Indice valor={total("pendente")} titulo="Falta algo" nota="dependem de acesso ou decisão" alerta={total("pendente") > 0} />
            <Indice valor={total("pausada")} titulo="Pausadas" />
          </Indices>
          <div className="grid gap-2.5 xl:grid-cols-2">
            {data.map((a) => (
              <CartaoAutomacao key={a.id} a={a} />
            ))}
          </div>
        </>
      )}
    </Pagina>
  );
}
