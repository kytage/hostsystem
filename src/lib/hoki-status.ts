import { useSyncExternalStore } from "react";

/**
 * Status do HOKI (emoji + texto curto), o mesmo na praça e no Perfil & Agenda.
 * Fica guardado neste navegador; mudar num lugar muda no outro na hora (e nas outras abas).
 */
export const EMOJIS_STATUS = ["📘", "💻", "☕", "🎮", "🎧", "🍔", "😴", "🔥", "🚗", "🎬", "📞", "🏋️"];
export const STATUS_PRONTOS = [
  "📘 Lendo",
  "💻 Trabalhando",
  "☕ Pausa pro café",
  "🎮 Jogando",
  "🎧 Ouvindo música",
  "🍔 Almoçando",
  "📞 Em reunião",
  "😴 Ausente",
];
const CHAVE = "hoki-praca-status";

export const limparStatus = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 32);

const ouvintes = new Set<() => void>();
let atual: string | null = null;

function ler(): string {
  if (atual !== null) return atual;
  try {
    atual = limparStatus(localStorage.getItem(CHAVE) ?? "");
  } catch {
    atual = "";
  }
  return atual;
}

export function salvarStatusHoki(novo: string) {
  const limpo = limparStatus(novo);
  atual = limpo;
  try {
    if (limpo) localStorage.setItem(CHAVE, limpo);
    else localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: o status vale só até recarregar
  }
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const outraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE) return;
    atual = limparStatus(e.newValue ?? "");
    f();
  };
  window.addEventListener("storage", outraAba);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", outraAba);
  };
}

/** Status do HOKI de quem está logado, ao vivo. */
export function useStatusHoki(): [string, (novo: string) => void] {
  const status = useSyncExternalStore(assinar, ler, () => "");
  return [status, salvarStatusHoki];
}
