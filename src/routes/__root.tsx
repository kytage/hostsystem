import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar } from "@/components/app-sidebar";
import { instalarBordaElastica } from "@/lib/borda-elastica";
import { instalarSonsDaInterface, playSfx } from "@/lib/sfx";
import { supabase } from "@/integrations/supabase/client";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import { Toaster } from "@/components/ui/sonner";
import { getAuthUser } from "@/lib/auth-cache";
import { ehVisita } from "@/lib/hoki-visita";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente atualizar ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HOST Eventos e Cronograma" },
      {
        name: "description",
        content:
          "HOST Eventos e Cronograma: pendências, desenvolvimento e gestão de eventos do servidor em um só lugar.",
      },
      { property: "og:title", content: "HOST Eventos e Cronograma" },
      {
        property: "og:description",
        content:
          "HOST Eventos e Cronograma: pendências, desenvolvimento e gestão de eventos do servidor em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("host-theme")||"dark";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <div className="aurora" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthPage = pathname === "/auth";
  // Visita do HOKI: não vê o menu da equipe (só a tela do HOKI)
  const [visita, setVisita] = useState(false);
  useEffect(() => {
    let vivo = true;
    void getAuthUser()
      .then((u) => (u ? ehVisita(u.id) : false))
      .then((v) => {
        if (vivo) setVisita(v);
      });
    return () => {
      vivo = false;
    };
  }, [pathname]);

  usePresenceHeartbeat();


  // Reage a login/logout: invalida rotas e cache apenas em transições reais
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED")
        return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  // Sons da interface: aperto, menu e janelas (ligados uma vez só) e um sopro a cada troca de página.
  useEffect(() => instalarSonsDaInterface(), []);
  const primeiraPagina = useRef(true);
  useEffect(() => {
    if (primeiraPagina.current) primeiraPagina.current = false;
    else playSfx("nav");
  }, [pathname]);

  // Borda elástica: o fio de luz que estica na moldura dos componentes, perto do ponteiro.
  useEffect(() => instalarBordaElastica(), []);

  if (isAuthPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }

  // Páginas abertas a quem não tem conta: painel do líder (entra por código) e
  // link de afiliação. Ficam sem o menu da equipe.
  if (pathname === "/lider" || pathname.startsWith("/convite/") || pathname.startsWith("/visita")) {
    return (
      <QueryClientProvider client={queryClient}>
        <main className="relative z-10 min-h-screen w-full">
          <Outlet />
        </main>
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="moldura relative z-10 flex h-screen w-full overflow-hidden">
        {!visita && <AppSidebar />}
        <main key={pathname} className="page-main min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
