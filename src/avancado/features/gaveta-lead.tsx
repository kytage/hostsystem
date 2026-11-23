// Gaveta de uma oportunidade de captação: resumo, evidências, pessoas, histórico e mensagens prontas.
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, GitMerge, Link2, MessageSquarePlus, Plus, Send, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import {
  CANAIS,
  CONFIANCAS,
  ESTILOS,
  ETAPAS,
  EVIDENCIA_CLASSES,
  INTERACAO_TIPOS,
  LEAD_TIPOS,
  ORIGENS,
  PLATAFORMAS,
  PRIORIDADES,
  nomeDe,
  plataformaDoLink,
} from "@/avancado/shared/dominio";
import type { Duplicado, LeadCompleto, LeadEntrada, LinkDoLead } from "@/avancado/shared/tipos";
import { ErroApi, mensagemDe } from "@/avancado/lib/api";
import { useAlterarLead, useConfig, useCriarLead, useExcluirLead, useFilhaDoLead, useLead, useLeads, useMesclarLead, useModelos, verDuplicados } from "@/avancado/lib/consultas";
import { formatarData, formatarMomento, hoje } from "@/avancado/lib/datas";
import { abrirLead } from "@/avancado/lib/gavetas";
import { AreaTexto, Botao, BotaoCopiar, BotaoIcone, Campo, CampoBusca, Carregando, Demo, ErroDeCarga, Etiqueta, EtiquetaConfianca, EtiquetaDe, Rotulo, Segmentos, Selecao, Vazio, aviso, useAtrasado } from "@/avancado/ui/kit";
import { IconePlataforma, arroba } from "@/avancado/ui/plataformas";
import { Gaveta, Janela, MenuAcoes, confirmar } from "@/avancado/ui/sobrepostos";

type Aba = "resumo" | "evidencias" | "pessoas" | "historico" | "mensagens";
const CAMPOS_EDITAVEIS = [
  "tipo", "nome", "descricao", "plataforma", "links", "cidade_atual", "cidade_confianca", "lider", "contato_publico",
  "tamanho", "tamanho_texto", "tamanho_confianca", "alcance", "alcance_texto", "estilo", "indicio", "indicio_confianca",
  "motivo_host", "prioridade", "origem", "etapa", "triagem", "proximo_passo", "ultimo_contato", "proximo_followup",
  "responsavel", "observacoes", "tags", "motivo_perda",
] as const;

const VAZIO: LeadEntrada = {
  tipo: "organizacao", nome: "", descricao: "", plataforma: "", links: [], cidade_atual: "", cidade_confianca: "desconhecida", lider: "", contato_publico: "",
  tamanho: null, tamanho_texto: "", tamanho_confianca: "desconhecida", alcance: null, alcance_texto: "", estilo: "desconhecido", indicio: "", indicio_confianca: "desconhecida",
  motivo_host: "", prioridade: "media", origem: "manual", etapa: "descoberta", triagem: "aprovado", proximo_passo: "", ultimo_contato: null, proximo_followup: null,
  responsavel: "", observacoes: "", tags: [], motivo_perda: "",
};

function soEditaveis(l: LeadEntrada): LeadEntrada {
  const o: Record<string, unknown> = {};
  for (const c of CAMPOS_EDITAVEIS) o[c] = l[c];
  return o as LeadEntrada;
}

