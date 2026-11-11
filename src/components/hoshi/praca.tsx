import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Hash, Layers, LogOut, Send, Swords, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LogoExtenso } from "@/components/dashboard/Logo";
import { PECAS, PELOS, type HoshiPet } from "@/lib/hoshi";
import { criarJogo, gravarJogo, jogosAtivos, type Cartas, type Jogo, type Pessoa, type Velha } from "@/lib/hoshi-jogos";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { CartasDialog, VelhaDialog } from "./jogos-online";

/** Quem está na praça (enviado pelo canal de presença). Posições em % do mapa. */
interface Presenca {
  id: string;
  nome: string;
  pet: string;
  /** Cor da roupa; vazio = sem roupa. */
  cor: string;
  /** Cor do pelo. */
  pelo: string;
  x: number;
  y: number;
  banco: number | null;
  /** Status curto (emoji + texto), mostrado em vermelho embaixo do nick. */
  status: string;
}

const EMOJIS_STATUS = ["📘", "💻", "☕", "🎮", "🎧", "🍔", "😴", "🔥", "🚗", "🎬", "📞", "🏋️"];
const STATUS_PRONTOS = ["📘 Lendo", "💻 Trabalhando", "☕ Pausa pro café", "🎮 Jogando", "🎧 Ouvindo música", "🍔 Almoçando", "📞 Em reunião", "😴 Ausente"];
const CHAVE_STATUS = "hoshi-praca-status";
const limparStatus = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 32);

/** 20 bancos: 6 em cima, 6 embaixo, 4 de cada lado. */
const BANCOS: { x: number; y: number; deitado: boolean }[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ x: 15 + i * 14, y: 15, deitado: false })),
  ...Array.from({ length: 6 }, (_, i) => ({ x: 15 + i * 14, y: 89, deitado: false })),
  ...Array.from({ length: 4 }, (_, i) => ({ x: 6, y: 33 + i * 13, deitado: true })),
  ...Array.from({ length: 4 }, (_, i) => ({ x: 94, y: 33 + i * 13, deitado: true })),
];
/* ---------------- cenário: pracinha 2D vista de cima ---------------- */
// Desenhada em SVG numa prancheta de 200×138 (as posições das pessoas e dos
// bancos continuam em % do mapa; PX(%) e PY(%) convertem para a prancheta).
const PX = (pct: number) => pct * 2;
const PY = (pct: number) => pct * 1.38;
const GRAMA = "#6aaa3f";
const TERRA = "#e2c48d";
const TERRA_BORDA = "#b9965f";
const FOLHA_BORDA = "#245a26";

