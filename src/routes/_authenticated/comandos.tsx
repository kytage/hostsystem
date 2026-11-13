import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  Check,
  Copy,
  Gavel,
  History,
  Navigation,
  Package,
  PartyPopper,
  Search,
  Server,
  Terminal,
  Trophy,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { InventarioFundo } from "@/components/players/inventario-fundo";
import { useCan, useMyRole } from "@/lib/permissions";
import {
  adminPodeUsar,
  CATEGORIAS_COMANDO,
  COMANDOS_STAFF,
  textoParaCopiar,
  type CategoriaComando,
  type ComandoStaff,
} from "@/lib/comandos-staff";

export const Route = createFileRoute("/_authenticated/comandos")({
  head: () => ({
    meta: [
      { title: "Comandos Staffs — HOST" },
      {
        name: "description",
        content: "Todos os comandos de staff do servidor, prontos para copiar.",
      },
    ],
  }),
  component: ComandosPage,
});

const ICONES: Record<CategoriaComando, LucideIcon> = {
  jogador: UserRound,
  teleporte: Navigation,
  punicoes: Gavel,
  itens: Package,
  veiculos: Car,
  contas: Users,
  mundo: PartyPopper,
  painel: Trophy,
  servidor: Server,
  console: Terminal,
};
const NIVEIS = [1, 2, 3, 4, 5, 6, 7];
const CHAVE_RECENTES = "comandos-staff-recentes";

function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return;
  } catch {
    // sem permissão da área de transferência: cai no jeito antigo
  }
  const area = document.createElement("textarea");
  area.value = texto;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

/** Texto de busca de cada comando (nome, descrição, uso, quem pode e onde está). */
const indice = new Map(
  COMANDOS_STAFF.map((c) => [
    c,
    [c.nome, c.desc, c.uso, c.quem.join(" "), c.recurso].join(" ").toLowerCase(),
  ]),
);

function Quem({ q }: { q: string }) {
  const admin = /^Admin(?:\s*≤\s*(\d+))?$/.exec(q);
  const rotulo = admin ? (admin[1] ? `Admin ≤${admin[1]}` : "Admin") : q;
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-px text-[10px] font-medium leading-4",
        admin
          ? "bg-white/[0.06] text-white/70"
          : q === "Console / RCON"
            ? "bg-amber-400/10 text-amber-200/90"
            : q === "Conferir"
              ? "border border-dashed border-white/15 text-ink-3"
              : "bg-primary/[0.12] text-red-200/90",
      )}
    >
      {rotulo}
    </span>
  );
}

