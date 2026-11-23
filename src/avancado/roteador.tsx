// As telas do HOST CENTRAL foram feitas com o react-router e endereços como "/captacao/funil".
// Aqui elas rodam dentro do site, em /avancado/...: este arquivo oferece os mesmos ganchos
// (useNavigate, useParams, useSearchParams, useLocation, NavLink) usando o roteador do site.
import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const BASE = "/avancado";

/** "/captacao/funil?x=1" → "/avancado/captacao/funil?x=1" */
export const noSite = (para: string) => (para === "/" || para === "" ? BASE : `${BASE}${para.startsWith("/") ? para : `/${para}`}`);

/** Endereço atual sem o /avancado: pathname "/captacao/funil" e search "?x=1". */
export function useLocation() {
  const local = useRouterState({ select: (s) => s.location });
  const resto = local.pathname.startsWith(BASE) ? local.pathname.slice(BASE.length) : local.pathname;
  const pathname = resto === "" ? "/" : resto.replace(/\/+$/, "") || "/";
  const search = local.searchStr ?? "";
  return { pathname, search };
}

type Opcoes = { replace?: boolean };

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (para: string | number, opcoes: Opcoes = {}) => {
      if (typeof para === "number") return router.history.go(para);
      const destino = noSite(para);
      if (opcoes.replace) router.history.replace(destino);
      else router.history.push(destino);
    },
    [router],
  );
}

/** Pedaços do endereço: /captacao/:aba, /conteudo/:aba, /radar/:aba e /materiais/:id. */
export function useParams(): { aba?: string; id?: string } {
  const { pathname } = useLocation();
  const segundo = pathname.split("/").filter(Boolean)[1];
  return segundo ? { aba: decodeURIComponent(segundo), id: decodeURIComponent(segundo) } : {};
}

type Busca = URLSearchParams | Record<string, string>;

export function useSearchParams(): [URLSearchParams, (novo: Busca, opcoes?: Opcoes) => void] {
  const { pathname, search } = useLocation();
  const router = useRouter();
  const parametros = useMemo(() => new URLSearchParams(search), [search]);
  const mudar = useCallback(
    (novo: Busca, opcoes: Opcoes = {}) => {
      const p = novo instanceof URLSearchParams ? novo : new URLSearchParams(novo);
      const texto = p.toString();
      const destino = `${noSite(pathname)}${texto ? `?${texto}` : ""}`;
      if (opcoes.replace) router.history.replace(destino);
      else router.history.push(destino);
    },
    [pathname, router],
  );
  return [parametros, mudar];
}

/** Link que marca quando é a página atual (`end`: só no endereço exato). */
export function NavLink({
  to,
  end,
  className,
  title,
  children,
  onClick,
}: {
  to: string;
  end?: boolean;
  className?: string | ((s: { isActive: boolean }) => string);
  title?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const { pathname } = useLocation();
  const ir = useNavigate();
  const ativo = end ? pathname === to : pathname === to || pathname.startsWith(`${to === "/" ? "" : to}/`);
  const classe = typeof className === "function" ? className({ isActive: ativo }) : cn(className, ativo && "active");
  return (
    <a
      href={noSite(to)}
      className={classe}
      title={title}
      aria-current={ativo ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.();
        ir(to);
      }}
    >
      {children}
    </a>
  );
}

export const Link = NavLink;
