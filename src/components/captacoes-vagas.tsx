import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Plus, Eye, Copy, Building2, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { fetchCategorias, type IlegalOrg } from "@/lib/ilegal-data";
import {
  fetchEstabCategorias,
  fetchEstabelecimentos,
  type Estabelecimento,
} from "@/lib/captacoes";
import { toast } from "sonner";

interface Props {
  modo: "ilegal" | "legal";
  onCaptarIlegal: (org: IlegalOrg) => void;
  onCaptarLegal: (est: Estabelecimento, categoria: string) => void;
}

/** Barra lateral "Vagas livres" — ILEGAL puxa do /ilegal em tempo real; LEGAL vem dos Estabelecimentos. */
export function CaptacoesVagas({ modo, onCaptarIlegal, onCaptarLegal }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState<string>("todas");

  const { data: categorias } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
    staleTime: 30_000,
  });
  const { data: estabCategorias } = useQuery({
    queryKey: ["captacoes-estab-categorias"],
    queryFn: fetchEstabCategorias,
    staleTime: 30_000,
  });
  const { data: estabelecimentos } = useQuery({
    queryKey: ["captacoes-estabelecimentos"],
    queryFn: fetchEstabelecimentos,
    staleTime: 30_000,
  });

  const livresIlegal = useMemo(() => {
    const out: { org: IlegalOrg; categoria: string }[] = [];
    for (const cat of categorias ?? []) {
      for (const org of cat.orgs) {
        if (org.status === "Livre") out.push({ org, categoria: cat.nome });
      }
    }
    return out;
  }, [categorias]);

  const livresLegal = useMemo(() => {
    const catNome = new Map((estabCategorias ?? []).map((c) => [c.id, c.nome]));
    return (estabelecimentos ?? [])
      .filter((e) => e.status === "livre")
      .map((e) => ({ est: e, categoria: catNome.get(e.categoriaId) ?? "Outros" }));
  }, [estabelecimentos, estabCategorias]);

  const total = modo === "ilegal" ? livresIlegal.length : livresLegal.length;
  const totalGeral =
    modo === "ilegal"
      ? (categorias ?? []).reduce((acc, c) => acc + c.orgs.length, 0)
      : (estabelecimentos ?? []).length;

  const contagemPorCat = useMemo(() => {
    const map = new Map<string, number>();
    if (modo === "ilegal") {
      for (const { categoria } of livresIlegal)
        map.set(categoria, (map.get(categoria) ?? 0) + 1);
    } else {
      for (const { categoria } of livresLegal)
        map.set(categoria, (map.get(categoria) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [livresIlegal, livresLegal, modo]);

  const q = busca.trim().toLowerCase();
  const filtradosIlegal = livresIlegal.filter(
    ({ org, categoria }) =>
      (filtroCat === "todas" || categoria === filtroCat) &&
      (!q ||
        org.setagem.toLowerCase().includes(q) ||
        org.local.toLowerCase().includes(q)),
  );
  const filtradosLegal = livresLegal.filter(
    ({ est, categoria }) =>
      (filtroCat === "todas" || categoria === filtroCat) &&
      (!q || est.nome.toLowerCase().includes(q)),
  );

  const gruposIlegal = useMemo(() => {
    const map = new Map<string, IlegalOrg[]>();
    for (const { org, categoria } of filtradosIlegal) {
      const arr = map.get(categoria) ?? [];
      arr.push(org);
      map.set(categoria, arr);
    }
    return [...map.entries()];
  }, [filtradosIlegal]);

  return (
    <aside className="glass hc flex w-full flex-col gap-3 p-5 lg:w-80 lg:shrink-0">
      <div>
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <MapPin className="size-4" strokeWidth={1.75} />
          </span>
          <h2 className="hc-titulo min-w-0 flex-1 truncate">Vagas livres</h2>
          <span className="hc-selo tabular-nums">{total}</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {modo === "ilegal"
            ? "Puxado do Ilegal em tempo real"
            : "Cadastro manual da aba Estabelecimentos"}
        </p>
      </div>

      <label className="campo-busca w-full">
        <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={modo === "ilegal" ? "Buscar setagem ou local" : "Buscar estabelecimento"}
          aria-label="Buscar vaga livre"
        />
      </label>

      {/* filtro por categoria: o escolhido vira uma tecla (branca no escuro) */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
        <button
          type="button"
          aria-pressed={filtroCat === "todas"}
          onClick={() => setFiltroCat("todas")}
          className={cn(
            "hc-selo",
            filtroCat === "todas"
              ? "!border-transparent !bg-foreground !font-semibold !text-background"
              : "hover:!text-foreground",
          )}
        >
          Todas <span className="tabular-nums opacity-60">{total}</span>
        </button>
        {contagemPorCat.map(([cat, n]) => (
          <button
            key={cat}
            type="button"
            aria-pressed={filtroCat === cat}
            onClick={() => setFiltroCat(filtroCat === cat ? "todas" : cat)}
            className={cn(
              "hc-selo",
              filtroCat === cat
                ? "!border-transparent !bg-foreground !font-semibold !text-background"
                : "hover:!text-foreground",
            )}
          >
            {cat} <span className="tabular-nums opacity-60">{n}</span>
          </button>
        ))}
      </div>

      <div className="flex max-h-[520px] min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {modo === "ilegal" &&
          gruposIlegal.map(([cat, orgs]) => (
            <div key={cat}>
              <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                <p className="hc-sobre truncate">{cat}</p>
                <p className="shrink-0 text-[11px] tabular-nums text-ink-3">{orgs.length} livres</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {orgs.map((org) => (
                  <div
                    key={org.id}
                    className="hc-dentro p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {org.setagem}
                      </p>
                      <button
                        type="button"
                        onClick={() => onCaptarIlegal(org)}
                        className="hc-pilula shrink-0"
                      >
                        <Plus className="size-3" /> Captar
                      </button>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{org.local || "—"}</span>
                      </span>
                      {org.cds ? (
                        <button
                          type="button"
                          title="Copiar CDS"
                          onClick={() => {
                            void navigator.clipboard.writeText(org.cds);
                            toast.success("CDS copiado");
                          }}
                          className="flex shrink-0 items-center gap-1 font-mono hover:text-foreground"
                        >
                          {org.cds.split(",").slice(0, 2).join(",")}
                          <Copy className="size-3" />
                        </button>
                      ) : (
                        <span className="shrink-0 italic">sem CDS</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {modo === "legal" &&
          filtradosLegal.map(({ est, categoria }) => (
            <div
              key={est.id}
              className="hc-dentro p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-foreground">{est.nome}</p>
                <button
                  type="button"
                  onClick={() => onCaptarLegal(est, categoria)}
                  className="hc-pilula shrink-0"
                >
                  <Plus className="size-3" /> Captar
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" /> {categoria}
                </span>
                {est.staff && <span className="truncate">{est.staff}</span>}
              </div>
            </div>
          ))}

        {total === 0 && (
          <p className="rounded-[14px] border border-dashed border-white/[0.1] px-4 py-6 text-center text-xs text-muted-foreground">
            Nenhuma vaga livre no momento.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11.5px] text-muted-foreground">
        <span>
          {total} {modo === "ilegal" ? "setagens livres" : "livres"} de {totalGeral}
        </span>
        {modo === "ilegal" ? (
          <Link
            to="/ilegal"
            className="hc-pilula shrink-0"
          >
            Abrir Ilegal <ArrowUpRight className="size-3" />
          </Link>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-foreground">
            Gerenciar <Eye className="size-3" />
          </span>
        )}
      </div>
    </aside>
  );
}
