/**
 * Borda elástica: a moldura do componente sob o ponteiro vira um fio de luz.
 * Quando o ponteiro chega perto de uma borda, o fio se projeta alguns pixels
 * para fora ali, deixa um véu bem leve e volta ao lugar com um balanço curto.
 * É de propósito discreto: um detalhe, não um espetáculo.
 *
 * Um único canvas, por cima de tudo e sem receber cliques, desenha as molduras
 * ativas. O véu é o próprio rastro do fio: a cada quadro o desenho anterior
 * some só um pouco. Parado, nada roda: o laço só vive enquanto há fio mexendo.
 */

/** O que ganha a borda elástica. `data-sem-elastico` tira um elemento (a busca segue para o pai). */
const SELETOR =
  ".glass, .glass-inset, .glass-elevated, .glass-modal, .metal, .pilula, [data-elastico], [role='dialog'], button, a[class*='rounded'], input, textarea, select, [role='tab']";

const FORCA = 170; // leva o fio até o alvo
const ATRITO = 12; // o fio volta com um balanço curto, sem ficar chicoteando
const TENSAO = 240; // entre vizinhos: a onda corre pelo fio
const RASTRO = 0.3; // quanto do desenho anterior some por quadro (a 60 quadros por segundo)
const ARRASTO = 1.4; // quanto o movimento do ponteiro carrega o fio junto
const MAXIMO = 7; // molduras vivas ao mesmo tempo

interface Moldura {
  el: Element;
  n: number;
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  /** deslocamento ao longo da normal (para fora é positivo) e a velocidade dele */
  d: Float32Array;
  v: Float32Array;
  /** o quanto o ponteiro acende cada ponto (0 a 1) */
  q: Float32Array;
  w: number;
  h: number;
  raio: number;
  amp: number;
  alcance: number;
  sigma: number;
  viva: boolean;
  brilho: number;
  energia: number;
  /** último ponto do ponteiro dentro dela, relativo ao canto */
  px: number;
  py: number;
  /** ancestrais que rolam: o desenho é recortado neles */
  rolam: Element[];
}

const suave = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** Contorno do retângulo de cantos redondos, em pontos espaçados, no sentido horário. */
function contorno(w: number, h: number, raio: number) {
  const r = Math.max(0, Math.min(raio, w / 2, h / 2));
  const perimetro = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
  const passo = Math.min(9, Math.max(3.5, perimetro / 240));
  const xs: number[] = [];
  const ys: number[] = [];
  const nxs: number[] = [];
  const nys: number[] = [];
  const reta = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / passo));
    for (let i = 0; i < k; i++) {
      const t = i / k;
      xs.push(x0 + (x1 - x0) * t);
      ys.push(y0 + (y1 - y0) * t);
      nxs.push(nx);
      nys.push(ny);
    }
  };
  const arco = (cx: number, cy: number, a0: number, a1: number) => {
    if (r < 0.5) return;
    const k = Math.max(2, Math.round((r * Math.abs(a1 - a0)) / passo));
    for (let i = 0; i < k; i++) {
      const a = a0 + (a1 - a0) * (i / k);
      const c = Math.cos(a);
      const s = Math.sin(a);
      xs.push(cx + c * r);
      ys.push(cy + s * r);
      nxs.push(c);
      nys.push(s);
    }
  };
  reta(r, 0, w - r, 0, 0, -1);
  arco(w - r, r, -Math.PI / 2, 0);
  reta(w, r, w, h - r, 1, 0);
  arco(w - r, h - r, 0, Math.PI / 2);
  reta(w - r, h, r, h, 0, 1);
  arco(r, h - r, Math.PI / 2, Math.PI);
  reta(0, h - r, 0, r, -1, 0);
  arco(r, r, Math.PI, Math.PI * 1.5);
  return {
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    nx: Float32Array.from(nxs),
    ny: Float32Array.from(nys),
    r,
  };
}

function raioDe(el: Element, w: number, h: number) {
  const bruto = getComputedStyle(el).borderTopLeftRadius;
  const valor = parseFloat(bruto) || 0;
  return bruto.includes("%") ? (Math.min(w, h) * valor) / 100 : valor;
}

