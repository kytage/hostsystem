export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      anotacoes: {
        Row: {
          texto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          texto?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          texto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      area_permissions: {
        Row: {
          actions: string[]
          area: string
          category: string
          created_at: string
          id: string
        }
        Insert: {
          actions?: string[]
          area: string
          category: string
          created_at?: string
          id?: string
        }
        Update: {
          actions?: string[]
          area?: string
          category?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          created_at: string
          emoji: string
          grupo: string | null
          id: string
          key: string
          label: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          grupo?: string | null
          id?: string
          key: string
          label: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          grupo?: string | null
          id?: string
          key?: string
          label?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      aviso_confirmacoes: {
        Row: {
          aviso_id: string
          created_at: string
          id: string
          user_id: string
          username: string
        }
        Insert: {
          aviso_id: string
          created_at?: string
          id?: string
          user_id: string
          username?: string
        }
        Update: {
          aviso_id?: string
          created_at?: string
          id?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_confirmacoes_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string | null
          id: string
          texto: string
          titulo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          texto?: string
          titulo: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      captacoes: {
        Row: {
          captador: string
          captador_id: string | null
          contato: string
          created_at: string
          id: string
          lider: string
          local: string
          observacao: string
          online_esperado: string
          ordem: number
          organizacao: string
          proposta: Json
          setagem: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          captador?: string
          captador_id?: string | null
          contato?: string
          created_at?: string
          id?: string
          lider?: string
          local?: string
          observacao?: string
          online_esperado?: string
          ordem?: number
          organizacao: string
          proposta?: Json
          setagem?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          captador?: string
          captador_id?: string | null
          contato?: string
          created_at?: string
          id?: string
          lider?: string
          local?: string
          observacao?: string
          online_esperado?: string
          ordem?: number
          organizacao?: string
          proposta?: Json
          setagem?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      captacoes_categorias: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          staff: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          staff?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          staff?: string
        }
        Relationships: []
      }
      captacoes_estabelecimentos: {
        Row: {
          categoria_id: string
          created_at: string
          id: string
          nome: string
          observacao: string
          ordem: number
          staff: string
          status: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          id?: string
          nome: string
          observacao?: string
          ordem?: number
          staff?: string
          status?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          id?: string
          nome?: string
          observacao?: string
          ordem?: number
          staff?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacoes_estabelecimentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "captacoes_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      captacoes_modelos: {
        Row: {
          conteudo: Json
          key: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          key: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      captacoes_reunioes: {
        Row: {
          captacao_id: string
          com_quem: string
          created_at: string
          data_hora: string
          id: string
          meio: string
          participantes: string
        }
        Insert: {
          captacao_id: string
          com_quem?: string
          created_at?: string
          data_hora: string
          id?: string
          meio?: string
          participantes?: string
        }
        Update: {
          captacao_id?: string
          com_quem?: string
          created_at?: string
          data_hora?: string
          id?: string
          meio?: string
          participantes?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacoes_reunioes_captacao_id_fkey"
            columns: ["captacao_id"]
            isOneToOne: false
            referencedRelation: "captacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      card_comentarios: {
        Row: {
          autor: string
          card_id: string
          created_at: string
          id: string
          texto: string
        }
        Insert: {
          autor?: string
          card_id: string
          created_at?: string
          id?: string
          texto: string
        }
        Update: {
          autor?: string
          card_id?: string
          created_at?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_comentarios_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_historico: {
        Row: {
          autor: string
          card_id: string
          created_at: string
          de_coluna: string
          id: string
          observacao: string
          para_coluna: string
        }
        Insert: {
          autor?: string
          card_id: string
          created_at?: string
          de_coluna?: string
          id?: string
          observacao?: string
          para_coluna?: string
        }
        Update: {
          autor?: string
          card_id?: string
          created_at?: string
          de_coluna?: string
          id?: string
          observacao?: string
          para_coluna?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_historico_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      casting: {
        Row: {
          created_at: string
          discord_id: string
          host_id: string
          id: string
          nome: string
          obs: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_id?: string
          host_id?: string
          id?: string
          nome?: string
          obs?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_id?: string
          host_id?: string
          id?: string
          nome?: string
          obs?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          avatar_url: string
          created_at: string
          id: string
          texto: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          id?: string
          texto: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string
          created_at?: string
          id?: string
          texto?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      dev_tasks: {
        Row: {
          assignee: string
          attachments: Json
          checklist: Json
          column_id: string
          created_at: string
          description: string
          estrutura: Json
          id: string
          prazo: string | null
          priority: string
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string
          attachments?: Json
          checklist?: Json
          column_id?: string
          created_at?: string
          description?: string
          estrutura?: Json
          id?: string
          prazo?: string | null
          priority?: string
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          attachments?: Json
          checklist?: Json
          column_id?: string
          created_at?: string
          description?: string
          estrutura?: Json
          id?: string
          prazo?: string | null
          priority?: string
          tag?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao?: string
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos_gestao: {
        Row: {
          adicoes: string[]
          anexos: Json
          banner_url: string
          created_at: string
          criado_por: string
          criado_por_id: string | null
          cronograma_evento_id: string | null
          data_evento: string
          equipe: string
          frequencia: string
          frequencia_dia: number | null
          frequencia_repeticoes: number
          horario: string
          id: string
          informacoes: string
          nome: string
          premiacao: string
          publicado_cronograma: boolean
          publicado_discord: boolean
          recorrencia_pai: string | null
          solicitacao_banner: boolean
          staff_responsaveis: Json
          status: string
          todos_da_area: boolean
          updated_at: string
        }
        Insert: {
          adicoes?: string[]
          anexos?: Json
          banner_url?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          cronograma_evento_id?: string | null
          data_evento?: string
          equipe?: string
          frequencia?: string
          frequencia_dia?: number | null
          frequencia_repeticoes?: number
          horario?: string
          id?: string
          informacoes?: string
          nome?: string
          premiacao?: string
          publicado_cronograma?: boolean
          publicado_discord?: boolean
          recorrencia_pai?: string | null
          solicitacao_banner?: boolean
          staff_responsaveis?: Json
          status?: string
          todos_da_area?: boolean
          updated_at?: string
        }
        Update: {
          adicoes?: string[]
          anexos?: Json
          banner_url?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          cronograma_evento_id?: string | null
          data_evento?: string
          equipe?: string
          frequencia?: string
          frequencia_dia?: number | null
          frequencia_repeticoes?: number
          horario?: string
          id?: string
          informacoes?: string
          nome?: string
          premiacao?: string
          publicado_cronograma?: boolean
          publicado_discord?: boolean
          recorrencia_pai?: string | null
          solicitacao_banner?: boolean
          staff_responsaveis?: Json
          status?: string
          todos_da_area?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_gestao_recorrencia_pai_fkey"
            columns: ["recorrencia_pai"]
            isOneToOne: false
            referencedRelation: "eventos_gestao"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_entradas: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string | null
          id: string
          mes: string
          observacao: string
          titulo: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          mes: string
          observacao?: string
          titulo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          mes?: string
          observacao?: string
          titulo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      financeiro_meses: {
        Row: {
          entrada_prevista: number
          mes: string
          observacao: string
          saldo_inicial: number
          updated_at: string
        }
        Insert: {
          entrada_prevista?: number
          mes: string
          observacao?: string
          saldo_inicial?: number
          updated_at?: string
        }
        Update: {
          entrada_prevista?: number
          mes?: string
          observacao?: string
          saldo_inicial?: number
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_saidas: {
        Row: {
          comprovante: string
          created_at: string
          criado_por: string
          criado_por_id: string | null
          data_pagamento: string | null
          id: string
          mes: string
          observacao: string
          recorrencia_pai: string | null
          status: string
          subtipo: string
          tipo: string
          titulo: string
          updated_at: string
          valor: number
        }
        Insert: {
          comprovante?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          data_pagamento?: string | null
          id?: string
          mes: string
          observacao?: string
          recorrencia_pai?: string | null
          status?: string
          subtipo?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          comprovante?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          data_pagamento?: string | null
          id?: string
          mes?: string
          observacao?: string
          recorrencia_pai?: string | null
          status?: string
          subtipo?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_saidas_recorrencia_pai_fkey"
            columns: ["recorrencia_pai"]
            isOneToOne: false
            referencedRelation: "financeiro_saidas"
            referencedColumns: ["id"]
          },
        ]
      }
      hoshi_jogos: {
        Row: {
          created_at: string
          criado_por: string
          estado: Json
          id: string
          status: string
          tipo: string
          updated_at: string
          versao: number
        }
        Insert: {
          created_at?: string
          criado_por?: string
          estado?: Json
          id?: string
          status?: string
          tipo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          created_at?: string
          criado_por?: string
          estado?: Json
          id?: string
          status?: string
          tipo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      hoshi_pets: {
        Row: {
          carinho: number
          coins: number
          created_at: string
          cuidado_em: string
          energia: number
          fome: number
          itens: Json
          nome: string
          recorde_petiscos: number
          recorde_reflexo: number
          sede: number
          updated_at: string
          user_id: string
          username: string
          visual: Json
          xp: number
        }
        Insert: {
          carinho?: number
          coins?: number
          created_at?: string
          cuidado_em?: string
          energia?: number
          fome?: number
          itens?: Json
          nome?: string
          recorde_petiscos?: number
          recorde_reflexo?: number
          sede?: number
          updated_at?: string
          user_id: string
          username?: string
          visual?: Json
          xp?: number
        }
        Update: {
          carinho?: number
          coins?: number
          created_at?: string
          cuidado_em?: string
          energia?: number
          fome?: number
          itens?: Json
          nome?: string
          recorde_petiscos?: number
          recorde_reflexo?: number
          sede?: number
          updated_at?: string
          user_id?: string
          username?: string
          visual?: Json
          xp?: number
        }
        Relationships: []
      }
      ilegal_anotacoes: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string | null
          descricao: string
          id: string
          imagens: Json
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          descricao?: string
          id?: string
          imagens?: Json
          titulo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          descricao?: string
          id?: string
          imagens?: Json
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ilegal_aviso_confirmacoes: {
        Row: {
          aviso_id: string
          created_at: string
          id: string
          user_id: string
          username: string
        }
        Insert: {
          aviso_id: string
          created_at?: string
          id?: string
          user_id: string
          username?: string
        }
        Update: {
          aviso_id?: string
          created_at?: string
          id?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "ilegal_aviso_confirmacoes_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "ilegal_avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      ilegal_avisos: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string | null
          id: string
          texto: string
          titulo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          texto?: string
          titulo: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      ilegal_coroas: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string | null
          id: string
          motivo: string
          organizacao: string
          setagem: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          motivo?: string
          organizacao?: string
          setagem: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          id?: string
          motivo?: string
          organizacao?: string
          setagem?: string
        }
        Relationships: []
      }
      ilegal_cronograma: {
        Row: {
          coluna: string
          created_at: string
          criado_por: string
          criado_por_id: string | null
          data_hora: string | null
          descricao: string
          id: string
          ordem: number
          responsavel: string
          setagem: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          coluna?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          data_hora?: string | null
          descricao?: string
          id?: string
          ordem?: number
          responsavel?: string
          setagem?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          coluna?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          data_hora?: string | null
          descricao?: string
          id?: string
          ordem?: number
          responsavel?: string
          setagem?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ilegal_detalhes: {
        Row: {
          anotacoes_sobre: string
          cds_bau_lider: string
          cds_bau_membro: string
          cds_blip_desmanche: string
          cds_craft: string
          cds_rota: string
          cds_shop: string
          cor_veiculo: string
          garagem_blip: string
          garagem_spawn: string
          logo: string
          nome1: string
          nome2: string
          nome3: string
          org_id: string
          telefone1: string
          telefone2: string
          telefone3: string
          uniforme: string
          updated_at: string
          vip_config: Json
          vips: Json
        }
        Insert: {
          anotacoes_sobre?: string
          cds_bau_lider?: string
          cds_bau_membro?: string
          cds_blip_desmanche?: string
          cds_craft?: string
          cds_rota?: string
          cds_shop?: string
          cor_veiculo?: string
          garagem_blip?: string
          garagem_spawn?: string
          logo?: string
          nome1?: string
          nome2?: string
          nome3?: string
          org_id: string
          telefone1?: string
          telefone2?: string
          telefone3?: string
          uniforme?: string
          updated_at?: string
          vip_config?: Json
          vips?: Json
        }
        Update: {
          anotacoes_sobre?: string
          cds_bau_lider?: string
          cds_bau_membro?: string
          cds_blip_desmanche?: string
          cds_craft?: string
          cds_rota?: string
          cds_shop?: string
          cor_veiculo?: string
          garagem_blip?: string
          garagem_spawn?: string
          logo?: string
          nome1?: string
          nome2?: string
          nome3?: string
          org_id?: string
          telefone1?: string
          telefone2?: string
          telefone3?: string
          uniforme?: string
          updated_at?: string
          vip_config?: Json
          vips?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ilegal_detalhes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "ilegal_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ilegal_log: {
        Row: {
          acao: string
          campos: string[]
          created_at: string
          id: string
          registro: string
          resumo: string
          tabela: string
          usuario: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          campos?: string[]
          created_at?: string
          id?: string
          registro?: string
          resumo?: string
          tabela: string
          usuario?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          campos?: string[]
          created_at?: string
          id?: string
          registro?: string
          resumo?: string
          tabela?: string
          usuario?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      ilegal_orgs: {
        Row: {
          categoria: string
          cds: string
          created_at: string
          grupo: string
          id: string
          limpo_em: string | null
          limpo_por: string
          local: string
          observacao: string
          ordem: number
          organizacao: string
          setagem: string
          situacao: string
          status: string
          updated_at: string
        }
        Insert: {
          categoria: string
          cds?: string
          created_at?: string
          grupo?: string
          id: string
          limpo_em?: string | null
          limpo_por?: string
          local?: string
          observacao?: string
          ordem?: number
          organizacao?: string
          setagem?: string
          situacao?: string
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          cds?: string
          created_at?: string
          grupo?: string
          id?: string
          limpo_em?: string | null
          limpo_por?: string
          local?: string
          observacao?: string
          ordem?: number
          organizacao?: string
          setagem?: string
          situacao?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_cards: {
        Row: {
          anexos: Json
          aprovado_por: string
          arquivado: boolean
          categoria: string
          checklist: Json
          coluna: string
          concluido_at: string | null
          concluido_por: string
          created_at: string
          criado_por: string
          descricao: string
          entrou_dev_at: string | null
          id: string
          numero: number
          obs_dev: string
          patch_texto: string
          patchnote_gerado: boolean
          patchnote_id: string | null
          prioridade: string
          responsavel: string
          status: string
          teste_status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: Json
          aprovado_por?: string
          arquivado?: boolean
          categoria?: string
          checklist?: Json
          coluna?: string
          concluido_at?: string | null
          concluido_por?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          entrou_dev_at?: string | null
          id?: string
          numero?: never
          obs_dev?: string
          patch_texto?: string
          patchnote_gerado?: boolean
          patchnote_id?: string | null
          prioridade?: string
          responsavel?: string
          status?: string
          teste_status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: Json
          aprovado_por?: string
          arquivado?: boolean
          categoria?: string
          checklist?: Json
          coluna?: string
          concluido_at?: string | null
          concluido_por?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          entrou_dev_at?: string | null
          id?: string
          numero?: never
          obs_dev?: string
          patch_texto?: string
          patchnote_gerado?: boolean
          patchnote_id?: string | null
          prioridade?: string
          responsavel?: string
          status?: string
          teste_status?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_patchnote_id_fkey"
            columns: ["patchnote_id"]
            isOneToOne: false
            referencedRelation: "patch_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_devs: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_devs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_ranking_base: {
        Row: {
          autor: string
          total: number
          updated_at: string
        }
        Insert: {
          autor: string
          total?: number
          updated_at?: string
        }
        Update: {
          autor?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          texto: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          texto: string
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          texto?: string
          tipo?: string
        }
        Relationships: []
      }
      org_membros: {
        Row: {
          cargo: string
          cliques: number
          created_at: string
          discord: string
          id: string
          nome: string
          painel_id: string
          passaporte: string
          slug: string
          updated_at: string
          visitas: number
        }
        Insert: {
          cargo?: string
          cliques?: number
          created_at?: string
          discord?: string
          id?: string
          nome: string
          painel_id: string
          passaporte?: string
          slug: string
          updated_at?: string
          visitas?: number
        }
        Update: {
          cargo?: string
          cliques?: number
          created_at?: string
          discord?: string
          id?: string
          nome?: string
          painel_id?: string
          passaporte?: string
          slug?: string
          updated_at?: string
          visitas?: number
        }
        Relationships: []
      }
      org_paineis: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          criado_por: string
          id: string
          lider_nome: string
          link_destino: string
          nome: string
          setagem: string
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          criado_por?: string
          id?: string
          lider_nome?: string
          link_destino?: string
          nome: string
          setagem?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          criado_por?: string
          id?: string
          lider_nome?: string
          link_destino?: string
          nome?: string
          setagem?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patch_notes: {
        Row: {
          created_at: string
          gerado_por: string
          id: string
          log_texto: string
          numero: number
          publicado_em: string
          texto: string
          total_alteracoes: number
        }
        Insert: {
          created_at?: string
          gerado_por?: string
          id?: string
          log_texto?: string
          numero?: never
          publicado_em?: string
          texto?: string
          total_alteracoes?: number
        }
        Update: {
          created_at?: string
          gerado_por?: string
          id?: string
          log_texto?: string
          numero?: never
          publicado_em?: string
          texto?: string
          total_alteracoes?: number
        }
        Relationships: []
      }
      peds: {
        Row: {
          adicao: string
          arquivo: string
          categoria: string
          created_at: string
          discord_ped: string
          discord_responsavel: string
          grupo: string
          id: string
          observacao: string
          passaporte_ped: string
          passaporte_responsavel: string
          responsavel: string
          source_key: string | null
          tamanho: string
          updated_at: string
        }
        Insert: {
          adicao?: string
          arquivo?: string
          categoria?: string
          created_at?: string
          discord_ped?: string
          discord_responsavel?: string
          grupo?: string
          id?: string
          observacao?: string
          passaporte_ped?: string
          passaporte_responsavel?: string
          responsavel?: string
          source_key?: string | null
          tamanho?: string
          updated_at?: string
        }
        Update: {
          adicao?: string
          arquivo?: string
          categoria?: string
          created_at?: string
          discord_ped?: string
          discord_responsavel?: string
          grupo?: string
          id?: string
          observacao?: string
          passaporte_ped?: string
          passaporte_responsavel?: string
          responsavel?: string
          source_key?: string | null
          tamanho?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_conteudos: {
        Row: {
          areas: string[]
          created_at: string
          tipo_postagem: string
          criado_por: string
          curtidas: number
          data_gravacao: string | null
          data_publicacao: string | null
          formato: string
          id: string
          link: string
          local: string
          plataformas: string[]
          responsavel: string
          roteiro: string
          status: string
          titulo: string
          updated_at: string
          views: number
        }
        Insert: {
          areas?: string[]
          created_at?: string
          tipo_postagem?: string
          criado_por?: string
          curtidas?: number
          data_gravacao?: string | null
          data_publicacao?: string | null
          formato?: string
          id?: string
          link?: string
          local?: string
          plataformas?: string[]
          responsavel?: string
          roteiro?: string
          status?: string
          titulo: string
          updated_at?: string
          views?: number
        }
        Update: {
          areas?: string[]
          created_at?: string
          tipo_postagem?: string
          criado_por?: string
          curtidas?: number
          data_gravacao?: string | null
          data_publicacao?: string | null
          formato?: string
          id?: string
          link?: string
          local?: string
          plataformas?: string[]
          responsavel?: string
          roteiro?: string
          status?: string
          titulo?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          contato: string
          created_at: string
          criado_por: string
          id: string
          interesse: string
          link: string
          nicho: string
          nome: string
          notas: string
          plataforma: string
          proximo_contato: string | null
          responsavel: string
          seguidores: number
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          contato?: string
          created_at?: string
          criado_por?: string
          id?: string
          interesse?: string
          link?: string
          nicho?: string
          nome: string
          notas?: string
          plataforma?: string
          proximo_contato?: string | null
          responsavel?: string
          seguidores?: number
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          contato?: string
          created_at?: string
          criado_por?: string
          id?: string
          interesse?: string
          link?: string
          nicho?: string
          nome?: string
          notas?: string
          plataforma?: string
          proximo_contato?: string | null
          responsavel?: string
          seguidores?: number
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_referencias: {
        Row: {
          canal: string
          categoria: string
          created_at: string
          criado_por: string
          id: string
          link: string
          nicho: string
          notas: string
          plataforma: string
          titulo: string
          views: number
        }
        Insert: {
          canal?: string
          categoria?: string
          created_at?: string
          criado_por?: string
          id?: string
          link?: string
          nicho?: string
          notas?: string
          plataforma?: string
          titulo: string
          views?: number
        }
        Update: {
          canal?: string
          categoria?: string
          created_at?: string
          criado_por?: string
          id?: string
          link?: string
          nicho?: string
          notas?: string
          plataforma?: string
          titulo?: string
          views?: number
        }
        Relationships: []
      }
      pendencias: {
        Row: {
          anexos: Json
          aprovado_at: string | null
          aprovado_por: string
          area: string
          created_at: string
          criado_por: string
          description: string
          id: string
          kanban_card_id: string | null
          obs_at: string | null
          obs_coordenacao: string
          obs_por: string
          obs_resolvida: boolean
          priority: string
          status: string
          tag: string
          tipo: string
          title: string
        }
        Insert: {
          anexos?: Json
          aprovado_at?: string | null
          aprovado_por?: string
          area?: string
          created_at?: string
          criado_por?: string
          description?: string
          id?: string
          kanban_card_id?: string | null
          obs_at?: string | null
          obs_coordenacao?: string
          obs_por?: string
          obs_resolvida?: boolean
          priority?: string
          status?: string
          tag?: string
          tipo?: string
          title: string
        }
        Update: {
          anexos?: Json
          aprovado_at?: string | null
          aprovado_por?: string
          area?: string
          created_at?: string
          criado_por?: string
          description?: string
          id?: string
          kanban_card_id?: string | null
          obs_at?: string | null
          obs_coordenacao?: string
          obs_por?: string
          obs_resolvida?: boolean
          priority?: string
          status?: string
          tag?: string
          tipo?: string
          title?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          headshots: number
          host_coins: number
          kills: number
          level: number
          maior_sequencia: number
          mortes: number
          rank_vip: string | null
          xp: number
          banco: number
          carteira: number
          created_at: string
          discord_id: string | null
          discord_nome: string | null
          grupos: string[]
          id: string
          idade: number | null
          inventario: Json
          license: string
          nome: string
          online: boolean
          passaporte: string | null
          telefone: string | null
          ultimo_login: string | null
          updated_at: string
          veiculos: string[]
        }
        Insert: {
          headshots?: number
          host_coins?: number
          kills?: number
          level?: number
          maior_sequencia?: number
          mortes?: number
          rank_vip?: string | null
          xp?: number
          banco?: number
          carteira?: number
          created_at?: string
          discord_id?: string | null
          discord_nome?: string | null
          grupos?: string[]
          id?: string
          idade?: number | null
          inventario?: Json
          license: string
          nome?: string
          online?: boolean
          passaporte?: string | null
          telefone?: string | null
          ultimo_login?: string | null
          updated_at?: string
          veiculos?: string[]
        }
        Update: {
          headshots?: number
          host_coins?: number
          kills?: number
          level?: number
          maior_sequencia?: number
          mortes?: number
          rank_vip?: string | null
          xp?: number
          banco?: number
          carteira?: number
          created_at?: string
          discord_id?: string | null
          discord_nome?: string | null
          grupos?: string[]
          id?: string
          idade?: number | null
          inventario?: Json
          license?: string
          nome?: string
          online?: boolean
          passaporte?: string | null
          telefone?: string | null
          ultimo_login?: string | null
          updated_at?: string
          veiculos?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string
          bio: string
          created_at: string
          deve_trocar_senha: boolean
          discord_id: string
          host_id: string
          id: string
          last_seen_at: string | null
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string
          bio?: string
          created_at?: string
          deve_trocar_senha?: boolean
          discord_id?: string
          host_id?: string
          id: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string
          bio?: string
          created_at?: string
          deve_trocar_senha?: boolean
          discord_id?: string
          host_id?: string
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      punicoes: {
        Row: {
          anexos: Json
          created_at: string
          data_punicao: string
          dias: number | null
          duracao: string
          id: string
          jogador: string
          jogador_id: string
          motivo: string
          observacao: string
          provas: string
          punicao: string
          responsaveis: Json
          resultado: string
          staff: string
          staff_id: string | null
          ticket_id: string
          tipo: string
          updated_at: string
          userset: string
          userset_sub: string
        }
        Insert: {
          anexos?: Json
          created_at?: string
          data_punicao?: string
          dias?: number | null
          duracao?: string
          id?: string
          jogador?: string
          jogador_id?: string
          motivo?: string
          observacao?: string
          provas?: string
          punicao?: string
          responsaveis?: Json
          resultado?: string
          staff?: string
          staff_id?: string | null
          ticket_id?: string
          tipo?: string
          updated_at?: string
          userset?: string
          userset_sub?: string
        }
        Update: {
          anexos?: Json
          created_at?: string
          data_punicao?: string
          dias?: number | null
          duracao?: string
          id?: string
          jogador?: string
          jogador_id?: string
          motivo?: string
          observacao?: string
          provas?: string
          punicao?: string
          responsaveis?: Json
          resultado?: string
          staff?: string
          staff_id?: string | null
          ticket_id?: string
          tipo?: string
          updated_at?: string
          userset?: string
          userset_sub?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          actions: string[]
          category: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          actions?: string[]
          category: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          actions?: string[]
          category?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      set_online_log: {
        Row: {
          amount: number
          captured_at: string
          category: string
          hour: number
          id: number
          set_label: string
          set_name: string
          webhook: string
        }
        Insert: {
          amount?: number
          captured_at?: string
          category: string
          hour: number
          id?: never
          set_label: string
          set_name: string
          webhook: string
        }
        Update: {
          amount?: number
          captured_at?: string
          category?: string
          hour?: number
          id?: never
          set_label?: string
          set_name?: string
          webhook?: string
        }
        Relationships: []
      }
      solicitacoes_admin: {
        Row: {
          anexos: Json
          created_at: string
          criado_por: string
          criado_por_id: string | null
          descricao: string
          destinatario_id: string
          destinatario_nome: string
          id: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: Json
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          descricao?: string
          destinatario_id: string
          destinatario_nome?: string
          id?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: Json
          created_at?: string
          criado_por?: string
          criado_por_id?: string | null
          descricao?: string
          destinatario_id?: string
          destinatario_nome?: string
          id?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      tarefas_particulares: {
        Row: {
          coluna: string
          created_at: string
          descricao: string
          designada_por: string
          id: string
          ordem: number
          reuniao_at: string | null
          reuniao_confirmada: boolean
          solicitacao_id: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coluna?: string
          created_at?: string
          descricao?: string
          designada_por?: string
          id?: string
          ordem?: number
          reuniao_at?: string | null
          reuniao_confirmada?: boolean
          solicitacao_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coluna?: string
          created_at?: string
          descricao?: string
          designada_por?: string
          id?: string
          ordem?: number
          reuniao_at?: string | null
          reuniao_confirmada?: boolean
          solicitacao_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_particulares_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      termometro_votos: {
        Row: {
          created_at: string
          de_user_id: string
          dia: string
          emoji: string
          id: string
          para_user_id: string
          para_username: string
        }
        Insert: {
          created_at?: string
          de_user_id: string
          dia?: string
          emoji: string
          id?: string
          para_user_id: string
          para_username?: string
        }
        Update: {
          created_at?: string
          de_user_id?: string
          dia?: string
          emoji?: string
          id?: string
          para_user_id?: string
          para_username?: string
        }
        Relationships: []
      }
      user_areas: {
        Row: {
          area: string
          created_at: string
          id: string
          nivel: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          nivel?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          nivel?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_captacoes: { Args: { _user_id: string }; Returns: boolean }
      can_access_peds: { Args: { _user_id: string }; Returns: boolean }
      can_edit_ilegal: { Args: { _user_id: string }; Returns: boolean }
      has_area: { Args: { _area: string; _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ilegal_transferir_org: {
        Args: { _destino: string; _origem: string }
        Returns: undefined
      }
      ilegal_trocar_historico_online: {
        Args: { _ate: string; _destino: string; _origem: string }
        Returns: undefined
      }
      is_coordinator_plus: { Args: { _user_id: string }; Returns: boolean }
      org_convite_contar: { Args: { _campo: string; _slug: string }; Returns: undefined }
      is_founder: { Args: { _user_id: string }; Returns: boolean }
      is_ilegal_lider: { Args: { _user_id: string }; Returns: boolean }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "founder"
        | "c_level"
        | "direcao"
        | "coordinator"
        | "manager"
        | "head_moderator"
        | "staff"
        | "dev"
        | "support"
        | "contributor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "founder",
        "c_level",
        "direcao",
        "coordinator",
        "manager",
        "head_moderator",
        "staff",
        "dev",
        "support",
        "contributor",
      ],
    },
  },
} as const