const ARVORES: [x: number, y: number, tipo: "redonda" | "pinheiro" | "outono"][] = [
  [26, 37, "pinheiro"], [36, 46, "redonda"], [62, 39, "redonda"], [80, 42, "pinheiro"],
  [174, 38, "pinheiro"], [172, 56, "outono"], [118, 40, "redonda"],
  [30, 108, "pinheiro"], [38, 97, "redonda"], [58, 106, "outono"], [74, 100, "pinheiro"],
  [122, 100, "pinheiro"], [142, 106, "redonda"], [166, 97, "redonda"], [176, 108, "pinheiro"],
  [5, 9, "pinheiro"], [195, 9, "pinheiro"], [5, 131, "redonda"], [195, 131, "redonda"],
];
const PEDRAS: [number, number][] = [[72, 57], [118, 91], [84, 92], [156, 60]];
const COGUMELOS: [number, number][] = [[46, 57], [152, 111], [66, 93], [128, 58]];
const POSTES: [number, number][] = [[62, 52], [138, 52], [62, 95], [138, 95]];
const CORES_FLOR = ["#ffffff", "#ff5a5a", "#ffd84a", "#ff8fc8"];
/** Sorteio com semente fixa: todo mundo vê as flores e os tufos nos mesmos lugares. */
function sorteador(semente: number) {
  let s = semente;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
const noCaminho = (x: number, y: number) =>
  Math.abs(y - 73) < 9 || Math.abs(x - 100) < 9 || y < 30 || y > 114 || x < 21 || x > 179 || Math.hypot((x - 100) / 44, (y - 73) / 30) < 1 || Math.hypot((x - 142) / 21, (y - 46) / 11) < 1;
const FLORES = (() => {
  const r = sorteador(11);
  const lista: { x: number; y: number; cor: string }[] = [];
  while (lista.length < 46) {
    const x = 22 + r() * 156;
    const y = 31 + r() * 82;
    if (!noCaminho(x, y)) lista.push({ x, y, cor: CORES_FLOR[Math.floor(r() * CORES_FLOR.length)] ?? "#ffffff" });
  }
  return lista;
})();
const TUFOS = (() => {
  const r = sorteador(5);
  return Array.from({ length: 90 }, () => ({ x: r() * 200, y: r() * 138 }));
})();

function Arvore({ x, y, tipo }: { x: number; y: number; tipo: "redonda" | "pinheiro" | "outono" }) {
  if (tipo === "pinheiro") {
    return (
      <g>
        <ellipse cx={x} cy={y + 6.5} rx={6} ry={2} fill="rgba(0,0,0,0.22)" />
        <rect x={x - 1} y={y + 1} width={2} height={5.5} fill="#7a4a22" stroke="#4a2a10" strokeWidth={0.5} />
        {[0, 4.5, 9].map((d, i) => (
          <polygon key={d} points={`${x},${y - 14 + d} ${x - 4 - i * 1.6},${y - 6 + d} ${x + 4 + i * 1.6},${y - 6 + d}`} fill={i === 0 ? "#3d9a5c" : "#2f8550"} stroke="#1c5a34" strokeWidth={0.7} strokeLinejoin="round" />
        ))}
      </g>
    );
  }
  const outono = tipo === "outono";
  return (
    <g>
      <ellipse cx={x} cy={y + 7} rx={7} ry={2.3} fill="rgba(0,0,0,0.22)" />
      <rect x={x - 1.2} y={y + 1} width={2.4} height={6} fill={outono ? "#e9e2d2" : "#7a4a22"} stroke="#4a2a10" strokeWidth={0.5} />
      <circle cx={x} cy={y - 2.5} r={7.6} fill={outono ? "#e07f36" : "#3f9a3c"} stroke={outono ? "#9a4a17" : FOLHA_BORDA} strokeWidth={0.9} />
      <circle cx={x - 2.6} cy={y - 5} r={3.3} fill={outono ? "#f09b52" : "#5cb850"} />
      <circle cx={x + 3} cy={y} r={1.7} fill={outono ? "#f09b52" : "#5cb850"} />
    </g>
  );
}

/** Banco de madeira visto de cima, com o encosto virado para fora da praça. */
function Banco({ b, i }: { b: (typeof BANCOS)[number]; i: number }) {
  const x = PX(b.x);
  const y = PY(b.y);
  if (b.deitado) {
    const fora = b.x < 50 ? -1 : 1;
    return (
      <g>
        <rect x={x - 2.6} y={y - 5.5} width={5.2} height={11} rx={0.8} fill="#b9793a" stroke="#5a3515" strokeWidth={0.7} />
        <rect x={fora < 0 ? x - 2.6 : x + 1.2} y={y - 5.5} width={1.4} height={11} fill="#8a5424" />
        <line x1={x - 2.6} x2={x + 2.6} y1={y} y2={y} stroke="#5a3515" strokeWidth={0.4} />
      </g>
    );
  }
  const fora = i < 6 ? -1 : 1;
  return (
    <g>
      <rect x={x - 6} y={y - 2.6} width={12} height={5.2} rx={0.8} fill="#b9793a" stroke="#5a3515" strokeWidth={0.7} />
      <rect x={x - 6} y={fora < 0 ? y - 2.6 : y + 1.2} width={12} height={1.4} fill="#8a5424" />
      <line x1={x} x2={x} y1={y - 2.6} y2={y + 2.6} stroke="#5a3515" strokeWidth={0.4} />
    </g>
  );
}

function Pracinha() {
  const caminho = (d: string) => (
    <>
      <path d={d} fill="none" stroke={TERRA_BORDA} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={TERRA} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  return (
    <svg aria-hidden viewBox="0 0 200 138" preserveAspectRatio="none" shapeRendering="crispEdges" className="pointer-events-none absolute inset-0 size-full">
      <rect width={200} height={138} fill={GRAMA} />
      {TUFOS.map((t, i) => (
        <path key={i} d={`M${t.x} ${t.y}l1 -1.6l1 1.6`} fill="none" stroke="#56923a" strokeWidth={0.6} />
      ))}

      {/* caminhos de terra: a volta dos bancos e a cruz no meio */}
      {caminho("M22 21H178Q188 21 188 31V113Q188 123 178 123H22Q12 123 12 113V31Q12 21 22 21Z")}
      {caminho("M12 73H188")}
      {caminho("M100 21V123")}

      {/* largo de pedra no centro, onde fica o letreiro */}
      <ellipse cx={100} cy={73} rx={41} ry={27} fill="#a59f8f" />
      <ellipse cx={100} cy={72.4} rx={40} ry={26} fill="#d9d3c4" />
      {[-24, -12, 0, 12, 24].map((d) => (
        <line key={d} x1={100 + d} x2={100 + d} y1={48} y2={98} stroke="#c3bcab" strokeWidth={0.4} />
      ))}
      {[-14, 0, 14].map((d) => (
        <line key={d} x1={62} x2={138} y1={73 + d} y2={73 + d} stroke="#c3bcab" strokeWidth={0.4} />
      ))}
      <ellipse cx={100} cy={80} rx={30} ry={5} fill="rgba(0,0,0,0.18)" />

      {/* laguinho */}
      <ellipse cx={142} cy={46.6} rx={19} ry={9.4} fill="#4f86b8" />
      <ellipse cx={142} cy={46} rx={18} ry={8.6} fill="#77b3e0" />
      <path d="M131 44h7M146 49h8M138 50h4" stroke="#a9d3f2" strokeWidth={0.7} fill="none" />
      <circle cx={150} cy={43.5} r={1.7} fill="#3f9a3c" stroke={FOLHA_BORDA} strokeWidth={0.4} />
      <circle cx={135} cy={48.5} r={1.4} fill="#3f9a3c" stroke={FOLHA_BORDA} strokeWidth={0.4} />

      {/* flores, pedras e cogumelos */}
      {FLORES.map((f, i) => (
        <g key={i}>
          <circle cx={f.x} cy={f.y} r={1.1} fill={f.cor} stroke="rgba(0,0,0,0.25)" strokeWidth={0.25} />
          <circle cx={f.x} cy={f.y} r={0.4} fill="#f2b632" />
        </g>
      ))}
      {PEDRAS.map(([x, y]) => (
        <polygon key={`${x}-${y}`} points={`${x - 3},${y + 1.5} ${x - 2},${y - 1.5} ${x + 1},${y - 2.2} ${x + 3.2},${y - 0.5} ${x + 2.6},${y + 1.6}`} fill="#a9aeb3" stroke="#6b7076" strokeWidth={0.6} strokeLinejoin="round" />
      ))}
      {COGUMELOS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x - 0.6} y={y} width={1.2} height={1.8} fill="#f4efe2" stroke="#8a8272" strokeWidth={0.3} />
          <path d={`M${x - 2} ${y}a2 1.9 0 0 1 4 0z`} fill="#d83a3a" stroke="#7d1717" strokeWidth={0.4} />
          <circle cx={x - 0.7} cy={y - 0.8} r={0.35} fill="#fff" />
          <circle cx={x + 0.8} cy={y - 0.5} r={0.3} fill="#fff" />
        </g>
      ))}

      {BANCOS.map((b, i) => (
        <Banco key={i} b={b} i={i} />
      ))}
      {POSTES.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x - 0.5} y={y - 4} width={1} height={5} fill="#3a3a3a" />
          <circle cx={x} cy={y - 4.6} r={1.5} fill="#ffe9a8" stroke="#3a3a3a" strokeWidth={0.4} />
        </g>
      ))}
      {[...ARVORES].sort((a, b) => a[1] - b[1]).map(([x, y, tipo]) => (
        <Arvore key={`${x}-${y}`} x={x} y={y} tipo={tipo} />
      ))}
    </svg>
  );
}

