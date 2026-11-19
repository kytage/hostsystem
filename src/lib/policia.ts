/**
 * Polícia (aba /policia): configuração das corporações e guarnições, tirada do servidor
 * (resources/[System]/vrp/config/Groups.lua). O nível do grupo vem como "Police:3" na ficha do
 * player (1 = a patente mais alta). Browser-safe (sem banco aqui).
 */
import type { AppRole } from "@/lib/roles";

export type TipoUnidade = "principal" | "investigativa" | "guarnicao";

export interface UnidadePolicial {
  id: string;
  /** Nome do grupo no jogo (exato). */
  grupo: string;
  nome: string;
  sigla: string;
  tipo: TipoUnidade;
  descricao: string;
  /** Patentes na ordem do jogo: índice 0 = nível 1 (o mais alto). */
  hierarquia: string[];
  /** Nomes que aparecem nas Organizações legais (POLICIA HOST), para puxar status e responsável. */
  nomesNaOrganizacao: string[];
  cor: string;
}

const guarnicao = (grupo: string, sigla: string, descricao: string, cor: string, outros: string[] = []): UnidadePolicial => ({
  id: grupo.toLowerCase(),
  grupo,
  nome: sigla,
  sigla,
  tipo: "guarnicao",
  descricao,
  hierarquia: [`Comando ${sigla}`, `Sub Comando ${sigla}`, `Coordenador ${sigla}`, `Membro ${sigla}`],
  nomesNaOrganizacao: [sigla, grupo, ...outros],
  cor,
});

export const UNIDADES: UnidadePolicial[] = [
  {
    id: "pm",
    grupo: "Police",
    nome: "Polícia Militar",
    sigla: "PMH",
    tipo: "principal",
    descricao: "Base de toda a corporação: todo policial é setado aqui e, depois, alguns entram em guarnições.",
    hierarquia: [
      "Corregedoria", "Coronel", "TenenteCoronel", "Major", "Capitao", "1Tenente", "2Tenente", "Aspirante",
      "SubTenente", "1Sargento", "2Sargento", "3Sargento", "Cabo", "Soldado", "Recruta",
    ],
    nomesNaOrganizacao: ["Polícia Militar", "Policia Militar", "PM"],
    cor: "#3b82f6",
  },
  {
    id: "civil",
    grupo: "Civil",
    nome: "Polícia Civil",
    sigla: "PC",
    tipo: "investigativa",
    descricao: "Investigativa: inquéritos, operações de inteligência e apoio às investigações.",
    hierarquia: [
      "Corregedoria", "DelegadoGeral", "DelegadoAdjunto", "Diretor", "Coordenador", "InspetorChefe",
      "Inspetor1Classe", "Inspetor2Classe", "Inspetor3Classe", "AgenteClasseEspecial", "Agente1Classe",
      "Agente2Classe", "Agente3Classe", "Agente", "Acadepol",
    ],
    nomesNaOrganizacao: ["Polícia Civil", "Policia Civil", "PC"],
    cor: "#a855f7",
  },
  guarnicao("BOPE", "BOPE", "Operações especiais.", "#111827"),
  guarnicao("CORE", "CORE", "Recursos especiais.", "#ef4444"),
  guarnicao("SPEED", "SPEED", "Patrulha em alta velocidade.", "#f59e0b"),
  guarnicao("Graer", "GRAER", "Grupamento aéreo.", "#06b6d4"),
  guarnicao("GTM", "GTM", "Grupamento tático de motos.", "#22c55e"),
];

export const GRUPOS_POLICIA = UNIDADES.map((u) => u.grupo);

/** Coordinator+ ou área Polícia. */
export function hasPoliciaAccess(role: AppRole | undefined, areas: readonly string[] | undefined): boolean {
  return (
    Boolean(role && ["founder", "c_level", "direcao", "coordinator"].includes(role)) ||
    (areas ?? []).some((a) => a === "policia")
  );
}

/** "TenenteCoronel" → "Tenente-Coronel", "1Tenente" → "1º Tenente", "Inspetor1Classe" → "Inspetor 1ª Classe". */
export function patenteBonita(p: string): string {
  const especiais: Record<string, string> = {
    TenenteCoronel: "Tenente-Coronel",
    Capitao: "Capitão",
    SubTenente: "Subtenente",
    DelegadoGeral: "Delegado-Geral",
    DelegadoAdjunto: "Delegado Adjunto",
    InspetorChefe: "Inspetor-Chefe",
    AgenteClasseEspecial: "Agente Classe Especial",
  };
  if (especiais[p]) return especiais[p]!;
  return p
    .replace(/^(\d)(Tenente|Sargento)$/, "$1º $2")
    .replace(/(\D)(\d)Classe$/, "$1 $2ª Classe")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

export interface Patente {
  nivel: number | null;
  nome: string;
}

/** Patente do player numa unidade, pelo "Grupo:nível" da ficha (null = não é dessa unidade). */
export function patenteNaUnidade(grupos: string[], u: UnidadePolicial): Patente | null {
  const alvo = u.grupo.toLowerCase();
  const g = grupos.find((x) => x.split(":")[0]!.trim().toLowerCase() === alvo);
  if (!g) return null;
  const n = Number(g.split(":")[1]);
  const nivel = Number.isFinite(n) && n > 0 ? n : null;
  return { nivel, nome: nivel ? patenteBonita(u.hierarquia[nivel - 1] ?? `Nível ${nivel}`) : "Sem patente" };
}

export interface PolicialResumo {
  passaporte: string;
  nome: string;
  discord: string | null;
  online: boolean;
  ultimoLogin: string | null;
  level: number;
  /** Só os grupos policiais, como vieram ("Police:3"). */
  grupos: string[];
}

/** Liga a unidade ao quadro POLICIA HOST das Organizações legais (pelo nome). */
export function estabDaUnidade<T extends { nome: string }>(u: UnidadePolicial, estabs: T[]): T | null {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const nomes = new Set(u.nomesNaOrganizacao.map(norm));
  return estabs.find((e) => nomes.has(norm(e.nome))) ?? null;
}
