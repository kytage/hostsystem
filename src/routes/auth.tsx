import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { definirMinhaSenha } from "@/lib/users.functions";
import hostSimbolo from "@/assets/host-simbolo.png.asset.json";

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

  const verificarTrocaSenha = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/" });
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
      navigate({ to: "/" });
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
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Gradiente cinza + grid animado */}
      <div
        className="auth-glow pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% -10%, rgb(206 14 14 / 26%), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 110%, rgb(206 14 14 / 14%), transparent 70%)",
        }}
      />
      <div className="auth-grid pointer-events-none absolute inset-0" />

      {/* Logo sutil ao fundo */}
      <img
        src={hostSimbolo.url}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 w-[420px] select-none opacity-[0.05]"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <img
            src={hostSimbolo.url}
            alt="HOST"
            className="size-14 select-none object-contain drop-shadow-[0_0_24px_rgb(206_14_14/45%)]"
          />
          <h1 className="mt-5 text-xl font-light uppercase tracking-[0.45em] text-foreground">
            Host <span className="font-semibold text-primary">Saas</span>
          </h1>
          <p className="mt-2 text-xs font-light tracking-wide text-muted-foreground">
            Sistema administrativo e desenvolvimento privado
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          {criandoSenha ? (
            <form onSubmit={handleCriarSenha} className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <KeyRound className="size-3.5" /> Primeiro acesso
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Você entrou com um token temporário. Crie agora a sua senha pessoal — ela será
                  usada nos próximos acessos. Mínimo de 6 caracteres.
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Nova senha
                </span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showNova ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showNova ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showNova ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Confirmar senha
                </span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showNova ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="repita a senha"
                    className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              </label>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground glow-red transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Criar senha e entrar
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Usuário
                </span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="seu.usuario"
                    className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Senha ou token
                </span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground glow-red transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Entrar no painel
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Conexão segura — dados sincronizados na nuvem
        </p>
      </div>
    </div>
  );
}
