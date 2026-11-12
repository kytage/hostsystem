import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Loader2, Minus, Plus, Store, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HokiPet } from "@/lib/hoki";
import { item, ITENS, quantosCabem, type Item } from "@/lib/hoki-itens";
import {
  anunciar,
  anunciosAbertos,
  comprar,
  ComercioFechado,
  MAX_ANUNCIOS,
  MAX_PRECO,
  MAX_QTD,
  meusAnuncios,
  pessoasDoComercio,
  retirar,
  type Anuncio,
  type Saldos,
} from "@/lib/hoki-comercio";
import { enviarNaPraca } from "@/lib/hoki-presenca";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import { Hoki2D } from "./hoki-2d";
import { Saldo } from "./guarda-roupa";

type Aba = "comprar" | "vender" | "meus";
type Filtro = "tudo" | Item["tipo"];
const FILTROS: { id: Filtro; nome: string }[] = [
  { id: "tudo", nome: "Tudo" },
  { id: "comida", nome: "Comidas" },
  { id: "bebida", nome: "Bebidas" },
  { id: "presente", nome: "Presentes" },
];
const CHAVE = ["hoki-comercio"] as const;
/** Sugestão de preço por unidade (o vendedor pode mudar): quanto o item enche as barras. */
const sugestao = (i: Item) =>
  Math.max(
    1,
    Math.round(((i.fome ?? 0) + (i.sede ?? 0) + (i.energia ?? 0) + (i.carinho ?? 0)) / 10),
  );
const nomeDoItem = (id: string) => item(id)?.nome ?? "item desconhecido";
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Comércio HOST: a barraca de feira do lobby. Quem vende anuncia itens da mochila
 * (comida da HOST FAZENDAS, flores, doces...) por Staff Coins; quem compra paga e
 * recebe na mochila. As moedas passam de um para o outro: ninguém cria moeda nova.
 */
