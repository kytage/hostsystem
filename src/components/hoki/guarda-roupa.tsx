import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Loader2, Lock, RotateCcw, Search, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  catalogo,
  CATEGORIAS,
  SO_ORIGINAL,
  comprarItem,
  coresDe,
  darCoins,
  ehBasica,
  ehHex,
  ESPACOS,
  PALETA,
  PARTES,
  partesLivres,
  peca as pecaPorId,
  PECAS,
  resgatarItem,
  tem,
  todosPets,
  vestirPeca,
  VISUAL_PADRAO,
  type HokiPet,
  type ParteCor,
  type Peca,
  type Visual,
} from "@/lib/hoki";
import { playSfx } from "@/lib/sfx";
import { Hoki2D } from "./hoki-2d";
import { Hoki3D, type Reacao } from "./hoki-3d";

/** Saldo de Staff Coins, em formato de pílula. */
export function Saldo({ coins, className }: { coins: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-200",
        className,
      )}
      title="Staff Coins"
    >
      <Coins className="size-3.5" aria-hidden /> {coins}
      <span className="sr-only"> Staff Coins</span>
    </span>
  );
}

type Aba = "guarda" | "loja" | "nivel" | "cores";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "guarda", nome: "Guarda-roupa" },
  { id: "loja", nome: "Loja" },
  { id: "nivel", nome: "Por nível" },
  { id: "cores", nome: "Cores" },
].filter((a) => !SO_ORIGINAL || a.id !== "cores") as { id: Aba; nome: string }[];
const igual = (a: Visual, b: Visual) => JSON.stringify(a) === JSON.stringify(b);

function Etiqueta({
  tom,
  children,
}: {
  tom: "ouro" | "verde" | "vermelho" | "neutro";
  children: React.ReactNode;
}) {
  const cores = {
    ouro: "border-amber-300/30 bg-amber-300/10 text-amber-200",
    verde: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    vermelho: "border-primary/40 bg-primary/15 text-red-200",
    neutro: "border-white/10 bg-white/[0.05] text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium leading-4",
        cores[tom],
      )}
    >
      {children}
    </span>
  );
}

/** Campo HEX que só aplica quando o valor digitado é uma cor válida. */
function CampoHex({
  valor,
  onMudar,
  rotulo,
}: {
  valor: string;
  onMudar: (cor: string) => void;
  rotulo: string;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <input
      value={texto}
      onChange={(e) => {
        const v = e.target.value.trim();
        setTexto(v);
        const cor = v.startsWith("#") ? v : `#${v}`;
        if (ehHex(cor)) onMudar(cor.toLowerCase());
      }}
      maxLength={7}
      spellCheck={false}
      aria-label={`${rotulo}: código HEX`}
      className="h-9 w-[92px] rounded-xl border border-white/[0.1] bg-black/40 px-2.5 font-mono text-[12px] uppercase outline-none focus:border-white/30"
    />
  );
}

/**
 * Guarda-roupa do HOKI. Tudo o que se mexe aqui é uma prévia ("em teste"):
 * nada é salvo nem cobrado até "Aplicar alterações" (ou até confirmar uma compra/resgate).
 */
