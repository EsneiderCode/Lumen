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
    PostgrestVersion: "14.5"
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
      capture_plans: {
        Row: {
          created_at: string
          definition: Json
          is_active: boolean
          key: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          definition: Json
          is_active?: boolean
          key: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          definition?: Json
          is_active?: boolean
          key?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      certification_audits: {
        Row: {
          cert_type: string
          certified_at: string
          certified_by: string | null
          created_at: string
          data_hash: string
          id: string
          notes: string | null
          work_order_id: string
        }
        Insert: {
          cert_type: string
          certified_at?: string
          certified_by?: string | null
          created_at?: string
          data_hash: string
          id?: string
          notes?: string | null
          work_order_id: string
        }
        Update: {
          cert_type?: string
          certified_at?: string
          certified_by?: string | null
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
          collaborator_id: string | null
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
          collaborator_id?: string | null
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
          collaborator_id?: string | null
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
      compliance_entities: {
        Row: {
          address: string | null
          attributes: Json
          contact_email: string | null
          contact_phone: string | null
          country_code: string
          created_at: string
          display_name: string
          employee_id: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["compliance_entity_kind"]
          legal_ids: Json
          nationality_country: string | null
          notes: string | null
          parent_entity_id: string | null
          profile_id: string | null
          scheinselbst_check: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          attributes?: Json
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          display_name: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["compliance_entity_kind"]
          legal_ids?: Json
          nationality_country?: string | null
          notes?: string | null
          parent_entity_id?: string | null
          profile_id?: string | null
          scheinselbst_check?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          attributes?: Json
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["compliance_entity_kind"]
          legal_ids?: Json
          nationality_country?: string | null
          notes?: string | null
          parent_entity_id?: string | null
          profile_id?: string | null
          scheinselbst_check?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_entities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_entities_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "compliance_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_entities_profile_id_fkey"
            columns: ["profile_id"]
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
          uploaded_by: string | null
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
          uploaded_by?: string | null
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
          uploaded_by?: string | null
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
      document_access_log: {
        Row: {
          accessed_by: string
          action: string
          created_at: string
          id: string
          version_id: string
        }
        Insert: {
          accessed_by: string
          action: string
          created_at?: string
          id?: string
          version_id: string
        }
        Update: {
          accessed_by?: string
          action?: string
          created_at?: string
          id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_log_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          applies_to: Database["public"]["Enums"]["compliance_entity_kind"]
          conditions: Json
          created_at: string
          document_type_id: string
          id: string
          is_active: boolean
          is_mandatory: boolean
          min_amount: number | null
          min_amount_currency: string
          notes: string | null
          notify_days: number[]
          on_missing_action: string | null
          origin: Database["public"]["Enums"]["requirement_origin"]
          requires_coverage_confirmation: boolean
          scope: Database["public"]["Enums"]["requirement_scope"]
          updated_at: string
          validity_days: number | null
          validity_rule: Database["public"]["Enums"]["document_validity_rule"]
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["compliance_entity_kind"]
          conditions?: Json
          created_at?: string
          document_type_id: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          min_amount?: number | null
          min_amount_currency?: string
          notes?: string | null
          notify_days?: number[]
          on_missing_action?: string | null
          origin?: Database["public"]["Enums"]["requirement_origin"]
          requires_coverage_confirmation?: boolean
          scope?: Database["public"]["Enums"]["requirement_scope"]
          updated_at?: string
          validity_days?: number | null
          validity_rule: Database["public"]["Enums"]["document_validity_rule"]
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["compliance_entity_kind"]
          conditions?: Json
          created_at?: string
          document_type_id?: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          min_amount?: number | null
          min_amount_currency?: string
          notes?: string | null
          notify_days?: number[]
          on_missing_action?: string | null
          origin?: Database["public"]["Enums"]["requirement_origin"]
          requires_coverage_confirmation?: boolean
          scope?: Database["public"]["Enums"]["requirement_scope"]
          updated_at?: string
          validity_days?: number | null
          validity_rule?: Database["public"]["Enums"]["document_validity_rule"]
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reviews: {
        Row: {
          action: string
          approved_metadata: Json | null
          created_at: string
          id: string
          rejection_reasons: string[] | null
          rejection_text: string | null
          reviewer_id: string
          version_id: string
        }
        Insert: {
          action: string
          approved_metadata?: Json | null
          created_at?: string
          id?: string
          rejection_reasons?: string[] | null
          rejection_text?: string | null
          reviewer_id: string
          version_id: string
        }
        Update: {
          action?: string
          approved_metadata?: Json | null
          created_at?: string
          id?: string
          rejection_reasons?: string[] | null
          rejection_text?: string | null
          reviewer_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reviews_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          code: string
          created_at: string
          description_i18n: Json | null
          id: string
          is_active: boolean
          metadata_schema: Json
          name_i18n: Json
          template_storage_path: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_i18n?: Json | null
          id?: string
          is_active?: boolean
          metadata_schema?: Json
          name_i18n: Json
          template_storage_path?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_i18n?: Json | null
          id?: string
          is_active?: boolean
          metadata_schema?: Json
          name_i18n?: Json
          template_storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          entity_document_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          submitted_metadata: Json
          uploaded_at: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          entity_document_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path: string
          submitted_metadata?: Json
          uploaded_at?: string
          uploaded_by: string
          version_number: number
        }
        Update: {
          entity_document_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          submitted_metadata?: Json
          uploaded_at?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_entity_document_id_fkey"
            columns: ["entity_document_id"]
            isOneToOne: false
            referencedRelation: "entity_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey"
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
      entity_documents: {
        Row: {
          approved_amount: number | null
          approved_expires_at: string | null
          approved_issued_at: string | null
          approved_metadata: Json | null
          coverage_confirmed: boolean
          created_at: string
          current_version_id: string | null
          document_type_id: string
          entity_id: string
          id: string
          project_id: string | null
          requirement_id: string | null
          status: Database["public"]["Enums"]["entity_document_status"]
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          approved_expires_at?: string | null
          approved_issued_at?: string | null
          approved_metadata?: Json | null
          coverage_confirmed?: boolean
          created_at?: string
          current_version_id?: string | null
          document_type_id: string
          entity_id: string
          id?: string
          project_id?: string | null
          requirement_id?: string | null
          status?: Database["public"]["Enums"]["entity_document_status"]
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          approved_expires_at?: string | null
          approved_issued_at?: string | null
          approved_metadata?: Json | null
          coverage_confirmed?: boolean
          created_at?: string
          current_version_id?: string | null
          document_type_id?: string
          entity_id?: string
          id?: string
          project_id?: string | null
          requirement_id?: string | null
          status?: Database["public"]["Enums"]["entity_document_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "compliance_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_documents_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "document_requirements"
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
      notifications: {
        Row: {
          category: string
          created_at: string
          dedupe_key: string
          id: string
          level: string
          payload: Json
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          category: string
          created_at?: string
          dedupe_key: string
          id?: string
          level?: string
          payload?: Json
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          category?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          level?: string
          payload?: Json
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          key: string | null
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string | null
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string | null
          module?: string
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
      project_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          entity_id: string
          id: string
          override: boolean
          override_by: string | null
          override_reason: string | null
          project_id: string
          start_date: string
          status: Database["public"]["Enums"]["compliance_assignment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          entity_id: string
          id?: string
          override?: boolean
          override_by?: string | null
          override_reason?: string | null
          project_id: string
          start_date: string
          status?: Database["public"]["Enums"]["compliance_assignment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          entity_id?: string
          id?: string
          override?: boolean
          override_by?: string | null
          override_reason?: string | null
          project_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["compliance_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "compliance_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          city: string | null
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
          center_lat?: number | null
          center_lng?: number | null
          city?: string | null
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
          center_lat?: number | null
          center_lng?: number | null
          city?: string | null
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
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          auto_grant_new: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          auto_grant_new?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          auto_grant_new?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      subcontractor_onboarding: {
        Row: {
          a1_workers: Json
          address: string | null
          checked_48b: boolean
          company_name: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          deployment_period: string | null
          id: string
          notes: string | null
          place_date: string | null
          project_site: string | null
          tax_number_de: string | null
          updated_at: string
          ust_id_confirmed: boolean
          ust_id_es: string | null
          verified_by: string | null
          withhold_bauabzug: boolean
        }
        Insert: {
          a1_workers?: Json
          address?: string | null
          checked_48b?: boolean
          company_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          deployment_period?: string | null
          id?: string
          notes?: string | null
          place_date?: string | null
          project_site?: string | null
          tax_number_de?: string | null
          updated_at?: string
          ust_id_confirmed?: boolean
          ust_id_es?: string | null
          verified_by?: string | null
          withhold_bauabzug?: boolean
        }
        Update: {
          a1_workers?: Json
          address?: string | null
          checked_48b?: boolean
          company_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          deployment_period?: string | null
          id?: string
          notes?: string | null
          place_date?: string | null
          project_site?: string | null
          tax_number_de?: string | null
          updated_at?: string
          ust_id_confirmed?: boolean
          ust_id_es?: string | null
          verified_by?: string | null
          withhold_bauabzug?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_onboarding_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_onboarding_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_permissions: {
        Row: {
          created_at: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      work_order_capture_reports: {
        Row: {
          answers: Json
          created_at: string
          plan_key: string
          plan_version: number
          reported_service_items: Json
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
          work_order_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          plan_key: string
          plan_version: number
          reported_service_items?: Json
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          work_order_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          plan_key?: string
          plan_version?: number
          reported_service_items?: Json
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_capture_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_capture_reports_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
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
          uploaded_by: string | null
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
          uploaded_by?: string | null
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
          uploaded_by?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
          reported_by: string | null
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
          reported_by?: string | null
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
          reported_by?: string | null
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
          accuracy_m: number | null
          caption: string | null
          created_at: string
          id: string
          item_id: string | null
          lat: number | null
          lng: number | null
          photo_type: string
          section_key: string | null
          slot_key: string | null
          storage_path: string
          taken_at: string | null
          uploaded_by: string | null
          work_order_id: string
        }
        Insert: {
          accuracy_m?: number | null
          caption?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          lat?: number | null
          lng?: number | null
          photo_type: string
          section_key?: string | null
          slot_key?: string | null
          storage_path: string
          taken_at?: string | null
          uploaded_by?: string | null
          work_order_id: string
        }
        Update: {
          accuracy_m?: number | null
          caption?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          lat?: number | null
          lng?: number | null
          photo_type?: string
          section_key?: string | null
          slot_key?: string | null
          storage_path?: string
          taken_at?: string | null
          uploaded_by?: string | null
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
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["work_order_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["work_order_status"]
          work_order_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["work_order_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["work_order_status"]
          work_order_id: string
        }
        Update: {
          changed_by?: string | null
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
      work_order_telegram_groups: {
        Row: {
          created_at: string
          id: string
          telegram_group_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          telegram_group_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          telegram_group_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_telegram_groups_telegram_group_id_fkey"
            columns: ["telegram_group_id"]
            isOneToOne: false
            referencedRelation: "telegram_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_telegram_groups_work_order_id_fkey"
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
          capture_plan_key: string | null
          city: string | null
          client_id: string | null
          compliance_override: boolean
          compliance_override_at: string | null
          compliance_override_by: string | null
          compliance_override_reason: string | null
          created_at: string
          created_by: string | null
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
          capture_plan_key?: string | null
          city?: string | null
          client_id?: string | null
          compliance_override?: boolean
          compliance_override_at?: string | null
          compliance_override_by?: string | null
          compliance_override_reason?: string | null
          created_at?: string
          created_by?: string | null
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
          capture_plan_key?: string | null
          city?: string | null
          client_id?: string | null
          compliance_override?: boolean
          compliance_override_at?: string | null
          compliance_override_by?: string | null
          compliance_override_reason?: string | null
          created_at?: string
          created_by?: string | null
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
            foreignKeyName: "work_orders_compliance_override_by_fkey"
            columns: ["compliance_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          capture_plan_key: string | null
          city: string | null
          client_id: string | null
          compliance_override: boolean
          compliance_override_at: string | null
          compliance_override_by: string | null
          compliance_override_reason: string | null
          created_at: string
          created_by: string | null
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
      applicable_requirement_ids: {
        Args: { p_entity_id: string }
        Returns: string[]
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
          capture_plan_key: string | null
          city: string | null
          client_id: string | null
          compliance_override: boolean
          compliance_override_at: string | null
          compliance_override_by: string | null
          compliance_override_reason: string | null
          created_at: string
          created_by: string | null
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
      capture_condition_met: {
        Args: { p_answers: Json; p_condition: Json; p_item: Json }
        Returns: boolean
      }
      capture_field_filled: {
        Args: { p_field: Json; p_value: Json }
        Returns: boolean
      }
      capture_plan_missing_nodes: {
        Args: { p_answers: Json; p_plan: Json; p_work_order_id: string }
        Returns: string[]
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
          capture_plan_key: string | null
          city: string | null
          client_id: string | null
          compliance_override: boolean
          compliance_override_at: string | null
          compliance_override_by: string | null
          compliance_override_reason: string | null
          created_at: string
          created_by: string | null
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
      compute_entity_aptitude: {
        Args: { p_entity_id: string; p_project_id?: string }
        Returns: {
          level: string
          missing: Json
        }[]
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
      country_origin_bucket: {
        Args: { p_country: string }
        Returns: Database["public"]["Enums"]["requirement_origin"]
      }
      current_capture_plan: { Args: { p_key: string }; Returns: Json }
      employee_vacation_days_used: {
        Args: { p_employee_id: string; p_year: number }
        Returns: number
      }
      generate_order_number: { Args: never; Returns: string }
      get_my_permissions: { Args: never; Returns: string[] }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_permission: { Args: { perm: string }; Returns: boolean }
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
          capture_plan_key: string | null
          city: string | null
          client_id: string | null
          compliance_override: boolean
          compliance_override_at: string | null
          compliance_override_by: string | null
          compliance_override_reason: string | null
          created_at: string
          created_by: string | null
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
      owns_compliance_entity: {
        Args: { p_entity_id: string }
        Returns: boolean
      }
      owns_compliance_entity_path: {
        Args: { p_folder: string }
        Returns: boolean
      }
      run_compliance_expiry_sweep: {
        Args: never
        Returns: {
          days_remaining: number
          document_type_code: string
          document_type_name: Json
          entity_contact_email: string
          entity_display_name: string
          entity_document_id: string
          entity_id: string
          entity_profile_id: string
          expires_on: string
          new_status: string
        }[]
      }
      run_compliance_retention_sweep: {
        Args: { retain_days?: number }
        Returns: number
      }
      sync_permissions: { Args: { perms: Json }; Returns: Json }
      user_has_permission: {
        Args: { perm: string; uid: string }
        Returns: boolean
      }
      work_order_capture_plan_key: {
        Args: { p_work_order_id: string }
        Returns: string
      }
    }
    Enums: {
      compliance_assignment_status:
        | "draft"
        | "confirmed"
        | "ended"
        | "cancelled"
      compliance_entity_kind:
        | "company"
        | "company_worker"
        | "freelancer"
        | "internal_employee"
      document_type: "plano" | "cartas_empalme" | "diagrama_routing" | "other"
      document_validity_rule:
        | "expiry_required"
        | "days_from_issue"
        | "must_cover_assignment"
        | "no_expiry"
      entity_document_status:
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "expiring"
        | "expired"
        | "not_applicable"
      priority_level: "normal" | "alta" | "urgente"
      requirement_origin: "DE" | "ES" | "EU_OTHER" | "NON_EU" | "ALL"
      requirement_scope: "entity" | "per_project"
      team_color:
        | "rot"
        | "gruen"
        | "blau"
        | "gelb"
        | "weiss"
        | "grau"
        | "braun"
        | "violett"
        | "tuerkis"
        | "schwarz"
        | "orange"
        | "rosa"
      telegram_event_type:
        | "order_returned_for_correction"
        | "task_assigned"
        | "order_status_changed"
        | "order_cancelled"
        | "order_deleted"
        | "report_submitted"
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
      compliance_assignment_status: [
        "draft",
        "confirmed",
        "ended",
        "cancelled",
      ],
      compliance_entity_kind: [
        "company",
        "company_worker",
        "freelancer",
        "internal_employee",
      ],
      document_type: ["plano", "cartas_empalme", "diagrama_routing", "other"],
      document_validity_rule: [
        "expiry_required",
        "days_from_issue",
        "must_cover_assignment",
        "no_expiry",
      ],
      entity_document_status: [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "expiring",
        "expired",
        "not_applicable",
      ],
      priority_level: ["normal", "alta", "urgente"],
      requirement_origin: ["DE", "ES", "EU_OTHER", "NON_EU", "ALL"],
      requirement_scope: ["entity", "per_project"],
      team_color: [
        "rot",
        "gruen",
        "blau",
        "gelb",
        "weiss",
        "grau",
        "braun",
        "violett",
        "tuerkis",
        "schwarz",
        "orange",
        "rosa",
      ],
      telegram_event_type: [
        "order_returned_for_correction",
        "task_assigned",
        "order_status_changed",
        "order_cancelled",
        "order_deleted",
        "report_submitted",
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