export function Comercio({
  pet,
  eu,
  onClose,
}: {
  pet: HokiPet;
  eu: { id: string; nome: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  useRealtimeTable("hoki_comercio", [[...CHAVE]]);
  const [aba, setAba] = useState<Aba>("comprar");
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const abertos = useQuery({
    queryKey: [...CHAVE, "abertos"],
    queryFn: anunciosAbertos,
    staleTime: 10_000,
    retry: (n, e) => !(e instanceof ComercioFechado) && n < 2,
  });
  const meus = useQuery({
    queryKey: [...CHAVE, "meus", eu.id],
    queryFn: () => meusAnuncios(eu.id),
    staleTime: 10_000,
    retry: (n, e) => !(e instanceof ComercioFechado) && n < 2,
  });
  const ids = useMemo(
    () =>
      [
        ...(abertos.data ?? []).map((a) => a.vendedor),
        ...(meus.data ?? []).flatMap((a) => (a.comprador ? [a.comprador] : [])),
      ].sort(),
    [abertos.data, meus.data],
  );
  const { data: pessoas = {} } = useQuery({
    queryKey: ["hoki-comercio-pessoas", [...new Set(ids)].join(",")],
    queryFn: () => pessoasDoComercio(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  const fechadoAinda =
    abertos.error instanceof ComercioFechado || meus.error instanceof ComercioFechado;

  /** Atualiza na hora a mochila e o saldo do HOKI com o que o banco devolveu. */
  const aplicar = (s: Saldos) => {
    qc.setQueryData<HokiPet>(["hoki-meu"], (p) =>
      p ? { ...p, inventario: s.inventario, coins: s.coins } : p,
    );
    void qc.invalidateQueries({ queryKey: [...CHAVE] });
  };
  const falhou = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Não deu certo agora. Tente de novo.");

  const comprarAnuncio = async (a: Anuncio) => {
    if (ocupado) return;
    const it = item(a.item);
    setOcupado(a.id);
    try {
      const r = await comprar(a.id);
      aplicar(r);
      playSfx("complete");
      toast.success(`Você comprou ${r.quantidade} ${it?.emoji ?? ""} ${nomeDoItem(r.item)}.`, {
        description: `−${r.preco} Staff Coins. Já está na sua mochila.`,
      });
      // quem vendeu recebe o aviso na hora (onde estiver no painel)
      enviarNaPraca("comercio", {
        de: eu.id,
        para: r.vendedor,
        nome: eu.nome,
        item: r.item,
        n: r.quantidade,
        preco: r.preco,
      });
    } catch (e) {
      falhou(e);
      void qc.invalidateQueries({ queryKey: [...CHAVE] });
    } finally {
      setOcupado(null);
    }
  };
  const retirarAnuncio = async (a: Anuncio) => {
    if (ocupado) return;
    setOcupado(a.id);
    try {
      aplicar(await retirar(a.id));
      playSfx("remove");
      toast.success(
        `Anúncio retirado: ${a.quantidade} ${nomeDoItem(a.item)} ${a.quantidade === 1 ? "voltou" : "voltaram"} para a mochila.`,
      );
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(null);
    }
  };
  const anunciarItem = async (id: string, qtd: number, preco: number) => {
    if (ocupado) return false;
    setOcupado("anunciar");
    try {
      aplicar(await anunciar(id, qtd, preco));
      playSfx("success");
      toast.success(`Anúncio criado: ${qtd} ${nomeDoItem(id)} por ${preco} Staff Coins.`, {
        description: "Quando alguém comprar, as moedas caem na sua conta e você recebe um aviso.",
      });
      return true;
    } catch (e) {
      falhou(e);
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const deOutros = (abertos.data ?? []).filter(
    (a) => a.vendedor !== eu.id && (filtro === "tudo" || item(a.item)?.tipo === filtro),
  );
  const meusAbertos = (meus.data ?? []).filter((a) => !a.vendido_em && !a.cancelado_em);
  const meusFechados = (meus.data ?? []).filter((a) => a.vendido_em || a.cancelado_em);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comércio HOST"
      className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className="pf-pop flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/85 text-white shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
          <span className="icone-quadro size-10 shrink-0">
            <Store className="size-[18px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Feira do lobby
            </p>
            <h3 className="font-display text-xl font-semibold leading-tight">Comércio HOST</h3>
            <p className="text-[11.5px] text-white/55">
              Venda o que está na mochila e compre dos outros com Staff Coins.
            </p>
          </div>
          <Saldo coins={pet.coins} className="mt-1 shrink-0" />
          <button
            onClick={onClose}
            aria-label="Fechar o Comércio"
            className="grid size-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <div className="segmentos" role="tablist" aria-label="O que fazer no Comércio">
            {(
              [
                ["comprar", "Comprar"],
                ["vender", "Vender"],
                ["meus", `Meus anúncios${meusAbertos.length ? ` (${meusAbertos.length})` : ""}`],
              ] as [Aba, string][]
            ).map(([id, nome]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                data-sem-elastico
              >
                {nome}
              </button>
            ))}
          </div>
          {aba === "comprar" && (
            <div className="flex flex-wrap gap-1">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filtro === f.id
                      ? "bg-white text-black"
                      : "bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white",
                  )}
                >
                  {f.nome}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
          {fechadoAinda ? (
            <Vazio
              titulo="A barraca está sendo montada"
              texto="O Comércio abre assim que a instalação terminar. Volte daqui a pouco."
            />
          ) : aba === "comprar" ? (
            abertos.isLoading ? (
              <Carregando />
            ) : deOutros.length === 0 ? (
              <Vazio
                titulo="Nada à venda agora"
                texto="Quando alguém anunciar um item, ele aparece aqui. Que tal ser o primeiro a vender?"
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {deOutros.map((a) => {
                  const it = item(a.item);
                  const quem = pessoas[a.vendedor];
                  const semSaldo = pet.coins < a.preco;
                  const semEspaco = !!it && quantosCabem(pet.inventario, a.item) < a.quantidade;
                  return (
                    <li
                      key={a.id}
                      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="icone-quadro size-11 shrink-0 text-[24px] leading-none">
                          {it?.emoji ?? "📦"}
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="truncate text-[13px] font-semibold">
                            {nomeDoItem(a.item)}{" "}
                            <span className="font-normal text-white/55">× {a.quantidade}</span>
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-white/55">
                            {quem && (
                              <span className="block size-4 shrink-0 overflow-hidden rounded-full bg-black/50">
                                <Hoki2D visual={quem.visual} busto />
                              </span>
                            )}
                            {quem?.nome ?? "alguém"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right leading-tight">
                          <p className="flex items-center justify-end gap-1 text-[13px] font-bold tabular-nums text-amber-200">
                            <Coins className="size-3.5" /> {a.preco}
                          </p>
                          {a.quantidade > 1 && (
                            <p className="text-[10px] text-white/45">
                              {(a.preco / a.quantidade).toLocaleString("pt-BR", {
                                maximumFractionDigits: 1,
                              })}{" "}
                              cada
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!!ocupado || semSaldo || semEspaco}
                        onClick={() => void comprarAnuncio(a)}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-white text-[12px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ocupado === a.id && <Loader2 className="size-3.5 animate-spin" />}
                        {semSaldo
                          ? "Saldo insuficiente"
                          : semEspaco
                            ? "Mochila sem espaço"
                            : "Comprar"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : aba === "vender" ? (
            <Vender
              pet={pet}
              abertos={meusAbertos.length}
              ocupado={ocupado === "anunciar"}
              onAnunciar={anunciarItem}
            />
          ) : meus.isLoading ? (
            <Carregando />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/45">
                  À venda agora ({meusAbertos.length} de {MAX_ANUNCIOS})
                </p>
                {meusAbertos.length === 0 ? (
                  <p className="text-[12px] text-white/50">
                    Nenhum anúncio aberto. Abra a aba Vender para anunciar algo da mochila.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {meusAbertos.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[12px]"
                      >
                        <span className="text-[20px] leading-none">
                          {item(a.item)?.emoji ?? "📦"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <b className="font-semibold">{nomeDoItem(a.item)}</b> × {a.quantidade}
                          <span className="text-white/45"> · desde {quando(a.criado_em)}</span>
                        </span>
                        <span className="flex items-center gap-1 font-bold tabular-nums text-amber-200">
                          <Coins className="size-3.5" /> {a.preco}
                        </span>
                        <button
                          type="button"
                          disabled={!!ocupado}
                          onClick={() => void retirarAnuncio(a)}
                          className="flex h-7 items-center gap-1 rounded-full border border-white/15 px-2.5 text-[11px] hover:bg-white/10 disabled:opacity-40"
                        >
                          {ocupado === a.id && <Loader2 className="size-3 animate-spin" />}
                          Retirar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/45">
                  Histórico
                </p>
                {meusFechados.length === 0 ? (
                  <p className="text-[12px] text-white/50">Nenhuma venda ainda.</p>
                ) : (
                  <ul className="space-y-1">
                    {meusFechados.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 border-t border-white/[0.06] py-1.5 text-[11.5px] first:border-0"
                      >
                        <span className="text-[16px] leading-none">
                          {item(a.item)?.emoji ?? "📦"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-white/80">
                          {a.quantidade} {nomeDoItem(a.item)}{" "}
                          {a.vendido_em ? (
                            <>
                              vendido para{" "}
                              <b className="font-semibold text-white">
                                {(a.comprador && pessoas[a.comprador]?.nome) || "alguém"}
                              </b>
                            </>
                          ) : (
                            <span className="text-white/45">retirado</span>
                          )}
                        </span>
                        {a.vendido_em && (
                          <span className="flex items-center gap-1 font-semibold tabular-nums text-emerald-300">
                            +{a.preco} <Coins className="size-3" />
                          </span>
                        )}
                        <span className="text-[10.5px] text-white/40">
                          {quando(a.vendido_em ?? a.cancelado_em ?? a.criado_em)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Anunciar: escolher o item da mochila, quantos e o preço do lote. */
function Vender({
  pet,
  abertos,
  ocupado,
  onAnunciar,
}: {
  pet: HokiPet;
  abertos: number;
  ocupado: boolean;
  onAnunciar: (id: string, qtd: number, preco: number) => Promise<boolean>;
}) {
  const meus = ITENS.filter((i) => (pet.inventario[i.id] ?? 0) >= 1);
  const [id, setId] = useState(meus[0]?.id ?? "");
  const escolhido = item(id);
  const tenho = Math.floor(pet.inventario[id] ?? 0);
  const [qtd, setQtd] = useState(1);
  const [preco, setPreco] = useState(() => (meus[0] ? sugestao(meus[0]) : 1));
  const escolher = (i: Item) => {
    setId(i.id);
    setQtd(1);
    setPreco(sugestao(i));
  };
  const mudarQtd = (n: number) => {
    const nova = Math.max(1, Math.min(n, tenho, MAX_QTD));
    setQtd(nova);
    if (escolhido) setPreco(Math.min(MAX_PRECO, sugestao(escolhido) * nova));
  };
  if (!meus.length)
    return (
      <Vazio
        titulo="Mochila vazia"
        texto="Colha na HOST FAZENDAS (cada colheita manda um pouco para a mochila do HOKI) e volte aqui para vender."
      />
    );
  const lotado = abertos >= MAX_ANUNCIOS;
  const precoValido = Number.isInteger(preco) && preco >= 1 && preco <= MAX_PRECO;
  return (
    <div className="space-y-3">
      <div className="grid max-h-[148px] grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
        {meus.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => escolher(i)}
            title={i.nome}
            aria-pressed={id === i.id}
            className={cn(
              "relative grid h-12 place-items-center rounded-xl border text-[22px] leading-none transition-colors",
              id === i.id
                ? "border-white/60 bg-white/15"
                : "border-white/10 bg-white/[0.05] hover:bg-white/[0.1]",
            )}
          >
            {i.emoji}
            <span className="absolute bottom-0.5 right-1 text-[9.5px] font-semibold tabular-nums text-white/80">
              {Math.floor(pet.inventario[i.id] ?? 0)}
            </span>
          </button>
        ))}
      </div>
      {escolhido && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[13px] font-semibold">
            {escolhido.emoji} {escolhido.nome}{" "}
            <span className="font-normal text-white/50">· você tem {tenho}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1 text-[10.5px] uppercase tracking-widest text-white/45">Quantos</p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => mudarQtd(qtd - 1)}
                  aria-label="Menos um"
                  className="grid size-8 place-items-center rounded-full border border-white/15 hover:bg-white/10"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-8 text-center text-[14px] font-semibold tabular-nums">
                  {qtd}
                </span>
                <button
                  type="button"
                  onClick={() => mudarQtd(qtd + 1)}
                  aria-label="Mais um"
                  className="grid size-8 place-items-center rounded-full border border-white/15 hover:bg-white/10"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mudarQtd(tenho)}
                  className="ml-1 h-8 rounded-full border border-white/15 px-2.5 text-[11px] hover:bg-white/10"
                >
                  Todos
                </button>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10.5px] uppercase tracking-widest text-white/45">
                Preço do lote
              </span>
              <span className="flex h-8 items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 text-amber-200">
                <Coins className="size-3.5" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_PRECO}
                  value={Number.isFinite(preco) ? preco : ""}
                  onChange={(e) => setPreco(Math.floor(Number(e.target.value)))}
                  aria-label="Preço do lote em Staff Coins"
                  className="w-16 bg-transparent text-[13px] font-semibold tabular-nums outline-none"
                />
              </span>
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-white/50">
            Os itens saem da mochila e ficam na barraca até alguém comprar. Se mudar de ideia,
            retire o anúncio em Meus anúncios e eles voltam.
          </p>
          <button
            type="button"
            disabled={ocupado || lotado || !precoValido || tenho < 1}
            onClick={() =>
              void onAnunciar(id, qtd, preco).then((ok) => {
                if (ok) setQtd(1);
              })
            }
            className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[12.5px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ocupado && <Loader2 className="size-4 animate-spin" />}
            {lotado
              ? `Você já tem ${MAX_ANUNCIOS} anúncios abertos`
              : `Anunciar ${qtd} ${escolhido.nome} por ${precoValido ? preco : "…"} Staff Coins`}
          </button>
        </div>
      )}
    </div>
  );
}

function Carregando() {
  return (
    <p className="flex items-center gap-2 py-8 text-[12.5px] text-white/70">
      <Loader2 className="size-4 animate-spin" /> Abrindo a barraca…
    </p>
  );
}
function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="grid min-h-[150px] place-items-center text-center">
      <div>
        <p className="font-display text-[15px] font-semibold">{titulo}</p>
        <p className="mx-auto mt-1 max-w-[340px] text-[12px] leading-snug text-white/55">{texto}</p>
      </div>
    </div>
  );
}
