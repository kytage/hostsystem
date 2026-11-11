import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Hash, Layers, LogOut, Send, Swords, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LogoExtenso } from "@/components/dashboard/Logo";
import { lerVisual, type HoshiPet, type Visual } from "@/lib/hoshi";
import { criarJogo, gravarJogo, jogosAtivos, type Cartas, type Jogo, type Pessoa, type Velha } from "@/lib/hoshi-jogos";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { Hoshi2D } from "./hoshi-2d";
import { CartasDialog, VelhaDialog } from "./jogos-online";

/** Quem está na praça (enviado pelo canal de presença). Posições em % do mapa. */
interface Presenca {
  id: string;
  nome: string;
  pet: string;
  /** Visual completo do pet, igual ao do boneco 3D. */
  visual: Visual;
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

/** 20 bancos: 8 em cima, 8 embaixo e 2 de cada lado. Posições em % do mapa. */
const BANCOS: { x: number; y: number; deitado: boolean }[] = [
  ...Array.from({ length: 8 }, (_, i) => ({ x: 12 + i * (76 / 7), y: 14, deitado: false })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: 12 + i * (76 / 7), y: 87, deitado: false })),
  ...[36, 65].map((y) => ({ x: 4.5, y, deitado: true })),
  ...[36, 65].map((y) => ({ x: 95.5, y, deitado: true })),
];

/* ---------------- cenário: pracinha panorâmica, vista de cima ---------------- */
// Desenhada em SVG numa prancheta de 260×120 (proporção 13:6). O mapa na tela
// mantém sempre essa proporção, então nada é esticado. Pessoas e bancos usam
// % do mapa; PX(%) e PY(%) convertem para a prancheta.
const PROPORCAO = 13 / 6;
const PX = (pct: number) => pct * 2.6;
const PY = (pct: number) => pct * 1.2;
const GRAMA = "#6aaa3f";
const TERRA = "#e2c48d";
const TERRA_BORDA = "#b9965f";
const FOLHA_BORDA = "#245a26";
const MEIO = { x: 130, y: 60.6 };
const LAGO = { x: 203, y: 40, rx: 21, ry: 8 };

