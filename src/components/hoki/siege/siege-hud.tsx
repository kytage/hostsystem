import { useEffect, useState } from "react";
import {
  Crosshair,
  Droplets,
  FlaskConical,
  Heart,
  LogOut,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Wand2,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KITS, KITS_INFO, SIEGE, type Kit, type Time } from "@/lib/siege/config";
import { slotsDoKit, type EstadoSiege } from "./siege-mundo";

const COR: Record<Time, string> = { vermelho: "#CE0E0E", azul: "#1e6bff" };
const NOME_TIME: Record<Time, string> = { vermelho: "Vermelho", azul: "Azul" };
const ICONES: Record<Kit, [LucideIcon, LucideIcon, LucideIcon]> = {
  vanguarda: [Sword, Shield, Zap],
  atirador: [Crosshair, Sparkles, Wind],
  alquimista: [Wand2, Heart, Shield],
  batedor: [Swords, Zap, Droplets],
};
const relogio = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Barra de vida de um Guardião (topo). */
function BarraGuardiao({ time, hp, exposto }: { time: Time; hp: number; exposto: number }) {
  const k = Math.max(0, hp / SIEGE.HP_GUARDIAO);
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1", time === "azul" && "items-end")}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/85">
        {time === "vermelho" && (
          <span className="size-2 rounded-full" style={{ background: COR[time] }} />
        )}
        Guardião {NOME_TIME[time]}
        <span className="tabular-nums text-white/60">{Math.ceil(hp)}</span>
        {exposto > 0 ? (
          <span className="rounded bg-[#ffc83d] px-1 text-[9.5px] font-extrabold text-black">
            EXPOSTO {Math.ceil(exposto)}s
          </span>
        ) : (
          <Shield className="size-3 text-white/60" />
        )}
        {time === "azul" && (
          <span className="size-2 rounded-full" style={{ background: COR[time] }} />
        )}
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            time === "azul" && "ml-auto",
          )}
          style={{
            width: `${k * 100}%`,
            background: COR[time],
            boxShadow: exposto > 0 ? `0 0 10px ${COR[time]}` : undefined,
          }}
        />
      </div>
    </div>
  );
}

function TextoForja({ e }: { e: EstadoSiege }) {
  const f = e.forja;
  if (f.estado === "janela" && f.time)
    return (
      <span style={{ color: COR[f.time] }}>
        Janela {NOME_TIME[f.time]} · {Math.ceil(f.restante)}s
      </span>
    );
  if (f.estado === "recarga")
    return <span className="text-white/50">Forja recarregando · {Math.ceil(f.restante)}s</span>;
  if (f.contestada) return <span className="text-[#ffc83d]">Forja contestada</span>;
  if (f.time && f.progresso > 0)
    return (
      <span style={{ color: COR[f.time] }}>
        Capturando {Math.round((f.progresso / SIEGE.FORJA_CAPTURA_S) * 100)}%
      </span>
    );
  return <span className="text-white/70">Forja livre</span>;
}

