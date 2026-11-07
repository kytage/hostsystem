/** Helpers server-only para geração de Patch Notes com IA (Lovable AI Gateway). */

export interface PatchCardInput {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  categoria: string;
  patchTexto: string;
}

export interface PatchNoteIAItem {
  cardId: string;
  texto: string;
}

export interface PatchNoteIACategoria {
  nome: string;
  itens: PatchNoteIAItem[];
}

export interface PatchNoteIAResult {
  categorias: PatchNoteIACategoria[];
}

const SYSTEM_PROMPT = `Você organiza Patch Notes de um servidor de FiveM (GTA RP) em português brasileiro.

Você receberá uma lista de tarefas concluídas (com id, título, descrição e um texto opcional já preparado pelo desenvolvedor).

Sua tarefa:
1. Para cada tarefa, produza uma frase curta e clara para jogadores, em pt-BR.
   - Se a tarefa tiver "textoPronto" preenchido, use-o como base (pode polir a gramática, mas preserve o sentido e nomes próprios).
   - Caso contrário, gere a frase a partir do título e da descrição.
   - Transforme textos técnicos/informais em linguagem clara: "CORRIGIR PERMISSAO PRO BOMBEIRO REANIMAR" -> "Corrigida a permissão para Bombeiros reanimarem jogadores."
   - NÃO invente funcionalidades que não estejam descritas.
   - NÃO inclua detalhes técnicos internos (nomes de arquivos, IDs, logs).
   - Preserve nomes próprios de veículos, organizações, comandos e sistemas.
2. Agrupe os itens em categorias temáticas com emoji, analisando o CONTEÚDO (não a categoria original da solicitação). Exemplos de categorias: "🚗 VEÍCULOS", "🚔 POLÍCIA", "🚑 HOSPITAL / BOMBEIROS", "💰 ECONOMIA / ITENS", "🛠️ SISTEMAS", "🐛 CORREÇÕES / BUGS", "💀 ILEGAL". Crie outras se fizerem sentido.
3. Cada tarefa deve aparecer exatamente uma vez.

Responda APENAS com JSON válido neste formato exato:
{"categorias":[{"nome":"🚗 VEÍCULOS","itens":[{"cardId":"...","texto":"..."}]}]}`;

export async function gerarPatchNoteComIA(
  cards: PatchCardInput[],
  apiKey: string
): Promise<PatchNoteIAResult> {
  const lista = cards.map((c) => ({
    cardId: c.id,
    numero: c.numero,
    titulo: c.titulo,
    descricao: c.descricao,
    textoPronto: c.patchTexto || null,
  }));

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Tarefas concluídas para o Patch Note:\n${JSON.stringify(lista, null, 2)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na IA (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("IA retornou resposta vazia.");

  const parsed = JSON.parse(content) as PatchNoteIAResult;
  if (!Array.isArray(parsed.categorias)) {
    throw new Error("Formato inesperado retornado pela IA.");
  }

  // Garante que toda tarefa apareça exatamente uma vez; se a IA omitir alguma,
  // ela entra numa seção de fallback para nunca perder uma alteração.
  const vistos = new Set<string>();
  for (const cat of parsed.categorias) {
    cat.itens = (cat.itens ?? []).filter((i) => {
      if (!i?.cardId || !i?.texto || vistos.has(i.cardId)) return false;
      vistos.add(i.cardId);
      return true;
    });
  }
  const faltantes = cards.filter((c) => !vistos.has(c.id));
  if (faltantes.length > 0) {
    parsed.categorias.push({
      nome: "🐛 CORREÇÕES / BUGS",
      itens: faltantes.map((c) => ({
        cardId: c.id,
        texto: c.patchTexto || c.titulo,
      })),
    });
  }
  parsed.categorias = parsed.categorias.filter((c) => c.itens.length > 0);

  return parsed;
}

/** Monta o texto final do Patch Note a partir das categorias. */
export function montarTextoPatchNote(
  data: string,
  categorias: PatchNoteIACategoria[]
): string {
  const blocos = categorias.map((cat) => {
    const linhas = cat.itens.map((i) => `• ${i.texto}`).join("\n");
    return `${cat.nome}\n${linhas}`;
  });
  return `PATCH NOTES — ${data}\n\n${blocos.join("\n\n")}`;
}