const ARVORES: [x: number, y: number, tipo: "redonda" | "pinheiro" | "outono"][] = [
  [26, 34, "pinheiro"], [40, 44, "redonda"], [58, 36, "outono"], [76, 43, "pinheiro"], [98, 33, "redonda"],
  [160, 34, "pinheiro"], [234, 36, "redonda"], [232, 50, "pinheiro"], [174, 46, "redonda"],
  [28, 86, "redonda"], [44, 78, "pinheiro"], [62, 88, "redonda"], [82, 80, "outono"], [100, 90, "pinheiro"],
  [160, 88, "redonda"], [178, 79, "pinheiro"], [198, 89, "outono"], [216, 80, "redonda"], [236, 88, "pinheiro"],
  [5, 8, "pinheiro"], [255, 8, "pinheiro"], [5, 114, "redonda"], [255, 114, "redonda"],
];
const PEDRAS: [number, number][] = [[88, 50], [170, 74], [50, 74], [222, 54], [112, 78]];
const COGUMELOS: [number, number][] = [[34, 50], [206, 76], [92, 76], [150, 44], [70, 52]];
const POSTES: [number, number][] = [[84, 46], [176, 46], [84, 78], [176, 78]];
const CORES_FLOR = ["#ffffff", "#ff5a5a", "#ffd84a", "#ff8fc8"];
/** Sorteio com semente fixa: todo mundo vê as flores e os tufos nos mesmos lugares. */
function sorteador(semente: number) {
  let s = semente;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
const noCaminho = (x: number, y: number) =>
  Math.abs(y - MEIO.y) < 8 || Math.abs(x - MEIO.x) < 8 || y < 25 || y > 96 || x < 20 || x > 240 || Math.hypot((x - MEIO.x) / 48, (y - MEIO.y) / 25) < 1 || Math.hypot((x - LAGO.x) / (LAGO.rx + 3), (y - LAGO.y) / (LAGO.ry + 3)) < 1;
const FLORES = (() => {
  const r = sorteador(11);
  const lista: { x: number; y: number; cor: string }[] = [];
  while (lista.length < 60) {
    const x = 20 + r() * 220;
    const y = 25 + r() * 71;
    if (!noCaminho(x, y)) lista.push({ x, y, cor: CORES_FLOR[Math.floor(r() * CORES_FLOR.length)] ?? "#ffffff" });
  }
  return lista;
})();
const TUFOS = (() => {
  const r = sorteador(5);
  return Array.from({ length: 110 }, () => ({ x: r() * 260, y: r() * 120 }));
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
  const fora = i < 8 ? -1 : 1;
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
      <path d={d} fill="none" stroke={TERRA_BORDA} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={TERRA} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  return (
    <svg aria-hidden viewBox="0 0 260 120" preserveAspectRatio="none" shapeRendering="crispEdges" className="pointer-events-none absolute inset-0 size-full">
      <rect width={260} height={120} fill={GRAMA} />
      {TUFOS.map((t, i) => (
        <path key={i} d={`M${t.x} ${t.y}l1 -1.6l1 1.6`} fill="none" stroke="#56923a" strokeWidth={0.6} />
      ))}

      {/* caminhos de terra: a volta dos bancos e a cruz no meio */}
      {caminho("M22 17H238Q248 17 248 27V94Q248 104 238 104H22Q12 104 12 94V27Q12 17 22 17Z")}
      {caminho(`M12 ${MEIO.y}H248`)}
      {caminho(`M${MEIO.x} 17V104`)}

      {/* largo de pedra no centro, onde fica o letreiro */}
      <ellipse cx={MEIO.x} cy={MEIO.y + 0.6} rx={46} ry={24} fill="#a59f8f" />
      <ellipse cx={MEIO.x} cy={MEIO.y} rx={45} ry={23} fill="#d9d3c4" />
      {[-30, -15, 0, 15, 30].map((d) => (
        <line key={d} x1={MEIO.x + d} x2={MEIO.x + d} y1={39} y2={82} stroke="#c3bcab" strokeWidth={0.4} />
      ))}
      {[-12, 0, 12].map((d) => (
        <line key={d} x1={88} x2={172} y1={MEIO.y + d} y2={MEIO.y + d} stroke="#c3bcab" strokeWidth={0.4} />
      ))}
      <ellipse cx={MEIO.x} cy={MEIO.y + 8} rx={32} ry={4.4} fill="rgba(0,0,0,0.18)" />

      {/* laguinho */}
      <ellipse cx={LAGO.x} cy={LAGO.y + 0.6} rx={LAGO.rx + 1} ry={LAGO.ry + 0.8} fill="#4f86b8" />
      <ellipse cx={LAGO.x} cy={LAGO.y} rx={LAGO.rx} ry={LAGO.ry} fill="#77b3e0" />
      <path d={`M${LAGO.x - 12} ${LAGO.y - 2}h7M${LAGO.x + 4} ${LAGO.y + 3}h8M${LAGO.x - 4} ${LAGO.y + 4}h4`} stroke="#a9d3f2" strokeWidth={0.7} fill="none" />
      <circle cx={LAGO.x + 9} cy={LAGO.y - 2.5} r={1.7} fill="#3f9a3c" stroke={FOLHA_BORDA} strokeWidth={0.4} />
      <circle cx={LAGO.x - 8} cy={LAGO.y + 2.5} r={1.4} fill="#3f9a3c" stroke={FOLHA_BORDA} strokeWidth={0.4} />

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

const FALA_MS = 6500;
const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function Praca({ pet }: { pet: HoshiPet }) {
  const qc = useQueryClient();
  const euPessoa = useMemo<Pessoa>(() => ({ id: pet.user_id, nome: pet.username || pet.nome }), [pet.user_id, pet.username, pet.nome]);
  // Texto estável do visual: só muda (e só reenvia a presença) quando o pet troca de aparência.
  const visualTxt = JSON.stringify(pet.visual);
  const meuVisual = useMemo(() => JSON.parse(visualTxt) as Visual, [visualTxt]);

  const [dentro, setDentro] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState<{ x: number; y: number; banco: number | null }>({ x: 50, y: 72, banco: null });
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
  const moldura = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = moldura.current;
    if (!el) return;
    const medir = () => {
      const w = Math.min(el.clientWidth, el.clientHeight * PROPORCAO);
      setMapa({ w: Math.floor(w), h: Math.floor(w / PROPORCAO) });
    };
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    medir();
    return () => observador.disconnect();
  }, []);
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
        proximo[id] = { id, nome: String(p.nome ?? "staff").slice(0, 24), pet: String(p.pet ?? "").slice(0, 24), visual: lerVisual(p.visual), x: limitar(p.x, 0, 100), y: limitar(p.y, 0, 100), banco: typeof p.banco === "number" ? p.banco : null, status: limparStatus(String(p.status ?? "")) };
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
    if (dentro) void ch.track({ nome: euPessoa.nome, pet: pet.nome, visual: meuVisual, x: eu.x, y: eu.y, banco: eu.banco, status });
    else void ch.untrack();
  }, [dentro, pronto, eu, euPessoa.nome, pet.nome, meuVisual, status]);

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

  // A partida só abre sozinha quando um desafio que EU mandei nesta visita é aceito.
  // Partidas antigas em andamento não abrem ao entrar: ficam no botão "Voltar à velha".
  const meusConvites = useRef(new Set<string>());
  useEffect(() => {
    if (enviado) meusConvites.current.add(enviado.id);
  }, [enviado]);
  useEffect(() => {
    if (emJogo && meusConvites.current.has(emJogo.id) && !vistas.current.has(emJogo.id)) {
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
    const ok = await gravarJogo(j, j.estado, aceita ? "jogando" : "fim").catch(() => false);
    void qc.invalidateQueries({ queryKey: ["hoshi-jogos"] });
    // quem aceitou entra direto na partida
    if (ok && aceita) {
      vistas.current.add(j.id);
      setVelhaId(j.id);
    }
  };

  /* ---------- andar, sentar e falar ---------- */
  const andar = (e: MouseEvent<HTMLDivElement>) => {
    if (!dentro) return;
    const r = e.currentTarget.getBoundingClientRect();
    setEu({ x: limitar(((e.clientX - r.left) / r.width) * 100, 3, 97), y: limitar(((e.clientY - r.top) / r.height) * 100, 13, 95), banco: null });
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
    setEu({ x: b.x, y: b.y - 1, banco: i });
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

  const pessoas: (Presenca & { souEu?: boolean })[] = [...Object.values(outros), ...(dentro ? [{ id: euPessoa.id, nome: euPessoa.nome, pet: pet.nome, visual: meuVisual, ...eu, status, souEu: true }] : [])];
  const online = Object.keys(outros).length + (dentro ? 1 : 0);

  return (
    <div className="flex h-full min-h-[400px] flex-col">
      {/* barra de cima */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
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
      <div ref={moldura} className="mx-3 grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#6aaa3f]">
      <div onClick={andar} style={{ width: mapa.w, height: mapa.h }} className={cn("relative select-none", dentro && "cursor-pointer")}>
        <Pracinha />
        {/* letreiro HOST com volume, no largo central */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[49%] w-[25%] -translate-x-1/2 -translate-y-1/2">
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
                b.deitado ? "h-[11%] w-[2.6%] min-w-3" : "h-[6%] min-h-3 w-[5.4%]",
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
                <Hoshi2D visual={p.visual} />
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
      </div>

      {/* chat */}
      <form onSubmit={falar} className="flex items-center gap-2 px-3 py-2">
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
