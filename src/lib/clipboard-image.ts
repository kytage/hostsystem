/**
 * Lê uma imagem colada via Ctrl+V (ClipboardEvent) e retorna um
 * data URL JPEG compacto (máx. `maxSize`px no maior lado), pronto
 * para salvar como anexo. Retorna null se não houver imagem.
 */
export function clipboardImageToDataUrl(
  e: ClipboardEvent,
  maxSize = 1280
): Promise<string | null> {
  const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
    i.type.startsWith("image/")
  );
  const file = item?.getAsFile();
  if (!file) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem colada"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem colada inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas não suportado"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Lê um File de imagem (ex.: selecionado via input) e retorna um
 * data URL JPEG compacto (máx. `maxSize`px no maior lado).
 */
export function fileImageToDataUrl(
  file: File,
  maxSize = 1280
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas não suportado"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Handler reutilizável de onPaste (React) para inputs: se houver imagem
 * na área de transferência, previne o paste de texto e chama `onImage`
 * com o data URL compactado. Texto comum segue o fluxo normal.
 */
export function pasteImageFromEvent(
  e: { nativeEvent: ClipboardEvent; preventDefault(): void },
  onImage: (dataUrl: string) => void
): void {
  void clipboardImageToDataUrl(e.nativeEvent).then((dataUrl) => {
    if (!dataUrl) return;
    e.preventDefault();
    onImage(dataUrl);
  });
}

/** Nome padrão para imagens coladas (data URL). */
export function nomeImagemColada(): string {
  return `print-${new Date()
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[^\d]/g, "")}.jpg`;
}
