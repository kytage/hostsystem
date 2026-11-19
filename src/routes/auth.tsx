import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { definirMinhaSenha } from "@/lib/users.functions";
import { LogoExtenso } from "@/components/dashboard/Logo";
import { CHAVE_ABERTURA } from "@/components/abertura";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — HOST Eventos e Cronograma" },
      { name: "description", content: "Sistema administrativo e desenvolvimento privado." },
      { property: "og:title", content: "Entrar — HOST Eventos e Cronograma" },
      { property: "og:description", content: "Sistema administrativo e desenvolvimento privado." },
    ],
  }),
  component: AuthPage,
});

/** O login é por usuário; internamente vira um e-mail sintético. */
const toEmail = (username: string) =>
  `${username.trim().toLowerCase()}@host.local`;

function AuthPage() {
  const navigate = useNavigate();
  const definirSenha = useServerFn(definirMinhaSenha);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Etapa de primeiro acesso: usuário autenticado com token precisa criar a senha
  const [criandoSenha, setCriandoSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [inclina, setInclina] = useState({ x: 0, y: 0 });

  // Quem chega aqui está deslogado: a próxima entrada mostra a abertura de novo.
  useEffect(() => {
    try {
      sessionStorage.removeItem(CHAVE_ABERTURA);
    } catch {
      // sem armazenamento, nada a limpar
    }
  }, []);

  /** Vai para o painel avisando a abertura de que o login acabou de acontecer. */
  const irParaPainel = () => {
    try {
      sessionStorage.setItem(CHAVE_ABERTURA, "login");
    } catch {
      // sem armazenamento: entra sem a animação do portal
    }
    navigate({ to: "/" });
  };

  const verificarTrocaSenha = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      irParaPainel();
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("deve_trocar_senha")
      .eq("id", auth.user.id)
      .single();
    if (profile?.deve_trocar_senha) {
      setCriandoSenha(true);
    } else {
      irParaPainel();
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const user = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,20}$/.test(user)) {
      setError("Usuário inválido: 3 a 20 caracteres (letras, números, _ . -)");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: toEmail(user),
        password,
      });
      if (err) {
        setError(
          err.message === "Invalid login credentials"
            ? "Usuário ou senha incorretos."
            : err.message
        );
        return;
      }
      await verificarTrocaSenha();
    } finally {
      setLoading(false);
    }
  };

  const handleCriarSenha = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (novaSenha.length < 6) {
      setError("A nova senha precisa de pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setError("As senhas não coincidem. Digite a mesma senha nos dois campos.");
      return;
    }
    setLoading(true);
    try {
      await definirSenha({ data: { password: novaSenha } });
      irParaPainel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setLoading(false);
    }
  };

  const campo =
    "h-12 w-full rounded-2xl border border-white/[0.09] bg-black/40 pl-11 pr-11 text-base text-foreground outline-none transition-colors placeholder:text-ink-3 focus:border-white/30 sm:text-sm";
  const rotulo = "mb-1.5 block text-xs text-muted-foreground";
  const botao =
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-black transition-all duration-200 hover:bg-white/90 active:scale-[0.985] disabled:opacity-60";

  return (
    <div
      className="dark relative flex min-h-screen flex-col items-center overflow-hidden px-4"
      onPointerMove={(e) => setInclina({ x: (0.5 - e.clientY / window.innerHeight) * 10, y: (e.clientX / window.innerWidth - 0.5) * 14 })}
    >
      {/* HOST gigante atrás do cartão de vidro, inclinando em 3D com o ponteiro */}
      <div className="pf-glow pointer-events-none mt-[9vh] w-[min(1080px,94vw)] select-none" style={{ perspective: 1200 }}>
        <div className="transition-transform duration-500 ease-out" style={{ transform: `rotateX(${inclina.x}deg) rotateY(${inclina.y}deg)` }}>
          <LogoExtenso />
        </div>
      </div>

      <div className="pf-modal glass relative z-10 -mt-[min(9vw,92px)] w-full max-w-sm rounded-[28px] !bg-black/45 p-6 backdrop-blur-2xl sm:p-7">
        <p className="eyebrow text-center">HOST GROUP · Sistema e gestão</p>
        <h1 className="mt-2 text-center font-display text-2xl font-semibold tracking-tight">{criandoSenha ? "Crie sua senha" : "Acesse o painel"}</h1>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          {criandoSenha ? "Primeiro acesso: escolha uma senha pessoal de pelo menos 6 caracteres." : "Sistema administrativo privado da equipe."}
        </p>

        {criandoSenha ? (
          <form onSubmit={handleCriarSenha} className="mt-6 space-y-4">
            <label className="block">
              <span className={rotulo}>Nova senha</span>
              <span className="relative block">
                <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input type={showNova ? "text" : "password"} required minLength={6} autoComplete="new-password" autoFocus value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="mínimo 6 caracteres" className={campo} />
                <button type="button" onClick={() => setShowNova((v) => !v)} aria-label={showNova ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 transition-colors hover:text-foreground">
                  {showNova ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            <label className="block">
              <span className={rotulo}>Confirmar senha</span>
              <span className="relative block">
                <KeyRound className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input type={showNova ? "text" : "password"} required minLength={6} autoComplete="new-password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} placeholder="repita a senha" className={campo} />
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-red-200">{error}</p>}
            <button type="submit" disabled={loading} className={botao}>
              {loading && <Loader2 className="size-4 animate-spin" />} Criar senha e entrar
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className={rotulo}>Usuário</span>
              <span className="relative block">
                <User className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input type="text" required autoComplete="username" autoCapitalize="none" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu.usuario" className={campo} />
              </span>
            </label>
            <label className="block">
              <span className={rotulo}>Senha ou token</span>
              <span className="relative block">
                <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input type={showPassword ? "text" : "password"} required minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={campo} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 transition-colors hover:text-foreground">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-red-200">{error}</p>}
            <button type="submit" disabled={loading} className={botao}>
              {loading && <Loader2 className="size-4 animate-spin" />} Entrar no painel
            </button>
          </form>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-3">
          <ShieldCheck className="size-3.5" /> Conexão segura
        </p>
      </div>

      <p className="relative z-10 mt-auto pb-6 pt-8 text-[10px] uppercase tracking-[0.3em] text-ink-3">desenvolvido por henrique bonne</p>
    </div>
  );
}
