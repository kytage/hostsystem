import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { corDoSelo } from "@/lib/fazenda/catalogo";
import { fazendaAmigos, fazendaCorreio, fazendaResponderAmizade } from "@/lib/fazenda.functions";
import { Hoki2D } from "../hoki-2d";
import { motivoSemVisita, ondeEsta, useIlhasDe, type PresenteNaIlha } from "./ilhas-de";

type ListaDeAmigos = Awaited<ReturnType<typeof fazendaAmigos>>;
interface Props {
  onMinhaIlha: () => void;
  onVisitar: (id: string) => void;
  /** Abre a minha ilha já com o Correio (presentes) ou os Vizinhos (amigos e convites). */
  onAbrirNaIlha: (painel: "correio" | "vizinhos") => void;
  /** Quem está online agora (sem contar eu). */
  naIlha: PresenteNaIlha[];
  onClose: () => void;
}

const restante = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
function SeloPequeno({ nivel, cor }: { nivel: number; cor: string }) {
  const c = corDoSelo(cor, nivel);
  return (
    <span
      className="inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10.5px] font-extrabold tabular-nums"
      style={{ background: c.fundo, color: c.texto }}
    >
      {nivel}
    </span>
  );
}
function Opcao({
  icone,
  titulo,
  texto,
  onClick,
  forte,
  aviso = 0,
}: {
  icone: string;
  titulo: string;
  texto: ReactNode;
  onClick: () => void;
  forte?: boolean;
  aviso?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-xl p-3 text-left transition active:scale-[0.99]",
        forte
          ? "bg-white text-black hover:bg-white/90"
          : "border border-white/10 bg-white/[0.04] hover:bg-white/[0.09]",
      )}
    >
      <span className="text-2xl">{icone}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13.5px] font-bold">{titulo}</span>
        <span className={cn("text-[11.5px]", forte ? "text-black/60" : "text-white/55")}>
          {texto}
        </span>
      </span>
      {aviso > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-[#e5231b] px-1.5 text-[10.5px] font-bold text-white">
          {aviso}
        </span>
      )}
    </button>
  );
}

/**
 * Quem está na ilha agora, com o nível e o botão de visitar a fazenda (sem precisar
 * de aceite: o dono só recebe o aviso de que a pessoa entrou).
 */