export function SiegeHud({
  e,
  onKit,
  onSair,
}: {
  e: EstadoSiege;
  onKit: (k: Kit) => void;
  onSair: () => void;
}) {
  const [placar, setPlacar] = useState(false);
  useEffect(() => {
    const baixa = (ev: KeyboardEvent) => {
      if (ev.code === "Tab") {
        ev.preventDefault();
        setPlacar(true);
      }
    };
    const sobe = (ev: KeyboardEvent) => ev.code === "Tab" && setPlacar(false);
    window.addEventListener("keydown", baixa);
    window.addEventListener("keyup", sobe);
    return () => {
      window.removeEventListener("keydown", baixa);
      window.removeEventListener("keyup", sobe);
    };
  }, []);
  const eu = e.eu;
  const kit = eu?.kit ?? null;
  const slots = slotsDoKit(kit);
  const icones = kit ? ICONES[kit] : [Sword, Sparkles, Zap];
  const fase =
    e.fase === "preparacao"
      ? "Preparação"
      : e.fase === "prorrogacao"
        ? "Prorrogação"
        : e.fase === "resultado"
          ? "Fim"
          : "";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 text-white">
      {/* topo: Guardiões, relógio e Forja */}
      <div className="absolute left-1/2 top-3 flex w-[min(640px,calc(100%-7rem))] -translate-x-1/2 items-start gap-3 rounded-2xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
        <BarraGuardiao
          time="vermelho"
          hp={e.guardioes.vermelho.hp}
          exposto={e.guardioes.vermelho.exposto}
        />
        <div className="flex shrink-0 flex-col items-center px-1">
          <span className="font-mono text-[18px] font-bold leading-none tabular-nums">
            {relogio(e.restante)}
          </span>
          {fase && (
            <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#ffc83d]">
              {fase}
            </span>
          )}
          <span className="mt-1 text-[10.5px] font-semibold">
            <TextoForja e={e} />
          </span>
          <span className="mt-0.5 text-[10px] tabular-nums text-white/60">
            <span style={{ color: COR.vermelho }}>{e.pontos.vermelho}</span> ×{" "}
            <span style={{ color: COR.azul }}>{e.pontos.azul}</span> pontos
          </span>
        </div>
        <BarraGuardiao time="azul" hp={e.guardioes.azul.hp} exposto={e.guardioes.azul.exposto} />
      </div>

      {/* sair (no treino e na partida privada) */}
      <button
        type="button"
        onClick={onSair}
        className="pointer-events-auto absolute right-3 top-3 flex h-8 items-center gap-1.5 rounded-lg border border-white/12 bg-black/70 px-2.5 text-[11.5px] font-semibold text-white/85 backdrop-blur-md hover:text-white"
      >
        <LogOut className="size-3.5" /> Sair
      </button>

      {/* alerta */}
      {e.alerta && (
        <div
          className="pf-pop absolute left-1/2 top-[92px] -translate-x-1/2 rounded-xl px-4 py-1.5 text-[13px] font-bold shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          style={{
            background: e.alerta.cor === "amarelo" ? "#ffc83d" : COR[e.alerta.cor],
            color: e.alerta.cor === "amarelo" ? "#000" : "#fff",
          }}
        >
          {e.alerta.texto}
        </div>
      )}

      {/* vida e escudo, e a barra 1 a 5 no centro de baixo */}
      {eu && e.fase !== "resultado" && (
        <div className="absolute bottom-[4.25rem] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {eu.pertoDePocao && eu.pocao < 1 && (
            <span className="rounded-full bg-black/75 px-2.5 py-0.5 text-[11px]">
              <kbd className="rounded bg-white px-1 font-bold text-black">E</kbd> pegar poção
            </span>
          )}
          <div className="relative h-3 w-[260px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#e53941] to-[#ff6a6f] transition-[width] duration-200"
              style={{ width: `${eu.hp}%` }}
            />
            {eu.escudo > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#9fd8ff]/80"
                style={{ width: `${Math.min(100, eu.escudo)}%` }}
              />
            )}
            <span className="absolute inset-0 grid place-items-center text-[9.5px] font-bold">
              {Math.ceil(eu.hp)} HP{eu.escudo > 0 ? ` + ${Math.ceil(eu.escudo)}` : ""}
              {eu.protegido ? " · protegido" : ""}
            </span>
          </div>
          <div className="flex gap-1.5">
            {slots.map((sl, i) => {
              const recarga = sl.tecla <= 3 ? eu.recarga[sl.tecla as 1 | 2 | 3] : 0;
              const Icone = i < 3 ? icones[i]! : i === 3 ? FlaskConical : null;
              const vazio = (sl.tecla === 4 && eu.pocao < 1) || sl.tecla === 5;
              return (
                <div
                  key={sl.tecla}
                  title={sl.nome}
                  className={cn(
                    "relative grid size-12 place-items-center rounded-xl border bg-black/75 backdrop-blur-md",
                    sl.tecla === 1
                      ? "border-[#ffc83d] shadow-[0_0_10px_rgba(255,200,61,0.35)]"
                      : "border-white/12",
                    vazio && "opacity-45",
                  )}
                >
                  {Icone && <Icone className="size-5" strokeWidth={1.8} />}
                  <span className="absolute left-1 top-0.5 text-[9.5px] font-bold text-white/60">
                    {sl.tecla}
                  </span>
                  {sl.tecla === 4 && (
                    <span className="absolute bottom-0.5 right-1 text-[9.5px] font-bold">
                      {eu.pocao}
                    </span>
                  )}
                  {recarga > 0.05 && sl.tecla > 1 && (
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/65 text-[13px] font-bold tabular-nums">
                      {Math.ceil(recarga)}
                    </span>
                  )}
                  {sl.tecla === 4 && eu.bebendo > 0 && (
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-[#ff3b6b]/40 text-[10px] font-bold">
                      bebendo
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* preparação: escolher o kit */}
      {eu && e.fase === "preparacao" && (
        <div className="pointer-events-auto absolute left-1/2 top-[112px] w-[min(720px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-white/12 bg-black/80 p-3 backdrop-blur-xl">
          <p className="mb-2 text-center text-[13px] font-semibold">
            Escolha o seu kit · os portões abrem em{" "}
            <span className="text-[#ffc83d]">{Math.ceil(e.restante)} s</span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KITS.map((k) => {
              const info = KITS_INFO[k];
              const meu = eu.kit === k;
              const livre = e.kitsLivres.includes(k) || meu;
              const [I] = ICONES[k];
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!livre}
                  onClick={() => onKit(k)}
                  className={cn(
                    "rounded-xl border p-2 text-left transition-colors disabled:opacity-35",
                    meu
                      ? "border-[#ffc83d] bg-[#ffc83d]/15"
                      : "border-white/10 bg-white/5 hover:bg-white/10",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <I className="size-4" /> {info.nome}
                  </span>
                  <span className="mt-1 block text-[10.5px] leading-snug text-white/65">
                    1 {info.arma.nome} · 2 {info.hab2.nome} · 3 {info.hab3.nome}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10.5px] text-white/55">
            Clique esquerdo ataca · 2 e 3 habilidades · 4 poção · E pega poção no pedestal · Tab
            placar · capture a Forja no meio para expor o Guardião inimigo
          </p>
        </div>
      )}

      {/* morto: contagem e troca de kit */}
      {eu?.morto && e.fase !== "resultado" && (
        <div className="pointer-events-auto absolute left-1/2 top-1/3 w-[min(420px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-white/12 bg-black/80 p-3 text-center backdrop-blur-xl">
          <p className="text-[15px] font-bold">Você volta em {Math.ceil(eu.renasce)} s</p>
          <p className="mt-1 text-[11px] text-white/60">Trocar de kit (vale ao voltar):</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {KITS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={!e.kitsLivres.includes(k) && eu.kit !== k}
                onClick={() => onKit(k)}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[11.5px] disabled:opacity-35",
                  (eu.kitPedido ?? eu.kit) === k
                    ? "border-[#ffc83d] bg-[#ffc83d]/15"
                    : "border-white/12 bg-white/5",
                )}
              >
                {KITS_INFO[k].nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* placar (Tab) e resultado */}
      {(placar || e.fase === "resultado") && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(560px,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-black/85 p-4 backdrop-blur-xl">
          {e.resultado && (
            <div className="mb-3 text-center">
              <p
                className="text-[22px] font-extrabold"
                style={{
                  color: e.resultado.vencedor === "empate" ? "#ffc83d" : COR[e.resultado.vencedor],
                }}
              >
                {e.resultado.vencedor === "empate"
                  ? "Empate"
                  : `Vitória do time ${NOME_TIME[e.resultado.vencedor]}`}
              </p>
              <p className="text-[11.5px] text-white/60">
                {e.resultado.motivo} · Guardiões: {Math.ceil(e.guardioes.vermelho.hp)} ×{" "}
                {Math.ceil(e.guardioes.azul.hp)} HP
              </p>
            </div>
          )}
          <table className="w-full text-[11.5px]">
            <thead className="text-white/50">
              <tr>
                <th className="text-left font-semibold">Jogador</th>
                <th className="font-semibold">Elim.</th>
                <th className="font-semibold">Assist.</th>
                <th className="font-semibold">Dano no Guardião</th>
                <th className="font-semibold">Capturas</th>
              </tr>
            </thead>
            <tbody>
              {e.jogadores
                .filter((j) => !j.bot)
                .map((j) => (
                  <tr key={j.id} className="border-t border-white/5">
                    <td className="py-1">
                      <span
                        className="mr-1.5 inline-block size-2 rounded-full"
                        style={{ background: COR[j.time] }}
                      />
                      {j.nome}{" "}
                      <span className="text-white/45">{j.kit ? KITS_INFO[j.kit].nome : ""}</span>
                    </td>
                    <td className="text-center tabular-nums">{j.stats.eliminacoes}</td>
                    <td className="text-center tabular-nums">{j.stats.assistencias}</td>
                    <td className="text-center tabular-nums">{Math.round(j.stats.danoGuardiao)}</td>
                    <td className="text-center tabular-nums">{j.stats.capturas}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-2 text-center text-[11px] text-white/55">
            Pontos: <span style={{ color: COR.vermelho }}>{e.pontos.vermelho}</span> ×{" "}
            <span style={{ color: COR.azul }}>{e.pontos.azul}</span>
          </p>
          {e.fase === "resultado" && (
            <button
              type="button"
              onClick={onSair}
              className="mx-auto mt-3 flex h-10 items-center rounded-xl bg-[#CE0E0E] px-5 text-[13px] font-semibold text-white hover:brightness-110"
            >
              Voltar ao lobby
            </button>
          )}
        </div>
      )}
    </div>
  );
}
