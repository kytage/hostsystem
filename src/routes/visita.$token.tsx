import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, KeyRound, Loader2, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { visitaConviteAbrir, visitaCriar } from "@/lib/hoki-visita.functions";
import { LogoExtenso } from "@/components/dashboard/Logo";

export const Route = createFileRoute("/visita/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite do HOKI — HOST" },
      { name: "description", content: "Você foi convidado para a praça do HOKI." },
    ],
  }),
  component: VisitaPage,
});

const campo =
  "h-12 w-full rounded-2xl border border-white/[0.09] bg-black/40 pl-11 pr-11 text-base text-foreground outline-none transition-colors placeholder:text-ink-3 focus:border-white/30 sm:text-sm";
const rotulo = "mb-1.5 block text-xs text-muted-foreground";
const botao =
  "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-black transition-all duration-200 hover:bg-white/90 active:scale-[0.985] disabled:opacity-60";

/** Página do convite: a visita escolhe o nome e a senha e já entra no HOKI. */
function VisitaPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const abrir = useServerFn(visitaConviteAbrir);
  const criar = useServerFn(visitaCriar);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const convite = useQuery({
    queryKey: ["visita-convite", token],
    queryFn: () => abrir({ data: { token } }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    const usuario = nome.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(usuario)) {
      setErro("Nome: 3 a 20 caracteres, só letras sem acento, números, _ ou ponto (sem espaço).");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não são iguais. Digite a mesma senha nos dois campos.");
      return;
    }
    setEnviando(true);
    try {
      await criar({ data: { token, nome: usuario, senha } });
      const { error } = await supabase.auth.signInWithPassword({
        email: `${usuario}@host.local`,
        password: senha,
      });
      if (error) throw new Error("Conta criada! Entre pela tela de login com seu nome e senha.");
      navigate({ to: "/hoki" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não deu para criar a conta agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="dark relative flex min-h-screen flex-col items-center overflow-hidden px-4">
      <div className="pf-glow pointer-events-none mt-[9vh] w-[min(1080px,94vw)] select-none">
        <LogoExtenso />
      </div>

      <div className="pf-modal glass relative z-10 -mt-[min(9vw,92px)] w-full max-w-sm rounded-[28px] !bg-black/45 p-6 backdrop-blur-2xl sm:p-7">
        <p className="eyebrow text-center">HOKI · Convite de visita</p>

        {convite.isPending ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : convite.isError ? (
          <div className="py-6 text-center">
            <h1 className="font-display text-xl font-semibold">Convite indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {convite.error instanceof Error ? convite.error.message : "Peça um novo convite."}
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-2 text-center font-display text-2xl font-semibold tracking-tight">
              Crie seu HOKI
            </h1>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Convite de <span className="text-foreground">{convite.data.convidadoPor}</span>.
              Escolha um nome e uma senha: é com eles que você entra depois.
            </p>
            <form onSubmit={entrar} className="mt-6 space-y-4">
              <label className="block">
                <span className={rotulo}>Seu nome</span>
                <span className="relative block">
                  <User className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    autoFocus
                    maxLength={20}
                    value={nome}
                    onChange={(e) => setNome(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="seu.nome"
                    className={campo}
                  />
                </span>
              </label>
              <label className="block">
                <span className={rotulo}>Senha</span>
                <span className="relative block">
                  <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <input
                    type={mostrar ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    className={campo}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar((v) => !v)}
                    aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 transition-colors hover:text-foreground"
                  >
                    {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </label>
              <label className="block">
                <span className={rotulo}>Confirmar senha</span>
                <span className="relative block">
                  <KeyRound className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <input
                    type={mostrar ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirma}
                    onChange={(e) => setConfirma(e.target.value)}
                    placeholder="repita a senha"
                    className={campo}
                  />
                </span>
              </label>
              {erro && (
                <p role="alert" className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-red-200">
                  {erro}
                </p>
              )}
              <button type="submit" disabled={enviando} className={botao}>
                {enviando && <Loader2 className="size-4 animate-spin" />} Criar conta e entrar
              </button>
            </form>
          </>
        )}
      </div>

      <p className="relative z-10 mt-auto pb-6 pt-8 text-[10px] uppercase tracking-[0.3em] text-ink-3">
        HOKI · acesso de visita
      </p>
    </div>
  );
}
