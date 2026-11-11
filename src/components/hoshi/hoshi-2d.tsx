import { useId } from "react";
import { cn } from "@/lib/utils";
import { coresDe, peca, trajeDe, type Visual } from "@/lib/hoshi";

/**
 * HOSHI em 2D: a versão simplificada do boneco 3D, com o mesmo traje, cores
 * e acessórios. Usada na praça, nas vitrines do guarda-roupa e, com `busto`,
 * como foto de perfil no ranking.
 */
export function Hoshi2D({ visual, busto = false, className }: { visual: Visual; busto?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = coresDe(visual);
  const tipo = trajeDe(visual).tipo ?? "redonda";
  const roupa = peca(visual.roupa);
  const calca = peca(visual.calca);
  const chapeu = peca(visual.chapeu);
  const luvas = peca(visual.luvas);
  const calcado = peca(visual.calcado);
  const costas = peca(visual.costas);
  const efeito = peca(visual.efeito);
  const traco = "#2e2222";
  const corLuva = luvas?.tipo === "ouro" ? "#f2c14e" : c.luvas;
  const corPe = calcado?.tipo === "tenis" ? "#ffffff" : c.pes;
  const corOrelha = tipo === "panda" ? c.detalhe : c.capuz;
  const dentro = tipo === "coelho" ? "#ffffff" : c.detalhe;
  const corChapeu = chapeu?.tipo === "festa" ? c.acessorio : (chapeu?.cor ?? "#000");
  const listras = (p: { cor: string; listras?: string[] }, x: number, y: number, w: number, h: number) =>
    p.listras ? p.listras.map((cor, i, l) => <rect key={i} x={x} y={y + (h / l.length) * i} width={w} height={h / l.length + 0.05} fill={cor} />) : <rect x={x} y={y} width={w} height={h} fill={p.cor} />;

  return (
    <svg viewBox={busto ? "-1 -9 34 34" : "-8 -16 48 60"} className={cn(busto ? "size-full" : "h-[60px] w-[48px]", className)} aria-hidden>
      <defs>
        <clipPath id={`t${id}`}>
          <ellipse cx="16" cy="31" rx="6.4" ry="7" />
        </clipPath>
        <clipPath id={`h${id}`}>
          <ellipse cx="16" cy="13.5" rx="12.4" ry="11.6" />
        </clipPath>
      </defs>
      {efeito?.tipo === "aura" && <ellipse cx="16" cy="41.5" rx="15" ry="3.6" fill={efeito.cor} opacity="0.6" className="animate-pulse" />}
      <ellipse cx="16" cy="42" rx="8" ry="1.6" fill="rgba(0,0,0,0.3)" />

      {/* costas */}
      {costas?.tipo === "capa" && <path d="M9 24h14l4 15H5z" fill={costas.cor} stroke={traco} strokeWidth="0.7" strokeLinejoin="round" />}
      {costas?.tipo === "mochila" && <rect x="7.5" y="26" width="17" height="10" rx="3" fill={c.acessorio} stroke={traco} strokeWidth="0.7" />}
      {costas?.tipo === "asas" && (
        <>
          <path d="M9 30Q-3 20 1 33Q4 37 9 34z" fill="#fff" stroke={traco} strokeWidth="0.7" />
          <path d="M23 30Q35 20 31 33Q28 37 23 34z" fill="#fff" stroke={traco} strokeWidth="0.7" />
        </>
      )}
      {costas?.tipo?.startsWith("bandeira") && (
        <g>
          <rect x="27.6" y="-13" width="0.9" height="46" fill="#d8d8d8" stroke={traco} strokeWidth="0.3" />
          {costas.listras ? (
            listras(costas, 28.5, -12.5, 9, 6)
          ) : costas.tipo === "bandeira-brasil" ? (
            <>
              <rect x="28.5" y="-12.5" width="9" height="6" fill="#009c3b" />
              <path d="M33 -11.7l3.6 2.2-3.6 2.2-3.6-2.2z" fill="#ffdf00" />
              <circle cx="33" cy="-9.5" r="1.2" fill="#002776" />
            </>
          ) : (
            <>
              <rect x="28.5" y="-12.5" width="9" height="6" fill="#ce0e0e" />
              <path d="M31 -11v3M35 -11v3M31 -9.5h4" stroke="#fff" strokeWidth="1" />
            </>
          )}
          <rect x="28.5" y="-12.5" width="9" height="6" fill="none" stroke={traco} strokeWidth="0.4" />
        </g>
      )}

      {/* pernas e pés */}
      <rect x="11.2" y="35" width="3.6" height="5" rx="1.6" fill={calca ? calca.cor : c.principal} stroke={traco} strokeWidth="0.6" />
      <rect x="17.2" y="35" width="3.6" height="5" rx="1.6" fill={calca ? calca.cor : c.principal} stroke={traco} strokeWidth="0.6" />
      <ellipse cx="12.6" cy="40.6" rx={calcado?.tipo === "botas" ? 3.4 : 2.8} ry="1.9" fill={corPe} stroke={traco} strokeWidth="0.6" />
      <ellipse cx="19.4" cy="40.6" rx={calcado?.tipo === "botas" ? 3.4 : 2.8} ry="1.9" fill={corPe} stroke={traco} strokeWidth="0.6" />
      {/* braços e mãos */}
      <rect x="6.6" y="26.5" width="3.4" height="7.5" rx="1.7" fill={roupa ? (roupa.listras?.[0] ?? roupa.cor) : c.principal} stroke={traco} strokeWidth="0.6" transform="rotate(14 8.3 27)" />
      <rect x="22" y="26.5" width="3.4" height="7.5" rx="1.7" fill={roupa ? (roupa.listras?.[0] ?? roupa.cor) : c.principal} stroke={traco} strokeWidth="0.6" transform="rotate(-14 23.7 27)" />
      <circle cx="7.2" cy="34.4" r={luvas?.tipo === "fofas" ? 2.6 : 2} fill={corLuva} stroke={traco} strokeWidth="0.6" />
      <circle cx="24.8" cy="34.4" r={luvas?.tipo === "fofas" ? 2.6 : 2} fill={corLuva} stroke={traco} strokeWidth="0.6" />
      {/* tronco */}
      <ellipse cx="16" cy="31" rx="6.4" ry="7" fill={c.principal} />
      <g clipPath={`url(#t${id})`}>
        <ellipse cx="16" cy="32.5" rx="3.6" ry="4.6" fill={c.detalhe} />
        {roupa && listras(roupa, 9, 24, 14, calca ? 9 : 11)}
        {calca && <rect x="9" y="33" width="14" height="6" fill={calca.cor} />}
      </g>
      <ellipse cx="16" cy="31" rx="6.4" ry="7" fill="none" stroke={traco} strokeWidth="0.8" />
      {!roupa && (tipo === "redonda" || tipo === "original" || tipo === "veterano") && <path d="M16 28.4l0.7 1.4 1.5 0.2-1.1 1 0.3 1.5-1.4-0.7-1.4 0.7 0.3-1.5-1.1-1 1.5-0.2z" fill={tipo === "original" ? "#ce0e0e" : "#f2c14e"} />}

      {/* orelhas do capuz */}
      {tipo === "coelho" ? (
        <>
          <rect x="7.4" y="-13" width="5.2" height="17" rx="2.6" fill={corOrelha} stroke={traco} strokeWidth="0.8" transform="rotate(-9 10 4)" />
          <rect x="19.4" y="-13" width="5.2" height="17" rx="2.6" fill={corOrelha} stroke={traco} strokeWidth="0.8" transform="rotate(9 22 4)" />
          <rect x="9" y="-10.5" width="2" height="11" rx="1" fill={dentro} transform="rotate(-9 10 4)" />
          <rect x="21" y="-10.5" width="2" height="11" rx="1" fill={dentro} transform="rotate(9 22 4)" />
        </>
      ) : tipo === "gato" || tipo === "raposa" ? (
        <>
          <path d={tipo === "raposa" ? "M4.5 8L6-6l8.5 7z" : "M5 8L7-3l7.5 4.5z"} fill={corOrelha} stroke={traco} strokeWidth="0.8" strokeLinejoin="round" />
          <path d={tipo === "raposa" ? "M27.5 8L26-6l-8.5 7z" : "M27 8L25-3l-7.5 4.5z"} fill={corOrelha} stroke={traco} strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M7.4 4.5l0.8-4.6 3.6 2.6zM24.6 4.5l-0.8-4.6-3.6 2.6z" fill={dentro} />
          {tipo === "raposa" && <path d="M5.4 -1.5L6-6l2.4 2zM26.6 -1.5L26-6l-2.4 2z" fill={c.luvas} />}
        </>
      ) : (
        <>
          <circle cx="6.5" cy="3.6" r="4.1" fill={corOrelha} stroke={traco} strokeWidth="0.8" />
          <circle cx="25.5" cy="3.6" r="4.1" fill={corOrelha} stroke={traco} strokeWidth="0.8" />
          <circle cx="6.8" cy="4" r="2.1" fill={dentro} />
          <circle cx="25.2" cy="4" r="2.1" fill={dentro} />
        </>
      )}

      {/* capuz e rosto */}
      <ellipse cx="16" cy="13.5" rx="12.4" ry="11.6" fill={c.capuz} />
      <g clipPath={`url(#h${id})`}>{chapeu?.tipo === "bone" && <rect x="2" y="1" width="28" height="7.4" fill={corChapeu} />}</g>
      <ellipse cx="16" cy="13.5" rx="12.4" ry="11.6" fill="none" stroke={traco} strokeWidth="0.9" />
      <ellipse cx="16" cy="14.6" rx="9.3" ry="8.4" fill="#fff4e6" stroke={traco} strokeWidth="0.5" />
      {tipo === "panda" && (
        <>
          <ellipse cx="12" cy="14.4" rx="2.9" ry="3.5" fill="#1c1c1c" />
          <ellipse cx="20" cy="14.4" rx="2.9" ry="3.5" fill="#1c1c1c" />
        </>
      )}
      {visual.oculos === "oculos:visor" ? (
        <rect x="7" y="11.6" width="18" height="5" rx="2.5" fill="#ff2a2a" stroke={traco} strokeWidth="0.5" />
      ) : visual.oculos === "oculos:escuros" ? (
        <>
          <ellipse cx="12" cy="14.4" rx="3.5" ry="3" fill="#111" />
          <ellipse cx="20" cy="14.4" rx="3.5" ry="3" fill="#111" />
          <rect x="15" y="13.6" width="2" height="0.9" fill="#111" />
        </>
      ) : (
        <>
          <ellipse cx="12" cy="14.4" rx="1.7" ry="2.3" fill="#141010" />
          <ellipse cx="20" cy="14.4" rx="1.7" ry="2.3" fill="#141010" />
          <circle cx="12.5" cy="13.5" r="0.6" fill="#fff" />
          <circle cx="20.5" cy="13.5" r="0.6" fill="#fff" />
        </>
      )}
      <ellipse cx="8.8" cy="17.6" rx="1.6" ry="1" fill="#ff9aa8" opacity="0.7" />
      <ellipse cx="23.2" cy="17.6" rx="1.6" ry="1" fill="#ff9aa8" opacity="0.7" />
      <path d="M14.8 18.6q1.2 1 2.4 0" stroke="#b0475a" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {tipo === "coelho" && <path d="M25 1.2l1 2 2.2 0.3-1.6 1.5 0.4 2.2-2-1.1-2 1.1 0.4-2.2-1.6-1.5 2.2-0.3z" fill={c.detalhe} stroke={traco} strokeWidth="0.5" strokeLinejoin="round" />}
      {tipo === "veterano" && <path d="M5 9.5Q16 3.5 27 9.5" stroke="#f2c14e" strokeWidth="1" fill="none" />}

      {/* chapéus */}
      {chapeu?.tipo === "bone" && <ellipse cx="16" cy="8.3" rx="10.5" ry="1.8" fill={corChapeu} stroke={traco} strokeWidth="0.6" />}
      {chapeu?.tipo === "cartola" && (
        <>
          <rect x="9.5" y="-8" width="13" height="10" fill={corChapeu} stroke={traco} strokeWidth="0.6" />
          <rect x="9.5" y="-0.5" width="13" height="2" fill="#ce0e0e" />
          <rect x="5" y="1.6" width="22" height="2.2" rx="1.1" fill={corChapeu} stroke={traco} strokeWidth="0.6" />
        </>
      )}
      {chapeu?.tipo === "coroa" && <path d="M8.5 3.4V-3.4l3.7 3.2L16-5l3.8 4.8 3.7-3.2v6.8z" fill={corChapeu} stroke="#8a6a12" strokeWidth="0.7" strokeLinejoin="round" />}
      {chapeu?.tipo === "festa" && (
        <>
          <path d="M11 3L16-9l5 12z" fill={corChapeu} stroke={traco} strokeWidth="0.6" strokeLinejoin="round" />
          <circle cx="16" cy="-9.6" r="1.6" fill="#fff" stroke={traco} strokeWidth="0.4" />
        </>
      )}
      {chapeu?.tipo === "tiara" && (
        <>
          <path d="M5.5 7Q16 -1 26.5 7" stroke="#f2c14e" strokeWidth="1.1" fill="none" />
          <path d="M16 -3.6l1.2 2.4 2.6 0.4-1.9 1.8 0.5 2.6-2.4-1.3-2.4 1.3 0.5-2.6-1.9-1.8 2.6-0.4z" fill="#f2c14e" stroke="#8a6a12" strokeWidth="0.5" strokeLinejoin="round" />
        </>
      )}

      {/* brilhos e auréola */}
      {efeito?.tipo === "aureola" && <ellipse cx="16" cy={tipo === "coelho" ? -14 : -5} rx="7" ry="1.8" fill="none" stroke={efeito.cor} strokeWidth="1.5" />}
      {efeito?.tipo === "glitter" &&
        [[-4, 8], [36, 14], [-3, 30], [35, 34], [3, -6], [30, -4]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y! - 2}l0.7 1.3 1.3 0.7-1.3 0.7-0.7 1.3-0.7-1.3-1.3-0.7 1.3-0.7z`} fill={efeito.listras ? (efeito.listras[i % efeito.listras.length] ?? efeito.cor) : efeito.cor} className="animate-pulse" style={{ animationDelay: `${i * 180}ms` }} />
        ))}
    </svg>
  );
}
