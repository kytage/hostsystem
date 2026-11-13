import type { ColumnId } from "@/lib/dev-tasks";

/** Colunas e categorias do quadro do HOST UPDATE. */
export const COLUNAS: { id: ColumnId; label: string; dot: string }[] = [
  { id: "backlog", label: "Planejado", dot: "bg-muted-foreground" },
  { id: "doing", label: "Em andamento", dot: "bg-warning" },
  { id: "review", label: "Em teste", dot: "bg-info" },
  { id: "done", label: "Concluído", dot: "bg-success" },
];

export const CATEGORIAS = [
  "Sistema",
  "Ilegal",
  "Polícia",
  "Economia",
  "Carros",
  "Interface",
  "Otimização",
  "Outros",
];
