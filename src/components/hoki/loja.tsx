import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Gem, Loader2, Lock, Palette, Store } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  apareceNaLoja,
  comprarItem,
  coresDe,
  PALETA,
  RARIDADES,
  resgatarItem,
  tem,
  vestirPeca,
  VISUAL_PADRAO,
  type HokiPet,
  type Peca,
  type Visual,
} from "@/lib/hoki";
import { playSfx } from "@/lib/sfx";
import { Hoki3D, type Reacao } from "./hoki-3d";
import { Categorias, CATEGORIAS_DA_VITRINE, Miniatura, useCatalogo, Vazio } from "./vitrine";

/** Peças que não dá para tirar: sempre há um traje e um pódio em uso. */
const padraoDe = (p: Peca) =>
  p.grupo === "traje" ? VISUAL_PADRAO.traje : p.grupo === "podio" ? VISUAL_PADRAO.podio : "";

type Filtro = "tudo" | "meus" | "venda";
const FILTROS: { id: Filtro; nome: string }[] = [
  { id: "tudo", nome: "Tudo" },
  { id: "meus", nome: "Meus" },
  { id: "venda", nome: "À venda" },
];

/**
 * Loja do HOKI: um lugar só para comprar e para usar. O que ainda não é seu
 * mostra o preço e "Comprar"; depois de comprado, o mesmo cartão passa a
 * mostrar "Usar" (e "Tirar" enquanto estiver em uso). A cor do HOKI é de
 * graça. Vestir vale na hora, sem botão de salvar.
 */
