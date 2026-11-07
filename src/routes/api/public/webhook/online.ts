import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// Validação do payload enviado pelo script do FiveM
const registroSchema = z.object({
  set_name: z.string().min(1).max(100), // ex: 'armas_cv'
  set_label: z.string().min(1).max(100), // ex: 'Armas — CV'
  category: z.string().min(1).max(50), // armas | muni | lavagem | garagem | drogas | hpi | gueto (gueto não é mais exibido)
  amount: z.number().int().min(0).max(10000),
  hour: z.number().int().min(0).max(23),
})

const bodySchema = z.object({
  registros: z.array(registroSchema).min(1).max(500),
})

export const Route = createFileRoute('/api/public/webhook/online')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Autenticação por token secreto
        const token = request.headers.get('x-webhook-token')
        const esperado = process.env['ONLINE_WEBHOOK_TOKEN']
        if (!esperado || !token || token !== esperado) {
          return new Response('Não autorizado', { status: 401 })
        }

        // 2) Validação do corpo
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

        // 3) Inserção privilegiada (tabela não permite INSERT público)
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const rows = parsed.data.registros.map((r) => ({
          webhook: 'faccoes',
          category: r.category.toLowerCase(),
          set_name: r.set_name,
          set_label: r.set_label,
          amount: r.amount,
          hour: r.hour,
        }))
        const { error } = await supabaseAdmin.from('set_online_log').insert(rows)
        if (error) {
          return Response.json({ error: 'Falha ao salvar' }, { status: 500 })
        }
        return Response.json({ ok: true, inseridos: rows.length })
      },
    },
  },
})
