import type { UserRole, TeamColor, WorkOrderStatus, WorkType } from './enums'

type PriorityLevel = 'normal' | 'alta' | 'urgente'
type PhotoType = 'before' | 'during' | 'after'
type MaterialUnit = 'm' | 'ud' | 'rollo' | 'caja'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string
          role: UserRole
          team: TeamColor | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          full_name: string
          role: UserRole
          team?: TeamColor | null
          pin_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string
          role?: UserRole
          team?: TeamColor | null
          pin_code?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: never[]
      }

      clients: {
        Row: {
          id: string
          name: string
          code: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          code?: string
          is_active?: boolean
        }
        Relationships: never[]
      }

      projects: {
        Row: {
          id: string
          code: string
          name: string
          client_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          client_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          client_id?: string | null
          is_active?: boolean
        }
        Relationships: never[]
      }

      operators: {
        Row: {
          id: string
          code: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          is_active?: boolean
        }
        Relationships: never[]
      }

      work_orders: {
        Row: {
          id: string
          order_number: string
          client_id: string
          project_id: string
          operator_id: string
          line: string
          work_type: WorkType
          status: WorkOrderStatus
          priority: PriorityLevel
          assigned_team: TeamColor | null
          assigned_technician: string | null
          assigned_date: string | null
          address: string | null
          postal_code: string | null
          city: string | null
          internal_notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          client_id: string
          project_id: string
          operator_id: string
          line: string
          work_type: WorkType
          status?: WorkOrderStatus
          priority?: PriorityLevel
          assigned_team?: TeamColor | null
          assigned_technician?: string | null
          assigned_date?: string | null
          address?: string | null
          postal_code?: string | null
          city?: string | null
          internal_notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          client_id?: string
          project_id?: string
          operator_id?: string
          line?: string
          work_type?: WorkType
          status?: WorkOrderStatus
          priority?: PriorityLevel
          assigned_team?: TeamColor | null
          assigned_technician?: string | null
          assigned_date?: string | null
          address?: string | null
          postal_code?: string | null
          city?: string | null
          internal_notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: never[]
      }

      wo_detail_soplado: {
        Row: {
          id: string
          work_order_id: string
          meters: number | null
          section: string | null
          tube_diameter: string | null
          result: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          meters?: number | null
          section?: string | null
          tube_diameter?: string | null
          result?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          meters?: number | null
          section?: string | null
          tube_diameter?: string | null
          result?: string | null
        }
        Relationships: never[]
      }

      wo_detail_fusion_ap: {
        Row: {
          id: string
          work_order_id: string
          splice_count: number | null
          fiber_type: string | null
          fusion_losses: number | null
          has_measurement_cert: boolean
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          splice_count?: number | null
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          splice_count?: number | null
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean
        }
        Relationships: never[]
      }

      wo_detail_fusion_dp: {
        Row: {
          id: string
          work_order_id: string
          splice_count: number | null
          fiber_type: string | null
          fusion_losses: number | null
          has_measurement_cert: boolean
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          splice_count?: number | null
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          splice_count?: number | null
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean
        }
        Relationships: never[]
      }

      wo_detail_alta: {
        Row: {
          id: string
          work_order_id: string
          access_type: string | null
          equipment_installed: string | null
          client_signature: boolean
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          access_type?: string | null
          equipment_installed?: string | null
          client_signature?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          access_type?: string | null
          equipment_installed?: string | null
          client_signature?: boolean
        }
        Relationships: never[]
      }

      wo_detail_nt: {
        Row: {
          id: string
          work_order_id: string
          nt_type: string | null
          serial_number: string | null
          location: string | null
          configuration: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          nt_type?: string | null
          serial_number?: string | null
          location?: string | null
          configuration?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          nt_type?: string | null
          serial_number?: string | null
          location?: string | null
          configuration?: string | null
        }
        Relationships: never[]
      }

      wo_detail_patchkabel: {
        Row: {
          id: string
          work_order_id: string
          connected_section: string | null
          cable_length: number | null
          connector_type: string | null
          test_result: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          connected_section?: string | null
          cable_length?: number | null
          connector_type?: string | null
          test_result?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          connected_section?: string | null
          cable_length?: number | null
          connector_type?: string | null
          test_result?: string | null
        }
        Relationships: never[]
      }

      work_order_photos: {
        Row: {
          id: string
          work_order_id: string
          storage_path: string
          photo_type: PhotoType
          caption: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          storage_path: string
          photo_type: PhotoType
          caption?: string | null
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          storage_path?: string
          photo_type?: PhotoType
          caption?: string | null
          uploaded_by?: string
        }
        Relationships: never[]
      }

      work_order_state_history: {
        Row: {
          id: string
          work_order_id: string
          from_status: WorkOrderStatus | null
          to_status: WorkOrderStatus
          changed_by: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          from_status?: WorkOrderStatus | null
          to_status: WorkOrderStatus
          changed_by: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          from_status?: WorkOrderStatus | null
          to_status?: WorkOrderStatus
          changed_by?: string
          notes?: string | null
        }
        Relationships: never[]
      }

      materials: {
        Row: {
          id: string
          name: string
          unit: MaterialUnit
          min_stock: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          unit: MaterialUnit
          min_stock?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          unit?: MaterialUnit
          min_stock?: number
          is_active?: boolean
        }
        Relationships: never[]
      }
    }

    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      team_color: TeamColor
      work_order_status: WorkOrderStatus
      work_type: WorkType
      priority_level: PriorityLevel
      photo_type: PhotoType
      material_unit: MaterialUnit
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
