// Materiais: estratégia, apresentação, mensagens, processos e relatórios, para ler, copiar e imprimir.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/avancado/roteador";
import { ArrowLeft, BookOpen, FileDown, Pencil, Pin, Plus, Printer, Trash2 } from "lucide-react";
import { MATERIAL_CATEGORIAS, nomeDe } from "@/avancado/shared/dominio";
import type { Material } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useExcluirMaterial, useMateriais, useSalvarMaterial } from "@/avancado/lib/consultas";
import { relativo } from "@/avancado/lib/datas";
import { AreaTexto, Botao, BotaoCopiar, BotaoIcone, Campo, Carregando, Cartao, ErroDeCarga, Etiqueta, Pagina, Selecao, Vazio, aviso } from "@/avancado/ui/kit";
import { Markdown } from "@/avancado/ui/markdown";
import { Janela, confirmar } from "@/avancado/ui/sobrepostos";

function slug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export default function Materiais() {
  const { id } = useParams();
  const ir = useNavigate();
  const { data: materiais, isLoading, error } = useMateriais();
  const salvar = useSalvarMaterial();
  const excluir = useExcluirMaterial();
  const [edit, setEdit] = useState<(Partial<Material> & { novo?: boolean }) | null>(null);
  const atual = materiais?.find((m) => m.id === id);

  useEffect(() => {
    document.querySelector(".area-pagina")?.scrollTo({ top: 0 });
  }, [id]);

  const gravar = async () => {
    if (!edit?.titulo?.trim()) return aviso.erro("Dê um título.");
    try {
      const { novo, criado_em: _a, atualizado_em: _b, ...dados } = edit;
      void _a, void _b;
      if (novo) dados.id = slug(edit.titulo) || `material-${Date.now()}`;
      const salvo = await salvar.mutateAsync(novo ? { dados, novo: true } : { id: edit.id!, dados });
      setEdit(null);
      aviso.ok("Salvo");
      ir(`/materiais/${salvo.id}`);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  const editor = edit && (
    <Janela larga titulo={edit.novo ? "Novo material" : "Editar material"} aoFechar={() => setEdit(null)} rodape={<><Botao variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Botao><Botao variante="principal" carregando={salvar.isPending} onClick={() => void gravar()}>Salvar</Botao></>}>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Campo rotulo="Título" value={edit.titulo ?? ""} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} autoFocus />
          <Selecao rotulo="Categoria" opcoes={MATERIAL_CATEGORIAS} value={edit.categoria ?? "outros"} onChange={(e) => setEdit({ ...edit, categoria: e.target.value as Material["categoria"] })} />
        </div>
        <Campo rotulo="Resumo de uma linha" value={edit.resumo ?? ""} onChange={(e) => setEdit({ ...edit, resumo: e.target.value })} />
        <AreaTexto rotulo="Texto (aceita markdown: # título, **negrito**, - lista)" linhas={14} className="font-mono text-[12.5px]" value={edit.markdown ?? ""} onChange={(e) => setEdit({ ...edit, markdown: e.target.value })} />
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" className="size-4 accent-white" checked={edit.fixado ?? false} onChange={(e) => setEdit({ ...edit, fixado: e.target.checked })} /> Fixar no topo (aparece em “Comece por aqui” no Início)
        </label>
      </div>
    </Janela>
  );

  if (isLoading) return <div className="pagina"><Carregando linhas={5} /></div>;
  if (error) return <div className="pagina"><ErroDeCarga erro={error} /></div>;

  // leitura de um material
  if (id) {
    if (!atual)
      return (
        <Pagina titulo="Material não encontrado">
          <Botao icone={ArrowLeft} onClick={() => ir("/materiais")}>
            Voltar para os materiais
          </Botao>
        </Pagina>
      );
    return (
      <div className="pagina">
        <div className="nao-imprimir flex flex-wrap items-center gap-2 px-1 pt-2">
          <Botao pequeno icone={ArrowLeft} onClick={() => ir("/materiais")}>
            Materiais
          </Botao>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {atual.arquivo && (
              <Botao pequeno icone={FileDown} onClick={() => aviso.info("O anexo deste material fica no computador do Henrique (pasta host-central/materiais).")}>
                Abrir anexo
              </Botao>
            )}
            <BotaoCopiar texto={atual.markdown} rotulo="Copiar texto" />
            <Botao pequeno icone={Printer} onClick={() => window.print()}>
              Imprimir
            </Botao>
            <Botao pequeno icone={Pencil} onClick={() => setEdit(atual)}>
              Editar
            </Botao>
            <BotaoIcone
              icone={Trash2}
              rotulo="Excluir material"
              onClick={async () => {
                if (!(await confirmar({ titulo: `Excluir "${atual.titulo}"?`, confirmar: "Excluir", perigo: true }))) return;
                excluir.mutate(atual.id, { onSuccess: () => ir("/materiais"), onError: (e) => aviso.erro(mensagemDe(e)) });
              }}
            />
          </span>
        </div>
        <Cartao className="mx-auto max-w-[860px] !p-6 sm:!p-9">
          <p className="sobretitulo">{nomeDe(MATERIAL_CATEGORIAS, atual.categoria)}</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.025em]">{atual.titulo}</h1>
          {atual.resumo && <p className="mt-2 text-[14px] text-tx-2">{atual.resumo}</p>}
          <p className="nao-imprimir mt-2 text-[11.5px] text-tx-3">Atualizado {relativo(atual.atualizado_em)}</p>
          <div className="my-5 border-t border-white/[0.07]" />
          <Markdown texto={atual.markdown || "*Sem texto ainda.*"} />
        </Cartao>
        {editor}
      </div>
    );
  }

  // biblioteca
  const fixados = (materiais ?? []).filter((m) => m.fixado);
  return (
    <Pagina
      sobretitulo="Sistema"
      titulo="Materiais"
      descricao="Estratégias, apresentação, mensagens e processos prontos para ler, copiar e usar."
      acoes={
        <Botao variante="principal" icone={Plus} onClick={() => setEdit({ novo: true, titulo: "", categoria: "outros", markdown: "", resumo: "" })}>
          Novo material
        </Botao>
      }
    >
      {!materiais || materiais.length === 0 ? (
        <Cartao>
          <Vazio icone={BookOpen} titulo="Nenhum material ainda" texto="Aqui ficam a estratégia de captação, a apresentação para líderes, as mensagens e o plano de conteúdo." />
        </Cartao>
      ) : (
        <>
          {fixados.length > 0 && (
            <div className="grid gap-2.5 md:grid-cols-2">
              {fixados.map((m) => (
                <button key={m.id} type="button" className="vidro grid gap-1.5 p-5 text-left transition-colors hover:brightness-125" onClick={() => ir(`/materiais/${m.id}`)}>
                  <span className="sobretitulo flex items-center gap-1.5">
                    <Pin size={11} /> Fixado · {nomeDe(MATERIAL_CATEGORIAS, m.categoria)}
                  </span>
                  <span className="font-display text-[17px] font-semibold tracking-[-0.015em]">{m.titulo}</span>
                  {m.resumo && <span className="text-[13px] text-tx-2">{m.resumo}</span>}
                </button>
              ))}
            </div>
          )}
          {MATERIAL_CATEGORIAS.map((cat) => {
            const lista = materiais.filter((m) => m.categoria === cat.id && !m.fixado);
            if (lista.length === 0) return null;
            return (
              <Cartao key={cat.id} titulo={cat.nome}>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {lista.map((m) => (
                    <button key={m.id} type="button" className="veu grid gap-1 p-3.5 text-left" onClick={() => ir(`/materiais/${m.id}`)}>
                      <span className="flex items-center gap-2 text-[13.5px] font-medium">
                        <span className="min-w-0 flex-1 truncate">{m.titulo}</span>
                        {m.arquivo && <Etiqueta fraca>anexo</Etiqueta>}
                      </span>
                      {m.resumo && <span className="line-clamp-2 text-[12.5px] text-tx-2">{m.resumo}</span>}
                    </button>
                  ))}
                </div>
              </Cartao>
            );
          })}
        </>
      )}
      {editor}
    </Pagina>
  );
}
