import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mail, MailOpen, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { type HokiPet } from "@/lib/hoki";
import {
  confirmarLeitura,
  enviarCarta,
  leiturasDaCarta,
  minhasCartas,
  minhasLeituras,
  type Carta,
} from "@/lib/hoki-correio";
import { item, ITENS } from "@/lib/hoki-itens";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/** Cartas e leituras, com o total de não lidas (para o selo no mapa). Atualiza a cada 40 segundos. */
export function useCorreio() {
  const { data: cartas = [] } = useQuery({
    queryKey: ["hoki-cartas"],
    queryFn: minhasCartas,
    refetchInterval: 40_000,
    staleTime: 20_000,
  });
  const { data: lidas = [] } = useQuery({
    queryKey: ["hoki-cartas-lidas"],
    queryFn: minhasLeituras,
    refetchInterval: 40_000,
    staleTime: 20_000,
  });
  const lidasSet = useMemo(() => new Set(lidas), [lidas]);
  const naoLidas = cartas.filter((c) => !lidasSet.has(c.id)).length;
  return { cartas, lidas: lidasSet, naoLidas };
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Correio da praça: a caixa de entrada (cartas da direção, que todos precisam
 * confirmar, e as cartas diretas) e a tela de escrever.
 */
export function Correio({
  pet,
  podeDirecao,
  onFlor,
  onClose,
  escreverPara,
}: {
  pet: HokiPet;
  /** Coordinator+ pode escrever a carta da direção. */
  podeDirecao: boolean;
  /** Abre já na tela de escrever, para esta pessoa, com comida/bebida para mandar. */
  escreverPara?: { id: string; nome: string } | null;
  /** Tira (-1) ou põe (+1) um presente na mochila: ao anexar numa carta, e ao receber a carta que veio com ele. */
  onFlor: (id: string, n: number) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { cartas, lidas, naoLidas } = useCorreio();
  const [aba, setAba] = useState<"entrada" | "escrever">(escreverPara ? "escrever" : "entrada");
  const [aberta, setAberta] = useState<string | null>(null);

  const ler = useMutation({
    mutationFn: async (c: Carta) => ({ c, nova: await confirmarLeitura(c.id) }),
    onSuccess: ({ c, nova }) => {
      void qc.invalidateQueries({ queryKey: ["hoki-cartas-lidas"] });
      if (nova && c.tipo === "direcao") {
        playSfx("check");
        toast.success("Leitura confirmada.");
      }
      // a flor que veio na carta direta vai para a mochila (uma vez só)
      if (nova && c.tipo === "direta" && c.flor && item(c.flor)) {
        const n = c.qtd || 1;
        onFlor(c.flor, n);
        toast.success(
          `Veio junto: ${n > 1 ? `${n}× ` : ""}${item(c.flor)?.emoji} ${item(c.flor)?.nome}. Já está na sua mochila.`,
        );
      }
    },
    onError: () => toast.error("Não foi possível marcar a carta."),
  });

  const abrir = (c: Carta) => {
    setAberta((a) => (a === c.id ? null : c.id));
    // a carta direta conta como lida ao abrir; a da direção precisa do botão de confirmar
    if (c.tipo === "direta" && !lidas.has(c.id) && !ler.isPending) ler.mutate(c);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[min(90dvh,680px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="brilho relative flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.07] px-5 py-3.5 pr-14">
          <span className="icone-quadro size-10 text-[#ff6a57]">
            <Mail className="size-[18px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">
              Correio da praça
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {naoLidas > 0
                ? `${naoLidas} ${naoLidas > 1 ? "cartas não lidas" : "carta não lida"}.`
                : "Tudo lido."}{" "}
              As cartas da direção precisam da sua confirmação.
            </p>
          </div>
          <div className="segmentos" role="tablist" aria-label="O que mostrar">
            <button
              type="button"
              role="tab"
              aria-selected={aba === "entrada"}
              onClick={() => setAba("entrada")}
              data-sem-elastico
            >
              Caixa de entrada{naoLidas > 0 ? ` · ${naoLidas}` : ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === "escrever"}
              onClick={() => setAba("escrever")}
              data-sem-elastico
            >
              Escrever
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {aba === "escrever" ? (
            <Escrever
              pet={pet}
              podeDirecao={podeDirecao}
              onFlor={onFlor}
              paraInicial={escreverPara ?? null}
              onEnviada={() => setAba("entrada")}
            />
          ) : cartas.length === 0 ? (
            <p className="grid h-full place-items-center text-sm text-muted-foreground">
              Nenhuma carta por aqui ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {cartas.map((c) => (
                <ItemCarta
                  key={c.id}
                  c={c}
                  lida={lidas.has(c.id)}
                  aberta={aberta === c.id}
                  podeVerLeituras={podeDirecao}
                  onAbrir={() => abrir(c)}
                  onConfirmar={() => ler.mutate(c)}
                  confirmando={ler.isPending}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemCarta({
  c,
  lida,
  aberta,
  podeVerLeituras,
  onAbrir,
  onConfirmar,
  confirmando,
}: {
  c: Carta;
  lida: boolean;
  aberta: boolean;
  podeVerLeituras: boolean;
  onAbrir: () => void;
  onConfirmar: () => void;
  confirmando: boolean;
}) {
  const direcao = c.tipo === "direcao";
  const flor = c.flor ? item(c.flor) : undefined;
  // Coordinator+ vê quantos já confirmaram a carta da direção
  const { data: leituras } = useQuery({
    queryKey: ["hoki-carta-leituras", c.id],
    queryFn: () => leiturasDaCarta(c.id),
    enabled: aberta && direcao && podeVerLeituras,
    staleTime: 20_000,
  });
  return (
    <li
      className={cn("glass-inset overflow-hidden rounded-2xl border", !lida && "!border-white/25")}
    >
      <button
        type="button"
        onClick={onAbrir}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className={cn("icone-quadro size-9", direcao && "text-[#ff6a57]")}>
          {lida ? (
            <MailOpen className="size-4" strokeWidth={1.7} />
          ) : (
            <Mail className="size-4" strokeWidth={1.7} />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1.5">
            {direcao && (
              <span className="rounded-full bg-[#ce0e0e] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-white">
                Direção
              </span>
            )}
            <span className="truncate text-[13px] font-medium">
              {c.titulo || (direcao ? "Carta da direção" : "Carta")}
            </span>
            {flor && <span className="text-[14px] leading-none">{flor.emoji}</span>}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {direcao
              ? `de ${c.de_nome || "Direção"}`
              : c.anonima || !c.de_nome
                ? "de alguém anônimo"
                : `de ${c.de_nome}`}{" "}
            · {quando(c.created_at)}
          </span>
        </span>
        {!lida && (
          <span className="size-2 shrink-0 rounded-full bg-[#e5231b] shadow-[0_0_8px_rgba(229,35,27,0.9)]" />
        )}
      </button>
      {aberta && (
        <div className="border-t border-white/[0.07] px-4 pb-3.5 pt-3">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
            {c.texto}
          </p>
          {flor && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Veio junto: {flor.emoji} {flor.nome}
            </p>
          )}
          {direcao && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lida ? (
                <span className="flex items-center gap-1.5 text-[12px] text-emerald-300">
                  <Check className="size-3.5" /> Leitura confirmada
                </span>
              ) : (
                <button
                  type="button"
                  disabled={confirmando}
                  onClick={onConfirmar}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {confirmando ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}{" "}
                  Confirmar leitura
                </button>
              )}
              {leituras && (
                <span className="text-[11px] text-ink-3">
                  {leituras.length}{" "}
                  {leituras.length === 1 ? "pessoa confirmou" : "pessoas confirmaram"}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Escrever({
  pet,
  podeDirecao,
  onFlor,
  paraInicial,
  onEnviada,
}: {
  pet: HokiPet;
  podeDirecao: boolean;
  onFlor: (id: string, n: number) => void;
  paraInicial: { id: string; nome: string } | null;
  onEnviada: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"direta" | "direcao">("direta");
  const [para, setPara] = useState(paraInicial?.id ?? "");
  const [anonima, setAnonima] = useState(false);
  const [flor, setFlor] = useState("");
  const [qtd, setQtd] = useState(1);
  const [titulo, setTitulo] = useState(paraInicial ? "Comida e bebida para você" : "");
  const [texto, setTexto] = useState(
    paraInicial ? `Oi, ${paraInicial.nome}! Mandei um lanchinho para o seu HOKI. Bom apetite!` : "",
  );
  const { data: perfis = [] } = useQuery({
    queryKey: ["correio-perfis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .order("username", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((p) => p.id !== pet.user_id);
    },
    staleTime: 300_000,
  });
  // tudo o que dá para mandar: comidas e bebidas primeiro, depois os presentes
  const anexaveis = ITENS.filter((i) => (pet.inventario[i.id] ?? 0) > 0).sort(
    (a, b) => Number(a.tipo === "presente") - Number(b.tipo === "presente"),
  );
  const tenho = flor ? (pet.inventario[flor] ?? 0) : 0;
  const quantos = Math.max(1, Math.min(qtd, tenho, 10));
  const enviar = useMutation({
    mutationFn: () =>
      enviarCarta({
        tipo,
        para: para || null,
        titulo,
        texto,
        flor: tipo === "direta" ? flor : "",
        qtd: quantos,
        anonima,
      }),
    onSuccess: () => {
      if (tipo === "direta" && flor) onFlor(flor, -quantos);
      playSfx("success");
      toast.success(tipo === "direcao" ? "Carta da direção enviada para todos." : "Carta enviada.");
      void qc.invalidateQueries({ queryKey: ["hoki-cartas"] });
      setTexto("");
      setTitulo("");
      setFlor("");
      setQtd(1);
      onEnviada();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a carta."),
  });
  const pronta = texto.trim().length > 0 && (tipo === "direcao" || !!para);
  const campo =
    "w-full rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 text-[13px] outline-none focus:border-white/30";

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {podeDirecao && (
        <div className="segmentos" role="tablist" aria-label="Tipo de carta">
          <button
            type="button"
            role="tab"
            aria-selected={tipo === "direta"}
            onClick={() => setTipo("direta")}
            data-sem-elastico
          >
            Carta direta
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === "direcao"}
            onClick={() => setTipo("direcao")}
            data-sem-elastico
          >
            Carta da direção
          </button>
        </div>
      )}
      {tipo === "direta" ? (
        <>
          <label className="block text-[11.5px] text-muted-foreground">
            Para quem
            <select
              value={para}
              onChange={(e) => setPara(e.target.value)}
              className={cn(campo, "mt-1 h-10")}
            >
              <option value="">Escolha uma pessoa</option>
              {perfis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.username}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={anonima}
              onChange={(e) => setAnonima(e.target.checked)}
              className="size-4 accent-white"
            />
            Mandar como anônimo (a pessoa não vê quem mandou)
          </label>
        </>
      ) : (
        <p className="glass-inset rounded-xl border px-3 py-2 text-[12px] text-muted-foreground">
          A carta da direção vai para todos os HOKIs, assinada por você, e cada um precisa confirmar
          a leitura.
        </p>
      )}
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={80}
        placeholder="Título (opcional)"
        className={cn(campo, "h-10")}
      />
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={1200}
        rows={6}
        placeholder="Escreva a sua carta…"
        className={cn(campo, "resize-none py-2.5 leading-relaxed")}
      />
      {tipo === "direta" && (
        <div>
          <p className="text-[11.5px] text-muted-foreground">
            Mandar junto comida, bebida ou um presente da mochila (opcional). Chega quando a pessoa
            abrir a carta, mesmo que esteja dormindo agora.
          </p>
          <div className="mt-1.5 flex max-h-[148px] flex-wrap gap-1.5 overflow-y-auto">
            {anexaveis.length === 0 && (
              <span className="text-[11.5px] text-ink-3">
                Mochila vazia. Pegue água na fonte da praça, colha na HOST FAZENDAS ou compre no
                Comércio.
              </span>
            )}
            {anexaveis.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  setFlor((f) => (f === i.id ? "" : i.id));
                  setQtd(1);
                }}
                aria-pressed={flor === i.id}
                title={i.nome}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px]",
                  flor === i.id ? "border-white/60 bg-white/15" : "border-white/10 bg-white/[0.04]",
                )}
              >
                <span className="text-[16px] leading-none">{i.emoji}</span> {i.nome}
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  {pet.inventario[i.id]}
                </span>
              </button>
            ))}
          </div>
          {flor && (
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              <span className="text-muted-foreground">Quantidade</span>
              <button
                type="button"
                onClick={() => setQtd((v) => Math.max(1, v - 1))}
                aria-label="Menos um"
                className="grid size-7 place-items-center rounded-full border border-white/15"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold tabular-nums">{quantos}</span>
              <button
                type="button"
                onClick={() => setQtd((v) => Math.min(Math.min(tenho, 10), v + 1))}
                aria-label="Mais um"
                className="grid size-7 place-items-center rounded-full border border-white/15"
              >
                +
              </button>
              <span className="text-[11px] text-ink-3">até 10 por carta</span>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-3">{texto.length}/1200</span>
        <button
          type="button"
          disabled={!pronta || enviar.isPending}
          onClick={() => enviar.mutate()}
          className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {enviar.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}{" "}
          Enviar
        </button>
      </div>
    </div>
  );
}