function ComandoTile({
  c,
  copiado,
  onCopiar,
}: {
  c: ComandoStaff;
  copiado: boolean;
  onCopiar: (c: ComandoStaff) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopiar(c)}
      title={`Copiar “${textoParaCopiar(c)}”`}
      className={cn(
        "cmd-tile group relative flex min-w-0 flex-col rounded-xl border px-3.5 py-3 text-left backdrop-blur-md transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px",
        copiado
          ? "border-emerald-400/50 bg-emerald-400/[0.06]"
          : "border-white/[0.07] bg-black/40 hover:border-primary/40 hover:bg-white/[0.035]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 truncate font-mono text-[13.5px] font-semibold tracking-tight text-foreground">
          {!c.console && <span className="text-white/25">/</span>}
          {c.nome}
        </code>
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1 text-[10.5px] transition-opacity",
            copiado
              ? "text-emerald-300 opacity-100"
              : "text-ink-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </span>
      </span>
      {c.desc && (
        <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
          {c.desc}
        </span>
      )}
      {c.uso && (
        <span className="mt-2 block truncate rounded-md border border-white/[0.05] bg-black/50 px-2 py-1 font-mono text-[10.5px] text-ink-3">
          {c.uso}
        </span>
      )}
      <span className="mt-2.5 flex flex-wrap gap-1">
        {c.quem.map((q) => (
          <Quem key={q} q={q} />
        ))}
      </span>
    </button>
  );
}

function ComandosPage() {
  const can = useCan();
  const { data: role } = useMyRole();
  const podeVer = can("comandos");
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState<CategoriaComando | "todas">("todas");
  const [nivel, setNivel] = useState<number | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<string[]>([]);
  const buscaRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setRecentes(lerRecentes()), []);

  // "/" leva para a busca; Esc limpa
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        buscaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const filtrados = useMemo(() => {
    const termos = busca.trim().toLowerCase().replace(/^\//, "").split(/\s+/).filter(Boolean);
    return COMANDOS_STAFF.filter((c) => {
      if (cat !== "todas" && c.cat !== cat) return false;
      if (nivel !== null && !adminPodeUsar(c, nivel)) return false;
      if (termos.length === 0) return true;
      const texto = indice.get(c) ?? "";
      return termos.every((t) => texto.includes(t));
    }).sort((a, b) => {
      // com busca: quem começa com o termo vem primeiro
      const t = termos[0];
      if (!t) return 0;
      return (
        Number(b.nome.toLowerCase().startsWith(t)) - Number(a.nome.toLowerCase().startsWith(t))
      );
    });
  }, [busca, cat, nivel]);

  const porCategoria = useMemo(
    () =>
      CATEGORIAS_COMANDO.map((k) => ({
        ...k,
        lista: filtrados.filter((c) => c.cat === k.key),
      })).filter((k) => k.lista.length > 0),
    [filtrados],
  );
  const contagem = useMemo(() => {
    const m = new Map<CategoriaComando, number>();
    for (const c of COMANDOS_STAFF) {
      if (nivel !== null && !adminPodeUsar(c, nivel)) continue;
      m.set(c.cat, (m.get(c.cat) ?? 0) + 1);
    }
    return m;
  }, [nivel]);

  const copiar = (c: ComandoStaff) => {
    const texto = textoParaCopiar(c);
    void copiarTexto(texto).then(() => {
      toast.success(`${texto} copiado`, { duration: 1600 });
      setUltimo(c.nome);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setUltimo(null), 1500);
      setRecentes((r) => {
        const novos = [c.nome, ...r.filter((n) => n !== c.nome)].slice(0, 8);
        try {
          localStorage.setItem(CHAVE_RECENTES, JSON.stringify(novos));
        } catch {
          // sem armazenamento: os recentes valem só nesta visita
        }
        return novos;
      });
    });
  };

  if (role && !podeVer) {
    return (
      <div className="pagina">
        <PageHeader kicker="OPERAÇÃO" title="Comandos Staffs" />
        <p className="glass-inset mt-6 rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
          Você não tem acesso a esta área. Peça liberação da categoria “Comandos Staffs” a um
          Founder.
        </p>
      </div>
    );
  }

  const chip = (on: boolean) =>
    cn(
      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors",
      on
        ? "bg-white text-black"
        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
    );

  return (
    <div className="pagina relative isolate">
      {/* fundo totalmente preto com a malha de holograma que segue o mouse */}
      <div aria-hidden className="comandos-fundo pointer-events-none absolute inset-0 -z-10">
        <div className="sticky top-0 h-[100dvh] overflow-hidden">
          <InventarioFundo />
        </div>
      </div>

      <PageHeader
        kicker="OPERAÇÃO"
        title="Comandos Staffs"
        subtitle={`${COMANDOS_STAFF.length} comandos do servidor. Clique para copiar: vai sem a barra, pronto para colar.`}
      />

      {/* busca e filtros */}
      <div className="sticky top-3 z-20 mt-5 rounded-2xl border border-white/[0.08] bg-black/75 p-2 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <label className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5">
          <Search className="size-4 shrink-0 text-ink-3" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtrados[0]) copiar(filtrados[0]);
              if (e.key === "Escape") setBusca("");
            }}
            placeholder="Buscar comando, uso ou quem pode…  (Enter copia o primeiro)"
            aria-label="Buscar comando"
            className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="text-ink-3 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3">
              /
            </kbd>
          )}
        </label>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <button type="button" className={chip(cat === "todas")} onClick={() => setCat("todas")}>
            Todos{" "}
            <span className="opacity-60">{[...contagem.values()].reduce((s, n) => s + n, 0)}</span>
          </button>
          {CATEGORIAS_COMANDO.map((k) => {
            const n = contagem.get(k.key) ?? 0;
            if (n === 0) return null;
            const Icone = ICONES[k.key];
            return (
              <button
                key={k.key}
                type="button"
                className={chip(cat === k.key)}
                onClick={() => setCat(k.key)}
              >
                <Icone className="size-3.5" strokeWidth={1.8} /> {k.label}{" "}
                <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1">
          <span className="mr-1 text-[11px] text-ink-3">Meu nível de Admin</span>
          <button type="button" className={chip(nivel === null)} onClick={() => setNivel(null)}>
            Todos
          </button>
          {NIVEIS.map((n) => (
            <button
              key={n}
              type="button"
              className={cn(chip(nivel === n), "w-8 justify-center !px-0")}
              onClick={() => setNivel(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {recentes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1.5 text-[11px] text-ink-3">
            <History className="size-3.5" /> Recentes
          </span>
          {recentes.map((nome) => {
            const c = COMANDOS_STAFF.find((x) => x.nome === nome);
            if (!c) return null;
            return (
              <button
                key={nome}
                type="button"
                onClick={() => copiar(c)}
                className="rounded-full border border-white/[0.08] bg-black/40 px-2.5 py-1 font-mono text-[11.5px] text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {c.nome}
              </button>
            );
          })}
        </div>
      )}

      {porCategoria.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-white/[0.06] bg-black/40 px-4 py-14 text-center text-sm text-muted-foreground backdrop-blur-md">
          Nenhum comando encontrado.
        </p>
      ) : (
        porCategoria.map((k) => {
          const Icone = ICONES[k.key];
          return (
            <section key={k.key} className="mt-8">
              <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-0.5">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
                  <span className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Icone className="size-3.5 text-primary" strokeWidth={1.8} />
                  </span>
                  {k.label}
                </h2>
                <span className="text-[11px] tabular-nums text-ink-3">{k.lista.length}</span>
                <span className="text-[11.5px] text-muted-foreground">{k.desc}</span>
              </header>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {k.lista.map((c) => (
                  <ComandoTile key={c.nome} c={c} copiado={ultimo === c.nome} onCopiar={copiar} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <p className="mt-10 px-0.5 text-[11px] leading-relaxed text-ink-3">
        “Admin ≤N” = cargo Admin até o nível N (1 = C-Level … 7 = Casting). “Conferir” = registrado
        sem checagem de permissão visível no código. Os comandos de console rodam só pelo console do
        servidor (RCON).
      </p>
    </div>
  );
}