export function GavetaLead({ id, inicial, aoFechar }: { id: string; inicial?: Partial<LeadEntrada> | undefined; aoFechar: () => void }) {
  const novo = id === "novo";
  const { data: lead, isLoading, error } = useLead(novo ? null : id);
  const criar = useCriarLead();
  const alterar = useAlterarLead();
  const excluir = useExcluirLead();
  const [aba, setAba] = useState<Aba>("resumo");
  const [r, setR] = useState<LeadEntrada>(() => ({ ...VAZIO, ...inicial }));
  const [sujo, setSujo] = useState(false);
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [juntando, setJuntando] = useState(false);

  useEffect(() => {
    if (lead && !sujo) setR(soEditaveis(lead));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  const mudar = <K extends keyof LeadEntrada>(campo: K, valor: LeadEntrada[K]) => {
    setR((a) => ({ ...a, [campo]: valor }));
    setSujo(true);
  };

  // aviso de duplicado enquanto digita (só em oportunidade nova)
  const nomeAtrasado = useAtrasado(r.nome ?? "", 400);
  const linksAtrasados = useAtrasado(JSON.stringify(r.links ?? []), 400);
  useEffect(() => {
    if (!novo || (nomeAtrasado.trim().length < 2 && linksAtrasados === "[]")) return void setDuplicados([]);
    let vivo = true;
    verDuplicados(nomeAtrasado, JSON.parse(linksAtrasados) as LinkDoLead[])
      .then((d) => vivo && setDuplicados(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [novo, nomeAtrasado, linksAtrasados]);

  const fechar = async () => {
    if (sujo && !(await confirmar({ titulo: "Sair sem salvar?", texto: "Você fez alterações que ainda não foram salvas.", confirmar: "Sair sem salvar", perigo: true }))) return;
    aoFechar();
  };

  const salvar = async (forcar = false) => {
    if (!String(r.nome ?? "").trim()) return aviso.erro("Dê um nome para a oportunidade.");
    try {
      if (novo) {
        const criado = await criar.mutateAsync({ ...r, forcar });
        setSujo(false);
        aviso.ok("Oportunidade criada");
        abrirLead(criado.id);
      } else {
        // perdida precisa de motivo
        if (r.etapa === "perdida" && lead?.etapa !== "perdida" && !String(r.motivo_perda ?? "").trim()) return aviso.erro('Conte o motivo no campo "Motivo da perda".');
        await alterar.mutateAsync({ id, dados: r });
        setSujo(false);
        aviso.ok("Salvo");
      }
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409 && e.duplicados) setDuplicados(e.duplicados);
      aviso.erro(mensagemDe(e));
    }
  };

  const apagar = async () => {
    if (!(await confirmar({ titulo: "Excluir esta oportunidade?", texto: "As evidências e o histórico dela também serão apagados.", confirmar: "Excluir", perigo: true }))) return;
    try {
      await excluir.mutateAsync(id);
      aviso.ok("Excluída");
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  const abas = [
    { id: "resumo" as const, nome: "Resumo" },
    { id: "evidencias" as const, nome: "Evidências", contador: lead?.evidencias.length },
    { id: "pessoas" as const, nome: "Pessoas", contador: lead?.contatos.length },
    { id: "historico" as const, nome: "Histórico", contador: lead?.interacoes.length },
    { id: "mensagens" as const, nome: "Mensagens" },
  ];

  return (
    <Gaveta
      larga
      aoFechar={() => void fechar()}
      sobretitulo={
        <>
          {novo ? "Nova oportunidade" : nomeDe(LEAD_TIPOS, r.tipo)}
          {lead?.demo && <Demo />}
          {lead && lead.triagem === "pendente" && <Etiqueta cor="#E8B339">Para olhar</Etiqueta>}
        </>
      }
      titulo={r.nome?.trim() || (novo ? "Sem nome" : "…")}
      acoes={
        !novo && lead ? (
          <MenuAcoes
            acoes={[
              { rotulo: "Juntar com outra…", icone: GitMerge, aoClicar: () => setJuntando(true) },
              { rotulo: "Excluir", icone: Trash2, aoClicar: () => void apagar(), perigo: true },
            ]}
          />
        ) : undefined
      }
      rodape={
        aba === "resumo" || novo ? (
          <>
            {sujo && <span className="mr-auto text-[12px] text-tx-3">Alterações não salvas</span>}
            <Botao variante="fantasma" onClick={() => void fechar()}>
              Fechar
            </Botao>
            <Botao variante="principal" carregando={criar.isPending || alterar.isPending} onClick={() => void salvar()}>
              {novo ? "Criar oportunidade" : "Salvar"}
            </Botao>
          </>
        ) : undefined
      }
    >
      {!novo && isLoading ? (
        <Carregando linhas={6} />
      ) : !novo && error ? (
        <ErroDeCarga erro={error} />
      ) : (
        <div className="grid gap-4">
          {!novo && <Segmentos abas={abas} valor={aba} aoMudar={setAba} rotulo="Partes da oportunidade" />}

          {duplicados.length > 0 && novo && (
            <div className="veu grid gap-2 p-3" role="alert">
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#f0c869]">
                <TriangleAlert size={15} /> Parece que já existe
              </p>
              {duplicados.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span>
                    <b>{d.nome}</b> — {d.motivo} · {nomeDe(ETAPAS, d.etapa)}
                  </span>
                  <Botao pequeno onClick={() => abrirLead(d.id)}>
                    Abrir a existente
                  </Botao>
                </div>
              ))}
              <div>
                <Botao pequeno variante="fantasma" onClick={() => void salvar(true)}>
                  Criar mesmo assim
                </Botao>
              </div>
            </div>
          )}

          {(aba === "resumo" || novo) && <Resumo r={r} mudar={mudar} lead={lead} />}
          {aba === "evidencias" && lead && <Evidencias lead={lead} />}
          {aba === "pessoas" && lead && <Pessoas lead={lead} />}
          {aba === "historico" && lead && <Historico lead={lead} />}
          {aba === "mensagens" && lead && <Mensagens lead={lead} />}
        </div>
      )}
      {juntando && lead && <JuntarCom lead={lead} aoFechar={() => setJuntando(false)} />}
    </Gaveta>
  );
}

/* ---------------- Resumo ---------------- */

function Resumo({ r, mudar, lead }: { r: LeadEntrada; mudar: <K extends keyof LeadEntrada>(c: K, v: LeadEntrada[K]) => void; lead: LeadCompleto | undefined }) {
  const links = r.links ?? [];
  const [novoLink, setNovoLink] = useState("");
  const adicionarLink = () => {
    const url = novoLink.trim();
    if (!url) return;
    const completo = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (!links.some((l) => l.url.toLowerCase() === completo.toLowerCase())) mudar("links", [...links, { plataforma: plataformaDoLink(completo), url: completo }]);
    setNovoLink("");
  };
  const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")) || 0);
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Campo rotulo="Nome" value={r.nome ?? ""} onChange={(e) => mudar("nome", e.target.value)} placeholder="Nome da organização, criador ou comunidade" autoFocus={!lead} />
        <Selecao rotulo="Tipo" opcoes={LEAD_TIPOS} value={r.tipo} onChange={(e) => mudar("tipo", e.target.value as LeadEntrada["tipo"])} />
      </div>
      <AreaTexto rotulo="Quem é (1 ou 2 frases)" linhas={2} value={r.descricao ?? ""} onChange={(e) => mudar("descricao", e.target.value)} />

      <div>
        <span className="rotulo">Redes e links</span>
        <div className="grid gap-1.5">
          {links.map((l, i) => (
            <div key={l.url} className="veu flex items-center gap-2.5 px-3 py-2">
              <span className="text-tx-2">
                <IconePlataforma plataforma={l.plataforma} tamanho={15} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]" title={l.url}>
                {arroba(l.url)} <span className="text-tx-3">· {nomeDe(PLATAFORMAS, l.plataforma)}</span>
                {l.status && l.status !== "aberto" && <span className="ml-1.5 text-[11px] text-[#f0c869]">{l.status === "indexado" ? "visto só no buscador" : l.status === "quebrado" ? "link quebrado" : "não conferido"}</span>}
              </span>
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="botao-icone size-7" title="Abrir em outra aba" aria-label="Abrir link">
                <ExternalLink size={14} />
              </a>
              <BotaoIcone icone={Trash2} rotulo="Remover link" className="size-7" onClick={() => mudar("links", links.filter((_, n) => n !== i))} />
            </div>
          ))}
          <div className="flex gap-2">
            <input className="campo" placeholder="Cole um link (Instagram, TikTok, Discord…)" value={novoLink} onChange={(e) => setNovoLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarLink())} onBlur={adicionarLink} />
            <Botao icone={Link2} onClick={adicionarLink}>
              Adicionar
            </Botao>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Selecao rotulo="Etapa" opcoes={ETAPAS} value={r.etapa} onChange={(e) => mudar("etapa", e.target.value as LeadEntrada["etapa"])} />
        <Selecao rotulo="Prioridade" opcoes={PRIORIDADES} value={r.prioridade} onChange={(e) => mudar("prioridade", e.target.value as LeadEntrada["prioridade"])} />
        <Selecao rotulo="Estilo" opcoes={ESTILOS} value={r.estilo} onChange={(e) => mudar("estilo", e.target.value as LeadEntrada["estilo"])} />
      </div>
      {r.etapa === "perdida" && <Campo rotulo="Motivo da perda" value={r.motivo_perda ?? ""} onChange={(e) => mudar("motivo_perda", e.target.value)} placeholder="Ex.: preferiu ficar na cidade atual" />}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
        <Campo rotulo="Cidade atual" value={r.cidade_atual ?? ""} onChange={(e) => mudar("cidade_atual", e.target.value)} placeholder="Onde joga hoje" />
        <Selecao rotulo="Certeza da cidade" opcoes={CONFIANCAS} value={r.cidade_confianca} onChange={(e) => mudar("cidade_confianca", e.target.value as LeadEntrada["cidade_confianca"])} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_170px]">
        <Campo rotulo="Integrantes" inputMode="numeric" value={r.tamanho ?? ""} onChange={(e) => mudar("tamanho", numero(e.target.value))} placeholder="nº" />
        <Campo rotulo="De onde veio esse número" value={r.tamanho_texto ?? ""} onChange={(e) => mudar("tamanho_texto", e.target.value)} placeholder="Ex.: ≈40 no vídeo de recrutamento" />
        <Selecao rotulo="Certeza do tamanho" opcoes={CONFIANCAS} value={r.tamanho_confianca} onChange={(e) => mudar("tamanho_confianca", e.target.value as LeadEntrada["tamanho_confianca"])} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        <Campo rotulo="Seguidores" inputMode="numeric" value={r.alcance ?? ""} onChange={(e) => mudar("alcance", numero(e.target.value))} placeholder="nº" />
        <Campo rotulo="Sobre o alcance" value={r.alcance_texto ?? ""} onChange={(e) => mudar("alcance_texto", e.target.value)} placeholder="Ex.: 12,4 mil no Instagram, visto em 21/11" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Líder" value={r.lider ?? ""} onChange={(e) => mudar("lider", e.target.value)} />
        <Campo rotulo="Contato público" value={r.contato_publico ?? ""} onChange={(e) => mudar("contato_publico", e.target.value)} placeholder="Ex.: DM no Instagram, Discord da bio" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
        <AreaTexto rotulo="Indício de que procura cidade nova" linhas={2} value={r.indicio ?? ""} onChange={(e) => mudar("indicio", e.target.value)} placeholder="O que foi visto e onde" />
        <Selecao rotulo="Certeza do indício" opcoes={CONFIANCAS} value={r.indicio_confianca} onChange={(e) => mudar("indicio_confianca", e.target.value as LeadEntrada["indicio_confianca"])} />
      </div>
      <AreaTexto rotulo="Por que a HOST pode interessar (hipótese)" linhas={2} value={r.motivo_host ?? ""} onChange={(e) => mudar("motivo_host", e.target.value)} />
      <AreaTexto rotulo="Próximo passo" linhas={2} value={r.proximo_passo ?? ""} onChange={(e) => mudar("proximo_passo", e.target.value)} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Último contato" type="date" value={r.ultimo_contato ?? ""} onChange={(e) => mudar("ultimo_contato", e.target.value || null)} />
        <Campo rotulo="Próximo acompanhamento" type="date" value={r.proximo_followup ?? ""} onChange={(e) => mudar("proximo_followup", e.target.value || null)} />
        <Campo rotulo="Responsável" value={r.responsavel ?? ""} onChange={(e) => mudar("responsavel", e.target.value)} placeholder="Quem cuida" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Selecao rotulo="Origem" opcoes={ORIGENS} value={r.origem} onChange={(e) => mudar("origem", e.target.value as LeadEntrada["origem"])} />
        <Campo rotulo="Etiquetas (separe por vírgula)" value={(r.tags ?? []).join(", ")} onChange={(e) => mudar("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </div>
      <AreaTexto rotulo="Observações" linhas={3} value={r.observacoes ?? ""} onChange={(e) => mudar("observacoes", e.target.value)} />

      {lead && lead.alertas.length > 0 && (
        <div className="veu grid gap-1 p-3 text-[12.5px] text-[#f0c869]">
          {lead.alertas.map((a) => (
            <p key={a} className="flex items-start gap-2">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {a}
            </p>
          ))}
        </div>
      )}
      {lead && (
        <p className="text-[11.5px] text-tx-3">
          Criada em {formatarMomento(lead.criado_em)} · alterada em {formatarMomento(lead.atualizado_em)} · na etapa atual desde {formatarMomento(lead.etapa_desde)}
        </p>
      )}
    </div>
  );
}

/* ---------------- Evidências ---------------- */

function Evidencias({ lead }: { lead: LeadCompleto }) {
  const { criar, alterar, excluir } = useFilhaDoLead(lead.id, "evidencias");
  const [n, setN] = useState({ url: "", data: "", descricao: "", classificacao: "fato" });
  const adicionar = async () => {
    if (!n.url.trim()) return aviso.erro("Cole o link da evidência.");
    try {
      await criar.mutateAsync({ ...n, data: n.data || null, verificado: true, como_verificou: "conferido por mim" });
      setN({ url: "", data: "", descricao: "", classificacao: "fato" });
      aviso.ok("Evidência adicionada");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  return (
    <div className="grid gap-3">
      <p className="text-[12.5px] text-tx-2">Cada informação importante precisa de um link para conferir. Marque se é fato, estimativa ou hipótese.</p>
      {lead.evidencias.length === 0 ? (
        <Vazio icone={Link2} titulo="Nenhuma evidência ainda" texto="Adicione o link de uma postagem, vídeo ou perfil que comprove o que está no resumo." />
      ) : (
        lead.evidencias.map((e) => (
          <div key={e.id} className="veu grid gap-1.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <EtiquetaDe lista={EVIDENCIA_CLASSES} id={e.classificacao} />
              {e.data && <span className="text-[12px] text-tx-2">{formatarData(e.data)}</span>}
              <button
                type="button"
                className="text-[11.5px] text-tx-3 underline-offset-2 hover:text-white hover:underline"
                onClick={() => alterar.mutate({ id: e.id, dados: { verificado: !e.verificado } })}
                title="Clique para trocar"
              >
                {e.verificado ? "conferida" : "não conferida"}
              </button>
              <span className="ml-auto flex items-center gap-1">
                <a href={e.url} target="_blank" rel="noreferrer noopener" className="botao-icone size-7" aria-label="Abrir evidência" title="Abrir em outra aba">
                  <ExternalLink size={14} />
                </a>
                <BotaoIcone icone={Trash2} rotulo="Remover" className="size-7" onClick={() => excluir.mutate(e.id)} />
              </span>
            </div>
            {e.descricao && <p className="text-[13px]">{e.descricao}</p>}
            <p className="truncate text-[11.5px] text-tx-3" title={e.url}>
              {e.url}
            </p>
            {e.como_verificou && <p className="text-[11.5px] text-tx-3">Como foi conferida: {e.como_verificou}</p>}
          </div>
        ))
      )}
      <div className="veu grid gap-2.5 p-3">
        <p className="text-[12.5px] font-medium">Adicionar evidência</p>
        <Campo placeholder="Link da postagem, vídeo ou perfil" value={n.url} onChange={(e) => setN({ ...n, url: e.target.value })} />
        <AreaTexto linhas={2} placeholder="O que esse link mostra" value={n.descricao} onChange={(e) => setN({ ...n, descricao: e.target.value })} />
        <div className="grid gap-2.5 sm:grid-cols-[170px_170px_auto]">
          <Campo type="date" value={n.data} onChange={(e) => setN({ ...n, data: e.target.value })} aria-label="Data da postagem" title="Data da postagem" />
          <Selecao opcoes={EVIDENCIA_CLASSES} value={n.classificacao} onChange={(e) => setN({ ...n, classificacao: e.target.value })} aria-label="Classificação" />
          <Botao variante="principal" icone={Plus} carregando={criar.isPending} onClick={() => void adicionar()} className="sm:justify-self-end">
            Adicionar
          </Botao>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pessoas ---------------- */

function Pessoas({ lead }: { lead: LeadCompleto }) {
  const { criar, excluir } = useFilhaDoLead(lead.id, "contatos");
  const [n, setN] = useState({ nome: "", papel: "", discord: "", instagram: "", notas: "" });
  const adicionar = async () => {
    if (!n.nome.trim() && !n.discord.trim() && !n.instagram.trim()) return aviso.erro("Preencha pelo menos o nome ou um contato.");
    try {
      await criar.mutateAsync(n);
      setN({ nome: "", papel: "", discord: "", instagram: "", notas: "" });
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  return (
    <div className="grid gap-3">
      {lead.contatos.length === 0 ? (
        <Vazio icone={UserPlus} titulo="Nenhuma pessoa cadastrada" texto="Guarde aqui o líder, o recrutador e quem mais for o caminho até a organização." />
      ) : (
        lead.contatos.map((c) => (
          <div key={c.id} className="veu flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">
                {c.nome || "Sem nome"} {c.papel && <span className="font-normal text-tx-2">· {c.papel}</span>}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-tx-2">
                {c.discord && <span>Discord: {c.discord}</span>}
                {c.instagram && <span>Instagram: {c.instagram}</span>}
                {c.outro && <span>{c.outro}</span>}
              </p>
              {c.notas && <p className="mt-1 text-[12.5px] text-tx-3">{c.notas}</p>}
            </div>
            <BotaoIcone icone={Trash2} rotulo="Remover pessoa" className="size-7" onClick={() => excluir.mutate(c.id)} />
          </div>
        ))
      )}
      <div className="veu grid gap-2.5 p-3">
        <p className="text-[12.5px] font-medium">Adicionar pessoa</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Campo placeholder="Nome ou apelido" value={n.nome} onChange={(e) => setN({ ...n, nome: e.target.value })} />
          <Campo placeholder="Papel (ex.: Líder 01, Recrutador)" value={n.papel} onChange={(e) => setN({ ...n, papel: e.target.value })} />
          <Campo placeholder="Discord (usuário)" value={n.discord} onChange={(e) => setN({ ...n, discord: e.target.value })} />
          <Campo placeholder="Instagram (@)" value={n.instagram} onChange={(e) => setN({ ...n, instagram: e.target.value })} />
        </div>
        <Campo placeholder="Anotações" value={n.notas} onChange={(e) => setN({ ...n, notas: e.target.value })} />
        <div className="flex justify-end">
          <Botao variante="principal" icone={Plus} carregando={criar.isPending} onClick={() => void adicionar()}>
            Adicionar
          </Botao>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Histórico ---------------- */

function Historico({ lead }: { lead: LeadCompleto }) {
  const { criar, excluir } = useFilhaDoLead(lead.id, "interacoes");
  const [n, setN] = useState({ tipo: "nota", canal: "", resumo: "", dia: hoje() });
  const tiposManuais = INTERACAO_TIPOS.filter((t) => !["etapa", "sistema"].includes(t.id));
  const registrar = async () => {
    if (!n.resumo.trim()) return aviso.erro("Escreva o que aconteceu.");
    try {
      const agoraIso = new Date().toISOString();
      await criar.mutateAsync({ tipo: n.tipo, canal: n.canal, resumo: n.resumo, data: n.dia === hoje() ? agoraIso : `${n.dia}T12:00:00.000Z` });
      setN({ ...n, resumo: "" });
      aviso.ok("Registrado");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  return (
    <div className="grid gap-3">
      <div className="veu grid gap-2.5 p-3">
        <p className="text-[12.5px] font-medium">Registrar no histórico</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Selecao opcoes={tiposManuais} value={n.tipo} onChange={(e) => setN({ ...n, tipo: e.target.value })} aria-label="Tipo" />
          <Selecao opcoes={CANAIS} vazio="Canal (opcional)" value={n.canal} onChange={(e) => setN({ ...n, canal: e.target.value })} aria-label="Canal" />
          <Campo type="date" value={n.dia} onChange={(e) => setN({ ...n, dia: e.target.value || hoje() })} aria-label="Dia" />
        </div>
        <AreaTexto linhas={2} placeholder="O que aconteceu (ex.: respondeu que topa uma call na quinta)" value={n.resumo} onChange={(e) => setN({ ...n, resumo: e.target.value })} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-tx-3">Mensagem, resposta ou reunião atualizam o "último contato".</span>
          <Botao variante="principal" icone={MessageSquarePlus} carregando={criar.isPending} onClick={() => void registrar()}>
            Registrar
          </Botao>
        </div>
      </div>
      {lead.interacoes.length === 0 ? (
        <Vazio titulo="Histórico vazio" texto="Tudo o que acontecer com esta oportunidade aparece aqui, do mais novo para o mais antigo." />
      ) : (
        <ol className="grid gap-1.5">
          {lead.interacoes.map((i) => (
            <li key={i.id} className="veu flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-tx-3">
                  <span className="font-medium text-tx-2">{nomeDe(INTERACAO_TIPOS, i.tipo)}</span>
                  {i.canal && <span>· {nomeDe(CANAIS, i.canal)}</span>}
                  <span>· {formatarMomento(i.data)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{i.resumo}</p>
              </div>
              {!["etapa", "sistema"].includes(i.tipo) && <BotaoIcone icone={Trash2} rotulo="Apagar registro" className="size-7" onClick={() => excluir.mutate(i.id)} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------------- Mensagens prontas ---------------- */

function preencher(texto: string, lead: LeadCompleto, meuNome: string) {
  const lider = lead.lider || lead.contatos[0]?.nome || "";
  return texto
    .replaceAll("{nome_org}", lead.nome)
    .replaceAll("{lider}", lider || "[nome do líder]")
    .replaceAll("{cidade_atual}", lead.cidade_atual || "[cidade atual]")
    .replaceAll("{meu_nome}", meuNome);
}

function Mensagens({ lead }: { lead: LeadCompleto }) {
  const { data: modelos, isLoading } = useModelos("primeiro_contato,acompanhamento,resposta");
  const { data: config } = useConfig();
  const { criar } = useFilhaDoLead(lead.id, "interacoes");
  const meuNome = typeof config?.["meu_nome"] === "string" && config["meu_nome"] ? config["meu_nome"] : "Henrique";
  const [copiado, setCopiado] = useState<string | null>(null);
  const registrar = async (titulo: string) => {
    try {
      await criar.mutateAsync({ tipo: "mensagem", canal: ["discord", "instagram", "tiktok"].includes(lead.plataforma) ? lead.plataforma : "", resumo: `Mensagem enviada: ${titulo}`, data: new Date().toISOString() });
      setCopiado(null);
      aviso.ok("Registrado no histórico");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  if (isLoading) return <Carregando />;
  if (!modelos || modelos.length === 0) return <Vazio icone={Send} titulo="Nenhum modelo de mensagem" texto="Crie modelos em Conteúdo › Quadros e modelos (tipos Primeiro contato e Acompanhamento)." />;
  return (
    <div className="grid gap-3">
      <p className="text-[12.5px] text-tx-2">
        O painel <b>não envia nada</b>: ele só deixa o texto pronto. Copie, revise e envie você mesmo, uma pessoa por vez.
      </p>
      {modelos.map((m) => {
        const texto = preencher(m.texto, lead, meuNome);
        return (
          <div key={m.id} className="veu grid gap-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium">
                {m.titulo} <span className="font-normal text-tx-3">· {m.tipo === "primeiro_contato" ? "Primeiro contato" : m.tipo === "acompanhamento" ? "Acompanhamento" : "Resposta"}</span>
              </p>
              <BotaoCopiar texto={texto} aoCopiar={() => setCopiado(m.id)} />
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-[13px] leading-relaxed">{texto}</p>
            {m.observacao && <p className="text-[11.5px] text-tx-3">{m.observacao}</p>}
            {copiado === m.id && (
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="text-tx-2">Enviou esta mensagem?</span>
                <Botao pequeno variante="principal" carregando={criar.isPending} onClick={() => void registrar(m.titulo)}>
                  Registrar no histórico
                </Botao>
                <Botao pequeno variante="fantasma" onClick={() => setCopiado(null)}>
                  Agora não
                </Botao>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Juntar duplicados ---------------- */

function JuntarCom({ lead, aoFechar }: { lead: LeadCompleto; aoFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const termo = useAtrasado(busca);
  const { data: leads } = useLeads({ busca: termo, triagem: "todos", demo: "todos", ordenar: "nome" });
  const mesclar = useMesclarLead();
  const opcoes = useMemo(() => (leads ?? []).filter((l) => l.id !== lead.id).slice(0, 30), [leads, lead.id]);
  const juntar = async (outroId: string, nome: string) => {
    if (!(await confirmar({ titulo: `Juntar "${nome}" dentro de "${lead.nome}"?`, texto: "Links, evidências, pessoas e histórico vêm para esta oportunidade. A outra é apagada.", confirmar: "Juntar" }))) return;
    try {
      await mesclar.mutateAsync({ id: lead.id, outro_id: outroId });
      aviso.ok("Oportunidades juntadas");
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  return (
    <Janela titulo="Juntar com outra oportunidade" descricao="Use quando a mesma organização foi cadastrada duas vezes." aoFechar={aoFechar}>
      <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar pelo nome" />
      <div className="mt-3 grid max-h-[46vh] gap-1 overflow-y-auto">
        {opcoes.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-tx-3">Nada encontrado.</p>
        ) : (
          opcoes.map((l) => (
            <button key={l.id} type="button" className="linha-item" onClick={() => void juntar(l.id, l.nome)}>
              <span className="min-w-0 flex-1 truncate text-[13px]">{l.nome}</span>
              <EtiquetaConfianca valor={l.cidade_confianca} />
              <span className="text-[11.5px] text-tx-3">{nomeDe(ETAPAS, l.etapa)}</span>
            </button>
          ))
        )}
      </div>
    </Janela>
  );
}

export { Rotulo };
