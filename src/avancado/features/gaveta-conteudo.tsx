// Gaveta de um conteúdo (Reels, TikTok…): plano, roteiro, arquivos e resultado.
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { CONTEUDO_FORMATOS, CONTEUDO_STATUS, PILARES, nomeDe } from "@/avancado/shared/dominio";
import type { Cena, Conteudo, ConteudoEntrada } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useConteudo, useDuplicarConteudo, useExcluirConteudo, useQuadros, useSalvarConteudo } from "@/avancado/lib/consultas";
import { abrirConteudo } from "@/avancado/lib/gavetas";
import { AreaTexto, Botao, BotaoCopiar, BotaoIcone, Campo, Carregando, Demo, ErroDeCarga, Segmentos, Selecao, aviso } from "@/avancado/ui/kit";
import { Gaveta, MenuAcoes, confirmar } from "@/avancado/ui/sobrepostos";

type Aba = "plano" | "roteiro" | "arquivos" | "resultado";
const REDES = [
  { id: "instagram", nome: "Instagram" },
  { id: "tiktok", nome: "TikTok" },
  { id: "youtube", nome: "YouTube" },
  { id: "discord", nome: "Discord" },
] as const;

const VAZIO: ConteudoEntrada = {
  titulo: "", formato: "reels", plataformas: ["instagram", "tiktok"], quadro_id: null, pilar: "", status: "ideia", data_planejada: null, hora: "", publicado_em: null,
  gancho: "", cenas: [], texto_tela: [], narracao: "", legenda: "", cta: "", hashtags: "", material_necessario: "", arquivos: [], responsavel: "", observacoes: "", metricas: {},
};

/** Roteiro inteiro em texto, pronto para colar para quem vai editar. */
export function roteiroEmTexto(c: ConteudoEntrada): string {
  const L: string[] = [];
  L.push(`${c.titulo ?? ""}`.toUpperCase());
  if (c.gancho) L.push("", `GANCHO (primeiros 3 segundos): ${c.gancho}`);
  if (c.cenas?.length) {
    L.push("", "CENAS:");
    c.cenas.forEach((cena, i) => L.push(`${i + 1}. ${cena.descricao}${cena.duracao ? ` (${cena.duracao})` : ""}`));
  }
  if (c.texto_tela?.length) {
    L.push("", "TEXTO NA TELA:");
    c.texto_tela.forEach((t) => L.push(`- ${t}`));
  }
  if (c.narracao) L.push("", `FALA / NARRAÇÃO:\n${c.narracao}`);
  if (c.legenda) L.push("", `LEGENDA:\n${c.legenda}`);
  if (c.cta) L.push("", `CHAMADA PARA AÇÃO: ${c.cta}`);
  if (c.hashtags) L.push("", c.hashtags);
  if (c.material_necessario) L.push("", `MATERIAL NECESSÁRIO: ${c.material_necessario}`);
  return L.join("\n");
}

