/**
 * Arte dos stories do ATO: imagem 1080×1920 desenhada no próprio navegador
 * (canvas), sem enviar nada para servidor nenhum. Serve para o membro salvar e
 * postar nos stories dizendo que faz parte do ATO da HOST.
 */
import { LOGO_PATHS, LOGO_VIEWBOX } from "@/components/dashboard/Logo";
import { ATO } from "@/lib/org-painel-shared";

export const STORY_W = 1080;
export const STORY_H = 1920;

const FONTE = "Manrope, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
const VERMELHO = "#ce0e0e";

export interface StoryDados {
  /** Linha pequena acima do nome do ATO. Ex.: "Faço parte do" */
  chamada: string;
  /** Nome em destaque: a pessoa ou a organização. */
  nome: string;
  /** Texto da etiqueta abaixo do nome. Ex.: "Gerente · Máfia" */
  etiqueta: string;
}

type Ctx = CanvasRenderingContext2D;

async function carregarFontes(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([document.fonts.load("700 120px Manrope"), document.fonts.load("600 36px Manrope")]);
  } catch {
    // sem a fonte da marca, a arte sai com a fonte do sistema
  }
}

const fonte = (peso: number, tamanho: number) => `${peso} ${tamanho}px ${FONTE}`;

/** Largura de um texto com espaçamento entre as letras. */
function larguraEspacada(ctx: Ctx, texto: string, espaco: number): number {
  const letras = [...texto];
  return letras.reduce((soma, l) => soma + ctx.measureText(l).width, 0) + espaco * Math.max(0, letras.length - 1);
}

/** Texto centralizado com espaçamento entre as letras (o canvas não faz isso sozinho em todo navegador). */
function textoEspacado(ctx: Ctx, texto: string, centro: number, y: number, espaco: number): void {
  let x = centro - larguraEspacada(ctx, texto, espaco) / 2;
  ctx.textAlign = "left";
  for (const letra of texto) {
    ctx.fillText(letra, x, y);
    x += ctx.measureText(letra).width + espaco;
  }
}

