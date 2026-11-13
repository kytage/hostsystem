import { useState, type MouseEvent, type ReactNode } from "react";
import { Check, Copy, Crown, Eye, Pencil, Plus, Scale, Skull, Trash2 } from "lucide-react";
import type { IlegalCategoria, IlegalOrg } from "@/lib/ilegal-data";
import { HORAS_MEDIA, serieDoPico, type SetagemOnlineResumo } from "@/lib/ilegal-online";
import { HEX_SERIE, HEX_SITUACAO, HEX_STATUS, hexDaCategoria } from "@/lib/ilegal-cores";
import { cn } from "@/lib/utils";

/**
 * Planilha do Ilegal no vidro da tela inicial: todas as setagens numa tabela
 * só, em letra pequena, com fios finos entre as células. Cada categoria abre
 * com uma faixa na cor dela. Todas as colunas aparecem sempre; em tela estreita
 * rola de lado.
 */
const celula = "border-r border-white/[0.045] px-2 py-[3px] align-middle last:border-r-0";
const vazio = <span className="text-foreground/20">—</span>;

/** Ponto colorido + texto: status e situação. */
function Marca({
  cor,
  children,
  apagado,
}: {
  cor: string;
  children: ReactNode;
  apagado?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", apagado && "opacity-55")}
    >
      <span
        className="size-[5px] shrink-0 rounded-full"
        style={{ background: cor, boxShadow: `0 0 7px ${cor}` }}
      />
      <span style={{ color: cor }}>{children}</span>
    </span>
  );
}

function Media({ info }: { info: SetagemOnlineResumo | undefined }) {
  if (!info) return vazio;
  const detalhes = HORAS_MEDIA.map(
    (h) => `${String(h).padStart(2, "0")}h: ${info.porHora[h] ?? "sem dado"}`,
  ).join("  ·  ");
  const pico = info.picoHora !== null ? ` (${String(info.picoHora).padStart(2, "0")}h)` : "";
  return (
    <span
      title={`${detalhes}\nMaior pico${pico}`}
      className="cursor-help font-medium tabular-nums text-foreground"
    >
      {info.pico}
    </span>
  );
}

function Cds({ cds }: { cds: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!cds) return vazio;
  const copiar = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cds).catch(() => undefined);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1200);
  };
  return (
    <button
      onClick={copiar}
      title={copiado ? "Copiado!" : `Copiar: ${cds}`}
      className="group/cds flex max-w-full items-center gap-1.5 rounded-md font-mono text-[10.5px] text-foreground/60 transition-colors hover:text-foreground"
    >
      {copiado ? (
        <Check className="size-3 shrink-0 text-success" />
      ) : (
        <Copy className="size-3 shrink-0 text-foreground/30 group-hover/cds:text-foreground" />
      )}
      <span className="truncate">{cds}</span>
    </button>
  );
}

