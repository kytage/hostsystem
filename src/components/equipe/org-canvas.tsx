import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minus, Plus, Move } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN = 0.4;
const MAX = 1.6;

/**
 * Área de desenho do organograma: arrastar para mover, Ctrl + roda (ou botões) para zoom.
 * O conteúdo é centralizado na largura e começa no topo.
 */
export function OrgCanvas({ children, className, height = "min(72vh, 760px)" }: { children: ReactNode; className?: string; height?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fit = useCallback(() => {
    const vp = viewport.current;
    const ct = content.current;
    if (!vp || !ct) return;
    const s = Math.min(1, Math.max(MIN, (vp.clientWidth - 48) / ct.scrollWidth));
    setScale(s);
    setPos({ x: (vp.clientWidth - ct.scrollWidth * s) / 2, y: 24 });
  }, []);

  useEffect(() => {
    fit();
    const vp = viewport.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fit]);

  // Ctrl + roda: zoom ancorado no cursor
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setScale((s) => {
        const next = Math.min(MAX, Math.max(MIN, s * (e.deltaY < 0 ? 1.1 : 0.9)));
        setPos((p) => ({ x: cx - ((cx - p.x) * next) / s, y: cy - ((cy - p.y) * next) / s }));
        return next;
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const vp = viewport.current;
    if (!vp) return;
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    setScale((s) => {
      const next = Math.min(MAX, Math.max(MIN, s * f));
      setPos((p) => ({ x: cx - ((cx - p.x) * next) / s, y: cy - ((cy - p.y) * next) / s }));
      return next;
    });
  };

  return (
    <div
      ref={viewport}
      style={{ height }}
      className={cn("glass-inset relative overflow-hidden rounded-[20px] select-none", dragging ? "cursor-grabbing" : "cursor-grab", className)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, [data-no-pan]")) return;
        drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setPos({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
    >
      {/* grade sutil de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: `${22 * scale}px ${22 * scale}px`,
          backgroundPosition: `${pos.x}px ${pos.y}px`,
        }}
      />
      <div
        ref={content}
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: dragging ? "none" : "transform 180ms cubic-bezier(.2,.7,.2,1)" }}
      >
        {children}
      </div>

      <div className="glass-elevated absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full p-1" data-no-pan>
        <button onClick={() => zoomBy(0.85)} aria-label="Diminuir zoom" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground">
          <Minus className="size-3.5" />
        </button>
        <span className="w-11 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.15)} aria-label="Aumentar zoom" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
        <button onClick={fit} aria-label="Centralizar" title="Centralizar" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground">
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 text-[11px] text-ink-3">
        <Move className="size-3" /> Arraste para mover · Ctrl + roda para zoom
      </p>
    </div>
  );
}