export function NaIlhaAgora({
  presentes,
  onVisitar,
  vazio = "Ninguém mais está na ilha agora.",
}: {
  presentes: PresenteNaIlha[];
  onVisitar: (id: string) => void;
  vazio?: string;
}) {
  const fazendas = useIlhasDe(presentes.map((p) => p.id));
  // quem tem fazenda aberta primeiro, depois por nível
  const lista = [...presentes].sort((a, b) => {
    const fa = fazendas[a.id];
    const fb = fazendas[b.id];
    const pa = fa?.podeEntrar ? 1 : 0;
    const pb = fb?.podeEntrar ? 1 : 0;
    return pb - pa || (fb?.nivel ?? 0) - (fa?.nivel ?? 0) || a.nome.localeCompare(b.nome);
  });
  if (!lista.length) return <p className="text-[12px] leading-snug text-white/55">{vazio}</p>;
  return (
    <div className="space-y-1.5">
      {lista.map((p) => {
        const f = fazendas[p.id];
        const motivo = motivoSemVisita(f);
        return (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2 text-[12px]"
          >
            <span className="block size-8 shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/50">
              <Hoki2D visual={p.visual} busto />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-1.5">
                {f?.nivel != null && <SeloPequeno nivel={f.nivel} cor={f.cor} />}
                {p.tag && (
                  <span className="rounded bg-[#ce0e0e] px-1 text-[8.5px] font-bold leading-[13px]">
                    {p.tag}
                  </span>
                )}
                <span className="truncate font-semibold">{p.nome}</span>
              </span>
              <span className="block text-[10.5px] text-white/45">{ondeEsta(p)}</span>
            </span>
            {motivo ? (
              <span className="shrink-0 text-[10.5px] text-white/40">{motivo}</span>
            ) : (
              <button
                onClick={() => onVisitar(p.id)}
                className="h-8 shrink-0 rounded-full bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.97]"
              >
                Visitar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** O portal da porta do celeiro: escolhe para onde ir no HOST FAZENDAS. */
export function PortalDasFazendas({
  onMinhaIlha,
  onVisitar,
  onAbrirNaIlha,
  naIlha,
  onClose,
}: Props) {
  const listar = useServerFn(fazendaAmigos);
  const lerCorreio = useServerFn(fazendaCorreio);
  const responder = useServerFn(fazendaResponderAmizade);
  const [aba, setAba] = useState<"inicio" | "agora" | "amigos" | "convites">("inicio");
  const [dados, setDados] = useState<ListaDeAmigos | null>(null);
  const [presentes, setPresentes] = useState<number | null>(null);
  const carregar = useCallback(async () => {
    try {
      setDados(await listar());
    } catch {
      setDados({
        amigos: [],
        recebidos: [],
        enviados: [],
        convitesRecebidos: [],
        convitesEnviados: [],
      });
    }
  }, [listar]);
  useEffect(() => {
    void carregar();
    void lerCorreio()
      .then((c) => setPresentes(c.presentes.length))
      .catch(() => setPresentes(0));
  }, [carregar, lerCorreio]);
  const convidadoPor = new Set((dados?.convitesRecebidos ?? []).map((c) => c.id));
  const avisosConvites =
    (dados?.convitesRecebidos.length ?? 0) + (dados?.recebidos.length ?? 0) + (presentes ?? 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Portal do HOST FAZENDAS"
      className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className="pf-pop w-full max-w-[420px] rounded-2xl border border-white/10 bg-black/85 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Portal
        </p>
        <h3 className="font-display text-2xl font-semibold leading-tight">HOST FAZENDAS</h3>
        {aba === "inicio" && (
          <>
            <p className="mt-1 text-[12px] text-white/60">
              Sua ilha de fazenda: plante, colha, crie bichos, suba de nível e ajude os amigos.
            </p>
            <div className="mt-4 space-y-2">
              <Opcao
                forte
                icone="🏡"
                titulo="Minha Ilha"
                texto="Entrar na sua fazenda (criada no primeiro acesso)"
                onClick={onMinhaIlha}
              />
              <Opcao
                icone="🧭"
                titulo="Na ilha agora"
                texto={
                  naIlha.length
                    ? `${naIlha.length} membro${naIlha.length === 1 ? "" : "s"} online · entre na fazenda sem pedir`
                    : "Ninguém mais online agora"
                }
                onClick={() => setAba("agora")}
              />
              <Opcao
                icone="🤝"
                titulo="Ilhas de Amigos"
                texto={
                  dados
                    ? `${dados.amigos.length} vizinho${dados.amigos.length === 1 ? "" : "s"} · visite e adube`
                    : "Carregando…"
                }
                onClick={() => setAba("amigos")}
              />
              <Opcao
                icone="🎁"
                titulo="Convites e Presentes"
                texto="Convites para visitar, pedidos de amizade e presentes"
                aviso={avisosConvites}
                onClick={() => setAba("convites")}
              />
              <Opcao
                icone="↩️"
                titulo="Voltar ao Mundo HOST"
                texto="Continuar na praça"
                onClick={onClose}
              />
            </div>
          </>
        )}
        {aba !== "inicio" && (
          <button
            onClick={() => setAba("inicio")}
            className="mt-1 flex items-center gap-1 text-[12px] text-white/55 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> voltar
          </button>
        )}
        {aba === "agora" && (
          <div className="mt-3 max-h-[46vh] overflow-y-auto pr-0.5">
            <p className="mb-2 text-[11.5px] leading-snug text-white/55">
              Entre na fazenda de quem está online sem precisar de aceite: o dono só recebe um aviso
              de que você entrou.
            </p>
            <NaIlhaAgora presentes={naIlha} onVisitar={onVisitar} />
          </div>
        )}
        {aba === "amigos" && (
          <div className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto">
            {!dados ? (
              <p className="flex items-center gap-2 text-[12px]">
                <Loader2 className="size-4 animate-spin" /> Carregando…
              </p>
            ) : dados.amigos.length === 0 ? (
              <p className="text-[12px] leading-snug text-white/55">
                Você ainda não tem vizinhos. Entre na sua ilha e abra <b>Vizinhos</b> para adicionar
                quem está online.
              </p>
            ) : (
              dados.amigos.map((a) => {
                const pode =
                  a.temIlha &&
                  a.privacidade !== "privada" &&
                  (a.privacidade !== "convite" || convidadoPor.has(a.id));
                return (
                  <div
                    key={a.relacao}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[12px]"
                  >
                    {a.nivel !== null && <SeloPequeno nivel={a.nivel} cor={a.cor} />}
                    <span className="min-w-0 flex-1 truncate font-semibold">{a.nome}</span>
                    <span className="text-[10.5px] text-white/45">
                      {!a.temIlha
                        ? "sem ilha"
                        : a.privacidade === "privada"
                          ? "privada"
                          : a.privacidade === "convite"
                            ? convidadoPor.has(a.id)
                              ? "te convidou"
                              : "só por convite"
                            : "aberta"}
                    </span>
                    <button
                      disabled={!pode}
                      onClick={() => onVisitar(a.id)}
                      className="h-8 rounded-full bg-white px-3 text-[12px] font-semibold text-black disabled:opacity-30"
                    >
                      Visitar
                    </button>
                  </div>
                );
              })
            )}
            <button
              onClick={() => onAbrirNaIlha("vizinhos")}
              className="mt-1 w-full text-center text-[11.5px] text-emerald-300 hover:text-emerald-200"
            >
              Adicionar vizinhos
            </button>
          </div>
        )}
        {aba === "convites" && (
          <div className="mt-3 max-h-[46vh] space-y-3 overflow-y-auto">
            {!dados ? (
              <p className="flex items-center gap-2 text-[12px]">
                <Loader2 className="size-4 animate-spin" /> Carregando…
              </p>
            ) : (
              <>
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-widest text-white/45">
                    Convites para visitar
                  </p>
                  {dados.convitesRecebidos.length === 0 ? (
                    <p className="text-[12px] text-white/50">Nenhum convite agora.</p>
                  ) : (
                    dados.convitesRecebidos.map((c) => (
                      <div
                        key={c.convite}
                        className="mb-1 flex items-center gap-2 rounded-xl border border-[#ffd23f]/30 bg-[#ffd23f]/10 p-2 text-[12px]"
                      >
                        <span className="min-w-0 flex-1">
                          <b>{c.nome}</b> te convidou · vale {restante(c.expiraEm - Date.now())}
                        </span>
                        <button
                          onClick={() => onVisitar(c.id)}
                          className="h-8 rounded-full bg-white px-3 text-[12px] font-semibold text-black"
                        >
                          Visitar
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-widest text-white/45">
                    Pedidos de amizade
                  </p>
                  {dados.recebidos.length === 0 ? (
                    <p className="text-[12px] text-white/50">Nenhum pedido.</p>
                  ) : (
                    dados.recebidos.map((a) => (
                      <div
                        key={a.relacao}
                        className="mb-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[12px]"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold">{a.nome}</span>
                        <button
                          onClick={async () => {
                            const r = await responder({
                              data: { relacao: a.relacao, aceitar: true },
                            });
                            if (r.erro) toast.error(r.erro);
                            else toast.success(`Agora você e ${a.nome} são vizinhos!`);
                            void carregar();
                          }}
                          className="h-8 rounded-full bg-emerald-400 px-3 text-[12px] font-semibold text-black"
                        >
                          Aceitar
                        </button>
                        <button
                          onClick={async () => {
                            await responder({ data: { relacao: a.relacao, aceitar: false } });
                            void carregar();
                          }}
                          className="h-8 rounded-full border border-white/15 px-3 text-[12px]"
                        >
                          Recusar
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-widest text-white/45">
                    Presentes
                  </p>
                  <button
                    onClick={() => onAbrirNaIlha("correio")}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[12px] hover:bg-white/[0.09]"
                  >
                    <span>
                      {presentes === null
                        ? "Abrindo o correio…"
                        : presentes === 0
                          ? "Nenhum presente esperando"
                          : `${presentes} presente${presentes === 1 ? "" : "s"} esperando`}
                    </span>
                    <b className="text-emerald-300">abrir o Correio</b>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
