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
      appointments: {
        Row: {
          address: string | null
          assigned_to: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          duration_min: number
          id: string
          line: string
          notes: string | null
          operator_id: string
          scheduled_at: string
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          id?: string
          line: string
          notes?: string | null
          operator_id: string
          scheduled_at: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          id?: string
          line?: string
          notes?: string | null
          operator_id?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_audits: {
        Row: {
          cert_type: string
          certified_at: string
          certified_by: string
          created_at: string
          data_hash: string
          id: string
          notes: string | null
          work_order_id: string
        }
        Insert: {
          cert_type: string
          certified_at?: string
          certified_by: string
          created_at?: string
          data_hash: string
          id?: string
          notes?: string | null
          work_order_id: string
        }
        Update: {
          cert_type?: string
          certified_at?: string
          certified_by?: string
          created_at?: string
          data_hash?: string
          id?: string
          notes?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_audits_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_audits_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
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
      collaborator_cycle_orders: {
        Row: {
          cycle_id: string
          work_order_id: string
        }
        Insert: {
          cycle_id: string
          work_order_id: string
        }
        Update: {
          cycle_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_cycle_orders_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "collaborator_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_cycle_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_cycles: {
        Row: {
          collaborator_id: string
          created_at: string
          emission_date: string | null
          final_cert_date: string | null
          id: string
          payment_date: string | null
          period_end: string
          period_label: string | null
          period_start: string
          published_at: string | null
          published_by: string | null
          review_start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          emission_date?: string | null
          final_cert_date?: string | null
          id?: string
          payment_date?: string | null
          period_end: string
          period_label?: string | null
          period_start: string
          published_at?: string | null
          published_by?: string | null
          review_start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          emission_date?: string | null
          final_cert_date?: string | null
          id?: string
          payment_date?: string | null
          period_end?: string
          period_label?: string | null
          period_start?: string
          published_at?: string | null
          published_by?: string | null
          review_start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_cycles_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_cycles_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_documents: {
        Row: {
          contractor_id: string
          created_at: string
          document_type: string
          expires_at: string | null
          file_name: string
          id: string
          issued_at: string | null
          mime_type: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          document_type: string
          expires_at?: string | null
          file_name: string
          id?: string
          issued_at?: string | null
          mime_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          issued_at?: string | null
          mime_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_documents_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          end_date: string | null
          full_name: string
          gross_salary: number
          iban: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          profile_id: string | null
          start_date: string
          steuer_id: string | null
          steuerklasse: string | null
          sv_nummer: string | null
          team: Database["public"]["Enums"]["team_color"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          end_date?: string | null
          full_name: string
          gross_salary?: number
          iban?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          start_date: string
          steuer_id?: string | null
          steuerklasse?: string | null
          sv_nummer?: string | null
          team?: Database["public"]["Enums"]["team_color"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          end_date?: string | null
          full_name?: string
          gross_salary?: number
          iban?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          start_date?: string
          steuer_id?: string | null
          steuerklasse?: string | null
          sv_nummer?: string | null
          team?: Database["public"]["Enums"]["team_color"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      inventory_vehicles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          license_plate: string | null
          name: string
          notes: string | null
          team: Database["public"]["Enums"]["team_color"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          license_plate?: string | null
          name: string
          notes?: string | null
          team: Database["public"]["Enums"]["team_color"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          license_plate?: string | null
          name?: string
          notes?: string | null
          team?: Database["public"]["Enums"]["team_color"]
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          catalog_client_id: string | null
          catalog_source: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          min_stock: number
          name: string
          notes: string | null
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          catalog_client_id?: string | null
          catalog_source?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          notes?: string | null
          sku?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          catalog_client_id?: string | null
          catalog_source?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          notes?: string | null
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_catalog_client_id_fkey"
            columns: ["catalog_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      pin_trusted_devices: {
        Row: {
          created_at: string
          device_id_hash: string
          first_seen_at: string
          id: string
          last_seen_at: string
          last_user_agent: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          device_id_hash: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          last_user_agent?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          device_id_hash?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          last_user_agent?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_trusted_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_pin_login_at: string | null
          pin_hash: string | null
          pin_login_code: string | null
          pin_set_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          scheduler_line: string | null
          scheduler_operator: string | null
          team: Database["public"]["Enums"]["team_color"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          last_pin_login_at?: string | null
          pin_hash?: string | null
          pin_login_code?: string | null
          pin_set_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          scheduler_line?: string | null
          scheduler_operator?: string | null
          team?: Database["public"]["Enums"]["team_color"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_pin_login_at?: string | null
          pin_hash?: string | null
          pin_login_code?: string | null
          pin_set_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          scheduler_line?: string | null
          scheduler_operator?: string | null
          team?: Database["public"]["Enums"]["team_color"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_scheduler_operator_fkey"
            columns: ["scheduler_operator"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          code: string
          created_at: string
          default_line: string | null
          default_operator_id: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          client_id?: string | null
          code: string
          created_at?: string
          default_line?: string | null
          default_operator_id?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          client_id?: string | null
          code?: string
          created_at?: string
          default_line?: string | null
          default_operator_id?: string | null
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
          {
            foreignKeyName: "projects_default_operator_id_fkey"
            columns: ["default_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      service_items: {
        Row: {
          active: boolean
          category: string | null
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
          unit_price_external: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
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
          unit_price_external?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
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
          unit_price_external?: number | null
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          material_id: string
          movement_type: string
          quantity_delta: number
          reason: string | null
          stock_after: number
          stock_before: number
          vehicle_id: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          material_id: string
          movement_type: string
          quantity_delta: number
          reason?: string | null
          stock_after: number
          stock_before: number
          vehicle_id: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          material_id?: string
          movement_type?: string
          quantity_delta?: number
          reason?: string | null
          stock_after?: number
          stock_before?: number
          vehicle_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "inventory_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      team_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          team_color: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          team_color: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          team_color?: string
          updated_at?: string
        }
        Relationships: []
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
      vacation_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_count: number
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count: number
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_material_stock: {
        Row: {
          id: string
          material_id: string
          quantity: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          id?: string
          material_id: string
          quantity?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          id?: string
          material_id?: string
          quantity?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_material_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_material_stock_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "inventory_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_detail_alta: {
        Row: {
          access_type: string | null
          client_signature: boolean | null
          created_at: string
          equipment_installed: string | null
          id: string
          reported_service_items: Json
          work_order_id: string
        }
        Insert: {
          access_type?: string | null
          client_signature?: boolean | null
          created_at?: string
          equipment_installed?: string | null
          id?: string
          reported_service_items?: Json
          work_order_id: string
        }
        Update: {
          access_type?: string | null
          client_signature?: boolean | null
          created_at?: string
          equipment_installed?: string | null
          id?: string
          reported_service_items?: Json
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
          cabinet_code: string | null
          card_count: number | null
          created_at: string
          fiber_type: string | null
          fusion_losses: number | null
          has_measurement_cert: boolean | null
          id: string
          splice_count: number | null
          work_order_id: string
        }
        Insert: {
          cabinet_code?: string | null
          card_count?: number | null
          created_at?: string
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean | null
          id?: string
          splice_count?: number | null
          work_order_id: string
        }
        Update: {
          cabinet_code?: string | null
          card_count?: number | null
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
          cabinet_code: string | null
          card_count: number | null
          created_at: string
          fiber_type: string | null
          fusion_losses: number | null
          has_measurement_cert: boolean | null
          id: string
          splice_count: number | null
          work_order_id: string
        }
        Insert: {
          cabinet_code?: string | null
          card_count?: number | null
          created_at?: string
          fiber_type?: string | null
          fusion_losses?: number | null
          has_measurement_cert?: boolean | null
          id?: string
          splice_count?: number | null
          work_order_id: string
        }
        Update: {
          cabinet_code?: string | null
          card_count?: number | null
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
      wo_detail_pop: {
        Row: {
          cable_entry_points: string | null
          created_at: string
          id: string
          rack_id: string | null
          tray_count: number | null
          work_order_id: string
        }
        Insert: {
          cable_entry_points?: string | null
          created_at?: string
          id?: string
          rack_id?: string | null
          tray_count?: number | null
          work_order_id: string
        }
        Update: {
          cable_entry_points?: string | null
          created_at?: string
          id?: string
          rack_id?: string | null
          tray_count?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_detail_pop_work_order_id_fkey"
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
      work_order_billing_lines: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          qty: number
          service_item_id: string
          subtotal: number | null
          unit_price_external_snapshot: number | null
          unit_price_snapshot: number
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          qty: number
          service_item_id: string
          subtotal?: number | null
          unit_price_external_snapshot?: number | null
          unit_price_snapshot: number
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          qty?: number
          service_item_id?: string
          subtotal?: number | null
          unit_price_external_snapshot?: number | null
          unit_price_snapshot?: number
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_billing_lines_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_billing_lines_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_billing_lines_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_documents: {
        Row: {
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string
          work_order_id: string
        }
        Insert: {
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
          work_order_id: string
        }
        Update: {
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_documents_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_line_items: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          quantity: number
          service_item_id: string
          unit_price_external_snapshot: number | null
          unit_price_snapshot: number | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          quantity?: number
          service_item_id: string
          unit_price_external_snapshot?: number | null
          unit_price_snapshot?: number | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          quantity?: number
          service_item_id?: string
          unit_price_external_snapshot?: number | null
          unit_price_snapshot?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_line_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_material_consumptions: {
        Row: {
          created_at: string
          id: string
          material_id: string
          notes: string | null
          quantity: number
          reported_by: string
          stock_real_before: number | null
          vehicle_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          quantity: number
          reported_by: string
          stock_real_before?: number | null
          vehicle_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          quantity?: number
          reported_by?: string
          stock_real_before?: number | null
          vehicle_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_material_consumptions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_material_consumptions_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_material_consumptions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "inventory_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_material_consumptions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
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
          assigned_collaborator_id: string | null
          assigned_date: string | null
          assigned_detail_snapshot: Json | null
          assigned_team: Database["public"]["Enums"]["team_color"] | null
          assigned_technician: string | null
          billing_reference: string | null
          city: string | null
          client_id: string | null
          created_at: string
          created_by: string
          external_metadata: Json | null
          id: string
          internal_notes: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id: string | null
          source: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Insert: {
          address?: string | null
          assigned_collaborator_id?: string | null
          assigned_date?: string | null
          assigned_detail_snapshot?: Json | null
          assigned_team?: Database["public"]["Enums"]["team_color"] | null
          assigned_technician?: string | null
          billing_reference?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          external_metadata?: Json | null
          id?: string
          internal_notes?: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Update: {
          address?: string | null
          assigned_collaborator_id?: string | null
          assigned_date?: string | null
          assigned_detail_snapshot?: Json | null
          assigned_team?: Database["public"]["Enums"]["team_color"] | null
          assigned_technician?: string | null
          billing_reference?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          external_metadata?: Json | null
          id?: string
          internal_notes?: string | null
          line?: string
          operator_id?: string
          order_number?: string
          postal_code?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          service_item_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_collaborator_id_fkey"
            columns: ["assigned_collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "work_orders_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      service_items_public: {
        Row: {
          active: boolean | null
          category: string | null
          client_code: string | null
          client_id: string | null
          client_name: string | null
          code: string | null
          created_at: string | null
          description_de: string | null
          description_es: string | null
          detail_form: string | null
          display_order: number | null
          id: string | null
          notes: string | null
          operator_code: string | null
          operator_id: string | null
          operator_name: string | null
          unit: string | null
          updated_at: string | null
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
    }
    Functions: {
      accept_work_order_client: {
        Args: {
          p_changed_by: string
          p_data_hash: string
          p_notes?: string
          p_work_order_id: string
        }
        Returns: {
          address: string | null
          assigned_collaborator_id: string | null
          assigned_date: string | null
          assigned_detail_snapshot: Json | null
          assigned_team: Database["public"]["Enums"]["team_color"] | null
          assigned_technician: string | null
          billing_reference: string | null
          city: string | null
          client_id: string | null
          created_at: string
          created_by: string
          external_metadata: Json | null
          id: string
          internal_notes: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id: string | null
          source: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_work_order_rueckmeldung_complete: {
        Args: { p_work_order_id: string }
        Returns: undefined
      }
      assign_work_order_checked: {
        Args: {
          p_assigned_date: string
          p_assignee_id: string
          p_changed_by: string
          p_notes?: string
          p_team: Database["public"]["Enums"]["team_color"]
          p_work_order_id: string
        }
        Returns: {
          address: string | null
          assigned_collaborator_id: string | null
          assigned_date: string | null
          assigned_detail_snapshot: Json | null
          assigned_team: Database["public"]["Enums"]["team_color"] | null
          assigned_technician: string | null
          billing_reference: string | null
          city: string | null
          client_id: string | null
          created_at: string
          created_by: string
          external_metadata: Json | null
          id: string
          internal_notes: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id: string | null
          source: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      certify_work_order_internal: {
        Args: {
          p_changed_by: string
          p_data_hash: string
          p_notes?: string
          p_work_order_id: string
        }
        Returns: {
          address: string | null
          assigned_collaborator_id: string | null
          assigned_date: string | null
          assigned_detail_snapshot: Json | null
          assigned_team: Database["public"]["Enums"]["team_color"] | null
          assigned_technician: string | null
          billing_reference: string | null
          city: string | null
          client_id: string | null
          created_at: string
          created_by: string
          external_metadata: Json | null
          id: string
          internal_notes: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id: string | null
          source: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      contractor_document_compliance_failures: {
        Args: { p_assignment_date?: string; p_contractor_id: string }
        Returns: {
          document_type: string
          failure_code: string
        }[]
      }
      contractor_documents_are_valid:
        | { Args: { p_contractor_id: string }; Returns: boolean }
        | {
            Args: { p_assignment_date?: string; p_contractor_id: string }
            Returns: boolean
          }
      contractor_required_document_types: { Args: never; Returns: string[] }
      employee_vacation_days_used: {
        Args: { p_employee_id: string; p_year: number }
        Returns: number
      }
      generate_order_number: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      invoice_work_order_checked: {
        Args: {
          p_billing_reference?: string
          p_changed_by: string
          p_notes?: string
          p_work_order_id: string
        }
        Returns: {
          address: string | null
          assigned_collaborator_id: string | null
          assigned_date: string | null
          assigned_detail_snapshot: Json | null
          assigned_team: Database["public"]["Enums"]["team_color"] | null
          assigned_technician: string | null
          billing_reference: string | null
          city: string | null
          client_id: string | null
          created_at: string
          created_by: string
          external_metadata: Json | null
          id: string
          internal_notes: string | null
          line: string
          operator_id: string
          order_number: string
          postal_code: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          service_item_id: string | null
          source: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      document_type: "plano" | "cartas_empalme" | "diagrama_routing" | "other"
      priority_level: "normal" | "alta" | "urgente"
      team_color: "rot" | "gruen" | "blau" | "gelb"
      telegram_event_type:
        | "order_returned_for_correction"
        | "task_assigned"
        | "order_status_changed"
        | "order_cancelled"
        | "order_deleted"
      telegram_group_purpose: "tareas" | "alertas" | "notificaciones"
      user_role: "admin" | "technician" | "contractor" | "scheduler"
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
        | "pop"
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
      document_type: ["plano", "cartas_empalme", "diagrama_routing", "other"],
      priority_level: ["normal", "alta", "urgente"],
      team_color: ["rot", "gruen", "blau", "gelb"],
      telegram_event_type: [
        "order_returned_for_correction",
        "task_assigned",
        "order_status_changed",
        "order_cancelled",
        "order_deleted",
      ],
      telegram_group_purpose: ["tareas", "alertas", "notificaciones"],
      user_role: ["admin", "technician", "contractor", "scheduler"],
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
        "pop",
      ],
    },
  },
} as const
