import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ChevronDown, Gavel, ListTodo, NotebookPen, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { AREA_LABELS, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { listArquivados, type UsuarioArquivado } from "@/lib/users.functions";

const fmtData = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const COLUNA_TAREFA: Record<string, string> = {
  todo: "A fazer",
  pendente: "A fazer",
  doing: "Fazendo",
  andamento: "Fazendo",
  done: "Feita",
  concluido: "Feita",
};

/** Aba ARQUIVADOS: histórico de quem foi excluído, com tudo que a pessoa tinha no painel. */
export function UsuariosArquivados({ busca }: { busca: string }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["usuarios-arquivados"],
    queryFn: () => listArquivados(),
  });
  const [aberto, setAberto] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data;
    return data.filter((a) =>
      [a.username, a.host_id, a.discord_id, a.cargo, a.motivo, a.excluido_por, ...a.areas]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, busca]);

  if (isLoading)
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Carregando arquivados...</p>;
  if (error)
    return (
      <p className="px-4 py-10 text-center text-sm text-destructive">
        Não foi possível carregar os arquivados.
      </p>
    );
  if (lista.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <Archive className="size-8 text-ink-3" />
        <p className="text-sm text-muted-foreground">
          {busca ? "Ninguém encontrado nos arquivados." : "Ninguém foi excluído ainda."}
        </p>
        <p className="text-xs text-ink-3">
          Quando um usuário for excluído, tudo dele aparece aqui como histórico.
        </p>
      </div>
    );

  return (
    <ul className="divide-y divide-white/[0.06]">
      {lista.map((a) => (
        <Linha
          key={a.id}
          a={a}
          aberto={aberto === a.id}
          onToggle={() => setAberto(aberto === a.id ? null : a.id)}
        />
      ))}
    </ul>
  );
}

function Linha({ a, aberto, onToggle }: { a: UsuarioArquivado; aberto: boolean; onToggle: () => void }) {
  const cargo = ROLE_LABELS[a.cargo as AppRole] ?? a.cargo;
  return (
    <li>
      <button
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <img
          src={a.avatar_url || DEFAULT_AVATAR_URL}
          alt=""
          className="size-9 rounded-full object-cover opacity-70 grayscale"
        />
        <span className="min-w-36 flex-1">
          <span className="block font-semibold text-foreground">
            {a.username}
            {a.host_id && <span className="ml-1 text-ink-3">#{a.host_id}</span>}
          </span>
          <span className="text-[11.5px] text-muted-foreground">
            {cargo}
            {a.areas.length > 0 &&
              ` · ${a.areas.map((x) => AREA_LABELS[x as keyof typeof AREA_LABELS] ?? x).join(", ")}`}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
          <Contador icone={StickyNote} n={a.staff_anotacoes.length} titulo="anotações" />
          <Contador icone={ListTodo} n={a.tarefas.length} titulo="tarefas" />
          <Contador icone={Gavel} n={a.punicoes.length} titulo="punições" />
        </span>
        <span className="w-44 text-right text-[11px] text-ink-3">
          Excluído em {fmtData(a.excluido_em)}
          {a.excluido_por && <span className="block">por @{a.excluido_por}</span>}
        </span>
        <ChevronDown className={cn("size-4 text-ink-3 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
          <Bloco titulo="Dados">
            <Dado k="Motivo da exclusão" v={a.motivo || "Não informado"} />
            <Dado k="Entrou no painel" v={fmtData(a.entrou_em)} />
            <Dado k="Último acesso" v={fmtData(a.ultimo_acesso)} />
            <Dado k="ID Discord" v={a.discord_id || "—"} mono />
            <Dado k="ID HOST" v={a.host_id || "—"} mono />
            {a.perfil?.bio ? <Dado k="Bio" v={a.perfil.bio} /> : null}
          </Bloco>

          <Bloco titulo={`Anotações de staff (${a.staff_anotacoes.length})`}>
            {a.staff_anotacoes.length === 0 ? (
              <Vazio />
            ) : (
              a.staff_anotacoes.map((n, i) => (
                <div key={i} className="rounded-lg bg-white/[0.03] p-2.5">
                  <p className="whitespace-pre-line text-[12.5px] text-foreground/90">{n.texto}</p>
                  <p className="mt-1 text-[10.5px] text-ink-3">
                    @{n.autor_nome || "?"} · {fmtData(n.criado_em)}
                  </p>
                </div>
              ))
            )}
          </Bloco>

          <Bloco titulo={`Tarefas (${a.tarefas.length})`}>
            {a.tarefas.length === 0 ? (
              <Vazio />
            ) : (
              a.tarefas.map((t, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-lg bg-white/[0.03] p-2.5">
                  <span>
                    <span className="block text-[12.5px] font-medium text-foreground/90">{t.titulo}</span>
                    {t.designada_por && (
                      <span className="text-[10.5px] text-ink-3">designada por {t.designada_por}</span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">
                    {COLUNA_TAREFA[t.coluna] ?? t.coluna}
                  </span>
                </div>
              ))
            )}
          </Bloco>

          <Bloco titulo={`Punições aplicadas (${a.punicoes.length})`}>
            {a.punicoes.length === 0 ? (
              <Vazio />
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {a.punicoes.map((p, i) => (
                  <div key={i} className="rounded-lg bg-white/[0.03] p-2.5 text-[12px]">
                    <span className="font-medium text-foreground/90">
                      {p.punicao || p.tipo} · {p.jogador}
                      {p.jogador_id && <span className="text-ink-3"> #{p.jogador_id}</span>}
                    </span>
                    <span className="block text-[10.5px] text-ink-3">
                      {p.motivo} · {fmtData(p.data_punicao)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Bloco>

          {a.anotacoes_pessoais.trim() && (
            <div className="md:col-span-2">
              <Bloco titulo="Anotações pessoais" icone={NotebookPen}>
                <p className="whitespace-pre-line rounded-lg bg-white/[0.03] p-2.5 text-[12.5px] text-foreground/90">
                  {a.anotacoes_pessoais}
                </p>
              </Bloco>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Contador({ icone: I, n, titulo }: { icone: typeof Gavel; n: number; titulo: string }) {
  return (
    <span title={`${n} ${titulo}`} className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5">
      <I className="size-3" /> {n}
    </span>
  );
}

function Bloco({
  titulo,
  icone: I,
  children,
}: {
  titulo: string;
  icone?: typeof Gavel;
  children: React.ReactNode;
}) {
  return (
    <section className="hc-dentro p-3">
      <h4 className="hc-sobre mb-2 flex items-center gap-1.5">
        {I && <I className="size-3" />}
        {titulo}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Dado({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <p className="flex justify-between gap-3 text-[12.5px]">
      <span className="text-ink-3">{k}</span>
      <span className={cn("text-right text-foreground/90", mono && "font-mono")}>{v}</span>
    </p>
  );
}

function Vazio() {
  return <p className="text-[12px] text-ink-3">Nada registrado.</p>;
}
