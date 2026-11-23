// Configurações: exportar/importar tudo, dados do sistema e histórico de alterações.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, HardDrive, History, Upload } from "lucide-react";
import { api, baixarArquivo, mensagemDe } from "@/avancado/lib/api";
import { useConfig, useHistorico, useSalvarConfig, useSaude } from "@/avancado/lib/consultas";
import { relativo } from "@/avancado/lib/datas";
import { Botao, Campo, Cartao, Pagina, Vazio, aviso } from "@/avancado/ui/kit";
import { confirmar } from "@/avancado/ui/sobrepostos";

const ENTIDADES: Record<string, string> = { lead: "Oportunidade", tarefa: "Tarefa", tarefas: "Tarefa", conteudos: "Conteúdo", quadros: "Quadro", modelos: "Modelo", materiais: "Material", pesquisas: "Pesquisa", resumos: "Resumo", novidades: "Novidade", mercado_servidores: "Cidade", automacoes: "Automação" };

export default function Configuracoes() {
  const { data: saude } = useSaude();
  const { data: historico } = useHistorico();
  const { data: config } = useConfig();
  const salvarConfig = useSalvarConfig();
  const qc = useQueryClient();
  const arquivo = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [nome, setNome] = useState<string | null>(null);
  const meuNome = nome ?? (typeof config?.["meu_nome"] === "string" ? config["meu_nome"] : "Henrique");

  const [exportando, setExportando] = useState(false);
  const exportarTudo = async () => {
    try {
      setExportando(true);
      const dados = await api.get("/exportar-tudo");
      baixarArquivo(`host-avancado-completo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados), "application/json");
    } catch (e) {
      aviso.erro(mensagemDe(e));
    } finally {
      setExportando(false);
    }
  };

  const importar = async (f: File) => {
    try {
      const dados: unknown = JSON.parse(await f.text());
      if (!(await confirmar({ titulo: "Importar este arquivo?", texto: "Só entra o que ainda não existe no painel. Nada é apagado nem substituído.", confirmar: "Importar" }))) return;
      setImportando(true);
      const r = await api.post<{ inseridos: Record<string, number> }>("/importar-tudo", { dados });
      const total = Object.values(r.inseridos).reduce((a, b) => a + b, 0);
      aviso.ok(`${total} ${total === 1 ? "registro importado" : "registros importados"}`);
      await qc.invalidateQueries();
    } catch (e) {
      aviso.erro(e instanceof SyntaxError ? "Este arquivo não é uma exportação do HOST CENTRAL ou do HOST AVANÇADO." : mensagemDe(e));
    } finally {
      setImportando(false);
    }
  };

  return (
    <Pagina sobretitulo="Sistema" titulo="Configurações" descricao="Cópias de segurança, exportação dos dados e o que mudou no painel.">
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Cartao titulo="Cópias de segurança" nota="O banco do site já faz cópia automática todos os dias">
          <p className="text-[12.5px] text-tx-2">Os dados ficam no banco do site (hostgg.dev), e só Founder e CEO conseguem ver. Se quiser uma cópia sua, use o botão Exportar tudo ao lado: ele baixa um arquivo com tudo.</p>
        </Cartao>

        <Cartao titulo="Levar os dados para outro lugar" nota="Um arquivo com tudo: oportunidades, conteúdos, tarefas, materiais e histórico">
          <div className="flex flex-wrap gap-2">
            <Botao icone={Download} carregando={exportando} onClick={() => void exportarTudo()}>
              Exportar tudo
            </Botao>
            <Botao icone={Upload} carregando={importando} onClick={() => arquivo.current?.click()}>
              Importar arquivo
            </Botao>
            <input
              ref={arquivo}
              type="file"
              accept=".json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-3 text-[12.5px] text-tx-2">Para planilha (Excel), use o botão Exportar na lista de Captação.</p>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <Campo rotulo="Seu nome nas mensagens prontas" value={meuNome} onChange={(e) => setNome(e.target.value)} onBlur={() => nome !== null && salvarConfig.mutate({ chave: "meu_nome", valor: nome.trim() || "Henrique" }, { onSuccess: () => aviso.ok("Nome salvo") })} />
            <p className="mt-1.5 text-[11.5px] text-tx-3">Entra no lugar de {"{meu_nome}"} nos modelos de mensagem.</p>
          </div>
        </Cartao>

        <Cartao titulo="Sobre este painel">
          <dl className="grid gap-2 text-[12.5px]">
            <div className="flex gap-3">
              <dt className="w-[120px] shrink-0 text-tx-3">Versão</dt>
              <dd>{saude?.versao ?? "…"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[120px] shrink-0 text-tx-3">Onde ficam os dados</dt>
              <dd className="min-w-0 break-all">{saude?.banco ?? "…"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[120px] shrink-0 text-tx-3">Quem acessa</dt>
              <dd>Só Founder e CEO</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-2 text-[11.5px] text-tx-3">
            <HardDrive size={13} className="mt-0.5 shrink-0" /> O HOST AVANÇADO nunca manda mensagem nem publica nada: só organiza e deixa os textos prontos.
          </p>
        </Cartao>

        <Cartao titulo="O que mudou" nota="Últimas alterações feitas no painel">
          {!historico || historico.length === 0 ? (
            <Vazio icone={History} titulo="Nada registrado ainda" />
          ) : (
            <ol className="grid max-h-[320px] gap-0.5 overflow-y-auto">
              {historico.map((h) => (
                <li key={h.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px]">
                  <span className="w-[86px] shrink-0 text-tx-3">{relativo(h.quando)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-tx-2">{ENTIDADES[h.entidade] ?? h.entidade}</span> {h.acao} {h.resumo && <b className="font-medium">{h.resumo}</b>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Cartao>
      </div>
    </Pagina>
  );
}