/** Miniatura do HOSHI para o mapa: a mesma gotinha, com a cor do pelo e da roupa de cada um. */
function Bichinho({ pelo, roupa }: { pelo: string; roupa: string | null }) {
  return (
    <svg viewBox="0 0 32 36" className="h-9 w-8" aria-hidden>
      <ellipse cx="16" cy="34" rx="9" ry="1.8" fill="rgba(0,0,0,0.28)" />
      <circle cx="8" cy="7" r="3.6" fill={pelo} stroke="#3a2a2a" strokeWidth="1" />
      <circle cx="24" cy="7" r="3.6" fill={pelo} stroke="#3a2a2a" strokeWidth="1" />
      <ellipse cx="16" cy="19.5" rx="12" ry="13.5" fill={pelo} stroke="#3a2a2a" strokeWidth="1" />
      {roupa && <path d="M4.6 23.5h22.8a12 13.5 0 0 1-3.6 6.6H8.2a12 13.5 0 0 1-3.6-6.6z" fill={roupa} stroke="#3a2a2a" strokeWidth="0.7" />}
      <circle cx="11.4" cy="15.5" r="3.9" fill="#fff" stroke="#3a2a2a" strokeWidth="0.6" />
      <circle cx="20.6" cy="15.5" r="3.9" fill="#fff" stroke="#3a2a2a" strokeWidth="0.6" />
      <circle cx="11.8" cy="15.9" r="2" fill="#1a1010" />
      <circle cx="20.2" cy="15.9" r="2" fill="#1a1010" />
      <circle cx="12.5" cy="15.1" r="0.7" fill="#fff" />
      <circle cx="20.9" cy="15.1" r="0.7" fill="#fff" />
      <ellipse cx="16" cy="19.6" rx="1.2" ry="0.9" fill="#1a1010" />
      <path d="M13.8 21.4q2.2 2 4.4 0" stroke="#7d1a26" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const FALA_MS = 6500;
const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ehCor = (v: unknown) => /^#[0-9a-f]{6}$/i.test(String(v));

export function Praca({ pet }: { pet: HoshiPet }) {
  const qc = useQueryClient();
  const euPessoa = useMemo<Pessoa>(() => ({ id: pet.user_id, nome: pet.username || pet.nome }), [pet.user_id, pet.username, pet.nome]);
  const cor = pet.visual.roupa === "nenhuma" ? "" : (PECAS.find((p) => p.grupo === "roupa" && p.valor === pet.visual.roupa)?.cor ?? "#ce0e0e");
  const pelo = PELOS.find((x) => x.id === pet.visual.pelo)?.cor ?? "#fff6ec";

  const [dentro, setDentro] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState<{ x: number; y: number; banco: number | null }>({ x: 50, y: 60, banco: null });
  const [outros, setOutros] = useState<Record<string, Presenca>>({});
  const [falas, setFalas] = useState<Record<string, { texto: string; ate: number }>>({});
  const [texto, setTexto] = useState("");
  // O status fica guardado neste navegador para não precisar escrever de novo.
  const [status, setStatus] = useState(() => {
    try {
      return limparStatus(localStorage.getItem(CHAVE_STATUS) ?? "");
    } catch {
      return "";
    }
  });
  const [editandoStatus, setEditandoStatus] = useState(false);
  const [rascunho, setRascunho] = useState({ emoji: "📘", texto: "" });
  const salvarStatus = (novo: string) => {
    const limpo = limparStatus(novo);
    setStatus(limpo);
    setEditandoStatus(false);
    try {
      if (limpo) localStorage.setItem(CHAVE_STATUS, limpo);
      else localStorage.removeItem(CHAVE_STATUS);
    } catch {
      // sem armazenamento: o status vale só até recarregar
    }
  };
  const [alvo, setAlvo] = useState<Presenca | null>(null);
  const [velhaId, setVelhaId] = useState<string | null>(null);
  const [cartas, setCartas] = useState(false);
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ultimaFala = useRef(0);
  const vistas = useRef(new Set<string>());

  /* ---------- canal ao vivo: presença (quem está e onde) + falas ---------- */
  useEffect(() => {
    const ch = supabase.channel("hoshi-praca", { config: { presence: { key: euPessoa.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const estado = ch.presenceState() as Record<string, (Partial<Presenca> & { presence_ref?: string })[]>;
      const proximo: Record<string, Presenca> = {};
      for (const [id, lista] of Object.entries(estado)) {
        const p = lista[lista.length - 1];
        if (id === euPessoa.id || !p || typeof p.x !== "number" || typeof p.y !== "number") continue;
        proximo[id] = { id, nome: String(p.nome ?? "staff").slice(0, 24), pet: String(p.pet ?? "").slice(0, 24), cor: ehCor(p.cor) ? String(p.cor) : "", pelo: ehCor(p.pelo) ? String(p.pelo) : "#fff6ec", x: limitar(p.x, 0, 100), y: limitar(p.y, 0, 100), banco: typeof p.banco === "number" ? p.banco : null, status: limparStatus(String(p.status ?? "")) };
      }
      setOutros(proximo);
    })
      .on("broadcast", { event: "fala" }, ({ payload }) => {
        const p = payload as { id?: unknown; texto?: unknown };
        if (typeof p.id !== "string" || typeof p.texto !== "string") return;
        setFalas((f) => ({ ...f, [p.id as string]: { texto: (p.texto as string).slice(0, 90), ate: Date.now() + FALA_MS } }));
      })
      .subscribe((status) => setPronto(status === "SUBSCRIBED"));
    canal.current = ch;
    return () => {
      canal.current = null;
      void supabase.removeChannel(ch);
    };
  }, [euPessoa.id]);

  // Publica onde estou sempre que entro, ando ou sento; ao sair, some para os outros.
  useEffect(() => {
    const ch = canal.current;
    if (!ch || !pronto) return;
    if (dentro) void ch.track({ nome: euPessoa.nome, pet: pet.nome, cor, pelo, x: eu.x, y: eu.y, banco: eu.banco, status });
    else void ch.untrack();
  }, [dentro, pronto, eu, euPessoa.nome, pet.nome, cor, pelo, status]);

  // Apaga os balões vencidos.
  const temFalas = Object.keys(falas).length > 0;
  useEffect(() => {
    if (!temFalas) return;
    const id = setInterval(() => setFalas((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v.ate > Date.now()))), 1000);
    return () => clearInterval(id);
  }, [temFalas]);

  /* ---------- partidas (convites e salas) ---------- */
  useRealtimeTable("hoshi_jogos", [["hoshi-jogos"]]);
  const { data: jogos = [] } = useQuery({ queryKey: ["hoshi-jogos", "ativos"], queryFn: jogosAtivos, staleTime: 15_000 });
  const velhas = jogos.filter((j): j is Jogo<Velha> => j.tipo === "velha");
  const salas = jogos.filter((j): j is Jogo<Cartas> => j.tipo === "cartas" && (j.estado as Cartas).jogadores.length > 0);
  const convite = velhas.find((j) => j.status === "aberto" && j.estado.o.id === euPessoa.id);
  const enviado = velhas.find((j) => j.status === "aberto" && j.estado.x.id === euPessoa.id);
  const emJogo = velhas.find((j) => j.status === "jogando" && (j.estado.x.id === euPessoa.id || j.estado.o.id === euPessoa.id));

  // Quando um desafio meu é aceito, a partida abre sozinha (uma vez por partida).
  useEffect(() => {
    if (emJogo && !vistas.current.has(emJogo.id)) {
      vistas.current.add(emJogo.id);
      setVelhaId(emJogo.id);
    }
  }, [emJogo]);

  const desafiar = async (p: Presenca) => {
    setAlvo(null);
    if (enviado || emJogo) {
      toast.info("Você já tem um jogo da velha em andamento.");
      return;
    }
    try {
      await criarJogo("velha", { x: euPessoa, o: { id: p.id, nome: p.nome }, tab: Array<null>(9).fill(null), vez: "x", vencedor: null });
      toast.success(`Desafio enviado para ${p.nome}.`);
    } catch {
      toast.error("Não foi possível enviar o desafio.");
    }
    void qc.invalidateQueries({ queryKey: ["hoshi-jogos"] });
  };
  const responder = async (j: Jogo<Velha>, aceita: boolean) => {
    await gravarJogo(j, j.estado, aceita ? "jogando" : "fim").catch(() => false);
    void qc.invalidateQueries({ queryKey: ["hoshi-jogos"] });
  };

  /* ---------- andar, sentar e falar ---------- */
  const andar = (e: MouseEvent<HTMLDivElement>) => {
    if (!dentro) return;
    const r = e.currentTarget.getBoundingClientRect();
    setEu({ x: limitar(((e.clientX - r.left) / r.width) * 100, 4, 96), y: limitar(((e.clientY - r.top) / r.height) * 100, 12, 94), banco: null });
    setAlvo(null);
  };
  const sentar = (i: number) => {
    const b = BANCOS[i];
    if (!dentro || !b) return;
    if (Object.values(outros).some((o) => o.banco === i)) {
      toast.info("Esse banco já está ocupado.");
      return;
    }
    playSfx("click");
    setEu({ x: b.x, y: b.y - 2.5, banco: i });
  };
  const falar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim().slice(0, 90);
    if (!t || !dentro || Date.now() - ultimaFala.current < 700) return;
    ultimaFala.current = Date.now();
    setTexto("");
    setFalas((f) => ({ ...f, [euPessoa.id]: { texto: t, ate: Date.now() + FALA_MS } }));
    void canal.current?.send({ type: "broadcast", event: "fala", payload: { id: euPessoa.id, texto: t } });
  };

  const pessoas: (Presenca & { souEu?: boolean })[] = [...Object.values(outros), ...(dentro ? [{ id: euPessoa.id, nome: euPessoa.nome, pet: pet.nome, cor, pelo, ...eu, status, souEu: true }] : [])];
  const online = Object.keys(outros).length + (dentro ? 1 : 0);

  return (
    <div className="flex h-full min-h-[440px] flex-col">
      {/* barra de cima */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <p className="font-display text-[15px] font-semibold">Praça HOST</p>
        {!dentro && (
          <button onClick={() => setDentro(true)} disabled={!pronto} className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[11px] font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60">
            <DoorOpen className="size-3.5" /> {pronto ? "Entrar na praça" : "Conectando…"}
          </button>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-400" : "bg-white/25")} /> {online} na praça
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setCartas(true)} className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 text-[11px] transition-colors hover:bg-white/[0.1]">
            <Layers className="size-3.5" /> Mau-Mau
            {salas.length > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">{salas.length}</span>}
          </button>
          {emJogo && (
            <button onClick={() => setVelhaId(emJogo.id)} className="flex h-8 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 text-[11px]">
              <Hash className="size-3.5" /> Voltar à velha
            </button>
          )}
          {dentro && (
            <button onClick={() => setDentro(false)} aria-label="Sair da praça" title="Sair da praça" className="grid size-8 place-items-center rounded-full border border-white/[0.1] text-muted-foreground transition-colors hover:text-foreground">
              <LogOut className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* convites */}
      {(convite || enviado) && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs" role="status">
          <Swords className="size-3.5 text-red-200" />
          {convite ? (
            <>
              <span className="min-w-0 flex-1 truncate">{convite.estado.x.nome} te desafiou no jogo da velha.</span>
              <button onClick={() => void responder(convite, true)} className="h-7 rounded-full bg-primary px-3 font-semibold text-white">
                Aceitar
              </button>
              <button onClick={() => void responder(convite, false)} className="h-7 rounded-full border border-white/15 px-3">
                Recusar
              </button>
            </>
          ) : (
            enviado && (
              <>
                <span className="min-w-0 flex-1 truncate">Aguardando {enviado.estado.o.nome} aceitar o desafio…</span>
                <button onClick={() => void responder(enviado, false)} className="h-7 rounded-full border border-white/15 px-3">
                  Cancelar
                </button>
              </>
            )
          )}
        </div>
      )}

      {/* mapa */}
      <div onClick={andar} className={cn("relative mx-4 flex-1 select-none overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#6aaa3f]", dentro && "cursor-pointer")}>
        <Pracinha />
        {/* letreiro HOST com volume, no largo central */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[51%] w-[31%] -translate-x-1/2 -translate-y-1/2">
          <LogoExtenso cor="#e8112d" className="w-full [filter:drop-shadow(0_1px_0_#7d0909)_drop-shadow(0_1px_0_#7d0909)_drop-shadow(0_1px_0_#7d0909)_drop-shadow(0_1px_0_#5a0606)_drop-shadow(0_2px_0_#3a0404)_drop-shadow(0_5px_3px_rgba(0,0,0,0.45))]" />
        </div>

        {/* bancos */}
        {BANCOS.map((b, i) => {
          const ocupado = pessoas.some((p) => p.banco === i);
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                sentar(i);
              }}
              disabled={!dentro}
              aria-label={`Banco ${i + 1}${ocupado ? ", ocupado" : ", livre"}`}
              title={ocupado ? "Ocupado" : "Sentar"}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-[5px] border-2 border-transparent transition-colors duration-200",
                b.deitado ? "h-[9%] w-[3.4%] min-w-3" : "h-[5%] min-h-3 w-[7%]",
                !ocupado && "enabled:hover:border-white enabled:hover:bg-white/25",
              )}
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
            />
          );
        })}

        {/* pessoas */}
        {pessoas.map((p) => {
          const fala = falas[p.id];
          return (
            <div
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-[85%] transition-[left,top] duration-[850ms] ease-out"
              style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: 10 + Math.round(p.y) }}
            >
              {fala && (
                <p className="pf-pop absolute bottom-full left-1/2 mb-1 w-max max-w-[170px] -translate-x-1/2 break-words rounded-2xl rounded-bl-sm bg-white px-2.5 py-1 text-[11px] font-medium leading-snug text-black shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
                  {fala.texto}
                </p>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!p.souEu && dentro) setAlvo(p);
                }}
                aria-label={p.souEu ? "Você" : `${p.nome}: desafiar`}
                className={cn("flex flex-col items-center", p.souEu ? "cursor-default" : "cursor-pointer")}
              >
                <Bichinho pelo={p.pelo} roupa={p.cor || null} />
                <span className={cn("mt-0.5 max-w-[90px] truncate rounded-full px-1.5 py-px text-[10px] font-medium", p.souEu ? "bg-white text-black" : "bg-black/70 text-white")}>{p.nome}</span>
                {p.status && <span className="mt-0.5 max-w-[120px] truncate rounded-full bg-black/75 px-1.5 py-px text-[9.5px] font-medium text-red-400">{p.status}</span>}
              </button>
            </div>
          );
        })}

        {/* ação sobre alguém */}
        {alvo && (
          <div onClick={(e) => e.stopPropagation()} className="pf-pop absolute inset-x-3 bottom-3 z-[200] flex items-center gap-2 rounded-2xl border border-white/15 bg-black/85 px-3 py-2 text-xs backdrop-blur-xl">
            <span className="min-w-0 flex-1 truncate">
              {alvo.nome}
              {alvo.pet ? ` · ${alvo.pet}` : ""}
            </span>
            <button onClick={() => void desafiar(alvo)} className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 font-semibold text-white">
              <Hash className="size-3.5" /> Desafiar na velha
            </button>
            <button onClick={() => setAlvo(null)} aria-label="Fechar" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* dica para quem só está olhando */}
        {!dentro && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-[150] -translate-x-1/2 rounded-full bg-black/75 px-3 py-1 text-[11px] text-white/85 backdrop-blur">
            {online ? "Você está só olhando. Entre para andar, sentar e conversar." : "A praça está vazia. Entre e seja o primeiro."}
          </p>
        )}
      </div>

      {/* chat */}
      <form onSubmit={falar} className="flex items-center gap-2 px-4 py-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={!dentro}
          maxLength={90}
          placeholder={dentro ? "Fale algo: aparece em cima do seu nick" : "Entre na praça para conversar"}
          aria-label="Mensagem para a praça"
          className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.09] bg-black/40 px-4 text-[13px] outline-none transition-colors placeholder:text-ink-3 focus:border-white/30 disabled:opacity-50"
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              // o status salvo é "emoji texto": separa no primeiro espaço para editar
              const espaco = status.indexOf(" ");
              setRascunho(espaco > 0 ? { emoji: status.slice(0, espaco), texto: status.slice(espaco + 1) } : { emoji: "📘", texto: "" });
              setEditandoStatus((v) => !v);
            }}
            aria-expanded={editandoStatus}
            title="Seu status na praça"
            className={cn("flex h-10 max-w-[170px] items-center gap-1.5 rounded-full border px-3.5 text-[12px] transition-colors", status ? "border-primary/40 bg-primary/10 text-red-300" : "border-white/[0.09] bg-black/40 text-ink-3 hover:text-foreground")}
          >
            <span className="truncate">{status || "＋ Status"}</span>
          </button>
          {editandoStatus && (
            <div className="pf-pop absolute bottom-12 right-0 z-[400] w-[290px] rounded-2xl border border-white/15 bg-[#0d0d0d]/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
              <p className="eyebrow">Seu status</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {EMOJIS_STATUS.map((e) => (
                  <button key={e} type="button" onClick={() => setRascunho((r) => ({ ...r, emoji: e }))} aria-label={`Emoji ${e}`} className={cn("grid size-8 place-items-center rounded-lg text-base transition-colors", rascunho.emoji === e ? "bg-white/15" : "hover:bg-white/[0.08]")}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-base">{rascunho.emoji}</span>
                <input
                  value={rascunho.texto}
                  onChange={(e) => setRascunho((r) => ({ ...r, texto: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      salvarStatus(rascunho.texto.trim() ? `${rascunho.emoji} ${rascunho.texto}` : "");
                    }
                  }}
                  maxLength={28}
                  autoFocus
                  placeholder="Lendo, no café…"
                  aria-label="Texto do status"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/40 px-3 text-[13px] outline-none focus:border-white/30"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {STATUS_PRONTOS.map((sp) => (
                  <button key={sp} type="button" onClick={() => salvarStatus(sp)} className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                    {sp}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-1.5">
                <button type="button" onClick={() => salvarStatus("")} className="h-8 flex-1 rounded-full border border-white/[0.1] text-[11px] text-muted-foreground hover:text-foreground">
                  Limpar
                </button>
                <button type="button" onClick={() => salvarStatus(rascunho.texto.trim() ? `${rascunho.emoji} ${rascunho.texto}` : "")} className="h-8 flex-1 rounded-full bg-primary text-[11px] font-semibold text-white">
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="submit" disabled={!dentro || !texto.trim()} aria-label="Enviar" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40">
          <Send className="size-4" />
        </button>
      </form>

      {velhaId && <VelhaDialog jogoId={velhaId} eu={euPessoa} onClose={() => setVelhaId(null)} />}
      {cartas && <CartasDialog eu={euPessoa} salas={salas} onClose={() => setCartas(false)} />}
    </div>
  );
}
