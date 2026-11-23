// Radar: resumos diários, registro de pesquisas, novidades e o mercado (jogadores online por cidade).
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@/avancado/roteador";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, Inbox, Newspaper, Pencil, Plus, Radar as IconeRadar, RefreshCw, Search, Trash2, TrendingUp } from "lucide-react";
import type { Novidade, Pesquisa, ServidorMercado } from "@/avancado/shared/tipos";
import { mensagemDe } from "@/avancado/lib/api";
import { useAmostrasMercado, useColetarMercado, useConfig, useExcluirServidor, useLeads, useNovidades, usePesquisas, useRadar, useResumos, useSalvarConfig, useSalvarServidor, useServidoresMercado } from "@/avancado/lib/consultas";
import { formatarData, formatarMomento, hoje, numero, relativo } from "@/avancado/lib/datas";
import { AreaTexto, Botao, BotaoIcone, Campo, Carregando, Cartao, ErroDeCarga, Etiqueta, Pagina, Segmentos, Vazio, aviso, cn } from "@/avancado/ui/kit";
import { Markdown } from "@/avancado/ui/markdown";
import { Janela, confirmar } from "@/avancado/ui/sobrepostos";

type Aba = "resumos" | "pesquisas" | "novidades" | "mercado";
const CORES = ["#ce0e0e", "#f4f4f5", "#5B9DF0", "#E8B339", "#46C37B", "#B58BF5", "#3CC8C8", "#F08A3C"];

/* ================= RESUMOS ================= */

function Resumos() {
  const { data: resumos, isLoading, error } = useResumos();
  const { data: pendentes } = useLeads({ triagem: "pendente" });
  const { excluir } = useRadar("resumos");
  const [aberto, setAberto] = useState<string | null>(null);
  const ir = useNavigate();
  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  const atual = resumos?.find((r) => r.id === aberto) ?? resumos?.[0];
  return (
    <>
      {(pendentes?.length ?? 0) > 0 && (
        <button type="button" className="vidro flex w-full items-center gap-3 p-3.5 text-left" onClick={() => ir("/captacao/triagem")}>
          <span className="indice-icone">
            <Inbox size={15} />
          </span>
          <span className="min-w-0 flex-1 text-[13px]">
            <b>{pendentes?.length}</b> {pendentes?.length === 1 ? "achado espera" : "achados esperam"} você na Triagem
          </span>
          <Etiqueta cor="#ce0e0e">Abrir triagem</Etiqueta>
        </button>
      )}
      {!resumos || resumos.length === 0 ? (
        <Cartao>
          <Vazio icone={IconeRadar} titulo="Nenhum resumo ainda" texto="O resumo diário é escrito pela pesquisa automática (veja em Automações). Cada um traz as oportunidades novas com o link para conferir." />
        </Cartao>
      ) : (
        <div className="grid items-start gap-3.5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Cartao semPadding className="max-h-[70vh] overflow-y-auto p-1.5">
            {resumos.map((r) => (
              <button key={r.id} type="button" className={cn("linha-item", atual?.id === r.id && "bg-white/[0.07]")} onClick={() => setAberto(r.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.titulo}</span>
                  <span className="block text-[11.5px] text-tx-3">
                    {formatarData(r.data)} · {r.novos_leads} {r.novos_leads === 1 ? "nova" : "novas"}
                  </span>
                </span>
              </button>
            ))}
          </Cartao>
          {atual && (
            <Cartao
              titulo={atual.titulo}
              nota={`${formatarData(atual.data)} · ${atual.novos_leads} ${atual.novos_leads === 1 ? "oportunidade nova" : "oportunidades novas"} · escrito ${relativo(atual.criado_em)}`}
              acao={<BotaoIcone icone={Trash2} rotulo="Apagar resumo" onClick={async () => (await confirmar({ titulo: "Apagar este resumo?", confirmar: "Apagar", perigo: true })) && excluir.mutate(atual.id)} />}
            >
              <Markdown texto={atual.markdown} />
              {atual.links.length > 0 && (
                <div className="mt-4 grid gap-1.5">
                  <p className="sobretitulo">Links para conferir</p>
                  {atual.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="linha-item">
                      <ExternalLink size={14} className="shrink-0 text-tx-3" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{l.rotulo || l.url}</span>
                    </a>
                  ))}
                </div>
              )}
            </Cartao>
          )}
        </div>
      )}
    </>
  );
}