export function GuardaRoupa({
  pet,
  nivel,
  salvando,
  onSalvar,
  onClose,
  abaInicial = "guarda",
}: {
  pet: HokiPet;
  nivel: number;
  salvando: boolean;
  onSalvar: (v: Visual) => void;
  onClose: () => void;
  abaInicial?: "guarda" | "loja";
}) {
  const qc = useQueryClient();
  const { data: pecas = PECAS } = useQuery({
    queryKey: ["hoki-catalogo"],
    queryFn: catalogo,
    staleTime: 300_000,
  });
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [rascunho, setRascunho] = useState<Visual>(pet.visual);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("todas");
  const [filtro, setFiltro] = useState<"todos" | "tenho" | "falta">("todos");
  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [mostra, setMostra] = useState<{ tipo: Reacao; n: number } | null>(null);

  const selecionada = pecas.find((p) => p.id === escolhida) ?? null;
  const emTeste = !igual(rascunho, pet.visual);
  const faltando = ESPACOS.map((g) => pecas.find((p) => p.id === rascunho[g])).filter(
    (p): p is Peca => !!p && !tem(pet, p),
  );
  const livres = partesLivres(rascunho);
  const cores = coresDe(rascunho);

  const lista = useMemo(() => {
    const grupos = CATEGORIAS.find((c) => c.id === categoria)?.grupos;
    const termo = busca.trim().toLowerCase();
    return pecas
      .filter((p) =>
        aba === "guarda"
          ? tem(pet, p)
          : aba === "loja"
            ? p.nivel === 0 && p.preco > 0
            : p.nivel > 0,
      )
      .filter((p) => !grupos || grupos.includes(p.grupo))
      .filter((p) => filtro === "todos" || (filtro === "tenho") === tem(pet, p))
      .filter((p) => !termo || p.nome.toLowerCase().includes(termo))
      .sort((a, b) => (aba === "nivel" ? a.nivel - b.nivel : 0));
  }, [pecas, aba, categoria, filtro, busca, pet]);

  const experimentar = (p: Peca) => {
    setEscolhida(p.id);
    setConfirmando(false);
    if (rascunho[p.grupo] === p.id) return;
    const { visual, removidas } = vestirPeca(rascunho, p);
    playSfx("click");
    setMostra((m) => ({ tipo: "girar", n: (m?.n ?? 0) + 1 }));
    setRascunho(visual);
    setAviso(
      removidas.length
        ? `${removidas.map((r) => r.nome).join(", ")} ${removidas.length > 1 ? "saíram" : "saiu"} da prévia para dar lugar a ${p.nome}.`
        : "",
    );
  };
  const tirar = (p: Peca) => {
    setRascunho((v) =>
      p.grupo === "traje"
        ? { ...v, traje: VISUAL_PADRAO.traje, cores: {} }
        : p.grupo === "podio"
          ? { ...v, podio: VISUAL_PADRAO.podio }
          : { ...v, [p.grupo]: "" },
    );
    setAviso("");
  };
  const pintar = (parte: ParteCor, cor: string) =>
    setRascunho((v) => ({ ...v, cores: { ...v.cores, [parte]: cor } }));

  const adquirir = useMutation({
    mutationFn: (p: Peca) => (p.nivel > 0 ? resgatarItem(p) : comprarItem(p)),
    onSuccess: (_, p) => {
      playSfx("complete");
      toast.success(p.nivel > 0 ? `${p.nome} resgatado!` : `${p.nome} agora é seu!`);
      setConfirmando(false);
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
        className="flex h-[min(92dvh,760px)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-6 py-3.5">
          Guarda-roupa de {pet.nome}
          <Saldo coins={pet.coins} />
          <Etiqueta tom="neutro">Nível {nivel}</Etiqueta>
        </DialogTitle>

        <div className="grid min-h-0 flex-1 md:grid-cols-[330px_minmax(0,1fr)]">
          {/* ---------- mascote + item selecionado ---------- */}
          <div className="relative flex min-h-0 flex-col border-b border-white/[0.07] md:border-b-0 md:border-r">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-[38%] h-24 rounded-full bg-primary/20 blur-3xl"
            />
            <span className="absolute left-4 top-3 z-10">
              {emTeste ? (
                <Etiqueta tom="ouro">Visual em teste</Etiqueta>
              ) : (
                <Etiqueta tom="verde">Visual equipado</Etiqueta>
              )}
            </span>
            <Hoki3D
              humor="feliz"
              reacao={mostra}
              visual={rascunho}
              placa={{ nome: pet.nome, nivel }}
              interativo
              className="h-[220px] w-full md:h-auto md:min-h-0 md:flex-1"
            />
            <p className="px-4 text-center text-[10.5px] text-ink-3">
              Arraste para girar · role para aproximar
            </p>

            <div
              className="m-3 min-h-[128px] rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"
              aria-live="polite"
            >
              {selecionada ? (
                <Selecionada
                  p={selecionada}
                  pet={pet}
                  nivel={nivel}
                  noRascunho={rascunho[selecionada.grupo] === selecionada.id}
                  confirmando={confirmando}
                  ocupado={adquirir.isPending}
                  onVestir={() => experimentar(selecionada)}
                  onTirar={() => tirar(selecionada)}
                  onPedir={() => setConfirmando(true)}
                  onVoltar={() => setConfirmando(false)}
                  onConfirmar={() => adquirir.mutate(selecionada)}
                />
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Clique numa peça para experimentar. Você pode combinar várias antes de salvar:
                  nada é cobrado nem trocado até você confirmar.
                </p>
              )}
              {aviso && <p className="mt-2 text-[11px] text-amber-200">{aviso}</p>}
            </div>

            <div className="border-t border-white/[0.07] p-3">
              {faltando.length > 0 && (
                <p className="mb-2 text-[11px] text-amber-200">
                  Em teste sem você ter: {faltando.map((p) => p.nome).join(", ")}. Adquira ou tire
                  para poder aplicar.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRascunho(pet.visual);
                    setAviso("");
                  }}
                  disabled={!emTeste}
                  className="h-10 flex-1 rounded-full border border-white/[0.12] text-xs font-medium transition-colors enabled:hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onSalvar(rascunho)}
                  disabled={!emTeste || faltando.length > 0 || salvando}
                  className="flex h-10 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold text-white disabled:opacity-40"
                >
                  {salvando ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}{" "}
                  Aplicar alterações
                </button>
              </div>
            </div>
          </div>

          {/* ---------- catálogo ---------- */}
          <div className="flex min-h-0 flex-col">
            <div
              className="flex flex-wrap items-center gap-1 border-b border-white/[0.07] px-4 py-2.5"
              role="tablist"
            >
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  role="tab"
                  aria-selected={aba === a.id}
                  onClick={() => setAba(a.id)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                    aba === a.id
                      ? "bg-white/[0.12] text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.nome}
                </button>
              ))}
              {aba !== "cores" && (
                <label className="relative ml-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar peça"
                    aria-label="Buscar peça pelo nome"
                    className="h-9 w-[170px] rounded-full border border-white/[0.09] bg-black/40 pl-8 pr-3 text-[12.5px] outline-none placeholder:text-ink-3 focus:border-white/30"
                  />
                </label>
              )}
            </div>

            {aba === "cores" ? (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Recolorir é de graça. As cores valem para o traje e os acessórios coloríveis da
                    prévia.
                  </p>
                  <button
                    onClick={() => setRascunho((v) => ({ ...v, cores: {} }))}
                    disabled={Object.keys(rascunho.cores).length === 0}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 text-xs transition-colors enabled:hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <RotateCcw className="size-3.5" /> Restaurar cores originais
                  </button>
                </div>
                {PARTES.map((parte) => {
                  const livre = livres.includes(parte.id);
                  return (
                    <section
                      key={parte.id}
                      className={cn(
                        "rounded-2xl border border-white/[0.07] p-3",
                        !livre && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-5 rounded-full border border-white/20"
                          style={{ background: cores[parte.id] }}
                        />
                        <h3 className="text-[13px] font-medium">{parte.nome}</h3>
                        {!livre && (
                          <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-3">
                            <Lock className="size-3" />{" "}
                            {parte.id === "acessorio"
                              ? "Vista um acessório colorível"
                              : "Fixa neste traje"}
                          </span>
                        )}
                      </div>
                      {livre && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {PALETA.map((c) => (
                            <button
                              key={c.cor}
                              onClick={() => pintar(parte.id, c.cor)}
                              aria-label={`${parte.nome}: ${c.nome}`}
                              aria-pressed={cores[parte.id].toLowerCase() === c.cor}
                              title={c.nome}
                              className={cn(
                                "size-8 rounded-full border-2 transition-transform duration-150 hover:scale-110",
                                cores[parte.id].toLowerCase() === c.cor
                                  ? "border-white"
                                  : "border-white/15",
                              )}
                              style={{ background: c.cor }}
                            />
                          ))}
                          <input
                            type="color"
                            value={cores[parte.id]}
                            onChange={(e) => pintar(parte.id, e.target.value)}
                            aria-label={`${parte.nome}: escolher cor`}
                            className="ml-1 size-9 cursor-pointer rounded-xl border border-white/[0.1] bg-transparent p-0.5"
                          />
                          <CampoHex
                            valor={cores[parte.id]}
                            onMudar={(cor) => pintar(parte.id, cor)}
                            rotulo={parte.nome}
                          />
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.07] px-4 py-2.5">
                  {[{ id: "todas", nome: "Tudo" }, ...CATEGORIAS].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoria(c.id)}
                      aria-pressed={categoria === c.id}
                      className={cn(
                        "h-7 rounded-full border px-2.5 text-[11.5px] transition-colors",
                        categoria === c.id
                          ? "border-white/30 bg-white/[0.1] text-foreground"
                          : "border-white/[0.07] text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.nome}
                    </button>
                  ))}
                  {aba !== "guarda" && (
                    <select
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value as typeof filtro)}
                      aria-label="Filtrar por disponibilidade"
                      className="ml-auto h-7 rounded-full border border-white/[0.09] bg-black/50 px-2 text-[11.5px] text-white outline-none [color-scheme:dark] [&>option]:bg-[#141416] [&>option]:text-white"
                    >
                      <option value="todos">Todos</option>
                      <option value="tenho">Adquiridos</option>
                      <option value="falta">Não adquiridos</option>
                    </select>
                  )}
                </div>
                {aba === "nivel" && (
                  <p className="flex items-center gap-2 px-5 pt-3 text-xs text-muted-foreground">
                    <Trophy className="size-3.5 text-amber-200" /> Você está no nível {nivel}.
                    Recompensas são gratuitas: ao atingir o nível, é só resgatar.
                  </p>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {lista.map((p) => {
                      const minha = tem(pet, p);
                      const equipada = pet.visual[p.grupo] === p.id;
                      const naPrevia = rascunho[p.grupo] === p.id;
                      const travada = p.nivel > nivel && !minha;
                      return (
                        <button
                          key={p.id}
                          onClick={() => experimentar(p)}
                          aria-pressed={naPrevia}
                          className={cn(
                            "group relative flex flex-col items-center rounded-2xl border px-2 pb-2.5 pt-2 text-center transition-all duration-200 hover:-translate-y-0.5",
                            escolhida === p.id
                              ? "border-white/45 bg-white/[0.1]"
                              : naPrevia
                                ? "border-white/25 bg-white/[0.06]"
                                : "border-white/[0.07] bg-white/[0.03]",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-[78px] w-full place-items-center rounded-xl bg-black/35",
                              travada && "opacity-60",
                            )}
                          >
                            <Hoki2D
                              visual={vestirPeca(VISUAL_PADRAO, p).visual}
                              className="h-[72px] w-[58px]"
                            />
                          </span>
                          <span className="mt-1.5 line-clamp-1 w-full text-[12.5px] font-medium">
                            {p.nome}
                          </span>
                          <span className="mt-1 flex flex-wrap justify-center gap-1">
                            {equipada ? (
                              <Etiqueta tom="verde">Equipado</Etiqueta>
                            ) : naPrevia ? (
                              <Etiqueta tom="ouro">Em teste</Etiqueta>
                            ) : minha && !ehBasica(p) ? (
                              <Etiqueta tom="neutro">Adquirido</Etiqueta>
                            ) : null}
                            {!minha &&
                              p.nivel > 0 &&
                              (travada ? (
                                <Etiqueta tom="neutro">
                                  <Lock className="size-2.5" /> Bloqueado — nível {p.nivel}
                                </Etiqueta>
                              ) : (
                                <Etiqueta tom="vermelho">Resgate liberado</Etiqueta>
                              ))}
                            {minha && p.nivel > 0 && (
                              <Etiqueta tom="neutro">Recompensa de nível</Etiqueta>
                            )}
                            {!minha && p.nivel === 0 && (
                              <Etiqueta tom="ouro">
                                <Coins className="size-2.5" /> {p.preco}
                              </Etiqueta>
                            )}
                            {ehBasica(p) && !equipada && !naPrevia && (
                              <Etiqueta tom="neutro">Básico</Etiqueta>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {lista.length === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma peça por aqui com esses filtros.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Painel do item selecionado: mostra a situação e a ação certa para cada caso. */
function Selecionada(props: {
  p: Peca;
  pet: HokiPet;
  nivel: number;
  noRascunho: boolean;
  confirmando: boolean;
  ocupado: boolean;
  onVestir: () => void;
  onTirar: () => void;
  onPedir: () => void;
  onVoltar: () => void;
  onConfirmar: () => void;
}) {
  const { p, pet, nivel, noRascunho, confirmando, ocupado } = props;
  const minha = tem(pet, p);
  const deNivel = p.nivel > 0;
  const travada = deNivel && !minha && nivel < p.nivel;
  const semSaldo = !deNivel && !minha && pet.coins < p.preco;
  const categoria = CATEGORIAS.find((c) => c.grupos.includes(p.grupo))?.nome;
  const botao =
    "flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold disabled:opacity-45";

  if (confirmando && !minha) {
    return (
      <div>
        <p className="text-sm font-medium">
          {deNivel ? `Resgatar ${p.nome}?` : `Comprar ${p.nome}?`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {deNivel
            ? `Recompensa gratuita do nível ${p.nivel}. Fica no seu guarda-roupa para sempre.`
            : `Valor: ${p.preco} Staff Coins. Saldo depois da compra: ${pet.coins - p.preco}.`}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={props.onVoltar}
            disabled={ocupado}
            className={cn(botao, "flex-1 border border-white/[0.12] font-medium")}
          >
            Voltar
          </button>
          <button
            onClick={props.onConfirmar}
            disabled={ocupado}
            className={cn(botao, "flex-[1.4] bg-primary text-white")}
          >
            {ocupado ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}{" "}
            {deNivel ? "Confirmar resgate" : "Confirmar compra"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm font-medium">{p.nome}</p>
        {minha ? (
          <Etiqueta tom="verde">{ehBasica(p) ? "Básico" : "Adquirido"}</Etiqueta>
        ) : deNivel ? (
          <Etiqueta tom="neutro">Recompensa de nível</Etiqueta>
        ) : (
          <Etiqueta tom="ouro">Staff Coins</Etiqueta>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-ink-3">
        {categoria}
        {p.recolore?.length ? " · aceita recolorir" : ""}
        {p.ocupa?.length ? " · traje completo: não combina com chapéu ou roupa por cima" : ""}
      </p>
      {travada && (
        <div className="mt-2">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Libera no nível {p.nivel}</span>
            <span>você está no {nivel}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (nivel / p.nivel) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {noRascunho ? (
          <button
            onClick={props.onTirar}
            disabled={p.id === VISUAL_PADRAO.traje}
            className={cn(botao, "border border-white/[0.12] font-medium")}
          >
            {minha ? "Desequipar" : "Tirar da prévia"}
          </button>
        ) : (
          <button
            onClick={props.onVestir}
            className={cn(botao, "border border-white/[0.12] font-medium")}
          >
            {minha ? "Equipar" : "Experimentar"}
          </button>
        )}
        {!minha &&
          (deNivel ? (
            <button
              onClick={props.onPedir}
              disabled={travada}
              className={cn(botao, "flex-1 bg-primary text-white")}
            >
              {travada ? (
                <>
                  <Lock className="size-3.5" /> Bloqueado — nível {p.nivel}
                </>
              ) : (
                "Resgatar"
              )}
            </button>
          ) : (
            <button
              onClick={props.onPedir}
              disabled={semSaldo}
              className={cn(botao, "flex-1 bg-primary text-white")}
            >
              <Coins className="size-3.5" />{" "}
              {semSaldo ? `Faltam ${p.preco - pet.coins} coins` : `Comprar por ${p.preco}`}
            </button>
          ))}
      </div>
    </div>
  );
}

/** Painel de entrega de Staff Coins. Só aparece para o henrique (e o banco confere de novo). */
export function PainelCoins() {
  const qc = useQueryClient();
  const { data: pets = [] } = useQuery({
    queryKey: ["hoki-todos"],
    queryFn: todosPets,
    staleTime: 30_000,
  });
  const [alvo, setAlvo] = useState("");
  const [qtd, setQtd] = useState("50");
  const entregar = useMutation({
    mutationFn: ({ id, n }: { id: string; n: number }) => darCoins(id, n),
    onSuccess: (saldo, { id, n }) => {
      const quem = pets.find((p) => p.user_id === id);
      playSfx("complete");
      toast.success(
        `${n > 0 ? `+${n}` : n} coins para ${quem?.username || quem?.nome || "o staff"}. Saldo: ${saldo}.`,
      );
      for (const chave of [["hoki-todos"], ["hoki-meu"], ["hoki-ranking"]])
        void qc.invalidateQueries({ queryKey: chave });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível entregar."),
  });
  const n = Math.trunc(Number(qtd));
  const valido = !!alvo && Number.isFinite(n) && n !== 0 && Math.abs(n) <= 100000;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) entregar.mutate({ id: alvo, n });
      }}
      className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-2.5"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
        <Coins className="size-3.5" /> Entregar Staff Coins
      </p>
      <select
        value={alvo}
        onChange={(e) => setAlvo(e.target.value)}
        aria-label="Staff que vai receber"
        className="mt-1.5 h-8 w-full rounded-lg border border-white/[0.1] bg-black/50 px-2 text-[12px] text-white outline-none [color-scheme:dark] focus:border-white/30 [&>option]:bg-[#141416] [&>option]:text-white"
      >
        <option value="">Escolha o staff…</option>
        {pets.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.username || p.nome} · {p.coins}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex gap-1.5">
        <input
          type="number"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          aria-label="Quantidade de coins (negativo tira)"
          title="Use número negativo para tirar"
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-black/50 px-2 text-[12px] tabular-nums outline-none focus:border-white/30"
        />
        <button
          type="submit"
          disabled={!valido || entregar.isPending}
          aria-label="Entregar coins"
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {entregar.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}{" "}
          Entregar
        </button>
      </div>
    </form>
  );
}

export { pecaPorId };
