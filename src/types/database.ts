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
      achievements: {
        Row: {
          category: string
          created_at: string
          criteria: string
          description: string
          icon: string
          id: string
          is_active: boolean
          points: number
          sort_order: number
          tier: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          criteria?: string
          description: string
          icon: string
          id: string
          is_active?: boolean
          points: number
          sort_order?: number
          tier: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          criteria?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          points?: number
          sort_order?: number
          tier?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      addon_prices: {
        Row: {
          description: string | null
          key: string
          price_usd: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          key: string
          price_usd: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          key?: string
          price_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_model_prices: {
        Row: {
          display_name: string
          input_price_per_1m: number
          model_id: string
          output_price_per_1m: number
          updated_at: string
        }
        Insert: {
          display_name: string
          input_price_per_1m?: number
          model_id: string
          output_price_per_1m?: number
          updated_at?: string
        }
        Update: {
          display_name?: string
          input_price_per_1m?: number
          model_id?: string
          output_price_per_1m?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_rate_limit_log: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          company_id: string | null
          created_at: string
          estimated_cost_usd: number
          feature: string
          id: string
          input_tokens: number
          model_used: string | null
          output_tokens: number
          prompt_summary: string | null
          tokens_used: number
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimated_cost_usd?: number
          feature: string
          id?: string
          input_tokens?: number
          model_used?: string | null
          output_tokens?: number
          prompt_summary?: string | null
          tokens_used?: number
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          id?: string
          input_tokens?: number
          model_used?: string | null
          output_tokens?: number
          prompt_summary?: string | null
          tokens_used?: number
          user_id?: string
        }
        Relationships: []
      }
      audit_items: {
        Row: {
          audit_id: string
          created_at: string
          criterion: string | null
          evidence: string | null
          evidence_type: string | null
          frequency: string | null
          how_to_audit: string | null
          id: string
          observation: string | null
          responsible: string | null
          score: number | null
          status: string
          updated_at: string
          what_to_audit: string | null
        }
        Insert: {
          audit_id: string
          created_at?: string
          criterion?: string | null
          evidence?: string | null
          evidence_type?: string | null
          frequency?: string | null
          how_to_audit?: string | null
          id?: string
          observation?: string | null
          responsible?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          what_to_audit?: string | null
        }
        Update: {
          audit_id?: string
          created_at?: string
          criterion?: string | null
          evidence?: string | null
          evidence_type?: string | null
          frequency?: string | null
          how_to_audit?: string | null
          id?: string
          observation?: string | null
          responsible?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          what_to_audit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audit_date: string | null
          auditor: string | null
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          overall_score: number | null
          process_id: string
          status: string
          updated_at: string
        }
        Insert: {
          audit_date?: string | null
          auditor?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          overall_score?: number | null
          process_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          audit_date?: string | null
          auditor?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          overall_score?: number | null
          process_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: true
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      bpmn_diagrams: {
        Row: {
          ai_prompt: string | null
          created_at: string
          diagram_json: Json | null
          diagram_xml: string | null
          generated_by_ai: boolean
          id: string
          name: string
          process_id: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_prompt?: string | null
          created_at?: string
          diagram_json?: Json | null
          diagram_xml?: string | null
          generated_by_ai?: boolean
          id?: string
          name?: string
          process_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_prompt?: string | null
          created_at?: string
          diagram_json?: Json | null
          diagram_xml?: string | null
          generated_by_ai?: boolean
          id?: string
          name?: string
          process_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bpmn_diagrams_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: true
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          catalog_type: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          value: string
        }
        Insert: {
          catalog_type: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          value: string
        }
        Update: {
          catalog_type?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          action: string
          author_name: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          process_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          author_name?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          process_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          author_name?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          process_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_log_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_snapshots: {
        Row: {
          id: string
          company_id: string
          date: string
          macro_count: number
          process_count: number
          bpmn_count: number
          procedure_count: number
          total_risks: number
          total_controls: number
          total_kpis: number
          total_audit_items: number
          va_efficiency: number
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          date: string
          macro_count?: number
          process_count?: number
          bpmn_count?: number
          procedure_count?: number
          total_risks?: number
          total_controls?: number
          total_kpis?: number
          total_audit_items?: number
          va_efficiency?: number
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          date?: string
          macro_count?: number
          process_count?: number
          bpmn_count?: number
          procedure_count?: number
          total_risks?: number
          total_controls?: number
          total_kpis?: number
          total_audit_items?: number
          va_efficiency?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_sync_runs: {
        Row: {
          api_calls_used: number
          completed_at: string | null
          error_details: Json | null
          id: string
          posts_created: number
          run_at: string
          status: string
          users_processed: number
        }
        Insert: {
          api_calls_used?: number
          completed_at?: string | null
          error_details?: Json | null
          id?: string
          posts_created?: number
          run_at?: string
          status?: string
          users_processed?: number
        }
        Update: {
          api_calls_used?: number
          completed_at?: string | null
          error_details?: Json | null
          id?: string
          posts_created?: number
          run_at?: string
          status?: string
          users_processed?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          company_size: string | null
          country: string | null
          created_at: string
          description: string | null
          doc_code_pattern: string | null
          doc_code_prefix: string | null
          id: string
          industry: string | null
          logo_url: string | null
          milestone_completions: Json
          name: string
          onboarding_completed: boolean
          process_level_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_size?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          doc_code_pattern?: string | null
          doc_code_prefix?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          milestone_completions?: Json
          name: string
          onboarding_completed?: boolean
          process_level_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_size?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          doc_code_pattern?: string | null
          doc_code_prefix?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          milestone_completions?: Json
          name?: string
          onboarding_completed?: boolean
          process_level_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_addons: {
        Row: {
          canceled_at: string | null
          company_id: string
          created_at: string
          currency: string
          id: string
          interval: string
          provider: string | null
          provider_ref: string | null
          quantity: number
          status: string
          type: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          provider?: string | null
          provider_ref?: string | null
          quantity?: number
          status?: string
          type: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          provider?: string | null
          provider_ref?: string | null
          quantity?: number
          status?: string
          type?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_addons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_readings: {
        Row: {
          created_at: string
          id: string
          indicator_id: string
          notes: string | null
          period: string | null
          recorded_by: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          indicator_id: string
          notes?: string | null
          period?: string | null
          recorded_by?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          indicator_id?: string
          notes?: string | null
          period?: string | null
          recorded_by?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_readings_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          category: string | null
          code: string | null
          company_id: string
          created_at: string
          data_source: string | null
          description: string | null
          formula: string | null
          frequency: string | null
          id: string
          is_active: boolean
          max_acceptable: number | null
          min_acceptable: number | null
          name: string
          owner: string | null
          process_id: string | null
          reporter: string
          target_value: number | null
          threshold_green_max: number | null
          threshold_green_min: number | null
          threshold_red_max: number | null
          threshold_red_min: number | null
          threshold_yellow_max: number | null
          threshold_yellow_min: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          data_source?: string | null
          description?: string | null
          formula?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean
          max_acceptable?: number | null
          min_acceptable?: number | null
          name: string
          owner?: string | null
          process_id?: string | null
          reporter?: string
          target_value?: number | null
          threshold_green_max?: number | null
          threshold_green_min?: number | null
          threshold_red_max?: number | null
          threshold_red_min?: number | null
          threshold_yellow_max?: number | null
          threshold_yellow_min?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          data_source?: string | null
          description?: string | null
          formula?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean
          max_acceptable?: number | null
          min_acceptable?: number | null
          name?: string
          owner?: string | null
          process_id?: string | null
          reporter?: string
          target_value?: number | null
          threshold_green_max?: number | null
          threshold_green_min?: number | null
          threshold_red_max?: number | null
          threshold_red_min?: number | null
          threshold_yellow_max?: number | null
          threshold_yellow_min?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicators_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      macroprocesses: {
        Row: {
          category: Database["public"]["Enums"]["macroprocess_category"]
          color: string | null
          company_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["macroprocess_category"]
          color?: string | null
          company_id: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["macroprocess_category"]
          color?: string | null
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "macroprocesses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_costs: {
        Row: {
          description: string | null
          key: string
          tier: string
          tokens: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          key: string
          tier: string
          tokens: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          key?: string
          tier?: string
          tokens?: number
          updated_at?: string
        }
        Relationships: []
      }
      org_level_definitions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          level_name: string
          level_number: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          level_name: string
          level_number: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          level_name?: string
          level_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_level_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_units: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          org_level_definition_id: string | null
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          org_level_definition_id?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          org_level_definition_id?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_org_level_definition_id_fkey"
            columns: ["org_level_definition_id"]
            isOneToOne: false
            referencedRelation: "org_level_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          limit_value: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          limit_value: string
          plan_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          limit_value?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_token_allocations: {
        Row: {
          plan_id: string
          tokens_monthly: number
          updated_at: string
        }
        Insert: {
          plan_id: string
          tokens_monthly: number
          updated_at?: string
        }
        Update: {
          plan_id?: string
          tokens_monthly?: number
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      procedure_steps: {
        Row: {
          created_at: string
          description: string | null
          duration: string | null
          duration_minutes: number | null
          id: string
          inputs: string | null
          observations: string | null
          outputs: string | null
          procedure_id: string
          responsible: string | null
          sort_order: number
          step_number: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: string | null
          duration_minutes?: number | null
          id?: string
          inputs?: string | null
          observations?: string | null
          outputs?: string | null
          procedure_id: string
          responsible?: string | null
          sort_order?: number
          step_number?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: string | null
          duration_minutes?: number | null
          id?: string
          inputs?: string | null
          observations?: string | null
          outputs?: string | null
          procedure_id?: string
          responsible?: string | null
          sort_order?: number
          step_number?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_steps_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string
          data: Json | null
          definitions: string | null
          id: string
          objective: string | null
          process_id: string | null
          references: string | null
          responsible: string | null
          scope: string | null
          status: string
          title: string | null
          updated_at: string
          version: string
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          data?: Json | null
          definitions?: string | null
          id?: string
          objective?: string | null
          process_id?: string | null
          references?: string | null
          responsible?: string | null
          scope?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          data?: Json | null
          definitions?: string | null
          id?: string
          objective?: string | null
          process_id?: string | null
          references?: string | null
          responsible?: string | null
          scope?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: true
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_level_definitions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          level_name: string
          level_number: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          level_name: string
          level_number: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          level_name?: string
          level_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_level_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          affects_accounting: boolean
          approval_date: string | null
          bpmn_xml: string | null
          business_line: string | null
          code: string | null
          company_id: string
          coordination: string | null
          created_at: string
          delivery_method: string | null
          description: string | null
          entity: string | null
          execution_frequency: string | null
          execution_level: string | null
          execution_type: string | null
          handles_personal_data: boolean
          has_contingency_plan: boolean
          has_tax_operations: boolean
          id: string
          involves_cash_movement: boolean
          is_critical: boolean
          level_definition_id: string | null
          macroprocess_id: string
          management: string | null
          name: string
          operative: string | null
          org_unit_id: string | null
          parent_process_id: string | null
          process_type: string | null
          published_at: string | null
          provided_by_third_party: boolean
          responsible: string | null
          sort_order: number
          supervision_level: string | null
          update_date: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          affects_accounting?: boolean
          approval_date?: string | null
          bpmn_xml?: string | null
          business_line?: string | null
          code?: string | null
          company_id: string
          coordination?: string | null
          created_at?: string
          delivery_method?: string | null
          description?: string | null
          entity?: string | null
          execution_frequency?: string | null
          execution_level?: string | null
          execution_type?: string | null
          handles_personal_data?: boolean
          has_contingency_plan?: boolean
          has_tax_operations?: boolean
          id?: string
          involves_cash_movement?: boolean
          is_critical?: boolean
          level_definition_id?: string | null
          macroprocess_id: string
          management?: string | null
          name: string
          operative?: string | null
          org_unit_id?: string | null
          parent_process_id?: string | null
          process_type?: string | null
          published_at?: string | null
          provided_by_third_party?: boolean
          responsible?: string | null
          sort_order?: number
          supervision_level?: string | null
          update_date?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          affects_accounting?: boolean
          approval_date?: string | null
          bpmn_xml?: string | null
          business_line?: string | null
          code?: string | null
          company_id?: string
          coordination?: string | null
          created_at?: string
          delivery_method?: string | null
          description?: string | null
          entity?: string | null
          execution_frequency?: string | null
          execution_level?: string | null
          execution_type?: string | null
          handles_personal_data?: boolean
          has_contingency_plan?: boolean
          has_tax_operations?: boolean
          id?: string
          involves_cash_movement?: boolean
          is_critical?: boolean
          level_definition_id?: string | null
          macroprocess_id?: string
          management?: string | null
          name?: string
          operative?: string | null
          org_unit_id?: string | null
          parent_process_id?: string | null
          process_type?: string | null
          published_at?: string | null
          provided_by_third_party?: boolean
          responsible?: string | null
          sort_order?: number
          supervision_level?: string | null
          update_date?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_level_definition_id_fkey"
            columns: ["level_definition_id"]
            isOneToOne: false
            referencedRelation: "process_level_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_macroprocess_id_fkey"
            columns: ["macroprocess_id"]
            isOneToOne: false
            referencedRelation: "macroprocesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_parent_process_id_fkey"
            columns: ["parent_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_tokens_reset_at: string
          ai_tokens_used: number
          avatar_url: string | null
          circle_last_synced_pts: number
          circle_member: boolean
          circle_member_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          plan_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_points: number
          updated_at: string
        }
        Insert: {
          ai_tokens_reset_at?: string
          ai_tokens_used?: number
          avatar_url?: string | null
          circle_last_synced_pts?: number
          circle_member?: boolean
          circle_member_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_points?: number
          updated_at?: string
        }
        Update: {
          ai_tokens_reset_at?: string
          ai_tokens_used?: number
          avatar_url?: string | null
          circle_last_synced_pts?: number
          circle_member?: boolean
          circle_member_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_controls: {
        Row: {
          created_at: string
          description: string | null
          doc: number
          effectiveness: string
          evidence: number
          freq: number
          id: string
          mitigates: string
          monitoring: number
          nature: number
          risk_id: string
          score: number
          segregation: number
          training: number
          type: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          doc?: number
          effectiveness?: string
          evidence?: number
          freq?: number
          id?: string
          mitigates?: string
          monitoring?: number
          nature?: number
          risk_id: string
          score?: number
          segregation?: number
          training?: number
          type?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          doc?: number
          effectiveness?: string
          evidence?: number
          freq?: number
          id?: string
          mitigates?: string
          monitoring?: number
          nature?: number
          risk_id?: string
          score?: number
          segregation?: number
          training?: number
          type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_controls_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          bpmn_element_id: string | null
          category: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          inherent_impact: number
          inherent_probability: number
          process_id: string
          process_step: string | null
          residual_impact: number
          residual_probability: number
          risk_cause: string | null
          risk_effect: string | null
          risk_event: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bpmn_element_id?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          inherent_impact?: number
          inherent_probability?: number
          process_id: string
          process_step?: string | null
          residual_impact?: number
          residual_probability?: number
          risk_cause?: string | null
          risk_effect?: string | null
          risk_event?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bpmn_element_id?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          inherent_impact?: number
          inherent_probability?: number
          process_id?: string
          process_step?: string | null
          residual_impact?: number
          residual_probability?: number
          risk_cause?: string | null
          risk_effect?: string | null
          risk_event?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      sipoc_customers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sipoc_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sipoc_entries: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          input_description: string | null
          output_description: string | null
          process_id: string
          sort_order: number
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          input_description?: string | null
          output_description?: string | null
          process_id: string
          sort_order?: number
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          input_description?: string | null
          output_description?: string | null
          process_id?: string
          sort_order?: number
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sipoc_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sipoc_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sipoc_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sipoc_entries_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sipoc_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "sipoc_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sipoc_suppliers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sipoc_suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          base_price: number | null
          cancel_at_period_end: boolean
          company_id: string
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interval: string
          plan_id: string | null
          provider: string
          provider_ref: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          cancel_at_period_end?: boolean
          company_id: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string
          plan_id?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          cancel_at_period_end?: boolean
          company_id?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string
          plan_id?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      token_packages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price_usd: number
          stripe_price_id: string | null
          tokens: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          name: string
          price_usd: number
          stripe_price_id?: string | null
          tokens: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price_usd?: number
          stripe_price_id?: string | null
          tokens?: number
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          note: string | null
          operation_key: string | null
          price_usd: number | null
          stripe_payment_intent_id: string | null
          tokens: number
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          operation_key?: string | null
          price_usd?: number | null
          stripe_payment_intent_id?: string | null
          tokens: number
          type: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          operation_key?: string | null
          price_usd?: number | null
          stripe_payment_intent_id?: string | null
          tokens?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_transactions_operation_key_fkey"
            columns: ["operation_key"]
            isOneToOne: false
            referencedRelation: "operation_costs"
            referencedColumns: ["key"]
          },
        ]
      }
      token_wallets: {
        Row: {
          bonus_balance: number
          created_at: string
          id: string
          monthly_allocation: number
          plan_id: string
          renewal_date: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          bonus_balance?: number
          created_at?: string
          id?: string
          monthly_allocation?: number
          plan_id?: string
          renewal_date?: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          bonus_balance?: number
          created_at?: string
          id?: string
          monthly_allocation?: number
          plan_id?: string
          renewal_date?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          shared_to_community: boolean
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          shared_to_community?: boolean
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          shared_to_community?: boolean
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          activity_history: Json
          current_streak: number
          freezes_available: number
          freezes_reset_month: string | null
          freezes_used: Json
          id: string
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_history?: Json
          current_streak?: number
          freezes_available?: number
          freezes_reset_month?: string | null
          freezes_used?: Json
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_history?: Json
          current_streak?: number
          freezes_available?: number
          freezes_reset_month?: string | null
          freezes_used?: Json
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      improvement_opportunities: {
        Row: {
          close_date: string | null
          company_id: string
          complexity_score: number
          cost_score: number
          created_at: string
          description: string
          end_date: string | null
          id: string
          name: string
          process_id: string
          progress_notes: string
          progress_pct: number
          responsible: string | null
          start_date: string | null
          status: string
          time_score: number
          updated_at: string
        }
        Insert: {
          close_date?: string | null
          company_id: string
          complexity_score?: number
          cost_score?: number
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          name: string
          process_id: string
          progress_notes?: string
          progress_pct?: number
          responsible?: string | null
          start_date?: string | null
          status?: string
          time_score?: number
          updated_at?: string
        }
        Update: {
          close_date?: string | null
          company_id?: string
          complexity_score?: number
          cost_score?: number
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          name?: string
          process_id?: string
          progress_notes?: string
          progress_pct?: number
          responsible?: string | null
          start_date?: string | null
          status?: string
          time_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "improvement_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "improvement_opportunities_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      value_activities: {
        Row: {
          bpmn_node_id: string | null
          company_id: string
          cost: number
          created_at: string
          id: string
          name: string
          notes: string | null
          process_id: string
          responsible: string | null
          sequence: number
          time_minutes: number
          updated_at: string
          value_type: string
        }
        Insert: {
          bpmn_node_id?: string | null
          company_id: string
          cost?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          process_id: string
          responsible?: string | null
          sequence?: number
          time_minutes?: number
          updated_at?: string
          value_type?: string
        }
        Update: {
          bpmn_node_id?: string | null
          company_id?: string
          cost?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          process_id?: string
          responsible?: string | null
          sequence?: number
          time_minutes?: number
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_activities_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      gamification_sync: {
        Row: {
          achievements_count: number | null
          circle_last_synced_pts: number | null
          circle_member: boolean | null
          circle_member_id: string | null
          delta_points: number | null
          email: string | null
          full_name: string | null
          last_achievement_at: string | null
          posts_to_create: number | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      consume_ai_tokens: {
        Args: {
          p_company_id?: string
          p_operation_key: string
          p_user_id: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_company_editor: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member: { Args: { p_company_id: string }; Returns: boolean }
      is_company_owner: { Args: { p_company_id: string }; Returns: boolean }
      reset_company: { Args: { p_company_id: string }; Returns: undefined }
    }
    Enums: {
      macroprocess_category: "estrategico" | "productivo" | "apoyo"
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
      macroprocess_category: ["estrategico", "productivo", "apoyo"],
    },
  },
} as const
