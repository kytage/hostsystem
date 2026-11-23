// Gaveta de uma tarefa, decisão, reunião ou rotina.
import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { AREAS, RECORRENCIAS, TAREFA_PRIORIDADES, TAREFA_STATUS, TAREFA_TIPOS, nomeDe } from "@/avancado/shared/dominio";
import type { Tarefa, TarefaEntrada } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useConcluirTarefa, useExcluirTarefa, useSalvarTarefa, useTarefa } from "@/avancado/lib/consultas";
import { formatarData } from "@/avancado/lib/datas";
import { AreaTexto, Botao, BotaoIcone, Campo, Carregando, ErroDeCarga, Marcar, Selecao, aviso } from "@/avancado/ui/kit";
import { Gaveta, MenuAcoes, confirmar } from "@/avancado/ui/sobrepostos";

const VAZIO: TarefaEntrada = {
  titulo: "", notas: "", tipo: "tarefa", area: "gestao", prioridade: "media", status: "a_fazer", responsavel: "", prazo: null, hora: "", recorrencia: "", checklist: [], participantes: "", vinculo_tipo: "", vinculo_id: "",
};

export function GavetaTarefa({ id, inicial, aoFechar }: { id: string; inicial?: TarefaEntrada | undefined; aoFechar: () => void }) {
  const novo = id === "novo";
  const { data: atual, isLoading, error } = useTarefa(novo ? null : id);
  const salvar = useSalvarTarefa();
  const concluir = useConcluirTarefa();
  const excluir = useExcluirTarefa();
  const [r, setR] = useState<TarefaEntrada>(() => ({ ...VAZIO, ...inicial }));
  const [sujo, setSujo] = useState(false);
  const [novoItem, setNovoItem] = useState("");

  useEffect(() => {
    if (atual && !sujo) setR(atual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual]);

  const mudar = <K extends keyof TarefaEntrada>(campo: K, valor: TarefaEntrada[K]) => {
    setR((a) => ({ ...a, [campo]: valor }));
    setSujo(true);
  };
  const fechar = async () => {
    if (sujo && !(await confirmar({ titulo: "Sair sem salvar?", texto: "Você fez alterações que ainda não foram salvas.", confirmar: "Sair sem salvar", perigo: true }))) return;
    aoFechar();
  };
  const gravar = async () => {
    if (!String(r.titulo ?? "").trim()) return aviso.erro("Escreva o que precisa ser feito.");
    try {
      const dados = { ...r } as Record<string, unknown>;
      for (const c of ["id", "criado_em", "atualizado_em", "concluida_em"]) delete dados[c];
      await salvar.mutateAsync(novo ? { dados } : { id, dados });
      aviso.ok(novo ? "Criada" : "Salva");
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const feito = async () => {
    try {
      const res = await concluir.mutateAsync(id);
      aviso.ok(res.proxima ? `Feita. Próxima em ${formatarData(res.proxima.prazo)}` : "Feita");
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const apagar = async () => {
    if (!(await confirmar({ titulo: "Excluir?", confirmar: "Excluir", perigo: true }))) return;
    await excluir.mutateAsync(id).then(() => (aviso.ok("Excluída"), aoFechar()), (e) => aviso.erro(mensagemDe(e)));
  };

  const lista = r.checklist ?? [];
  const reuniao = r.tipo === "reuniao";
  const adicionarItem = () => {
    const t = novoItem.trim();
    if (!t) return;
    mudar("checklist", [...lista, { texto: t, feito: false }]);
    setNovoItem("");
  };
  const aberta = atual && atual.status !== "feito" && atual.status !== "cancelado";

  return (
    <Gaveta
      aoFechar={() => void fechar()}
      sobretitulo={novo ? `Nova ${nomeDe(TAREFA_TIPOS, r.tipo).toLowerCase()}` : nomeDe(TAREFA_TIPOS, r.tipo)}
      titulo={r.titulo?.trim() || "Sem título"}
      acoes={!novo && atual ? <MenuAcoes acoes={[{ rotulo: "Excluir", icone: Trash2, aoClicar: () => void apagar(), perigo: true }]} /> : undefined}
      rodape={
        <>
          {aberta && (
            <Botao icone={Check} className="mr-auto" carregando={concluir.isPending} onClick={() => void feito()}>
              Marcar como feita
            </Botao>
          )}
          <Botao variante="principal" carregando={salvar.isPending} onClick={() => void gravar()}>
            {novo ? "Criar" : "Salvar"}
          </Botao>
        </>
      }
    >
      {!novo && isLoading ? (
        <Carregando linhas={5} />
      ) : !novo && error ? (
        <ErroDeCarga erro={error} />
      ) : (
        <div className="grid gap-3">
          <Campo rotulo={r.tipo === "decisao" ? "O que precisa ser decidido" : reuniao ? "Assunto da reunião" : "O que precisa ser feito"} value={r.titulo ?? ""} onChange={(e) => mudar("titulo", e.target.value)} autoFocus={novo} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Selecao rotulo="Tipo" opcoes={TAREFA_TIPOS} value={r.tipo} onChange={(e) => mudar("tipo", e.target.value as Tarefa["tipo"])} />
            <Selecao rotulo="Prioridade" opcoes={TAREFA_PRIORIDADES} value={r.prioridade} onChange={(e) => mudar("prioridade", e.target.value as Tarefa["prioridade"])} />
            <Selecao rotulo="Situação" opcoes={TAREFA_STATUS} value={r.status} onChange={(e) => mudar("status", e.target.value as Tarefa["status"])} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo={reuniao ? "Dia" : "Prazo"} type="date" value={r.prazo ?? ""} onChange={(e) => mudar("prazo", e.target.value || null)} />
            <Campo rotulo="Horário" type="time" value={r.hora ?? ""} onChange={(e) => mudar("hora", e.target.value)} />
            <Selecao rotulo="Repete" opcoes={RECORRENCIAS} value={r.recorrencia ?? ""} onChange={(e) => mudar("recorrencia", e.target.value as Tarefa["recorrencia"])} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Selecao rotulo="Área" opcoes={AREAS} value={r.area} onChange={(e) => mudar("area", e.target.value as Tarefa["area"])} />
            <Campo rotulo="Responsável" value={r.responsavel ?? ""} onChange={(e) => mudar("responsavel", e.target.value)} placeholder="Quem faz (vazio = você)" />
          </div>
          {reuniao && <Campo rotulo="Participantes" value={r.participantes ?? ""} onChange={(e) => mudar("participantes", e.target.value)} placeholder="Quem participa" />}
          <AreaTexto rotulo={r.tipo === "decisao" ? "Contexto e opções" : "Anotações"} linhas={3} value={r.notas ?? ""} onChange={(e) => mudar("notas", e.target.value)} />
          <div>
            <span className="rotulo">{reuniao ? "Pauta" : "Passos"}</span>
            <div className="grid gap-1.5">
              {lista.map((item, i) => (
                <div key={i} className="veu flex items-center gap-2.5 px-3 py-2">
                  <Marcar marcado={item.feito} rotulo={item.feito ? "Desmarcar" : "Marcar como feito"} aoMudar={(v) => mudar("checklist", lista.map((x, n) => (n === i ? { ...x, feito: v } : x)))} />
                  <input className={`min-w-0 flex-1 bg-transparent text-[13px] outline-none ${item.feito ? "text-tx-3 line-through" : ""}`} value={item.texto} onChange={(e) => mudar("checklist", lista.map((x, n) => (n === i ? { ...x, texto: e.target.value } : x)))} aria-label={`Item ${i + 1}`} />
                  <BotaoIcone icone={Trash2} rotulo="Remover item" className="size-7" onClick={() => mudar("checklist", lista.filter((_, n) => n !== i))} />
                </div>
              ))}
              <div className="flex gap-2">
                <input className="campo" placeholder={reuniao ? "Novo item da pauta" : "Novo passo"} value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarItem())} />
                <Botao icone={Plus} onClick={adicionarItem}>
                  Adicionar
                </Botao>
              </div>
            </div>
          </div>
          {atual?.concluida_em && <p className="text-[11.5px] text-tx-3">Concluída em {formatarData(atual.concluida_em.slice(0, 10))}</p>}
          {atual?.origem && atual.origem !== "manual" && <p className="text-[11.5px] text-tx-3">Origem: {atual.origem}</p>}
        </div>
      )}
    </Gaveta>
  );
}
