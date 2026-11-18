import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

/**
 * Mapa do GTA V (Atlas e Satélite), com os pedaços guardados no Supabase (bucket público "mapa").
 * Recebe coordenadas do jogo (x, y) e marca cada ponto como um radar que pisca.
 *
 * A conversão das coordenadas do jogo para o mapa usa a calibração do projeto
 * gta-v-map-leaflet (RiceaRaul, licença MIT), o mesmo de onde vieram os pedaços do mapa.
 */

export interface PontoNoMapa {
  id: string | number;
  x: number;
  y: number;
  /** 0 a 1: quanto o radar já "esfriou" (1 = acabou de acontecer). */
  forca?: number;
  titulo?: string;
}

export type EstiloDoMapa = "atlas" | "satelite";

const PASTA: Record<EstiloDoMapa, string> = { atlas: "styleAtlas", satelite: "styleSatelite" };
const BASE = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const urlDosPedacos = (estilo: EstiloDoMapa) =>
  `${BASE}/storage/v1/object/public/mapa/${PASTA[estilo]}/{z}/{x}/{y}.jpg`;

/** Coordenada do jogo → posição no mapa (no Leaflet a ordem é [y, x]). */
export const posicaoDoJogo = (x: number, y: number): [number, number] => [y, x];

/** Lê "x, y, z" (ou "x,y,z") e devolve as coordenadas do jogo. */
export function lerCds(texto: string): { x: number; y: number } | null {
  const m = texto.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function criarCrs(L: typeof Leaflet): Leaflet.CRS {
  // calibração do gta-v-map-leaflet (MIT)
  return Object.assign({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    scale: (zoom: number) => Math.pow(2, zoom),
    zoom: (sc: number) => Math.log(sc) / Math.LN2,
    distance: (a: Leaflet.LatLng, b: Leaflet.LatLng) => Math.hypot(b.lng - a.lng, b.lat - a.lat),
    transformation: new L.Transformation(0.02072, 117.3, -0.0205, 172.8),
    infinite: true,
  });
}

export function MapaGta({
  pontos,
  foco,
  selecionado,
  onPonto,
  estilo = "atlas",
  className,
}: {
  pontos: PontoNoMapa[];
  /** Centraliza neste ponto (coordenadas do jogo) com zoom de perto. */
  foco?: { x: number; y: number } | null;
  selecionado?: string | number | null;
  onPonto?: (id: string | number) => void;
  estilo?: EstiloDoMapa;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const camadaPontos = useRef<Leaflet.LayerGroup | null>(null);
  const camadaFundo = useRef<Leaflet.TileLayer | null>(null);
  const aoClicar = useRef(onPonto);
  aoClicar.current = onPonto;

  // cria o mapa uma vez (o Leaflet só existe no navegador)
  useEffect(() => {
    let vivo = true;
    void import("leaflet").then((mod) => {
      const L = (mod.default ?? mod) as typeof Leaflet;
      if (!vivo || !caixa.current || mapa.current) return;
      leaflet.current = L;
      const crs = criarCrs(L);
      // o desenho do mapa inteiro (os pedaços do zoom 0 ocupam 256×256)
      const mundo = L.latLngBounds(
        crs.pointToLatLng(L.point(0, 0), 0),
        crs.pointToLatLng(L.point(256, 256), 0),
      );
      const m = L.map(caixa.current, {
        crs,
        maxZoom: 7,
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true,
        // zoom em passos de 1/4: o mapa inteiro enche melhor a caixa
        zoomSnap: 0.25,
        // não deixa arrastar para fora do desenho (nada de borda em branco)
        maxBounds: mundo,
        maxBoundsViscosity: 1,
      });
      // o menor zoom é o que cobre a caixa inteira com o mapa
      const encher = () => {
        m.invalidateSize();
        const z = m.getBoundsZoom(mundo, true);
        m.setMinZoom(z);
        if (m.getZoom() < z || !m.getCenter()) m.setView(mundo.getCenter(), z);
      };
      m.setView(mundo.getCenter(), 2);
      encher();
      camadaPontos.current = L.layerGroup().addTo(m);
      mapa.current = m;
      // a caixa pode nascer escondida ou mudar de tamanho: refaz o zoom mínimo
      const olheiro = new ResizeObserver(() => encher());
      olheiro.observe(caixa.current);
      m.on("unload", () => olheiro.disconnect());
      trocarFundo();
      desenharPontos();
      centralizar();
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarFundo() {
    const L = leaflet.current;
    const m = mapa.current;
    if (!L || !m) return;
    camadaFundo.current?.remove();
    camadaFundo.current = L.tileLayer(urlDosPedacos(estilo), {
      minZoom: 0,
      maxZoom: 7,
      maxNativeZoom: 5,
      noWrap: true,
      tileSize: 256,
      errorTileUrl: `${BASE}/storage/v1/object/public/mapa/${PASTA[estilo]}/empty.jpg`,
    }).addTo(m);
    camadaFundo.current.bringToBack();
  }

  function desenharPontos() {
    const L = leaflet.current;
    const grupo = camadaPontos.current;
    if (!L || !grupo) return;
    grupo.clearLayers();
    for (const p of pontos) {
      const forca = Math.max(0.25, Math.min(1, p.forca ?? 1));
      const icone = L.divIcon({
        className: "mapa-radar-icone",
        html: `<span class="mapa-radar${p.id === selecionado ? " mapa-radar-ativo" : ""}" style="--forca:${forca.toFixed(2)}"><i></i></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marca = L.marker(posicaoDoJogo(p.x, p.y), {
        icon: icone,
        title: p.titulo ?? "",
        zIndexOffset: p.id === selecionado ? 1000 : Math.round(forca * 100),
      });
      marca.on("click", () => aoClicar.current?.(p.id));
      grupo.addLayer(marca);
    }
  }

  function centralizar() {
    const m = mapa.current;
    if (!m || !foco) return;
    m.setView(posicaoDoJogo(foco.x, foco.y), Math.max(m.getZoom(), 5), { animate: true });
  }

  useEffect(() => {
    trocarFundo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estilo]);
  useEffect(() => {
    desenharPontos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos, selecionado]);
  useEffect(() => {
    centralizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.x, foco?.y]);

  return <div ref={caixa} data-estilo={estilo} className={cn("mapa-gta", className)} />;
}