function Acao({
  titulo,
  onClick,
  className,
  children,
}: {
  titulo: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      title={titulo}
      aria-label={titulo}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-[19px] place-items-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

const dia = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export interface IlegalPlanilhaProps {
  categorias: IlegalCategoria[];
  medias: Map<string, SetagemOnlineResumo>;
  coroas: Map<string, number>;
  canEdit: boolean;
  onAbrir: (org: IlegalOrg, cat: IlegalCategoria) => void;
  onEditar: (org: IlegalOrg, cat: IlegalCategoria) => void;
  onExcluir: (org: IlegalOrg) => void;
  onCoroas: (org: IlegalOrg) => void;
  onJuridico: (org: IlegalOrg) => void;
  onAdicionar: (cat: IlegalCategoria) => void;
}

const COLUNAS: { nome: string; largura: string; titulo?: string; centro?: boolean }[] = [
  { nome: "#", largura: "w-[34px]", centro: true },
  { nome: "Setagem", largura: "w-[112px]" },
  { nome: "Organização", largura: "w-[150px]" },
  { nome: "Status", largura: "w-[92px]" },
  { nome: "Situação", largura: "w-[86px]" },
  {
    nome: "Pico",
    largura: "w-[46px]",
    centro: true,
    titulo: "Maior pico de online entre 20h e 00h (passe o mouse para ver por horário)",
  },
  {
    nome: "Série",
    largura: "w-[44px]",
    centro: true,
    titulo: "Série das assumidas: A 10+, B 5–9, C 0–4 no pico",
  },
  { nome: "Local", largura: "w-[150px]" },
  { nome: "Grupo", largura: "w-[86px]" },
  { nome: "CDS", largura: "w-[150px]" },
  { nome: "Observação", largura: "min-w-[170px]" },
  { nome: "Limpa em", largura: "w-[88px]", titulo: "Última vez que a FAC foi limpa, e por quem" },
  {
    nome: "Coroas",
    largura: "w-[52px]",
    centro: true,
    titulo: "Contatos de RP da semana (segunda a domingo 23:59)",
  },
  { nome: "", largura: "w-[84px]" },
];

export function IlegalPlanilha(props: IlegalPlanilhaProps) {
  const { categorias, medias, coroas, canEdit } = props;
  const total = categorias.reduce((s, c) => s + c.orgs.length, 0);
  return (
    <section className="glass hc mt-3.5">
      <span aria-hidden className="pontilhado opacity-40" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <Skull className="size-4" strokeWidth={1.75} />
          </span>
          <h2 className="hc-titulo">Setagens</h2>
          <span className="hc-selo tabular-nums">{total}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
          <Marca cor={HEX_STATUS.Assumida}>Assumida</Marca>
          <Marca cor={HEX_STATUS.Reservada}>Reservada</Marca>
          <Marca cor={HEX_STATUS.Livre}>Livre</Marca>
          <Marca cor={HEX_STATUS.Fechado}>Fechado</Marca>
          <span className="h-3 w-px bg-foreground/10" />
          <Marca cor={HEX_SITUACAO.Entregue}>Entregue</Marca>
          <Marca cor={HEX_SITUACAO.Pendente}>Pendente</Marca>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[1320px] border-collapse text-left text-[11px] leading-tight">
          <thead>
            <tr className="border-y border-white/[0.06]">
              {COLUNAS.map((c) => (
                <th
                  key={c.nome || "acoes"}
                  title={c.titulo}
                  className={cn(
                    celula,
                    "py-[7px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3",
                    c.largura,
                    c.centro && "text-center",
                  )}
                >
                  {c.nome}
                </th>
              ))}
            </tr>
          </thead>
          {categorias.map((cat) => {
            const cor = hexDaCategoria(cat.id);
            return (
              <tbody key={cat.id}>
                {/* faixa da categoria: a cor dela vem do canto e some para a direita */}
                <tr className="border-b border-white/[0.06]">
                  <td
                    colSpan={COLUNAS.length}
                    className="px-4 py-[5px]"
                    style={{
                      background: `linear-gradient(90deg, ${cor}30, ${cor}0d 26%, transparent 58%)`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-[7px] rounded-full"
                        style={{ background: cor, boxShadow: `0 0 10px ${cor}` }}
                      />
                      <span className="text-[12px] font-medium text-foreground">{cat.nome}</span>
                      <span
                        className="font-display text-[12px] font-medium tabular-nums"
                        style={{ color: cor }}
                      >
                        {cat.orgs.length}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => props.onAdicionar(cat)}
                          className="hc-pilula ml-auto !h-[22px] !gap-1 !px-2 !text-[10.5px]"
                        >
                          <Plus className="size-3" /> Nova setagem
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {cat.orgs.map((o, i) => {
                  const info = medias.get(o.setagem);
                  const serie = o.status === "Assumida" ? serieDoPico(info?.pico) : null;
                  const apagada = o.status === "Fechado";
                  const limpa = dia(o.limpoEm);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => props.onAbrir(o, cat)}
                      title="Abrir painel da organização"
                      className="cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]"
                    >
                      <td
                        className={cn(celula, "text-center tabular-nums text-foreground/30")}
                        style={{ boxShadow: `inset 2px 0 0 ${cor}` }}
                      >
                        {i + 1}
                      </td>
                      <td className={cn(celula, "font-medium text-foreground", apagada && "opacity-55")}>
                        <span className="block truncate" title={o.setagem}>
                          {o.setagem || <span className="font-normal text-foreground/25">sem nome</span>}
                        </span>
                      </td>
                      <td className={cn(celula, "font-medium text-foreground", apagada && "opacity-55")}>
                        <span className="block truncate" title={o.organizacao}>
                          {o.organizacao || vazio}
                        </span>
                      </td>
                      <td className={celula}>
                        <Marca cor={HEX_STATUS[o.status]} apagado={apagada}>
                          {o.status}
                        </Marca>
                      </td>
                      <td className={celula}>
                        {o.situacao === "." ? (
                          vazio
                        ) : (
                          <Marca cor={HEX_SITUACAO[o.situacao]}>{o.situacao}</Marca>
                        )}
                      </td>
                      <td className={cn(celula, "text-center")}>
                        <Media info={info} />
                      </td>
                      <td className={cn(celula, "text-center")}>
                        {serie ? (
                          <span
                            className="inline-block min-w-[16px] rounded-full px-1 text-[10px] font-semibold leading-[15px]"
                            style={{ color: HEX_SERIE[serie], background: `${HEX_SERIE[serie]}22` }}
                          >
                            {serie}
                          </span>
                        ) : (
                          vazio
                        )}
                      </td>
                      <td className={cn(celula, "text-foreground/70")}>
                        <span className="block truncate" title={o.local}>
                          {o.local || vazio}
                        </span>
                      </td>
                      <td className={cn(celula, "font-mono text-[10.5px] text-foreground/55")}>
                        <span className="block truncate" title={o.grupo}>
                          {o.grupo || vazio}
                        </span>
                      </td>
                      <td className={celula}>
                        <Cds cds={o.cds} />
                      </td>
                      <td className={cn(celula, "text-violet-700 dark:text-violet-200/90")}>
                        <span className="line-clamp-2" title={o.observacao}>
                          {o.observacao || vazio}
                        </span>
                      </td>
                      <td className={cn(celula, "text-foreground/55")}>
                        {limpa ? (
                          <span
                            className="block truncate"
                            title={`Limpa em ${limpa} por ${o.limpoPor || "?"}`}
                          >
                            <span className="tabular-nums text-foreground/80">{limpa}</span>
                            {o.limpoPor && <span className="ml-1 text-foreground/40">{o.limpoPor}</span>}
                          </span>
                        ) : (
                          vazio
                        )}
                      </td>
                      <td className={cn(celula, "text-center")}>
                        <button
                          title="Coroas da semana"
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onCoroas(o);
                          }}
                          className="inline-flex items-center gap-1 rounded-full px-1 text-amber-700 transition-colors hover:bg-foreground/10 dark:text-amber-300/90"
                        >
                          <Crown className="size-3" />
                          <span className="font-medium tabular-nums">
                            {coroas.get(o.setagem) ?? 0}
                          </span>
                        </button>
                      </td>
                      <td className={cn(celula, "pr-2")}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Acao
                            titulo="Jurídico: denúncias desta setagem"
                            onClick={() => props.onJuridico(o)}
                          >
                            <Scale className="size-3" />
                          </Acao>
                          {canEdit ? (
                            <>
                              <Acao titulo="Editar" onClick={() => props.onEditar(o, cat)}>
                                <Pencil className="size-3" />
                              </Acao>
                              <Acao
                                titulo="Excluir setagem"
                                onClick={() => props.onExcluir(o)}
                                className="hover:!bg-destructive hover:!text-destructive-foreground"
                              >
                                <Trash2 className="size-3" />
                              </Acao>
                            </>
                          ) : (
                            <span title="Somente visualização" className="px-1">
                              <Eye className="size-3 text-foreground/25" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}
