import { useState } from "react";
import { createPortal } from "react-dom";
import { Dumbbell, Search, Users, X } from "lucide-react";
import { SIEGE } from "@/lib/siege/config";
import type { NaFila } from "@/lib/siege/rede";

/** Desenho da arena (vista de cima): castelo vermelho à esquerda, azul à direita, ponte e Forja no meio. */
function MapaDaArena() {
  return (
    <svg viewBox="0 0 400 150" className="h-auto w-full" aria-hidden>
      <defs>
        <radialGradient id="siege-ceu" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#1b2233" />
          <stop offset="1" stopColor="#0a0c12" />
        </radialGradient>
      </defs>
      <rect width="400" height="150" rx="14" fill="url(#siege-ceu)" />
      {/* plataformas distantes */}
      {[
        [70, 22, 16],
        [330, 128, 16],
        [200, 14, 20],
        [200, 136, 20],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x! - w! / 2} y={y! - 4} width={w} height={8} rx={2} fill="#23232a" />
      ))}
      {/* ponte */}
      <rect x="92" y="70" width="216" height="10" fill="#3a3a42" />
      {[150, 250].map((x) => (
        <rect key={x} x={x - 2} y="70" width="4" height="5" fill="#1d1d22" />
      ))}
      {/* desvios laterais com os pedestais */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x="180" y={75 + s * 30 - 8} width="40" height="16" rx="3" fill="#34343b" />
          <circle cx="200" cy={75 + s * 30} r="3" fill="#ff3b6b" />
          <rect x="168" y={s < 0 ? 52 : 80} width="5" height="18" fill="#34343b" />
          <rect x="227" y={s < 0 ? 52 : 80} width="5" height="18" fill="#34343b" />
        </g>
      ))}
      {/* Forja */}
      <rect x="182" y="57" width="36" height="36" rx="4" fill="#2e2e34" />
      <circle
        cx="200"
        cy="75"
        r="11"
        fill="none"
        stroke="#ffc83d"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <path d="M200 67 L206 75 L200 83 L194 75 Z" fill="#ffc83d" />
      {/* castelos */}
      {[
        { x: 22, cor: "#CE0E0E" },
        { x: 308, cor: "#1e6bff" },
      ].map((c) => (
        <g key={c.x}>
          <rect
            x={c.x}
            y="42"
            width="70"
            height="66"
            rx="4"
            fill="#2a2a30"
            stroke={c.cor}
            strokeWidth="2"
          />
          <circle cx={c.x + 35} cy="75" r="8" fill={c.cor} />
          <rect x={c.x === 22 ? 22 : 378 - 0} y="58" width="0" height="0" />
        </g>
      ))}
      <text x="57" y="125" textAnchor="middle" fontSize="9" fill="#ff7a7a" fontWeight="700">
        VERMELHO
      </text>
      <text x="343" y="125" textAnchor="middle" fontSize="9" fill="#7aa8ff" fontWeight="700">
        AZUL
      </text>
      <text x="200" y="108" textAnchor="middle" fontSize="8" fill="#ffc83d" fontWeight="700">
        FORJA
      </text>
    </svg>
  );
}

