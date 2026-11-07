export type IlegalStatus = "Assumida" | "Reservada" | "Livre" | "Fechado";

/** Textos de local que significam "nenhum local cadastrado". */
export function isSemLocal(local: string): boolean {
  const v = local.trim();
  return v === "" || v === "-" || v === "—" || /sem local/i.test(v);
}

/** Sem nenhum local, a setagem é automaticamente Fechado. */
export function statusPorLocal(org: { local: string; status: IlegalStatus }): IlegalStatus {
  return isSemLocal(org.local) ? "Fechado" : org.status;
}
