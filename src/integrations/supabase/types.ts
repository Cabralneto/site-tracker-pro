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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      disciplinas: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          accuracy: number | null
          confirmacao_status:
            | Database["public"]["Enums"]["confirmacao_status"]
            | null
          confirmado_em: string | null
          confirmado_por: string | null
          criado_em: string | null
          criado_por: string
          detalhe_impedimento: string | null
          foto_url: string | null
          id: string
          impedimento_id: string | null
          ip: string | null
          lat: number | null
          lon: number | null
          observacao: string | null
          pt_id: string
          tipo_evento: Database["public"]["Enums"]["tipo_evento"]
          user_agent: string | null
        }
        Insert: {
          accuracy?: number | null
          confirmacao_status?:
            | Database["public"]["Enums"]["confirmacao_status"]
            | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string | null
          criado_por: string
          detalhe_impedimento?: string | null
          foto_url?: string | null
          id?: string
          impedimento_id?: string | null
          ip?: string | null
          lat?: number | null
          lon?: number | null
          observacao?: string | null
          pt_id: string
          tipo_evento: Database["public"]["Enums"]["tipo_evento"]
          user_agent?: string | null
        }
        Update: {
          accuracy?: number | null
          confirmacao_status?:
            | Database["public"]["Enums"]["confirmacao_status"]
            | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string | null
          criado_por?: string
          detalhe_impedimento?: string | null
          foto_url?: string | null
          id?: string
          impedimento_id?: string | null
          ip?: string | null
          lat?: number | null
          lon?: number | null
          observacao?: string | null
          pt_id?: string
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_impedimento_id_fkey"
            columns: ["impedimento_id"]
            isOneToOne: false
            referencedRelation: "impedimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_pt_id_fkey"
            columns: ["pt_id"]
            isOneToOne: false
            referencedRelation: "pts"
            referencedColumns: ["id"]
          },
        ]
      }
      frentes: {
        Row: {
          area: string | null
          ativo: boolean | null
          criado_em: string | null
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          area?: string | null
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          area?: string | null
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      impedimentos: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email: string
          id: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      profiles_directory: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
      }
      pts: {
        Row: {
          atraso_etm: number | null
          atraso_petrobras: number | null
          atualizado_em: string | null
          causa_atraso: string | null
          criado_em: string | null
          criado_por: string
          data_servico: string
          descricao_operacao: string | null
          disciplina_id: string | null
          disciplina_ids: string[] | null
          efetivo_qtd: number
          encarregado_matricula: string | null
          encarregado_nome: string | null
          equipe: string | null
          frente_id: string | null
          frente_ids: string[] | null
          id: string
          numero_pt: string
          responsavel_atraso:
            | Database["public"]["Enums"]["responsavel_atraso"]
            | null
          status: Database["public"]["Enums"]["pt_status"]
          tempo_ate_chegada: unknown
          tempo_ate_liberacao: unknown
          tipo_pt: Database["public"]["Enums"]["tipo_pt"]
        }
        Insert: {
          atraso_etm?: number | null
          atraso_petrobras?: number | null
          atualizado_em?: string | null
          causa_atraso?: string | null
          criado_em?: string | null
          criado_por: string
          data_servico?: string
          descricao_operacao?: string | null
          disciplina_id?: string | null
          disciplina_ids?: string[] | null
          efetivo_qtd?: number
          encarregado_matricula?: string | null
          encarregado_nome?: string | null
          equipe?: string | null
          frente_id?: string | null
          frente_ids?: string[] | null
          id?: string
          numero_pt: string
          responsavel_atraso?:
            | Database["public"]["Enums"]["responsavel_atraso"]
            | null
          status?: Database["public"]["Enums"]["pt_status"]
          tempo_ate_chegada?: unknown
          tempo_ate_liberacao?: unknown
          tipo_pt?: Database["public"]["Enums"]["tipo_pt"]
        }
        Update: {
          atraso_etm?: number | null
          atraso_petrobras?: number | null
          atualizado_em?: string | null
          causa_atraso?: string | null
          criado_em?: string | null
          criado_por?: string
          data_servico?: string
          descricao_operacao?: string | null
          disciplina_id?: string | null
          disciplina_ids?: string[] | null
          efetivo_qtd?: number
          encarregado_matricula?: string | null
          encarregado_nome?: string | null
          equipe?: string | null
          frente_id?: string | null
          frente_ids?: string[] | null
          id?: string
          numero_pt?: string
          responsavel_atraso?:
            | Database["public"]["Enums"]["responsavel_atraso"]
            | null
          status?: Database["public"]["Enums"]["pt_status"]
          tempo_ate_chegada?: unknown
          tempo_ate_liberacao?: unknown
          tipo_pt?: Database["public"]["Enums"]["tipo_pt"]
        }
        Relationships: [
          {
            foreignKeyName: "pts_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pts_frente_id_fkey"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_config: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          criado_por: string | null
          hora_limite_liberacao: string
          hora_limite_solicitacao: string
          id: string
          timezone: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          hora_limite_liberacao?: string
          hora_limite_solicitacao?: string
          id?: string
          timezone?: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          criado_por?: string | null
          hora_limite_liberacao?: string
          hora_limite_solicitacao?: string
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_encarregado_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_operador_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "encarregado" | "operador" | "visualizador"
      confirmacao_status: "confirmado" | "pendente"
      pt_status: "pendente" | "solicitada" | "chegada" | "liberada" | "impedida"
      responsavel_atraso: "etm" | "petrobras" | "sem_atraso" | "impedimento"
      tipo_evento: "solicitacao" | "chegada" | "liberacao" | "impedimento"
      tipo_pt: "pt" | "ptt"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "encarregado", "operador", "visualizador"],
      confirmacao_status: ["confirmado", "pendente"],
      pt_status: ["pendente", "solicitada", "chegada", "liberada", "impedida"],
      responsavel_atraso: ["etm", "petrobras", "sem_atraso", "impedimento"],
      tipo_evento: ["solicitacao", "chegada", "liberacao", "impedimento"],
      tipo_pt: ["pt", "ptt"],
    },
  },
} as const
