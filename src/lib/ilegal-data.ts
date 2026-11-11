import { supabase } from "@/integrations/supabase/client";
import { excluirSetagemSchema } from "./ilegal-excluir";
import { statusPorLocal, type IlegalStatus } from "./ilegal-status";

export { isSemLocal, statusPorLocal, type IlegalStatus } from "./ilegal-status";
export type IlegalSituacao = "Entregue" | "Pendente" | ".";

export interface IlegalOrg {
  id: string;
  categoria: string;
  ordem: number;
  setagem: string;
  local: string;
  grupo: string;
  cds: string;
  organizacao: string;
  status: IlegalStatus;
  situacao: IlegalSituacao;
  observacao: string;
  /** Marco da última "Limpar Fac": oculta histórico/registros anteriores no Ilegal. */
  limpoEm: string | null;
  limpoPor: string;
}


export interface IlegalCategoria {
  id: string;
  nome: string;
  orgs: IlegalOrg[];
}

export const CATEGORIAS_META: { id: string; nome: string }[] = [
  { id: "armas", nome: "Armas" },
  { id: "municao", nome: "Munição" },
  { id: "lavagem", nome: "Lavagem" },
  { id: "garagem", nome: "Garagem" },
  { id: "drogas", nome: "Drogas" },
  { id: "hpi", nome: "HPI" },
  // Locais cadastrados sem tipo definido: aparecem aqui até alguém escolher a categoria.
  { id: "a_definir", nome: "A definir" },
];

/** Item VIP da facção (garagem com veículo específico, pounder, etc.). */
export interface IlegalVip {
  label: string;
  cds: string;
}

/**
 * Configuração completa do VIP FAC.
 * Guardada em `ilegal_detalhes.vip_config` (jsonb) e usada tanto no painel
 * quanto no texto enviado para o Desenvolvimento.
 */
export interface IlegalVipConfig {
  lojaRoupa: string;
  barbearia: string;
  tatuagem: string;
  garagemComumBlip: string;
  garagemComumSpawn: string;
  garagemComumCarro: string;
  garagemCaminhaoBlip: string;
  garagemCaminhaoSpawn: string;
  garagemCaminhaoIndex: string;
  radioPrivada: string;
  bauMembro: string;
  bauLider: string;
  salario: string;
  textoExtra: string;
}

export const VIP_CONFIG_VAZIO: IlegalVipConfig = {
  lojaRoupa: "",
  barbearia: "",
  tatuagem: "",
  garagemComumBlip: "",
  garagemComumSpawn: "",
  garagemComumCarro: "",
  garagemCaminhaoBlip: "",
  garagemCaminhaoSpawn: "",
  garagemCaminhaoIndex: "pounder",
  radioPrivada: "",
  bauMembro: "3000kg",
  bauLider: "5000kg",
  salario: "R$ 2.000",
  textoExtra: "",
};

