import { Package, Pill, Wrench } from "lucide-react";
import type { DrogaCentral } from "@/lib/ilegal-data";
import { cn } from "@/lib/utils";

/** Cor de cada droga nos ícones da Central. */
export const COR_DROGA: Record<Exclude<DrogaCentral, "">, string> = {
  Cocaína: "#e5e7eb",
  Maconha: "#4ade80",
  Loló: "#38bdf8",
  Metanfetamina: "#22d3ee",
  Ecstasy: "#f472b6",
};
export const COR_DESMANCHE = "#fb923c";
export const COR_CONTRABANDO = "#facc15";

function Icone({ cor, titulo, children }: { cor: string; titulo: string; children: React.ReactNode }) {
  return (
    <span
      title={titulo}
      aria-label={titulo}
      className="grid size-[17px] shrink-0 place-items-center rounded-full"
      style={{ color: cor, background: `${cor}1f`, boxShadow: `inset 0 0 0 1px ${cor}40` }}
    >
      {children}
    </span>
  );
}

/** Produtos extras da Central em ícones pequenos (passe o mouse para ver o nome). */
export function ProdutosCentral({
  droga,
  desmanche,
  contrabando,
  className,
}: {
  droga: DrogaCentral;
  desmanche: boolean;
  contrabando: boolean;
  className?: string;
}) {
  if (!droga && !desmanche && !contrabando) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {droga && (
        <Icone cor={COR_DROGA[droga]} titulo={`Droga: ${droga}`}>
          <Pill className="size-[10px]" strokeWidth={2.2} />
        </Icone>
      )}
      {desmanche && (
        <Icone cor={COR_DESMANCHE} titulo="Desmanche">
          <Wrench className="size-[10px]" strokeWidth={2.2} />
        </Icone>
      )}
      {contrabando && (
        <Icone cor={COR_CONTRABANDO} titulo="Contrabando">
          <Package className="size-[10px]" strokeWidth={2.2} />
        </Icone>
      )}
    </span>
  );
}
