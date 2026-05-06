import type { UserRole, TeamColor, WorkOrderStatus, WorkType } from './enums'

type PriorityLevel = 'normal' | 'alta' | 'urgente'
type PhotoType = 'before' | 'during' | 'after'
type MaterialUnit = 'm' | 'ud' | 'rollo' | 'caja'
type ContractorDocumentType =
  | 'gewerbeanmeldung'
  | 'haftpflichtversicherung'
  | 'unbedenklichkeit_finanzamt'
  | 'unbedenklichkeit_sozialkasse'
  | 'id_passport'
  | 'subcontractor_agreement'
type ContractorDocumentStatus = 'pending_review' | 'approved' | 'rejected'

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
          pin_login_code: string | null
          pin_set_at: string | null
          last_pin_login_at: string | null
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
          pin_login_code?: string | null
          pin_hash?: string | null
          pin_set_at?: string | null
          last_pin_login_at?: string | null
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
          pin_login_code?: string | null
          pin_hash?: string | null
          pin_set_at?: string | null
          last_pin_login_at?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: never[]
      }

      pin_trusted_devices: {
        Row: {
          id: string
          profile_id: string
          device_id_hash: string
          first_seen_at: string
          last_seen_at: string
          last_user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          device_id_hash: string
          first_seen_at?: string
          last_seen_at?: string
          last_user_agent?: string | null
          created_at?: string
        }
        Update: {
          profile_id?: string
          device_id_hash?: string
          first_seen_at?: string
          last_seen_at?: string
          last_user_agent?: string | null
        }
        Relationships: never[]
      }

      contractor_documents: {
        Row: {
          id: string
          contractor_id: string
          document_type: ContractorDocumentType
          status: ContractorDocumentStatus
          file_name: string
          storage_path: string
          mime_type: string | null
          size_bytes: number | null
          issued_at: string | null
          expires_at: string | null
          uploaded_by: string
          uploaded_at: string
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contractor_id: string
          document_type: ContractorDocumentType
          status?: ContractorDocumentStatus
          file_name: string
          storage_path: string
          mime_type?: string | null
          size_bytes?: number | null
          issued_at?: string | null
          expires_at?: string | null
          uploaded_by: string
          uploaded_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          document_type?: ContractorDocumentType
          status?: ContractorDocumentStatus
          file_name?: string
          storage_path?: string
          mime_type?: string | null
          size_bytes?: number | null
          issued_at?: string | null
          expires_at?: string | null
          uploaded_by?: string
          uploaded_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
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
          assigned_collaborator_id: string | null
          assigned_date: string | null
          address: string | null
          postal_code: string | null
          city: string | null
          internal_notes: string | null
          assigned_detail_snapshot: Record<string, unknown> | null
          service_item_id: string | null
          billing_reference: string | null
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
          assigned_collaborator_id?: string | null
          assigned_date?: string | null
          address?: string | null
          postal_code?: string | null
          city?: string | null
          internal_notes?: string | null
          assigned_detail_snapshot?: Record<string, unknown> | null
          service_item_id?: string | null
          billing_reference?: string | null
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
          assigned_collaborator_id?: string | null
          assigned_date?: string | null
          address?: string | null
          postal_code?: string | null
          city?: string | null
          internal_notes?: string | null
          assigned_detail_snapshot?: Record<string, unknown> | null
          service_item_id?: string | null
          billing_reference?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: never[]
      }

      service_items: {
        Row: {
          id: string
          code: string
          description_de: string
          description_es: string | null
          unit: string | null
          unit_price: number | null
          unit_price_external: number | null
          operator_id: string | null
          client_id: string | null
          detail_form: string | null
          display_order: number
          active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description_de: string
          description_es?: string | null
          unit?: string | null
          unit_price?: number | null
          unit_price_external?: number | null
          operator_id?: string | null
          client_id?: string | null
          detail_form?: string | null
          display_order?: number
          active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          code?: string
          description_de?: string
          description_es?: string | null
          unit?: string | null
          unit_price?: number | null
          unit_price_external?: number | null
          operator_id?: string | null
          client_id?: string | null
          detail_form?: string | null
          display_order?: number
          active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: never[]
      }

      work_order_line_items: {
        Row: {
          id: string
          work_order_id: string
          service_item_id: string
          quantity: number
          unit_price_snapshot: number | null
          unit_price_external_snapshot: number | null
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          service_item_id: string
          quantity?: number
          unit_price_snapshot?: number | null
          unit_price_external_snapshot?: number | null
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          quantity?: number
          unit_price_snapshot?: number | null
          unit_price_external_snapshot?: number | null
          notes?: string | null
        }
        Relationships: never[]
      }

      work_order_documents: {
        Row: {
          id: string
          work_order_id: string
          document_type: string
          file_name: string
          storage_path: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          document_type: string
          file_name: string
          storage_path: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by: string
          uploaded_at?: string
        }
        Update: {
          document_type?: string
          file_name?: string
          storage_path?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: never[]
      }

      certification_audits: {
        Row: {
          id: string
          work_order_id: string
          cert_type: string
          certified_by: string
          certified_at: string
          data_hash: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          cert_type: string
          certified_by: string
          certified_at?: string
          data_hash: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          cert_type?: string
          certified_by?: string
          certified_at?: string
          data_hash?: string
          notes?: string | null
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

      wo_detail_pop: {
        Row: {
          id: string
          work_order_id: string
          rack_id: string | null
          tray_count: number | null
          cable_entry_points: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          rack_id?: string | null
          tray_count?: number | null
          cable_entry_points?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          rack_id?: string | null
          tray_count?: number | null
          cable_entry_points?: string | null
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