/** Liga a borda elástica na página inteira. Devolve a função que desliga. */
export function instalarBordaElastica(): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const tela = document.createElement("canvas");
  tela.setAttribute("aria-hidden", "true");
  tela.style.cssText =
    "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;pointer-events:none";
  const ctx = tela.getContext("2d");
  if (!ctx) return () => {};
  document.body.appendChild(tela);

  let dpr = 1;
  const medir = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    tela.width = Math.max(1, Math.round(window.innerWidth * dpr));
    tela.height = Math.max(1, Math.round(window.innerHeight * dpr));
  };
  medir();

  const molduras = new Map<Element, Moldura>();
  let atual: Moldura | null = null;
  let ultimoAlvo: EventTarget | null = null;
  let mx = 0;
  let my = 0;
  let vx = 0;
  let vy = 0;
  let tPonteiro = 0;
  let quadro = 0;
  let tAnterior = 0;
  let parado = 0;

  const refazer = (m: Moldura, w: number, h: number) => {
    const g = contorno(w, h, raioDe(m.el, w, h));
    const n = g.x.length;
    const menor = Math.min(w, h);
    m.n = n;
    m.x = g.x;
    m.y = g.y;
    m.nx = g.nx;
    m.ny = g.ny;
    m.d = new Float32Array(n);
    m.v = new Float32Array(n);
    m.q = new Float32Array(n);
    m.w = w;
    m.h = h;
    m.raio = g.r;
    // discreto: o fio só encosta para fora alguns pixels
    m.amp = Math.min(8, Math.max(2, menor * 0.065));
    m.alcance = Math.min(56, Math.max(12, menor * 0.36));
    m.sigma = Math.min(74, Math.max(16, menor * 0.36));
  };

  const criar = (el: Element): Moldura | null => {
    const caixa = el.getBoundingClientRect();
    if (caixa.width < 26 || caixa.height < 22) return null;
    if (getComputedStyle(el).display === "inline") return null;
    const rolam: Element[] = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const estilo = getComputedStyle(p);
      if (/(auto|scroll)/.test(estilo.overflowY + estilo.overflowX)) rolam.push(p);
    }
    const vazio = new Float32Array(0);
    const m: Moldura = {
      el,
      n: 0,
      x: vazio,
      y: vazio,
      nx: vazio,
      ny: vazio,
      d: vazio,
      v: vazio,
      q: vazio,
      w: 0,
      h: 0,
      raio: 0,
      amp: 0,
      alcance: 0,
      sigma: 0,
      viva: false,
      brilho: 0,
      energia: 0,
      px: 0,
      py: 0,
      rolam,
    };
    refazer(m, caixa.width, caixa.height);
    return m;
  };

  /** O componente mais próximo do alvo que aceita a borda elástica. */
  const acharAlvo = (alvo: EventTarget | null): Element | null => {
    let el = alvo instanceof Element ? alvo.closest(SELETOR) : null;
    while (
      el &&
      (el.hasAttribute("data-sem-elastico") || (el as HTMLButtonElement).disabled === true)
    ) {
      el = el.parentElement ? el.parentElement.closest(SELETOR) : null;
    }
    return el;
  };

  const trocar = (el: Element | null) => {
    if (atual && atual.el === el) return;
    if (atual) atual.viva = false;
    atual = null;
    if (!el) return;
    let m = molduras.get(el) ?? null;
    if (!m) {
      m = criar(el);
      if (!m) return;
      if (molduras.size >= MAXIMO) {
        // sai a mais calma que não está em uso
        let pior: Moldura | null = null;
        for (const o of molduras.values())
          if (!o.viva && (!pior || o.energia < pior.energia)) pior = o;
        if (pior) molduras.delete(pior.el);
      }
      molduras.set(el, m);
    }
    m.viva = true;
    atual = m;
  };

  const fisica = (m: Moldura, dt: number) => {
    const { n, d, v, q, x, y, nx, ny } = m;
    const borda = Math.min(m.px, m.py, m.w - m.px, m.h - m.py);
    const perto = m.viva ? suave(1 - borda / m.alcance) : 0;
    const s2 = 2 * m.sigma * m.sigma;
    const puxaX = Math.max(-900, Math.min(900, vx));
    const puxaY = Math.max(-900, Math.min(900, vy));
    for (let i = 0; i < n; i++) {
      const dx = m.px - x[i]!;
      const dy = m.py - y[i]!;
      const acende = perto > 0 ? Math.exp(-(dx * dx + dy * dy) / s2) * perto : 0;
      q[i] = acende;
      const antes = d[i === 0 ? n - 1 : i - 1]!;
      const depois = d[i === n - 1 ? 0 : i + 1]!;
      const aqui = d[i]!;
      const a =
        FORCA * (m.amp * acende - aqui) +
        TENSAO * (antes + depois - 2 * aqui) -
        ATRITO * v[i]! +
        ARRASTO * (puxaX * nx[i]! + puxaY * ny[i]!) * acende;
      v[i] = v[i]! + a * dt;
    }
    let energia = 0;
    const teto = m.amp * 2.2;
    for (let i = 0; i < n; i++) {
      let novo = d[i]! + v[i]! * dt;
      if (novo > teto) novo = teto;
      else if (novo < -teto) novo = -teto;
      d[i] = novo;
      const e = Math.abs(novo) + Math.abs(v[i]!) * 0.03;
      if (e > energia) energia = e;
    }
    m.energia = energia;
  };

  const desenhar = (m: Moldura, caixa: DOMRect) => {
    const { n, d, q, x, y, nx, ny } = m;
    const ox = caixa.left;
    const oy = caixa.top;

    // recorte: o que rola corta o que passa da sua janela
    let cortou = false;
    if (m.rolam.length) {
      let l = -1e6;
      let t = -1e6;
      let r = 1e6;
      let b = 1e6;
      for (const p of m.rolam) {
        const c = p.getBoundingClientRect();
        l = Math.max(l, c.left - 14);
        t = Math.max(t, c.top - 14);
        r = Math.min(r, c.right + 14);
        b = Math.min(b, c.bottom + 14);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(l, t, Math.max(0, r - l), Math.max(0, b - t));
      ctx.clip();
      cortou = true;
    }

    // véu: a área entre a moldura em repouso e o fio esticado, mais clara perto do ponteiro
    if (m.energia > 0.5) {
      ctx.beginPath();
      ctx.moveTo(ox + x[0]! + nx[0]! * d[0]!, oy + y[0]! + ny[0]! * d[0]!);
      for (let i = 1; i < n; i++)
        ctx.lineTo(ox + x[i]! + nx[i]! * d[i]!, oy + y[i]! + ny[i]! * d[i]!);
      ctx.closePath();
      ctx.moveTo(ox + x[0]!, oy + y[0]!);
      for (let i = n - 1; i > 0; i--) ctx.lineTo(ox + x[i]!, oy + y[i]!);
      ctx.closePath();
      const luz = ctx.createRadialGradient(
        ox + m.px,
        oy + m.py,
        0,
        ox + m.px,
        oy + m.py,
        m.sigma * 2.6 + m.amp,
      );
      luz.addColorStop(0, "rgba(255,255,255,0.035)");
      luz.addColorStop(0.6, "rgba(255,255,255,0.012)");
      luz.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = m.brilho;
      ctx.fillStyle = luz;
      ctx.fill();
    }

    // fio: só o trecho perto do ponteiro (ou ainda esticado) acende
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    const meio = m.amp * 0.55;
    for (let passada = 0; passada < 2; passada++) {
      ctx.lineWidth = passada === 0 ? 3.5 : 1;
      const peso = passada === 0 ? 0.03 : 0.4;
      for (let i = 0; i < n; i++) {
        const j = i === n - 1 ? 0 : i + 1;
        const a = m.brilho * Math.min(1, q[i]! * 1.15 + Math.abs(d[i]!) / meio);
        if (a < 0.03) continue;
        ctx.globalAlpha = a * peso;
        ctx.beginPath();
        ctx.moveTo(ox + x[i]! + nx[i]! * d[i]!, oy + y[i]! + ny[i]! * d[i]!);
        ctx.lineTo(ox + x[j]! + nx[j]! * d[j]!, oy + y[j]! + ny[j]! * d[j]!);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (cortou) ctx.restore();
  };

  const rodar = (agora: number) => {
    quadro = 0;
    const dt = Math.min(0.034, Math.max(0.001, (agora - tAnterior) / 1000));
    tAnterior = agora;

    // o ponteiro parado deixa de arrastar
    if (agora - tPonteiro > 50) {
      vx *= 0.7;
      vy *= 0.7;
    }

    // apaga um pouco do quadro anterior: o que sobra é o véu
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1 - Math.pow(1 - RASTRO, dt * 60);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let mexendo = false;
    for (const m of molduras.values()) {
      if (!m.el.isConnected) {
        molduras.delete(m.el);
        if (atual === m) atual = null;
        continue;
      }
      const caixa = m.el.getBoundingClientRect();
      if (Math.abs(caixa.width - m.w) > 0.75 || Math.abs(caixa.height - m.h) > 0.75) {
        if (caixa.width < 26 || caixa.height < 22) {
          molduras.delete(m.el);
          if (atual === m) atual = null;
          continue;
        }
        refazer(m, caixa.width, caixa.height);
      }
      if (m.viva) {
        m.px = mx - caixa.left;
        m.py = my - caixa.top;
      }
      const passos = dt > 0.02 ? 2 : 1;
      for (let k = 0; k < passos; k++) fisica(m, dt / passos);
      const acesa = m.viva || m.energia > 0.5;
      m.brilho += ((acesa ? 1 : 0) - m.brilho) * Math.min(1, dt * (acesa ? 12 : 7));
      if (!m.viva && m.energia < 0.12 && m.brilho < 0.03) {
        molduras.delete(m.el);
        continue;
      }
      if (m.energia > 0.12) mexendo = true;
      desenhar(m, caixa);
    }

    // sem nada mexendo por meio segundo: limpa e dorme até o próximo movimento
    parado = mexendo ? 0 : parado + dt;
    if (parado > 0.5) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, tela.width, tela.height);
      return;
    }
    quadro = requestAnimationFrame(rodar);
  };

  const acordar = () => {
    parado = 0;
    if (quadro || document.hidden) return;
    tAnterior = performance.now();
    quadro = requestAnimationFrame(rodar);
  };

  const mover = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const agora = performance.now();
    const dt = Math.max(0.004, (agora - tPonteiro) / 1000);
    if (dt < 0.12) {
      vx += ((e.clientX - mx) / dt - vx) * 0.35;
      vy += ((e.clientY - my) / dt - vy) * 0.35;
    } else {
      vx = 0;
      vy = 0;
    }
    mx = e.clientX;
    my = e.clientY;
    tPonteiro = agora;
    if (e.target !== ultimoAlvo) {
      ultimoAlvo = e.target;
      trocar(acharAlvo(e.target));
    }
    if (!atual) {
      if (molduras.size) acordar();
      return;
    }
    // só acorda o laço se o ponteiro está perto de uma borda (ou se ainda há fio mexendo)
    const caixa = atual.el.getBoundingClientRect();
    const borda = Math.min(mx - caixa.left, my - caixa.top, caixa.right - mx, caixa.bottom - my);
    if (borda < atual.alcance || molduras.size > 1 || atual.energia > 0.12) acordar();
  };

  const apertar = (e: PointerEvent) => {
    if (e.pointerType === "touch" || !atual) return;
    // o aperto dá um tranco para fora, em volta do ponteiro
    const m = atual;
    const s2 = 2 * (m.sigma * 1.6) * (m.sigma * 1.6);
    for (let i = 0; i < m.n; i++) {
      const dx = m.px - m.x[i]!;
      const dy = m.py - m.y[i]!;
      m.v[i] = m.v[i]! + m.amp * 6 * Math.exp(-(dx * dx + dy * dy) / s2);
    }
    m.energia = Math.max(m.energia, 1);
    acordar();
  };

  const sair = () => {
    if (atual) atual.viva = false;
    atual = null;
    ultimoAlvo = null;
    if (molduras.size) acordar();
  };

  const visibilidade = () => {
    if (document.hidden && quadro) {
      cancelAnimationFrame(quadro);
      quadro = 0;
    }
  };

  window.addEventListener("pointermove", mover, { passive: true });
  window.addEventListener("pointerdown", apertar, { passive: true });
  window.addEventListener("resize", medir);
  window.addEventListener("blur", sair);
  document.documentElement.addEventListener("pointerleave", sair);
  document.addEventListener("visibilitychange", visibilidade);

  return () => {
    window.removeEventListener("pointermove", mover);
    window.removeEventListener("pointerdown", apertar);
    window.removeEventListener("resize", medir);
    window.removeEventListener("blur", sair);
    document.documentElement.removeEventListener("pointerleave", sair);
    document.removeEventListener("visibilitychange", visibilidade);
    if (quadro) cancelAnimationFrame(quadro);
    tela.remove();
    molduras.clear();
  };
}
