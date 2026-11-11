import { useQuery } from "@tanstack/react-query";
import { Thermometer } from "lucide-react";
import { CartaoDoQuadro, useQueridometro } from "@/components/hoki/queridometro";
import { getAuthUserData } from "@/lib/auth-cache";
import { QUERIDOMETRO } from "@/lib/termometro";

/**
 * Queridômetro de hoje, na tela inicial: só mostra o quadro. Para entregar
 * emojis, o HOKI precisa ir até o termômetro que pisca na praça.
 */
export function Termometro() {
  const { data: euId = "" } = useQuery({
    queryKey: ["meu-id"],
    queryFn: async () => (await getAuthUserData()).user?.id ?? "",
    staleTime: Infinity,
  });
  const { quadro, pendentes } = useQueridometro(euId);
  const comEmoji = quadro.filter((l) => l.total > 0);

  return (
    <section className="glass h-full rounded-[24px] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13.5px] font-medium text-foreground/90">
          <Thermometer className="size-4 text-[#ff6a57]" strokeWidth={1.7} /> Queridômetro de hoje
        </h2>
        <span className="flex items-center gap-1 text-[14px] leading-none" aria-hidden>
          {QUERIDOMETRO.map((e) => (
            <span key={e.nome} title={e.nome}>
              {e.emoji}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        Para entregar emojis, acorde o seu HOKI e vá até o termômetro que pisca na praça.
        {pendentes > 0
          ? ` Você ainda pode entregar para ${pendentes} ${pendentes > 1 ? "pessoas" : "pessoa"} hoje.`
          : ""}{" "}
        Zera à meia-noite.
      </p>

      {comEmoji.length === 0 ? (
        <p className="glass-inset mt-3 rounded-2xl border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Ninguém recebeu emoji hoje ainda.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {comEmoji.slice(0, 6).map((l) => (
            <li key={l.perfil.id}>
              <CartaoDoQuadro linha={l} compacto />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
