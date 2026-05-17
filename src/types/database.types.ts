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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      event_group_mappings: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["telegram_event_type"]
          id: string
          is_active: boolean
          telegram_group_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["telegram_event_type"]
          id?: string
          is_active?: boolean
          telegram_group_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["telegram_event_type"]
          id?: string
          is_active?: boolean
          telegram_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_group_mappings_telegram_group_id_fkey"
            columns: ["telegram_group_id"]
            isOneToOne: false
            referencedRelation: "telegram_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          min_stock: number
          name: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          unit?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          team: Database["public"]["Enums"]["team_color"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          team?: Database["public"]["Enums"]["team_color"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          team?: Database["public"]["Enums"]["team_color"] | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          client_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          client_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_items: {
        Row: {
          active: boolean
          client_id: string | null
          code: string
          created_at: string
          description_de: string
          description_es: string | null
          detail_form: string | null
          display_order: number
          id: string
          notes: string | null
          operator_id: string | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id?: string | null
          code: string
          created_at?: string
          description_de: string
          description_es?: string | null
          detail_form?: string | null
          display_order?: number
          id?: string
          notes?: string | null
          operator_id?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string | null
          code?: string
          created_at?: string
          description_de?: string
          description_es?: string | null
          detail_form?: string | null
          display_order?: number
          id?: string
          notes?: string | null
          operator_id?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_groups: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          purpose: Database["public"]["Enums"]["telegram_group_purpose"]
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          purpose: Database["public"]["Enums"]["telegram_group_purpose"]
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          purpose?: Database["public"]["Enums"]["telegram_group_purpose"]
          updated_at?: string
        }
        Relationships: []
      }
      wo_detail_alta: {
        Row: {
          access_type: string | null
          client_signature: boolean | null
          created_at: string
          equipment_installed: string | null
          id: string
          work_order_id: string
        }
        Insert: {
          access_type?: string | null
          client_signature?: boolean | null
          created_at?: string
          equipment_installed?: string | null
          id?: string
          work_order_id: string
        }
        Update: {
          access_type?: string | null
          client_signature?: boolean | null
          created_at?: string
          equipment_installed?: string | null
          id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_alta_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_detail_fusion_ap: {
        Row: {
          created_at: string
          fiber_type: string | null
          fusion_losses: number | null
          has_measurement_cert: boolean | null
          id: string
          splice_count: number | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean | null
          id?: string
          splice_count?: number | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean | null
          id?: string
          splice_count?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_fusion_ap_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_detail_fusion_dp: {
        Row: {
          created_at: string
          fiber_type: string | null
          fusion_losses: number | null
          has_measurement_cert: boolean | null
          id: string
          splice_count: number | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean | null
          id?: string
          splice_count?: number | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean | null
          id?: string
          splice_count?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_fusion_dp_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_detail_nt: {
        Row: {
          configuration: string | null
          created_at: string
          id: string
          location: string | null
          nt_type: string | null
          serial_number: string | null
          work_order_id: string
        }
        Insert: {
          configuration?: string | null
          created_at?: string
          id?: string
          location?: string | null
          nt_type?: string | null
          serial_number?: string | null
          work_order_id: string
        }
        Update: {
          configuration?: string | null
          created_at?: string
          id?: string
          location?: string | null
          nt_type?: string | null
          serial_number?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_nt_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_detail_patchkabel: {
        Row: {
          cable_length: number | null
          connected_section: string | null
          connector_type: string | null
          created_at: string
          id: string
          test_result: string | null
          work_order_id: string
        }
        Insert: {
          cable_length?: number | null
          connected_section?: string | null
          connector_type?: string | null
          created_at?: string
          id?: string
          test_result?: string | null
          work_order_id: string
        }
        Update: {
          cable_length?: number | null
          connected_section?: string | null
          connector_type?: string | null
          created_at?: string
          id?: string
          test_result?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_patchkabel_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_detail_soplado: {
        Row: {
          created_at: string
          id: string
          meters: number | null
          result: string | null
          section: string | null
          tube_diameter: string | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meters?: number | null
          result?: string | null
          section?: string | null
          tube_diameter?: string | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meters?: number | null
          result?: string | null
          section?: string | null
          tube_diameter?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_soplado_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_type: string
          storage_path: string
          uploaded_by: string
          work_order_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_type: string
          storage_path: string
          uploaded_by: string
          work_order_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_type?: string
          storage_path?: string
          uploaded_by?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_photos_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_state_history: {
        Row: {
          changed_by: string
          created_at: string
          from_status: Database["public"]["Enums"]["work_order_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["work_order_status"]
          work_order_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["work_order_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["work_order_status"]
          work_order_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["work_order_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["work_order_status"]
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_state_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_state_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          address: string | null
          assigned_date: string | null
          assigned_team: Database["public"]["Enums"]["team_color"] | null
          assigned_technician: string | null
          city: string | null
          client_id: string
          created_at: string
          created_by: string
          id: string
          internal_notes: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Insert: {
          address?: string | null
          assigned_date?: string | null
          assigned_team?: Database["public"]["Enums"]["team_color"] | null
          assigned_technician?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          internal_notes?: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Update: {
          address?: string | null
          assigned_date?: string | null
          assigned_team?: Database["public"]["Enums"]["team_color"] | null
          assigned_technician?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          internal_notes?: string | null
          line?: string
          operator_id?: string
          order_number?: string
          postal_code?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          service_item_id?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_technician_fkey"
            columns: ["assigned_technician"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      priority_level: "normal" | "alta" | "urgente"
      team_color: "rot" | "gruen" | "blau" | "gelb"
      telegram_event_type:
        | "order_returned_for_correction"
        | "task_assigned"
        | "order_status_changed"
      telegram_group_purpose: "tareas" | "alertas" | "notificaciones"
      user_role: "admin" | "technician" | "contractor"
      work_order_status:
        | "created"
        | "assigned"
        | "in_progress"
        | "executed"
        | "rueckmeldung_pending"
        | "rueckmeldung_sent"
        | "internally_certified"
        | "sent_to_client"
        | "client_accepted"
        | "client_rejected"
        | "invoiced"
        | "paid"
        | "returned"
        | "cancelled"
      work_type:
        | "soplado"
        | "fusion_ap"
        | "fusion_dp"
        | "alta"
        | "nt_installation"
        | "patchkabel"
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
      priority_level: ["normal", "alta", "urgente"],
      team_color: ["rot", "gruen", "blau", "gelb"],
      telegram_event_type: [
        "order_returned_for_correction",
        "task_assigned",
        "order_status_changed",
      ],
      telegram_group_purpose: ["tareas", "alertas", "notificaciones"],
      user_role: ["admin", "technician", "contractor"],
      work_order_status: [
        "created",
        "assigned",
        "in_progress",
        "executed",
        "rueckmeldung_pending",
        "rueckmeldung_sent",
        "internally_certified",
        "sent_to_client",
        "client_accepted",
        "client_rejected",
        "invoiced",
        "paid",
        "returned",
        "cancelled",
      ],
      work_type: [
        "soplado",
        "fusion_ap",
        "fusion_dp",
        "alta",
        "nt_installation",
        "patchkabel",
      ],
    },
  },
} as const