/** Painel do portal HOST SIEGE (na ilha EM BREVE do lobby). */
export function PortalSiege({
  onTreinar,
  onBuscar,
  onPrivada,
  onClose,
  naFila,
}: {
  onTreinar: () => void;
  onBuscar: () => void;
  /** Sem código: cria uma sala nova; com código: entra nela. */
  onPrivada: (codigo?: string) => void;
  onClose: () => void;
  naFila: boolean;
}) {
  const [privada, setPrivada] = useState(false);
  const [codigo, setCodigo] = useState("");
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HOST SIEGE"
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pf-pop relative w-full max-w-[560px] rounded-3xl border border-white/12 bg-[#0c0c0e] p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#CE0E0E]">
          Mini-game
        </p>
        <h2 className="text-[24px] font-extrabold leading-tight">HOST SIEGE</h2>
        <p className="text-[13px] text-white/70">Cerco dos Guardiões</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          <MapaDaArena />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">
          Dois times, um Guardião de {SIEGE.HP_GUARDIAO} HP em cada castelo. Capture a{" "}
          <b>Forja Central</b> no meio da ponte para tirar a barreira do Guardião inimigo por{" "}
          {SIEGE.FORJA_JANELA_S} s. Quem derrubar o Guardião do outro time vence na hora. Partidas
          de {SIEGE.FILA_MIN} a {SIEGE.FILA_MAX} jogadores; com {SIEGE.FILA_MIN} na fila, começa em{" "}
          {SIEGE.FILA_CONTAGEM_S} s.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onBuscar}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#CE0E0E] text-[13px] font-semibold hover:brightness-110"
          >
            <Search className="size-4" /> {naFila ? "Cancelar busca" : "Buscar partida"}
          </button>
          <button
            type="button"
            onClick={() => setPrivada((v) => !v)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-[13px] font-semibold hover:bg-white/10"
          >
            <Users className="size-4" /> Partida privada
          </button>
          <button
            type="button"
            onClick={onTreinar}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-[13px] font-semibold hover:bg-white/10"
          >
            <Dumbbell className="size-4" /> Treinar
          </button>
        </div>
        {privada && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <button
              type="button"
              onClick={() => onPrivada()}
              className="h-9 rounded-lg bg-white/10 px-3 text-[12.5px] font-semibold hover:bg-white/20"
            >
              Criar sala
            </button>
            <span className="text-[11.5px] text-white/50">ou entre com o código:</span>
            <input
              value={codigo}
              onChange={(e) =>
                setCodigo(
                  e.target.value
                    .replace(/[^a-z]/gi, "")
                    .slice(0, 4)
                    .toUpperCase(),
                )
              }
              placeholder="ABCD"
              aria-label="Código da sala"
              className="h-9 w-20 rounded-lg border border-white/12 bg-black/40 px-2 text-center font-mono text-[14px] uppercase tracking-widest outline-none focus:border-white/30"
            />
            <button
              type="button"
              disabled={codigo.length !== 4}
              onClick={() => onPrivada(codigo)}
              className="h-9 rounded-lg bg-[#CE0E0E] px-3 text-[12.5px] font-semibold disabled:opacity-40"
            >
              Entrar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Sala privada aberta: o código para chamar os amigos, quem entrou (por time) e o Começar do anfitrião. */
export function SalaSiege({
  sala,
  euId,
  onComecar,
  onSair,
}: {
  sala: { codigo: string; lista: NaFila[]; anfitriao: string | null };
  euId: string;
  onComecar: () => void;
  onSair: () => void;
}) {
  const souAnfitriao = sala.anfitriao === euId;
  const n = sala.lista.length;
  const pronto = n % 2 === 0 && n >= 4 && n <= 8;
  return (
    <div className="pf-pop absolute left-1/2 top-12 z-30 w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-white/12 bg-black/85 p-3 text-white backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold">
          <span className="text-[#CE0E0E]">HOST SIEGE</span> · sala privada
        </p>
        <span className="rounded-lg bg-white/10 px-2 py-0.5 font-mono text-[15px] font-bold tracking-widest">
          {sala.codigo}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-white/55">
        Passe o código para os amigos (portal → Partida privada → código). 2v2, 3v3 ou 4v4.
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1">
        {sala.lista.map((j, i) => (
          <li
            key={j.id}
            className="flex items-center gap-1.5 truncate rounded-lg bg-white/5 px-2 py-1 text-[12px]"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: i % 2 === 0 ? "#CE0E0E" : "#1e6bff" }}
            />
            <span className="truncate">{j.nome}</span>
            {j.id === sala.anfitriao && (
              <span className="ml-auto text-[9.5px] text-[#ffc83d]">anfitrião</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        {souAnfitriao && (
          <button
            type="button"
            disabled={!pronto}
            onClick={onComecar}
            className="h-9 flex-1 rounded-lg bg-[#CE0E0E] text-[12.5px] font-semibold disabled:opacity-40"
          >
            Começar ({n} jogadores)
          </button>
        )}
        <button
          type="button"
          onClick={onSair}
          className="h-9 flex-1 rounded-lg bg-white/10 text-[12.5px] font-semibold hover:bg-white/20"
        >
          Sair da sala
        </button>
      </div>
    </div>
  );
}
