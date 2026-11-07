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
    <aside className="flex w-full flex-col gap-3 rounded-2xl glass p-4 lg:w-80 lg:shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Vagas livres</h2>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {total}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {modo === "ilegal"
            ? "Puxado do Ilegal em tempo real"
            : "Cadastro manual da aba Estabelecimentos"}
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={modo === "ilegal" ? "Buscar setagem ou local" : "Buscar estabelecimento"}
          className="w-full rounded-lg border border-border bg-black/25 py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFiltroCat("todas")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            filtroCat === "todas"
              ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Todas {total}
        </button>
        {contagemPorCat.map(([cat, n]) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFiltroCat(filtroCat === cat ? "todas" : cat)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              filtroCat === cat
                ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {cat} {n}
          </button>
        ))}
      </div>

      <div className="flex max-h-[520px] min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {modo === "ilegal" &&
          gruposIlegal.map(([cat, orgs]) => (
            <div key={cat}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{cat}</p>
                <p className="text-[11px] text-muted-foreground">{orgs.length} livres</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {orgs.map((org) => (
                  <div
                    key={org.id}
                    className="rounded-xl border border-border bg-black/25 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {org.setagem}
                      </p>
                      <button
                        type="button"
                        onClick={() => onCaptarIlegal(org)}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
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
              className="rounded-xl border border-border bg-black/25 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-foreground">{est.nome}</p>
                <button
                  type="button"
                  onClick={() => onCaptarLegal(est, categoria)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
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
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma vaga livre no momento.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
        <span>
          {total} {modo === "ilegal" ? "setagens livres" : "livres"} de {totalGeral}
        </span>
        {modo === "ilegal" ? (
          <Link
            to="/ilegal"
            className="flex items-center gap-1 font-semibold text-foreground hover:text-primary"
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