/** Normaliza o jsonb vindo do banco, preenchendo defaults ausentes. */
export function parseVipConfig(value: unknown): IlegalVipConfig {
  const raw = (value ?? {}) as Partial<Record<keyof IlegalVipConfig, unknown>>;
  const out = { ...VIP_CONFIG_VAZIO };
  for (const key of Object.keys(VIP_CONFIG_VAZIO) as (keyof IlegalVipConfig)[]) {
    const v = raw[key];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  return out;
}


export interface IlegalDetalhes {
  logo: string;
  nome1: string;
  telefone1: string;
  nome2: string;
  telefone2: string;
  nome3: string;
  telefone3: string;
  cdsBauLider: string;
  cdsBauMembro: string;
  cdsCraft: string;
  cdsShop: string;
  cdsRota: string;
  garagemBlip: string;
  garagemSpawn: string;
  uniforme: "" | "sim" | "nao";
  corVeiculo: string;
  cdsBlipDesmanche: string;
  anotacoesSobre: string;
  vips: IlegalVip[];
  vipConfig: IlegalVipConfig;
}


export const DETALHES_VAZIO: IlegalDetalhes = {
  logo: "",
  nome1: "",
  telefone1: "",
  nome2: "",
  telefone2: "",
  nome3: "",
  telefone3: "",
  cdsBauLider: "",
  cdsBauMembro: "",
  cdsCraft: "",
  cdsShop: "",
  cdsRota: "",
  garagemBlip: "",
  garagemSpawn: "",
  uniforme: "",
  corVeiculo: "",
  cdsBlipDesmanche: "",
  anotacoesSobre: "",
  vips: [],
  vipConfig: { ...VIP_CONFIG_VAZIO },
};

interface OrgRow {
  id: string;
  categoria: string;
  ordem: number;
  setagem: string;
  local: string;
  grupo: string;
  cds: string;
  organizacao: string;
  status: string;
  situacao: string;
  observacao: string;
  limpo_em?: string | null;
  limpo_por?: string | null;
}

function rowToOrg(r: OrgRow): IlegalOrg {
  return {
    id: r.id,
    categoria: r.categoria,
    ordem: r.ordem,
    setagem: r.setagem,
    local: r.local,
    grupo: r.grupo,
    cds: r.cds,
    organizacao: r.organizacao,
    status: r.status as IlegalStatus,
    situacao: r.situacao as IlegalSituacao,
    observacao: r.observacao,
    limpoEm: r.limpo_em ?? null,
    limpoPor: r.limpo_por ?? "",
  };
}

export async function fetchCategorias(): Promise<IlegalCategoria[]> {
  const { data, error } = await supabase
    .from("ilegal_orgs")
    .select("*")
    .order("categoria")
    .order("ordem");
  if (error) throw error;
  const orgs = ((data ?? []) as OrgRow[]).map(rowToOrg);
  return CATEGORIAS_META.map((c) => ({
    ...c,
    orgs: orgs.filter((o) => o.categoria === c.id),
  }));
}

export async function updateOrg(org: IlegalOrg): Promise<void> {
  const { error } = await supabase
    .from("ilegal_orgs")
    .update({
      categoria: org.categoria,
      setagem: org.setagem,
      local: org.local,
      grupo: org.grupo,
      cds: org.cds,
      organizacao: org.organizacao,
      status: statusPorLocal(org),
      situacao: org.situacao,
      observacao: org.observacao,
      updated_at: new Date().toISOString(),
    })
    .eq("id", org.id);
  if (error) throw error;
}

export async function createOrg(org: IlegalOrg): Promise<void> {
  const { error } = await supabase.from("ilegal_orgs").insert({
    id: org.id,
    categoria: org.categoria,
    ordem: org.ordem,
    setagem: org.setagem,
    local: org.local,
    grupo: org.grupo,
    cds: org.cds,
    organizacao: org.organizacao,
    status: statusPorLocal(org),
    situacao: org.situacao,
    observacao: org.observacao,
  });
  if (error) throw error;
}

export async function deleteOrg(input: { id: string; setagem: string; confirmacao: string }): Promise<void> {
  const dados = excluirSetagemSchema.parse(input);
  // RLS enforces can_edit_ilegal; selecting the deleted row avoids false success.
  // a linha é achada pelo id; o nome só confere se estiver preenchido (setagens novas vêm sem nome)
  let pedido = supabase.from("ilegal_orgs").delete().eq("id", dados.id);
  if (dados.setagem.trim()) pedido = pedido.eq("setagem", dados.setagem);
  const { data, error } = await pedido.select("id").maybeSingle();
  if (error) throw new Error("Não foi possível excluir a setagem. Tente novamente.");
  if (!data) throw new Error("Setagem não encontrada, alterada ou sem permissão para excluir.");
}

interface DetalhesRow {
  org_id: string;
  logo: string;
  nome1: string;
  telefone1: string;
  nome2: string;
  telefone2: string;
  nome3: string;
  telefone3: string;
  cds_bau_lider: string;
  cds_bau_membro: string;
  cds_craft: string;
  cds_shop: string;
  cds_rota: string;
  garagem_blip: string;
  garagem_spawn: string;
  uniforme: string;
  cor_veiculo: string;
  cds_blip_desmanche: string;
  anotacoes_sobre: string;
  vips: unknown;
  vip_config?: unknown;
}

function rowToDetalhes(r: DetalhesRow): IlegalDetalhes {
  return {
    logo: r.logo,
    nome1: r.nome1,
    telefone1: r.telefone1,
    nome2: r.nome2,
    telefone2: r.telefone2,
    nome3: r.nome3,
    telefone3: r.telefone3,
    cdsBauLider: r.cds_bau_lider,
    cdsBauMembro: r.cds_bau_membro,
    cdsCraft: r.cds_craft,
    cdsShop: r.cds_shop,
    cdsRota: r.cds_rota,
    garagemBlip: r.garagem_blip,
    garagemSpawn: r.garagem_spawn,
    uniforme: r.uniforme as IlegalDetalhes["uniforme"],
    corVeiculo: r.cor_veiculo,
    cdsBlipDesmanche: r.cds_blip_desmanche,
    anotacoesSobre: r.anotacoes_sobre,
    vips: Array.isArray(r.vips)
      ? (r.vips as IlegalVip[]).map((v) => ({
          label: String(v?.label ?? ""),
          cds: String(v?.cds ?? ""),
        }))
      : [],
    vipConfig: parseVipConfig(r.vip_config),
  };
}

function detalhesToRow(orgId: string, d: IlegalDetalhes) {
  return {
    org_id: orgId,
    logo: d.logo,
    nome1: d.nome1,
    telefone1: d.telefone1,
    nome2: d.nome2,
    telefone2: d.telefone2,
    nome3: d.nome3,
    telefone3: d.telefone3,
    cds_bau_lider: d.cdsBauLider,
    cds_bau_membro: d.cdsBauMembro,
    cds_craft: d.cdsCraft,
    cds_shop: d.cdsShop,
    cds_rota: d.cdsRota,
    garagem_blip: d.garagemBlip,
    garagem_spawn: d.garagemSpawn,
    uniforme: d.uniforme,
    cor_veiculo: d.corVeiculo,
    cds_blip_desmanche: d.cdsBlipDesmanche,
    anotacoes_sobre: d.anotacoesSobre,
    vips: d.vips.map((v) => ({ label: v.label, cds: v.cds })) as unknown as never,
    vip_config: { ...d.vipConfig } as unknown as never,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchDetalhes(orgId: string): Promise<IlegalDetalhes> {
  const { data, error } = await supabase
    .from("ilegal_detalhes")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DETALHES_VAZIO };
  return rowToDetalhes(data as DetalhesRow);
}

export async function saveDetalhesDb(
  orgId: string,
  detalhes: IlegalDetalhes
): Promise<void> {
  const { error } = await supabase
    .from("ilegal_detalhes")
    .upsert(detalhesToRow(orgId, detalhes));
  if (error) throw error;
}