/* ================= PESQUISAS ================= */

function Pesquisas() {
  const { data: pesquisas, isLoading, error } = usePesquisas();
  const { salvar, excluir } = useRadar("pesquisas");
  const [edit, setEdit] = useState<Partial<Pesquisa> | null>(null);
  const gravar = async () => {
    if (!edit?.titulo?.trim()) return aviso.erro("Dê um título para a pesquisa.");
    try {
      const { id, ...dados } = edit;
      await salvar.mutateAsync(id ? { id, dados } : { dados });
      setEdit(null);
      aviso.ok("Pesquisa registrada");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-tx-2">O que foi pesquisado, onde, e o que saiu de cada busca. Serve para não repetir trabalho.</p>
        <Botao variante="principal" icone={Plus} onClick={() => setEdit({ data: hoje(), titulo: "", fonte: "", consulta: "", resumo: "", achados: 0, links: [] })}>
          Registrar pesquisa
        </Botao>
      </div>
      {!pesquisas || pesquisas.length === 0 ? (
        <Cartao>
          <Vazio icone={Search} titulo="Nenhuma pesquisa registrada" />
        </Cartao>
      ) : (
        <div className="grid gap-2.5">
          {pesquisas.map((p) => (
            <article key={p.id} className="vidro grid gap-2 p-4">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="cartao-titulo">{p.titulo}</h3>
                  <p className="mt-0.5 text-[12px] text-tx-3">
                    {formatarData(p.data)}
                    {p.fonte ? ` · ${p.fonte}` : ""} · {p.achados} {p.achados === 1 ? "achado" : "achados"}
                  </p>
                </div>
                <span className="flex shrink-0">
                  <BotaoIcone icone={Pencil} rotulo="Editar" className="size-8" onClick={() => setEdit(p)} />
                  <BotaoIcone icone={Trash2} rotulo="Apagar" className="size-8" onClick={async () => (await confirmar({ titulo: "Apagar este registro?", confirmar: "Apagar", perigo: true })) && excluir.mutate(p.id)} />
                </span>
              </header>
              {p.consulta && (
                <p className="veu px-3 py-2 text-[12.5px]">
                  <span className="text-tx-3">Buscou por:</span> {p.consulta}
                </p>
              )}
              {p.resumo && <Markdown texto={p.resumo} className="!text-[13px]" />}
              {p.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener">
                      <Etiqueta fraca>{l.rotulo || l.url}</Etiqueta>
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {edit && (
        <Janela larga titulo={edit.id ? "Editar pesquisa" : "Registrar pesquisa"} aoFechar={() => setEdit(null)} rodape={<><Botao variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Botao><Botao variante="principal" carregando={salvar.isPending} onClick={() => void gravar()}>Salvar</Botao></>}>
          <div className="grid gap-3">
            <Campo rotulo="Título" value={edit.titulo ?? ""} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} autoFocus />
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Data" type="date" value={edit.data ?? ""} onChange={(e) => setEdit({ ...edit, data: e.target.value })} />
              <Campo rotulo="Onde" value={edit.fonte ?? ""} onChange={(e) => setEdit({ ...edit, fonte: e.target.value })} placeholder="Instagram, TikTok, Discord…" />
              <Campo rotulo="Quantos achados" inputMode="numeric" value={edit.achados ?? 0} onChange={(e) => setEdit({ ...edit, achados: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            </div>
            <Campo rotulo="O que foi buscado" value={edit.consulta ?? ""} onChange={(e) => setEdit({ ...edit, consulta: e.target.value })} />
            <AreaTexto rotulo="O que saiu" linhas={4} value={edit.resumo ?? ""} onChange={(e) => setEdit({ ...edit, resumo: e.target.value })} />
          </div>
        </Janela>
      )}
    </>
  );
}

/* ================= NOVIDADES ================= */

function Novidades() {
  const { data: novidades, isLoading, error } = useNovidades();
  const { salvar, excluir } = useRadar("novidades");
  const [edit, setEdit] = useState<Partial<Novidade> | null>(null);
  const gravar = async () => {
    if (!edit?.titulo?.trim()) return aviso.erro("Dê um título.");
    try {
      const { id, ...dados } = edit;
      await salvar.mutateAsync(id ? { id, dados } : { dados });
      setEdit(null);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-tx-2">O que está acontecendo nas outras cidades e no mercado de FiveM no Brasil.</p>
        <Botao variante="principal" icone={Plus} onClick={() => setEdit({ data: hoje(), titulo: "", resumo: "", url: "", fonte: "", verificado: false, tags: [] })}>
          Nova novidade
        </Botao>
      </div>
      {!novidades || novidades.length === 0 ? (
        <Cartao>
          <Vazio icone={Newspaper} titulo="Nenhuma novidade registrada" />
        </Cartao>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {novidades.map((n) => (
            <article key={n.id} className="vidro grid gap-2 p-4">
              <header className="flex items-start justify-between gap-3">
                <h3 className="cartao-titulo min-w-0">{n.titulo}</h3>
                <span className="flex shrink-0">
                  <BotaoIcone icone={Pencil} rotulo="Editar" className="size-7" onClick={() => setEdit(n)} />
                  <BotaoIcone icone={Trash2} rotulo="Apagar" className="size-7" onClick={async () => (await confirmar({ titulo: "Apagar esta novidade?", confirmar: "Apagar", perigo: true })) && excluir.mutate(n.id)} />
                </span>
              </header>
              <p className="text-[13px] text-tx-2">{n.resumo}</p>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-tx-3">
                <span>{formatarData(n.data)}</span>
                {n.fonte && <span>· {n.fonte}</span>}
                <Etiqueta cor={n.verificado ? "#46C37B" : "#E8B339"}>{n.verificado ? "Conferida na fonte" : "A conferir"}</Etiqueta>
                {n.url && (
                  <a href={n.url} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-tx-2 hover:text-white">
                    Abrir fonte <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <Janela titulo={edit.id ? "Editar novidade" : "Nova novidade"} aoFechar={() => setEdit(null)} rodape={<><Botao variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Botao><Botao variante="principal" carregando={salvar.isPending} onClick={() => void gravar()}>Salvar</Botao></>}>
          <div className="grid gap-3">
            <Campo rotulo="Título" value={edit.titulo ?? ""} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} autoFocus />
            <AreaTexto rotulo="Resumo" linhas={3} value={edit.resumo ?? ""} onChange={(e) => setEdit({ ...edit, resumo: e.target.value })} />
            <Campo rotulo="Link da fonte" value={edit.url ?? ""} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Data" type="date" value={edit.data ?? ""} onChange={(e) => setEdit({ ...edit, data: e.target.value })} />
              <Campo rotulo="Onde saiu" value={edit.fonte ?? ""} onChange={(e) => setEdit({ ...edit, fonte: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="size-4 accent-white" checked={edit.verificado ?? false} onChange={(e) => setEdit({ ...edit, verificado: e.target.checked })} /> Conferi na fonte
            </label>
          </div>
        </Janela>
      )}
    </>
  );
}

/* ================= MERCADO ================= */

function Mercado() {
  const [dias, setDias] = useState(7);
  const { data: servidores, isLoading, error } = useServidoresMercado();
  const { data: amostras } = useAmostrasMercado(dias);
  const { data: config } = useConfig();
  const salvarConfig = useSalvarConfig();
  const coletar = useColetarMercado();
  const salvar = useSalvarServidor();
  const excluir = useExcluirServidor();
  const [edit, setEdit] = useState<Partial<ServidorMercado> | null>(null);
  const ligado = config?.["mercado_cfx_ativo"] === true;

  const serie = useMemo(() => {
    // junta as amostras por hora: { hora, [nome da cidade]: online }
    const nomes = new Map((servidores ?? []).map((s) => [s.id, s.nome]));
    const porHora = new Map<string, Record<string, number | string>>();
    for (const a of amostras ?? []) {
      if (a.online === null) continue;
      const hora = a.coletado_em.slice(0, 13);
      const linha = porHora.get(hora) ?? { hora, rotulo: formatarMomento(a.coletado_em) };
      const nome = nomes.get(a.servidor_id);
      if (nome) linha[nome] = a.online;
      porHora.set(hora, linha);
    }
    return [...porHora.values()].sort((x, y) => (String(x["hora"]) < String(y["hora"]) ? -1 : 1));
  }, [amostras, servidores]);

  const coletarAgora = async () => {
    try {
      const r = await coletar.mutateAsync();
      if (r.total === 0) aviso.info("Nenhuma cidade com código cadastrado.");
      else if (r.falhas.length === 0) aviso.ok(`${r.coletados} ${r.coletados === 1 ? "cidade coletada" : "cidades coletadas"}`);
      else aviso.erro(`Coletei ${r.coletados} de ${r.total}. Falhou: ${r.falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };
  const gravar = async () => {
    if (!edit?.nome?.trim()) return aviso.erro("Dê o nome da cidade.");
    try {
      const { id, ultimo_online: _a, ultimo_slots: _b, ultima_coleta: _c, criado_em: _d, atualizado_em: _e, ...dados } = edit;
      void _a, void _b, void _c, void _d, void _e;
      await salvar.mutateAsync(id ? { id, dados } : { dados });
      setEdit(null);
    } catch (e) {
      aviso.erro(mensagemDe(e));
    }
  };

  if (isLoading) return <Carregando linhas={4} />;
  if (error) return <ErroDeCarga erro={error} />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-[220px] flex-1 text-[12.5px] text-tx-2">Jogadores online da HOST e das outras cidades, lidos da lista pública do FiveM. É uma foto do momento da coleta, não a média do dia.</p>
        <label className="solto flex h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px]" title="Com isto ligado, o painel coleta sozinho de hora em hora enquanto estiver aberto">
          <input type="checkbox" className="size-4 accent-white" checked={ligado} onChange={(e) => salvarConfig.mutate({ chave: "mercado_cfx_ativo", valor: e.target.checked })} /> Coletar de hora em hora
        </label>
        <Botao icone={RefreshCw} carregando={coletar.isPending} onClick={() => void coletarAgora()}>
          Coletar agora
        </Botao>
        <Botao variante="principal" icone={Plus} onClick={() => setEdit({ nome: "", cfx_codigo: "", concorrente_direto: true, ativo: true })}>
          Cidade
        </Botao>
      </div>

      <Cartao semPadding>
        {!servidores || servidores.length === 0 ? (
          <Vazio icone={TrendingUp} titulo="Nenhuma cidade cadastrada" texto="Cadastre a HOST e os concorrentes com o código do cfx.re/join/…" />
        ) : (
          <div className="overflow-x-auto px-1 py-1">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Cidade</th>
                  <th>Online agora</th>
                  <th>Vagas</th>
                  <th>Última coleta</th>
                  <th>Links</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {servidores.map((s) => (
                  <tr key={s.id} className={cn(!s.ativo && "opacity-50")}>
                    <td>
                      <span className="font-medium">{s.nome}</span> {s.proprio && <Etiqueta cor="#ce0e0e">HOST</Etiqueta>} {s.concorrente_direto && <Etiqueta fraca>concorrente direto</Etiqueta>}
                      {s.observacoes && <span className="block max-w-[340px] truncate text-[11.5px] text-tx-3">{s.observacoes}</span>}
                    </td>
                    <td className="font-display text-[17px] font-semibold tabular-nums">{s.ultimo_online === null ? <span className="text-[13px] font-normal text-tx-3">sem coleta</span> : numero(s.ultimo_online)}</td>
                    <td className="text-tx-2 tabular-nums">{numero(s.ultimo_slots) || "—"}</td>
                    <td className="text-[12.5px] text-tx-2">{s.ultima_coleta ? relativo(s.ultima_coleta) : "—"}</td>
                    <td>
                      <span className="flex flex-wrap gap-1.5 text-[12px]">
                        {s.cfx_codigo ? (
                          <a className="underline-offset-2 hover:underline" href={`https://servers.fivem.net/servers/detail/${s.cfx_codigo}`} target="_blank" rel="noreferrer noopener">
                            lista FiveM
                          </a>
                        ) : (
                          <span className="text-[#f0c869]">sem código</span>
                        )}
                        {s.site && <a className="underline-offset-2 hover:underline" href={s.site} target="_blank" rel="noreferrer noopener">site</a>}
                        {s.discord && <a className="underline-offset-2 hover:underline" href={s.discord} target="_blank" rel="noreferrer noopener">Discord</a>}
                        {s.instagram && <a className="underline-offset-2 hover:underline" href={s.instagram} target="_blank" rel="noreferrer noopener">Instagram</a>}
                      </span>
                    </td>
                    <td>
                      <span className="flex justify-end">
                        <BotaoIcone icone={Pencil} rotulo="Editar cidade" className="size-7" onClick={() => setEdit(s)} />
                        <BotaoIcone icone={Trash2} rotulo="Excluir cidade" className="size-7" onClick={async () => (await confirmar({ titulo: `Excluir "${s.nome}"?`, confirmar: "Excluir", perigo: true })) && excluir.mutate(s.id)} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Cartao
        titulo="Jogadores online ao longo do tempo"
        nota={serie.length < 2 ? "O gráfico aparece depois de pelo menos duas coletas" : `${serie.length} coletas`}
        acao={<Segmentos rotulo="Período" valor={String(dias)} aoMudar={(v) => setDias(Number(v))} abas={[{ id: "2", nome: "2 dias" }, { id: "7", nome: "7 dias" }, { id: "30", nome: "30 dias" }]} />}
      >
        {serie.length < 2 ? (
          <Vazio icone={TrendingUp} titulo="Ainda sem histórico" texto="Ligue “Coletar de hora em hora” e deixe o painel aberto, ou clique em “Coletar agora” de vez em quando." />
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10.5, fill: "#7c7c84" }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: "#7c7c84" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "rgba(22,21,22,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#f4f4f5" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(servidores ?? []).map((s, i) => (
                  <Line key={s.id} type="monotone" dataKey={s.nome} stroke={s.proprio ? "#ce0e0e" : CORES[(i % (CORES.length - 1)) + 1]} strokeWidth={s.proprio ? 2.5 : 1.75} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>

      {edit && (
        <Janela titulo={edit.id ? "Editar cidade" : "Nova cidade"} aoFechar={() => setEdit(null)} rodape={<><Botao variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Botao><Botao variante="principal" carregando={salvar.isPending} onClick={() => void gravar()}>Salvar</Botao></>}>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome da cidade" value={edit.nome ?? ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} autoFocus />
              <Campo rotulo="Código do FiveM" dica="O final do endereço cfx.re/join/xxxxxx" value={edit.cfx_codigo ?? ""} onChange={(e) => setEdit({ ...edit, cfx_codigo: e.target.value.trim().replace(/^.*\//, "") })} placeholder="ex.: qqadkyz" />
            </div>
            <Campo rotulo="Site" value={edit.site ?? ""} onChange={(e) => setEdit({ ...edit, site: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Discord" value={edit.discord ?? ""} onChange={(e) => setEdit({ ...edit, discord: e.target.value })} />
              <Campo rotulo="Instagram" value={edit.instagram ?? ""} onChange={(e) => setEdit({ ...edit, instagram: e.target.value })} />
            </div>
            <AreaTexto rotulo="Observações" linhas={2} value={edit.observacoes ?? ""} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} />
            <div className="flex flex-wrap gap-4 text-[13px]">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-white" checked={edit.concorrente_direto ?? false} onChange={(e) => setEdit({ ...edit, concorrente_direto: e.target.checked })} /> Concorrente direto
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-white" checked={edit.proprio ?? false} onChange={(e) => setEdit({ ...edit, proprio: e.target.checked })} /> É a HOST
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-white" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /> Acompanhar
              </label>
            </div>
          </div>
        </Janela>
      )}
    </>
  );
}

/* ================= PÁGINA ================= */

export default function RadarPagina() {
  const { aba: abaUrl } = useParams();
  const aba: Aba = abaUrl === "pesquisas" || abaUrl === "novidades" || abaUrl === "mercado" ? abaUrl : "resumos";
  const ir = useNavigate();
  return (
    <Pagina sobretitulo="Inteligência" titulo="Radar" descricao="O que a pesquisa encontrou: resumo do dia, buscas feitas, novidades do mercado e o tamanho das cidades.">
      <Segmentos
        rotulo="Áreas do radar"
        valor={aba}
        aoMudar={(v) => ir(v === "resumos" ? "/radar" : `/radar/${v}`)}
        abas={[
          { id: "resumos", nome: "Resumos diários" },
          { id: "pesquisas", nome: "Pesquisas" },
          { id: "novidades", nome: "Novidades" },
          { id: "mercado", nome: "Mercado" },
        ]}
      />
      {aba === "resumos" && <Resumos />}
      {aba === "pesquisas" && <Pesquisas />}
      {aba === "novidades" && <Novidades />}
      {aba === "mercado" && <Mercado />}
    </Pagina>
  );
}