export function GavetaConteudo({ id, inicial, aoFechar }: { id: string; inicial?: ConteudoEntrada | undefined; aoFechar: () => void }) {
  const novo = id === "novo";
  const { data: atual, isLoading, error } = useConteudo(novo ? null : id);
  const { data: quadros } = useQuadros();
  const salvar = useSalvarConteudo();
  const excluir = useExcluirConteudo();
  const duplicar = useDuplicarConteudo();
  const [aba, setAba] = useState<Aba>("plano");
  const [r, setR] = useState<ConteudoEntrada>(() => ({ ...VAZIO, ...inicial }));
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    if (atual && !sujo) setR(atual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual]);

  const mudar = <K extends keyof ConteudoEntrada>(campo: K, valor: ConteudoEntrada[K]) => {
    setR((a) => ({ ...a, [campo]: valor }));
    setSujo(true);
  };
  const fechar = async () => {
    if (sujo && !(await confirmar({ titulo: "Sair sem salvar?", texto: "Você fez alterações que ainda não foram salvas.", confirmar: "Sair sem salvar", perigo: true }))) return;
    aoFechar();
  };
  const gravar = async () => {
    if (!String(r.titulo ?? "").trim()) return aviso.erro("Dê um título para o conteúdo.");
    try {
      const dados = { ...r } as Record<string, unknown>;
      for (const c of ["id", "criado_em", "atualizado_em"]) delete dados[c];
      const salvo = await salvar.mutateAsync(novo ? { dados } : { id, dados });
      setSujo(false);
      aviso.ok(novo ? "Conteúdo criado" : "Salvo");
      if (novo) abrirConteudo((salvo as Conteudo).id);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const apagar = async () => {
    if (!(await confirmar({ titulo: "Excluir este conteúdo?", confirmar: "Excluir", perigo: true }))) return;
    await excluir.mutateAsync(id).then(() => (aviso.ok("Excluído"), aoFechar()), (e) => aviso.erro(mensagemDe(e)));
  };
  const copia = async () => {
    try {
      const c = await duplicar.mutateAsync(id);
      aviso.ok("Cópia criada");
      abrirConteudo(c.id);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  const cenas = r.cenas ?? [];
  const mudarCena = (i: number, c: Partial<Cena>) => mudar("cenas", cenas.map((x, n) => (n === i ? { ...x, ...c } : x)));
  const moverCena = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= cenas.length) return;
    const copiaCenas = [...cenas];
    [copiaCenas[i], copiaCenas[j]] = [copiaCenas[j]!, copiaCenas[i]!];
    mudar("cenas", copiaCenas);
  };
  const plataformas = r.plataformas ?? [];
  const metricas = r.metricas ?? {};
  const mudarMetrica = (k: "visualizacoes" | "curtidas" | "comentarios" | "compartilhamentos" | "salvamentos", v: string) => {
    const copiaMetricas = { ...metricas };
    if (v.trim() === "") delete copiaMetricas[k];
    else copiaMetricas[k] = Number(v.replace(/\D/g, "")) || 0;
    mudar("metricas", copiaMetricas);
  };

  return (
    <Gaveta
      larga
      aoFechar={() => void fechar()}
      sobretitulo={
        <>
          {novo ? "Novo conteúdo" : nomeDe(CONTEUDO_FORMATOS, r.formato)}
          {atual?.demo && <Demo />}
        </>
      }
      titulo={r.titulo?.trim() || "Sem título"}
      acoes={
        !novo && atual ? (
          <MenuAcoes
            acoes={[
              { rotulo: "Duplicar", icone: Copy, aoClicar: () => void copia() },
              { rotulo: "Excluir", icone: Trash2, aoClicar: () => void apagar(), perigo: true },
            ]}
          />
        ) : undefined
      }
      rodape={
        <>
          {sujo && <span className="mr-auto text-[12px] text-tx-3">Alterações não salvas</span>}
          {aba === "roteiro" && <BotaoCopiar texto={roteiroEmTexto(r)} rotulo="Copiar roteiro completo" pequeno={false} />}
          <Botao variante="principal" carregando={salvar.isPending} onClick={() => void gravar()}>
            {novo ? "Criar conteúdo" : "Salvar"}
          </Botao>
        </>
      }
    >
      {!novo && isLoading ? (
        <Carregando linhas={6} />
      ) : !novo && error ? (
        <ErroDeCarga erro={error} />
      ) : (
        <div className="grid gap-4">
          <Segmentos
            rotulo="Partes do conteúdo"
            valor={aba}
            aoMudar={setAba}
            abas={[
              { id: "plano", nome: "Plano" },
              { id: "roteiro", nome: "Roteiro" },
              { id: "arquivos", nome: "Arquivos", contador: r.arquivos?.length },
              { id: "resultado", nome: "Resultado" },
            ]}
          />

          {aba === "plano" && (
            <div className="grid gap-3">
              <Campo rotulo="Título" value={r.titulo ?? ""} onChange={(e) => mudar("titulo", e.target.value)} placeholder="Ex.: Reta final das corridas ranqueadas" autoFocus={novo} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Selecao rotulo="Formato" opcoes={CONTEUDO_FORMATOS} value={r.formato} onChange={(e) => mudar("formato", e.target.value as Conteudo["formato"])} />
                <Selecao rotulo="Etapa da produção" opcoes={CONTEUDO_STATUS} value={r.status} onChange={(e) => mudar("status", e.target.value as Conteudo["status"])} />
                <Selecao rotulo="Tema" opcoes={PILARES} vazio="Sem tema" value={r.pilar ?? ""} onChange={(e) => mudar("pilar", e.target.value as Conteudo["pilar"])} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Data planejada" type="date" value={r.data_planejada ?? ""} onChange={(e) => mudar("data_planejada", e.target.value || null)} />
                <Campo rotulo="Horário" type="time" value={r.hora ?? ""} onChange={(e) => mudar("hora", e.target.value)} />
                <Selecao rotulo="Quadro" opcoes={(quadros ?? []).map((q) => ({ id: q.id, nome: q.nome }))} vazio="Nenhum" value={r.quadro_id ?? ""} onChange={(e) => mudar("quadro_id", e.target.value || null)} />
              </div>
              <div>
                <span className="rotulo">Onde publicar</span>
                <div className="flex flex-wrap gap-1.5">
                  {REDES.map((rede) => {
                    const ativo = plataformas.includes(rede.id);
                    return (
                      <button key={rede.id} type="button" className={`botao botao-pequeno ${ativo ? "botao-principal" : "botao-secundario"}`} aria-pressed={ativo} onClick={() => mudar("plataformas", ativo ? plataformas.filter((p) => p !== rede.id) : [...plataformas, rede.id])}>
                        {rede.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Campo rotulo="Responsável" value={r.responsavel ?? ""} onChange={(e) => mudar("responsavel", e.target.value)} placeholder="Quem grava, edita ou publica" />
              <AreaTexto rotulo="Observações" linhas={2} value={r.observacoes ?? ""} onChange={(e) => mudar("observacoes", e.target.value)} />
            </div>
          )}

          {aba === "roteiro" && (
            <div className="grid gap-3">
              <AreaTexto rotulo="Gancho (o que aparece nos 3 primeiros segundos)" linhas={2} value={r.gancho ?? ""} onChange={(e) => mudar("gancho", e.target.value)} />
              <div>
                <span className="rotulo">Cenas</span>
                <div className="grid gap-1.5">
                  {cenas.map((c, i) => (
                    <div key={i} className="veu flex items-start gap-2 p-2">
                      <span className="mt-2 w-5 shrink-0 text-center text-[12px] font-semibold text-tx-3">{i + 1}</span>
                      <AreaTexto linhas={1} className="min-h-[38px]" value={c.descricao} onChange={(e) => mudarCena(i, { descricao: e.target.value })} placeholder="O que aparece" aria-label={`Cena ${i + 1}`} />
                      <input className="campo w-[76px] shrink-0" value={c.duracao ?? ""} onChange={(e) => mudarCena(i, { duracao: e.target.value })} placeholder="3s" aria-label="Duração" />
                      <div className="flex shrink-0 flex-col">
                        <BotaoIcone icone={ArrowUp} rotulo="Subir cena" className="size-[19px]" onClick={() => moverCena(i, -1)} disabled={i === 0} />
                        <BotaoIcone icone={ArrowDown} rotulo="Descer cena" className="size-[19px]" onClick={() => moverCena(i, 1)} disabled={i === cenas.length - 1} />
                      </div>
                      <BotaoIcone icone={Trash2} rotulo="Remover cena" className="mt-0.5 size-8" onClick={() => mudar("cenas", cenas.filter((_, n) => n !== i))} />
                    </div>
                  ))}
                  <div>
                    <Botao pequeno icone={Plus} onClick={() => mudar("cenas", [...cenas, { descricao: "", duracao: "" }])}>
                      Adicionar cena
                    </Botao>
                  </div>
                </div>
              </div>
              <AreaTexto rotulo="Texto na tela (uma frase por linha)" linhas={3} value={(r.texto_tela ?? []).join("\n")} onChange={(e) => mudar("texto_tela", e.target.value.split("\n"))} onBlur={() => mudar("texto_tela", (r.texto_tela ?? []).map((t) => t.trim()).filter(Boolean))} />
              <AreaTexto rotulo="Fala ou narração" linhas={3} value={r.narracao ?? ""} onChange={(e) => mudar("narracao", e.target.value)} />
              <AreaTexto rotulo="Legenda da postagem" linhas={3} value={r.legenda ?? ""} onChange={(e) => mudar("legenda", e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Chamada para ação" value={r.cta ?? ""} onChange={(e) => mudar("cta", e.target.value)} placeholder="Ex.: Entre no nosso Discord" />
                <Campo rotulo="Hashtags" value={r.hashtags ?? ""} onChange={(e) => mudar("hashtags", e.target.value)} placeholder="#fivem #gtarp" />
              </div>
              <AreaTexto rotulo="Material necessário (o que precisa gravar ou separar)" linhas={2} value={r.material_necessario ?? ""} onChange={(e) => mudar("material_necessario", e.target.value)} />
            </div>
          )}

          {aba === "arquivos" && (
            <div className="grid gap-2">
              <p className="text-[12.5px] text-tx-2">Guarde aqui onde estão os arquivos: caminho no computador (ex.: F:\HOST VIDEOS\...) ou link.</p>
              {(r.arquivos ?? []).map((a, i) => (
                <div key={i} className="veu grid gap-2 p-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <input className="campo" value={a.rotulo} placeholder="O que é (ex.: vídeo final)" onChange={(e) => mudar("arquivos", (r.arquivos ?? []).map((x, n) => (n === i ? { ...x, rotulo: e.target.value } : x)))} />
                  <input className="campo" value={a.caminho} placeholder="Caminho ou link" onChange={(e) => mudar("arquivos", (r.arquivos ?? []).map((x, n) => (n === i ? { ...x, caminho: e.target.value } : x)))} />
                  <div className="flex items-center gap-1">
                    <BotaoCopiar texto={a.caminho} rotulo="Copiar" />
                    <BotaoIcone icone={Trash2} rotulo="Remover" onClick={() => mudar("arquivos", (r.arquivos ?? []).filter((_, n) => n !== i))} />
                  </div>
                </div>
              ))}
              <div>
                <Botao pequeno icone={Plus} onClick={() => mudar("arquivos", [...(r.arquivos ?? []), { rotulo: "", caminho: "" }])}>
                  Adicionar arquivo
                </Botao>
              </div>
            </div>
          )}

          {aba === "resultado" && (
            <div className="grid gap-3">
              <p className="text-[12.5px] text-tx-2">Preencha depois de publicar, para saber o que funciona.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Publicado em" type="date" value={r.publicado_em ?? ""} onChange={(e) => mudar("publicado_em", e.target.value || null)} />
                <Campo rotulo="Link da postagem" value={metricas.link ?? ""} onChange={(e) => mudar("metricas", { ...metricas, link: e.target.value })} placeholder="https://" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Campo rotulo="Visualizações" inputMode="numeric" value={metricas.visualizacoes ?? ""} onChange={(e) => mudarMetrica("visualizacoes", e.target.value)} />
                <Campo rotulo="Curtidas" inputMode="numeric" value={metricas.curtidas ?? ""} onChange={(e) => mudarMetrica("curtidas", e.target.value)} />
                <Campo rotulo="Comentários" inputMode="numeric" value={metricas.comentarios ?? ""} onChange={(e) => mudarMetrica("comentarios", e.target.value)} />
                <Campo rotulo="Compartilh." inputMode="numeric" value={metricas.compartilhamentos ?? ""} onChange={(e) => mudarMetrica("compartilhamentos", e.target.value)} />
                <Campo rotulo="Salvamentos" inputMode="numeric" value={metricas.salvamentos ?? ""} onChange={(e) => mudarMetrica("salvamentos", e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}
    </Gaveta>
  );
}