function retanguloArredondado(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Maior tamanho de fonte (entre min e max) em que o texto cabe na largura. */
function tamanhoQueCabe(ctx: Ctx, texto: string, peso: number, max: number, min: number, largura: number): number {
  for (let t = max; t > min; t -= 2) {
    ctx.font = fonte(peso, t);
    if (ctx.measureText(texto).width <= largura) return t;
  }
  return min;
}

/** Corta com reticências quando nem no menor tamanho o texto cabe. */
function cortar(ctx: Ctx, texto: string, largura: number): string {
  if (ctx.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export async function desenharStory(canvas: HTMLCanvasElement, dados: StoryDados): Promise<void> {
  await carregarFontes();
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu gerar a imagem.");

  const W = STORY_W;
  const H = STORY_H;
  const cx = W / 2;
  const [palavra = "ATO", numero = ""] = ATO.split(" ");

  // Fundo preto com a luz vermelha da HOST vindo do topo e um reflexo na base.
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);
  const luz = ctx.createRadialGradient(cx, -160, 0, cx, -160, 1320);
  luz.addColorStop(0, "rgba(206,14,14,0.92)");
  luz.addColorStop(0.42, "rgba(125,8,8,0.42)");
  luz.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, W, 1320);
  const reflexo = ctx.createRadialGradient(cx, H + 260, 0, cx, H + 260, 900);
  reflexo.addColorStop(0, "rgba(206,14,14,0.30)");
  reflexo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = reflexo;
  ctx.fillRect(0, H - 900, W, 900);

  // Grade bem discreta.
  ctx.strokeStyle = "rgba(255,255,255,0.028)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 90; x < W; x += 90) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 90; y < H; y += 90) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Moldura fina.
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2;
  retanguloArredondado(ctx, 44, 44, W - 88, H - 88, 56);
  ctx.stroke();

  // Marca HOST.
  const larguraLogo = 168;
  const escala = larguraLogo / LOGO_VIEWBOX.largura;
  ctx.save();
  ctx.translate(cx - larguraLogo / 2, 196);
  ctx.scale(escala, escala);
  ctx.fillStyle = "#ffffff";
  for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = fonte(700, 40);
  textoEspacado(ctx, "HOST", cx, 446, 26);

  // Chamada.
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = fonte(600, 36);
  textoEspacado(ctx, dados.chamada.toUpperCase(), cx, 712, 12);

  // Nome do ato: palavra em branco e número em vermelho, com brilho.
  let tamanhoAto = 300;
  ctx.font = fonte(700, tamanhoAto);
  while (tamanhoAto > 160 && ctx.measureText(ATO).width > 900) {
    tamanhoAto -= 10;
    ctx.font = fonte(700, tamanhoAto);
  }
  const larguraPalavra = ctx.measureText(numero ? `${palavra} ` : palavra).width;
  const larguraNumero = numero ? ctx.measureText(numero).width : 0;
  const inicio = cx - (larguraPalavra + larguraNumero) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(palavra, inicio, 990);
  if (numero) {
    ctx.save();
    ctx.shadowColor = "rgba(206,14,14,0.78)";
    ctx.shadowBlur = 90;
    ctx.fillStyle = VERMELHO;
    ctx.fillText(numero, inicio + larguraPalavra, 990);
    ctx.restore();
  }

  // Linha de separação.
  const linha = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
  linha.addColorStop(0, "rgba(206,14,14,0)");
  linha.addColorStop(0.5, "rgba(206,14,14,1)");
  linha.addColorStop(1, "rgba(206,14,14,0)");
  ctx.fillStyle = linha;
  ctx.fillRect(cx - 300, 1078, 600, 3);

  // Nome em destaque.
  const nome = dados.nome.trim() || "HOST";
  const tamanhoNome = tamanhoQueCabe(ctx, nome, 700, 108, 52, 900);
  ctx.font = fonte(700, tamanhoNome);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(cortar(ctx, nome, 900), cx, 1240);

  // Etiqueta em pílula.
  const etiqueta = dados.etiqueta.trim().toUpperCase();
  if (etiqueta) {
    const espaco = 5;
    let tamanho = 34;
    ctx.font = fonte(600, tamanho);
    while (tamanho > 22 && larguraEspacada(ctx, etiqueta, espaco) > 820) {
      tamanho -= 2;
      ctx.font = fonte(600, tamanho);
    }
    const larguraTexto = Math.min(820, larguraEspacada(ctx, etiqueta, espaco));
    const w = larguraTexto + 88;
    const h = 84;
    const x = cx - w / 2;
    const y = 1300;
    retanguloArredondado(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    textoEspacado(ctx, etiqueta, cx, y + h / 2 + tamanho * 0.35, espaco);
  }

  // Rodapé.
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = fonte(600, 28);
  textoEspacado(ctx, `HOST · ${ATO}`, cx, 1792, 10);
}

export async function storyBlob(dados: StoryDados): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await desenharStory(canvas, dados);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem."))), "image/png");
  });
}

/** Nome do arquivo sem acentos nem espaços. */
export function nomeArquivoStory(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${ATO.toLowerCase().replace(/\s+/g, "")}-${base || "host"}.png`;
}

export async function baixarStory(dados: StoryDados): Promise<void> {
  const blob = await storyBlob(dados);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoStory(dados.nome);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** No celular, abre o menu de compartilhar já com a imagem (Instagram, WhatsApp...). */
export function podeCompartilharImagem(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "story.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

export async function compartilharStory(dados: StoryDados): Promise<void> {
  const blob = await storyBlob(dados);
  const arquivo = new File([blob], nomeArquivoStory(dados.nome), { type: "image/png" });
  await navigator.share({ files: [arquivo] });
}
