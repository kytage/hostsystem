import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

/**
 * Integração FiveM → painel Players.
 * POST /api/public/webhook/players  (header x-webhook-token = PLAYERS_WEBHOOK_TOKEN)
 * Faz upsert por license. Listas aceitam array ou texto separado por vírgula,
 * e o inventário aceita [{item, qtd}] ou o texto "1x cake, 5x biotonico".
 */
const lista = z.union([z.array(z.string().max(120)).max(2000), z.string().max(60000)]).optional()

const playerSchema = z.object({
  license: z.string().min(3).max(120),
  passaporte: z.union([z.string(), z.number()]).optional().nullable(),
  nome: z.string().max(120).optional(),
  idade: z.number().int().min(0).max(200).optional().nullable(),
  telefone: z.union([z.string(), z.number()]).optional().nullable(),
  banco: z.number().optional(),
  carteira: z.number().optional(),
  grupos: lista,
  inventario: z
    .union([z.array(z.object({ item: z.string().max(200), qtd: z.number().int().min(0) })).max(2000), z.string().max(60000)])
    .optional(),
  veiculos: lista,
  discord_id: z.string().max(40).optional().nullable(),
  discord_nome: z.string().max(80).optional().nullable(),
  online: z.boolean().optional(),
  level: z.number().int().min(1).max(250).optional(),
  xp: z.number().int().min(0).optional(),
  rank_vip: z.string().max(60).optional().nullable(),
  host_coins: z.number().int().min(0).optional(),
  kills: z.number().int().min(0).optional(),
  mortes: z.number().int().min(0).optional(),
  headshots: z.number().int().min(0).optional(),
  maior_sequencia: z.number().int().min(0).optional(),
})

const bodySchema = z.object({
  players: z.array(playerSchema).min(1).max(2000),
  /** true = quem não veio na lista fica offline (envio da lista completa de online). */
  marcar_offline_ausentes: z.boolean().optional(),
})

const split = (v: string[] | string | undefined) =>
  v === undefined ? undefined : (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean)

function parseInventario(v: z.infer<typeof playerSchema>['inventario']) {
  if (v === undefined) return undefined
  if (Array.isArray(v)) return v
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d+)\s*x\s+(.+)$/i.exec(s)
      return m ? { item: m[2]!.trim(), qtd: Number(m[1]) } : { item: s, qtd: 1 }
    })
}

export const Route = createFileRoute('/api/public/webhook/players')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('x-webhook-token')
        const esperado = process.env['PLAYERS_WEBHOOK_TOKEN']
        if (!esperado || !token || token !== esperado) {
          return new Response('Não autorizado', { status: 401 })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'JSON inválido' }, { status: 400 })
        }
        const parsed = bodySchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Payload inválido', detalhes: parsed.error.issues }, { status: 400 })
        }

        const agora = new Date().toISOString()
        const rows = parsed.data.players.map((p) => {
          const row: Record<string, unknown> = { license: p.license, updated_at: agora }
          if (p.passaporte !== undefined) row['passaporte'] = p.passaporte === null ? null : String(p.passaporte)
          if (p.nome !== undefined) row['nome'] = p.nome
          if (p.idade !== undefined) row['idade'] = p.idade
          if (p.telefone !== undefined) row['telefone'] = p.telefone === null ? null : String(p.telefone)
          if (p.banco !== undefined) row['banco'] = p.banco
          if (p.carteira !== undefined) row['carteira'] = p.carteira
          if (p.grupos !== undefined) row['grupos'] = split(p.grupos)
          if (p.inventario !== undefined) row['inventario'] = parseInventario(p.inventario)
          if (p.veiculos !== undefined) row['veiculos'] = split(p.veiculos)
          if (p.discord_id !== undefined) row['discord_id'] = p.discord_id
          if (p.discord_nome !== undefined) row['discord_nome'] = p.discord_nome
          for (const k of ['level', 'xp', 'rank_vip', 'host_coins', 'kills', 'mortes', 'headshots', 'maior_sequencia'] as const) {
            if (p[k] !== undefined) row[k] = p[k]
          }
          if (p.online !== undefined) {
            row['online'] = p.online
            if (p.online) row['ultimo_login'] = agora
          }
          return row
        })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        // Upsert por grupo de campos iguais: campo ausente no payload nunca é apagado.
        const grupos = new Map<string, Record<string, unknown>[]>()
        for (const r of rows) {
          const k = Object.keys(r).sort().join('|')
          grupos.set(k, [...(grupos.get(k) ?? []), r])
        }
        for (const lote of grupos.values()) {
          const { error } = await supabaseAdmin.from('players').upsert(lote as never, { onConflict: 'license' })
          if (error) return Response.json({ error: 'Falha ao salvar' }, { status: 500 })
        }

        if (parsed.data.marcar_offline_ausentes) {
          const licencas = rows.map((r) => r['license'] as string)
          await supabaseAdmin
            .from('players')
            .update({ online: false })
            .eq('online', true)
            .not('license', 'in', `(${licencas.map((l) => `"${l.replace(/"/g, '')}"`).join(',')})`)
        }
        return Response.json({ ok: true, atualizados: rows.length })
      },
    },
  },
})
