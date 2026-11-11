import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-cache";

/**
 * Visitas do HOKI (lado do navegador). A visita entra por um convite, escolhe
 * nome e senha e só usa o HOKI: o menu da equipe some e qualquer outra tela
 * leva de volta para /hoki. Quem realmente barra o resto é o banco (a visita
 * não tem cargo, então não passa nas regras da equipe).
 */
const visitantes = () => supabase.from("hoki_visitantes" as never);
const convites = () => supabase.from("hoki_convites" as never);

/** Guardado por usuário: a resposta não muda durante a sessão. */
const cache = new Map<string, Promise<boolean>>();
export function ehVisita(userId: string): Promise<boolean> {
  let p = cache.get(userId);
  if (!p) {
    p = Promise.resolve(visitantes().select("user_id").eq("user_id", userId).maybeSingle()).then(
      ({ data, error }) => !error && !!data,
      () => false,
    );
    cache.set(userId, p);
  }
  return p;
}

/** A pessoa logada é visita do HOKI? (false enquanto não sabe) */
export function useSouVisita() {
  const { data } = useQuery({
    queryKey: ["sou-visita"],
    queryFn: async () => {
      const user = await getAuthUser();
      return user ? ehVisita(user.id) : false;
    },
    staleTime: Infinity,
  });
  return data === true;
}

export interface ConviteHoki {
  token: string;
  link: string;
  expiraEm: string;
  maxUsos: number;
}

function gerarToken(tamanho = 10) {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

/** Gera um convite novo (só Coordinator+ consegue: o banco confere). */
export async function criarConviteHoki(): Promise<ConviteHoki> {
  const token = gerarToken();
  const { data, error } = await convites()
    .insert({ token } as never)
    .select("token, expira_em, max_usos")
    .single();
  if (error) throw new Error("Não deu para gerar o convite agora.");
  const c = data as unknown as { token: string; expira_em: string; max_usos: number };
  return {
    token: c.token,
    link: `${window.location.origin}/visita/${c.token}`,
    expiraEm: c.expira_em,
    maxUsos: c.max_usos,
  };
}