export function Loja({
  pet,
  nivel,
  salvando,
  onUsar,
  onClose,
}: {
  pet: HokiPet;
  nivel: number;
  salvando: boolean;
  /** Grava o novo visual (o que o HOKI está vestindo). */
  onUsar: (v: Visual) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const catalogo = useCatalogo();
  const pecas = useMemo(
    () => catalogo.filter((p) => apareceNaLoja(p, pet.username)),
    [catalogo, pet.username],
  );
  const [categoria, setCategoria] = useState("trajes");
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [olhando, setOlhando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [mostra, setMostra] = useState<{ tipo: Reacao; n: number } | null>(null);
  // o que está vestido agora: muda na hora ao clicar em "Usar" e segue o que foi gravado
  const gravado = JSON.stringify(pet.visual);
  const [visual, setVisual] = useState<Visual>(pet.visual);
  useEffect(() => setVisual(JSON.parse(gravado) as Visual), [gravado]);

  const noFiltro = useMemo(
    () =>
      pecas.filter((p) =>
        filtro === "tudo" ? true : filtro === "meus" ? tem(pet, p) : !tem(pet, p),
      ),
    [pecas, pet, filtro],
  );
  // as peças exclusivas ficam só na aba EXCLUSIVO (que aparece para quem tem alguma)
  const temExclusivas = pecas.some((p) => p.exclusivo);
  const naCategoria = (id: string) => {
    if (id === "exclusivo") return noFiltro.filter((p) => p.exclusivo);
    const grupos = CATEGORIAS_DA_VITRINE.find((c) => c.id === id)?.grupos ?? [];
    return noFiltro.filter((p) => grupos.includes(p.grupo) && !p.exclusivo);
  };
  // primeiro o que está em uso, depois o que já é seu, depois o que está à venda
  const ordem = (p: Peca) => (visual[p.grupo] === p.id ? 0 : tem(pet, p) ? 1 : 2);
  const lista = naCategoria(categoria).sort((a, b) => ordem(a) - ordem(b));
  const emDestaque = pecas.find((p) => p.id === olhando) ?? null;
  const provando = !!emDestaque && visual[emDestaque.grupo] !== emDestaque.id;
  const previa = provando && emDestaque ? vestirPeca(visual, emDestaque).visual : visual;
  const corAtual = coresDe(visual).principal;

  const girar = () => setMostra((m) => ({ tipo: "girar", n: (m?.n ?? 0) + 1 }));
  const aplicar = (novo: Visual) => {
    playSfx("click");
    girar();
    setVisual(novo);
    onUsar(novo);
  };
  /** Usa a peça; se já está em uso, tira (traje e pódio voltam para o padrão). */
  const alternar = (p: Peca) => {
    if (visual[p.grupo] !== p.id) aplicar(vestirPeca(visual, p).visual);
    else if (padraoDe(p) !== p.id)
      aplicar(
        p.grupo === "traje"
          ? { ...visual, traje: VISUAL_PADRAO.traje, cores: {} }
          : { ...visual, [p.grupo]: padraoDe(p) },
      );
  };

  const adquirir = useMutation({
    mutationFn: (p: Peca) => (p.nivel > 0 ? resgatarItem(p) : comprarItem(p)),
    onSuccess: (_, p) => {
      playSfx("complete");
      toast.success(`${p.nome} agora é seu. Já dá para usar.`);
      setConfirmando(null);
      setMostra((m) => ({ tipo: "festa", n: (m?.n ?? 0) + 1 }));
      void qc.invalidateQueries({ queryKey: ["hoki-meu"] });
      void qc.invalidateQueries({ queryKey: ["hoki-todos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[min(92dvh,740px)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="relative flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.07] px-5 py-3.5 pr-14">
          <span className="icone-quadro size-10">
            <Store className="size-[18px]" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">
              Loja do HOKI
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Compre com Staff Coins. O que já é seu aparece com o botão Usar.
            </p>
          </div>
          <div className="segmentos" role="tablist" aria-label="O que mostrar">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                data-sem-elastico
              >
                {f.nome}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-amber-200">
            <Coins className="size-4" aria-hidden />
            <span className="font-display text-base font-semibold tabular-nums leading-none">
              {pet.coins}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-amber-200/70">coins</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* espelho: o HOKI como está (ou provando a peça sob o mouse) */}
          <div className="relative h-[210px] shrink-0 overflow-hidden border-b border-white/[0.07] md:h-auto md:w-[270px] md:border-b-0 md:border-r">
            <Hoki3D
              humor="feliz"
              reacao={mostra}
              visual={previa}
              placa={{ nome: pet.nome, nivel }}
              interativo
              className="absolute inset-0"
            />
            {(provando || salvando) && (
              <p className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/85 backdrop-blur-md">
                {provando ? "Provando" : "Salvando"}
              </p>
            )}
          </div>

          <Categorias
            atual={categoria}
            onMudar={(id) => {
              setCategoria(id);
              setOlhando(null);
            }}
            contar={(c) => naCategoria(c.id).length}
            inicio={{ id: "cores", nome: "Cores", Icone: Palette, n: PALETA.length }}
            {...(temExclusivas
              ? {
                  fim: {
                    id: "exclusivo",
                    nome: "Exclusivo",
                    Icone: Gem,
                    n: naCategoria("exclusivo").length,
                  },
                }
              : {})}
          />

          <div className="min-h-0 flex-1 overflow-y-auto p-4" onMouseLeave={() => setOlhando(null)}>
            {categoria === "cores" ? (
              <div>
                <p className="mb-3 text-xs text-muted-foreground">
                  A cor do seu HOKI é de graça: é o mesmo HOKI, só muda o vermelho. Vale também por
                  baixo das roupas e fantasias.
                </p>
                <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                  {PALETA.map((c) => {
                    const emUso = corAtual.toLowerCase() === c.cor.toLowerCase();
                    return (
                      <li key={c.cor}>
                        <button
                          onClick={() =>
                            !emUso &&
                            aplicar({ ...visual, cores: { ...visual.cores, principal: c.cor } })
                          }
                          aria-pressed={emUso}
                          title={c.nome}
                          className={cn(
                            "glass-inset flex w-full flex-col items-center gap-2 rounded-2xl border p-3",
                            emUso && "!border-white/40",
                          )}
                        >
                          <span
                            className="relative grid size-11 place-items-center rounded-full ring-1 ring-white/15"
                            style={{ background: c.cor }}
                          >
                            {emUso && (
                              <Check className="size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                            )}
                          </span>
                          <span className="w-full truncate text-center text-[11px] text-muted-foreground">
                            {c.nome}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : lista.length === 0 ? (
              <Vazio
                titulo={
                  filtro === "meus"
                    ? "Nada seu aqui ainda"
                    : filtro === "venda"
                      ? "Você já tem tudo daqui"
                      : "Em breve"
                }
                texto={
                  filtro === "meus"
                    ? "Você ainda não tem peças desta categoria. Troque o filtro para ver o que está à venda."
                    : filtro === "venda"
                      ? "Não sobrou nada para comprar nesta categoria."
                      : "Ainda não há nada nesta categoria. As novidades aparecem aqui."
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {lista.map((p) => (
                  <li key={p.id}>
                    <Produto
                      p={p}
                      pet={pet}
                      nivel={nivel}
                      emUso={visual[p.grupo] === p.id}
                      fixo={padraoDe(p) === p.id}
                      ativo={olhando === p.id}
                      confirmando={confirmando === p.id}
                      ocupado={adquirir.isPending}
                      onOlhar={() => setOlhando(p.id)}
                      onUsar={() => alternar(p)}
                      onPedir={() => setConfirmando(p.id)}
                      onVoltar={() => setConfirmando(null)}
                      onConfirmar={() => adquirir.mutate(p)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Um item da loja. O botão muda com a situação: Comprar, Resgatar, Usar, Tirar ou travado por nível. */
function Produto(props: {
  p: Peca;
  pet: HokiPet;
  nivel: number;
  emUso: boolean;
  /** Peça padrão (traje e pódio de fábrica): não dá para tirar, só trocar por outra. */
  fixo: boolean;
  ativo: boolean;
  confirmando: boolean;
  ocupado: boolean;
  onOlhar: () => void;
  onUsar: () => void;
  onPedir: () => void;
  onVoltar: () => void;
  onConfirmar: () => void;
}) {
  const { p, pet, nivel, emUso, ativo, confirmando, ocupado } = props;
  const minha = tem(pet, p);
  const deNivel = p.nivel > 0;
  const travada = deNivel && !minha && nivel < p.nivel;
  const semSaldo = !deNivel && !minha && pet.coins < p.preco;
  const botao =
    "flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold disabled:opacity-50";
  const contorno =
    "border border-white/[0.12] font-medium text-foreground/85 hover:border-white/30";

  return (
    <article
      onMouseEnter={props.onOlhar}
      onFocus={props.onOlhar}
      className={cn(
        "glass-inset group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-colors duration-200",
        emUso ? "!border-white/45" : ativo && "!border-white/20",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.1),transparent_65%)]">
        <div
          aria-hidden
          className="absolute inset-x-6 bottom-2 h-8 rounded-full blur-2xl"
          style={{ background: p.cor, opacity: 0.3 }}
        />
        <div className="absolute inset-3 transition-transform duration-300 group-hover:scale-105">
          <Miniatura p={p} />
        </div>
        {p.exclusivo ? (
          <span className="absolute left-2 top-2 rounded-full border border-white/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-md">
            Exclusivo
          </span>
        ) : (
          (deNivel || p.raridade) && (
            <span
              className="absolute left-2 top-2 rounded-full border bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] backdrop-blur-md"
              style={
                p.raridade
                  ? {
                      color: RARIDADES[p.raridade].cor,
                      borderColor: `${RARIDADES[p.raridade].cor}66`,
                    }
                  : { color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.15)" }
              }
            >
              {p.raridade ? RARIDADES[p.raridade].nome : `Nível ${p.nivel}`}
            </span>
          )
        )}
        {emUso ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">
            <Check className="size-3" /> Em uso
          </span>
        ) : (
          minha && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur-md">
              <Check className="size-3" /> Seu
            </span>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 text-[13px] font-medium leading-tight">{p.nome}</h3>
          {!minha && (
            <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums text-amber-200">
              {deNivel ? (
                "Grátis"
              ) : (
                <>
                  <Coins className="size-3.5" aria-hidden /> {p.preco}
                </>
              )}
            </span>
          )}
        </div>

        <div className="mt-auto">
          {minha ? (
            emUso ? (
              props.fixo ? (
                <p
                  className={cn(
                    botao,
                    "border border-white/[0.08] font-medium text-muted-foreground",
                  )}
                >
                  Padrão do HOKI
                </p>
              ) : (
                <button onClick={props.onUsar} className={cn(botao, contorno)}>
                  Tirar
                </button>
              )
            ) : (
              <button
                onClick={props.onUsar}
                className={cn(botao, "bg-primary text-primary-foreground")}
              >
                Usar
              </button>
            )
          ) : confirmando ? (
            <div className="flex gap-1.5">
              <button
                onClick={props.onVoltar}
                disabled={ocupado}
                className={cn(botao, contorno, "w-auto flex-1")}
              >
                Voltar
              </button>
              <button
                onClick={props.onConfirmar}
                disabled={ocupado}
                className={cn(botao, "w-auto flex-[1.6] bg-primary text-primary-foreground")}
              >
                {ocupado ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}{" "}
                Confirmar
              </button>
            </div>
          ) : travada ? (
            <p
              className={cn(botao, "border border-white/[0.08] font-medium text-muted-foreground")}
            >
              <Lock className="size-3.5" /> Libera no nível {p.nivel}
            </p>
          ) : (
            <button onClick={props.onPedir} disabled={semSaldo} className={cn(botao, contorno)}>
              {semSaldo ? `Faltam ${p.preco - pet.coins} coins` : deNivel ? "Resgatar" : "Comprar"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
