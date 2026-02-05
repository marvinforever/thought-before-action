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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academy_article_domains: {
        Row: {
          article_id: string
          created_at: string
          domain_id: string
          id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          domain_id: string
          id?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          domain_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_article_domains_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "academy_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_article_domains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_articles: {
        Row: {
          content: string | null
          content_type: string
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          reading_time_minutes: number | null
          slug: string
          source_author: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          reading_time_minutes?: number | null
          slug: string
          source_author?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          reading_time_minutes?: number | null
          slug?: string
          source_author?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      academy_sources: {
        Row: {
          created_at: string
          fetch_frequency_hours: number | null
          id: string
          is_active: boolean
          last_fetched_at: string | null
          name: string
          source_type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          fetch_frequency_hours?: number | null
          id?: string
          is_active?: boolean
          last_fetched_at?: string | null
          name: string
          source_type?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          fetch_frequency_hours?: number | null
          id?: string
          is_active?: boolean
          last_fetched_at?: string | null
          name?: string
          source_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          achieved_date: string | null
          achievement_text: string
          category: string
          company_id: string
          created_at: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          achieved_date?: string | null
          achievement_text: string
          category: string
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          achieved_date?: string | null
          achievement_text?: string
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_efficiency_reports: {
        Row: {
          company_id: string
          created_at: string
          department_analysis: Json
          efficiency_score: number | null
          executive_summary: Json
          expires_at: string
          generated_at: string
          id: string
          implementation_roadmap: Json
          quick_wins: Json
          role_analysis: Json
          total_employees_analyzed: number | null
          total_estimated_hours_saved: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          department_analysis?: Json
          efficiency_score?: number | null
          executive_summary?: Json
          expires_at?: string
          generated_at?: string
          id?: string
          implementation_roadmap?: Json
          quick_wins?: Json
          role_analysis?: Json
          total_employees_analyzed?: number | null
          total_estimated_hours_saved?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          department_analysis?: Json
          efficiency_score?: number | null
          executive_summary?: Json
          expires_at?: string
          generated_at?: string
          id?: string
          implementation_roadmap?: Json
          quick_wins?: Json
          role_analysis?: Json
          total_employees_analyzed?: number | null
          total_estimated_hours_saved?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_efficiency_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_usage: {
        Row: {
          created_at: string | null
          id: string
          jericho_practiced: boolean | null
          marked_helpful: boolean | null
          profile_id: string | null
          prompt_copied: boolean | null
          prompt_text: string | null
          recommendation_id: string | null
          task_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          jericho_practiced?: boolean | null
          marked_helpful?: boolean | null
          profile_id?: string | null
          prompt_copied?: boolean | null
          prompt_text?: string | null
          recommendation_id?: string | null
          task_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          jericho_practiced?: boolean | null
          marked_helpful?: boolean | null
          profile_id?: string | null
          prompt_copied?: boolean | null
          prompt_text?: string | null
          recommendation_id?: string | null
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_usage_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_usage_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "employee_ai_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_readiness_assessments: {
        Row: {
          ai_readiness_score: number | null
          analysis_results: Json | null
          analyzed_at: string | null
          company_name: string | null
          created_at: string | null
          current_ai_tools: string[] | null
          current_ai_workflows: string | null
          email: string
          error_message: string | null
          executive_summary: Json | null
          first_name: string | null
          id: string
          job_descriptions: Json
          job_title: string | null
          last_name: string | null
          name: string | null
          phone: string | null
          referral_code: string | null
          share_token: string | null
          status: string | null
          total_hours_saved: number | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          ai_readiness_score?: number | null
          analysis_results?: Json | null
          analyzed_at?: string | null
          company_name?: string | null
          created_at?: string | null
          current_ai_tools?: string[] | null
          current_ai_workflows?: string | null
          email: string
          error_message?: string | null
          executive_summary?: Json | null
          first_name?: string | null
          id?: string
          job_descriptions?: Json
          job_title?: string | null
          last_name?: string | null
          name?: string | null
          phone?: string | null
          referral_code?: string | null
          share_token?: string | null
          status?: string | null
          total_hours_saved?: number | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          ai_readiness_score?: number | null
          analysis_results?: Json | null
          analyzed_at?: string | null
          company_name?: string | null
          created_at?: string | null
          current_ai_tools?: string[] | null
          current_ai_workflows?: string | null
          email?: string
          error_message?: string | null
          executive_summary?: Json | null
          first_name?: string | null
          id?: string
          job_descriptions?: Json
          job_title?: string | null
          last_name?: string | null
          name?: string | null
          phone?: string | null
          referral_code?: string | null
          share_token?: string | null
          status?: string | null
          total_hours_saved?: number | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          company_id: string | null
          created_at: string
          estimated_cost_usd: number | null
          fallback_reason: string | null
          function_name: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          model_provider: string
          model_used: string
          output_tokens: number | null
          profile_id: string | null
          task_type: string | null
          total_tokens: number | null
          was_fallback: boolean | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          fallback_reason?: string | null
          function_name: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_provider?: string
          model_used: string
          output_tokens?: number | null
          profile_id?: string | null
          task_type?: string | null
          total_tokens?: number | null
          was_fallback?: boolean | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          fallback_reason?: string | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_provider?: string
          model_used?: string
          output_tokens?: number | null
          profile_id?: string | null
          task_type?: string | null
          total_tokens?: number | null
          was_fallback?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_profiles: {
        Row: {
          created_at: string | null
          current_tools: string[] | null
          current_workflows: string | null
          estimated_current_weekly_ai_hours: number | null
          id: string
          lead_assessment_id: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_tools?: string[] | null
          current_workflows?: string | null
          estimated_current_weekly_ai_hours?: number | null
          id?: string
          lead_assessment_id?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_tools?: string[] | null
          current_workflows?: string | null
          estimated_current_weekly_ai_hours?: number | null
          id?: string
          lead_assessment_id?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_profiles_lead_assessment_id_fkey"
            columns: ["lead_assessment_id"]
            isOneToOne: false
            referencedRelation: "ai_readiness_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      backboard_threads: {
        Row: {
          assistant_id: string
          context_type: string | null
          created_at: string
          customer_id: string | null
          id: string
          profile_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          assistant_id: string
          context_type?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          profile_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          assistant_id?: string
          context_type?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          profile_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backboard_threads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backboard_threads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          display_order: number
          icon_emoji: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number | null
          slug: string
          tier: number
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          display_order?: number
          icon_emoji?: string
          id?: string
          name: string
          requirement_type: string
          requirement_value?: number | null
          slug: string
          tier?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          icon_emoji?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number | null
          slug?: string
          tier?: number
        }
        Relationships: []
      }
      call_plan_reminders: {
        Row: {
          call_number: number
          call_plan_tracking_id: string
          company_id: string | null
          created_at: string
          customer_name: string
          id: string
          meeting_date: string
          profile_id: string
          reminder_type: string
          sent_at: string
          subject: string | null
        }
        Insert: {
          call_number: number
          call_plan_tracking_id: string
          company_id?: string | null
          created_at?: string
          customer_name: string
          id?: string
          meeting_date: string
          profile_id: string
          reminder_type: string
          sent_at?: string
          subject?: string | null
        }
        Update: {
          call_number?: number
          call_plan_tracking_id?: string
          company_id?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          meeting_date?: string
          profile_id?: string
          reminder_type?: string
          sent_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_plan_reminders_call_plan_tracking_id_fkey"
            columns: ["call_plan_tracking_id"]
            isOneToOne: false
            referencedRelation: "call_plan_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_plan_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_plan_reminders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_plan_tracking: {
        Row: {
          acreage: number | null
          call_1_completed: boolean | null
          call_1_date: string | null
          call_1_notes: string | null
          call_2_completed: boolean | null
          call_2_date: string | null
          call_2_notes: string | null
          call_3_completed: boolean | null
          call_3_date: string | null
          call_3_notes: string | null
          call_4_completed: boolean | null
          call_4_date: string | null
          call_4_notes: string | null
          created_at: string | null
          crops: string | null
          customer_id: string | null
          customer_name: string
          id: string
          plan_year: number
          precall_plan: string | null
          profile_id: string
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          acreage?: number | null
          call_1_completed?: boolean | null
          call_1_date?: string | null
          call_1_notes?: string | null
          call_2_completed?: boolean | null
          call_2_date?: string | null
          call_2_notes?: string | null
          call_3_completed?: boolean | null
          call_3_date?: string | null
          call_3_notes?: string | null
          call_4_completed?: boolean | null
          call_4_date?: string | null
          call_4_notes?: string | null
          created_at?: string | null
          crops?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          plan_year?: number
          precall_plan?: string | null
          profile_id: string
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          acreage?: number | null
          call_1_completed?: boolean | null
          call_1_date?: string | null
          call_1_notes?: string | null
          call_2_completed?: boolean | null
          call_2_date?: string | null
          call_2_notes?: string | null
          call_3_completed?: boolean | null
          call_3_date?: string | null
          call_3_notes?: string | null
          call_4_completed?: boolean | null
          call_4_date?: string | null
          call_4_notes?: string | null
          created_at?: string | null
          crops?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          plan_year?: number
          precall_plan?: string | null
          profile_id?: string
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_plan_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_plan_tracking_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string | null
          companies_using_count: number | null
          created_at: string | null
          created_by_company_id: string | null
          description: string | null
          full_description: string | null
          id: string
          is_custom: boolean | null
          level: Database["public"]["Enums"]["capability_level"] | null
          name: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          companies_using_count?: number | null
          created_at?: string | null
          created_by_company_id?: string | null
          description?: string | null
          full_description?: string | null
          id?: string
          is_custom?: boolean | null
          level?: Database["public"]["Enums"]["capability_level"] | null
          name: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          companies_using_count?: number | null
          created_at?: string | null
          created_by_company_id?: string | null
          description?: string | null
          full_description?: string | null
          id?: string
          is_custom?: boolean | null
          level?: Database["public"]["Enums"]["capability_level"] | null
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capabilities_created_by_company_id_fkey"
            columns: ["created_by_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_reason: string | null
          created_at: string
          employee_capability_id: string
          id: string
          new_level: string
          new_priority: number | null
          previous_level: string
          previous_priority: number | null
          profile_id: string
        }
        Insert: {
          adjusted_by: string
          adjustment_reason?: string | null
          created_at?: string
          employee_capability_id: string
          id?: string
          new_level: string
          new_priority?: number | null
          previous_level: string
          previous_priority?: number | null
          profile_id: string
        }
        Update: {
          adjusted_by?: string
          adjustment_reason?: string | null
          created_at?: string
          employee_capability_id?: string
          id?: string
          new_level?: string
          new_priority?: number | null
          previous_level?: string
          previous_priority?: number | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_adjustments_employee_capability_id_fkey"
            columns: ["employee_capability_id"]
            isOneToOne: false
            referencedRelation: "employee_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_adjustments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_domain_mappings: {
        Row: {
          capability_id: string
          created_at: string
          domain_id: string
          id: string
          is_primary: boolean | null
        }
        Insert: {
          capability_id: string
          created_at?: string
          domain_id: string
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          capability_id?: string
          created_at?: string
          domain_id?: string
          id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_domain_mappings_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_domain_mappings_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_domains: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      capability_level_history: {
        Row: {
          capability_id: string
          change_reason: string | null
          changed_by: string | null
          created_at: string
          from_level: string | null
          id: string
          profile_id: string
          request_id: string | null
          to_level: string
        }
        Insert: {
          capability_id: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          from_level?: string | null
          id?: string
          profile_id: string
          request_id?: string | null
          to_level: string
        }
        Update: {
          capability_id?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          from_level?: string | null
          id?: string
          profile_id?: string
          request_id?: string | null
          to_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_level_history_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_level_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_level_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_level_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "capability_level_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_level_requests: {
        Row: {
          capability_id: string
          company_id: string
          created_at: string
          current_level: string
          evidence_text: string
          id: string
          manager_notes: string | null
          profile_id: string
          requested_level: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capability_id: string
          company_id: string
          created_at?: string
          current_level: string
          evidence_text: string
          id?: string
          manager_notes?: string | null
          profile_id: string
          requested_level: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capability_id?: string
          company_id?: string
          created_at?: string
          current_level?: string
          evidence_text?: string
          id?: string
          manager_notes?: string | null
          profile_id?: string
          requested_level?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_level_requests_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_level_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_level_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_level_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_levels: {
        Row: {
          capability_id: string
          created_at: string | null
          description: string
          id: string
          level: string
        }
        Insert: {
          capability_id: string
          created_at?: string | null
          description: string
          id?: string
          level: string
        }
        Update: {
          capability_id?: string
          created_at?: string | null
          description?: string
          id?: string
          level?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_levels_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_levels_pending: {
        Row: {
          created_at: string | null
          custom_capability_id: string | null
          description: string
          id: string
          level: string
        }
        Insert: {
          created_at?: string | null
          custom_capability_id?: string | null
          description: string
          id?: string
          level: string
        }
        Update: {
          created_at?: string | null
          custom_capability_id?: string | null
          description?: string
          id?: string
          level?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_levels_pending_custom_capability_id_fkey"
            columns: ["custom_capability_id"]
            isOneToOne: false
            referencedRelation: "custom_capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_resource_gaps: {
        Row: {
          capability_id: string | null
          flagged_at: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          capability_id?: string | null
          flagged_at?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          capability_id?: string | null
          flagged_at?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_resource_gaps_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: true
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_resource_gaps_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_usage_stats: {
        Row: {
          capability_id: string | null
          company_id: string | null
          first_used_at: string | null
          id: string
          last_used_at: string | null
          usage_count: number | null
        }
        Insert: {
          capability_id?: string | null
          company_id?: string | null
          first_used_at?: string | null
          id?: string
          last_used_at?: string | null
          usage_count?: number | null
        }
        Update: {
          capability_id?: string | null
          company_id?: string | null
          first_used_at?: string | null
          id?: string
          last_used_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_usage_stats_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_usage_stats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      career_aspirations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          aspiration_text: string
          aspiration_type: string
          company_id: string
          confidence_score: number | null
          created_at: string
          id: string
          is_active: boolean | null
          keywords: string[] | null
          profile_id: string
          sentiment: string | null
          source_conversation_id: string | null
          source_type: string
          target_role: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          aspiration_text: string
          aspiration_type: string
          company_id: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          profile_id: string
          sentiment?: string | null
          source_conversation_id?: string | null
          source_type?: string
          target_role?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          aspiration_text?: string
          aspiration_type?: string
          company_id?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          profile_id?: string
          sentiment?: string | null
          source_conversation_id?: string | null
          source_type?: string
          target_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_aspirations_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_aspirations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_aspirations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_aspirations_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      career_paths: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          from_role: string | null
          id: string
          is_active: boolean | null
          name: string
          path_type: string
          required_capabilities: Json | null
          to_role: string
          typical_timeline_months: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_role?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          path_type?: string
          required_capabilities?: Json | null
          to_role: string
          typical_timeline_months?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_role?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          path_type?: string
          required_capabilities?: Json | null
          to_role?: string
          typical_timeline_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_paths_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_paths_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_follow_ups: {
        Row: {
          channel: string | null
          completed_at: string | null
          context: Json
          conversation_id: string | null
          created_at: string | null
          follow_up_type: string
          id: string
          priority: string | null
          profile_id: string
          scheduled_for: string
          skip_reason: string | null
          skipped_at: string | null
        }
        Insert: {
          channel?: string | null
          completed_at?: string | null
          context?: Json
          conversation_id?: string | null
          created_at?: string | null
          follow_up_type: string
          id?: string
          priority?: string | null
          profile_id: string
          scheduled_for: string
          skip_reason?: string | null
          skipped_at?: string | null
        }
        Update: {
          channel?: string | null
          completed_at?: string | null
          context?: Json
          conversation_id?: string | null
          created_at?: string | null
          follow_up_type?: string
          id?: string
          priority?: string | null
          profile_id?: string
          scheduled_for?: string
          skip_reason?: string | null
          skipped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_follow_ups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_follow_ups_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_insights: {
        Row: {
          company_id: string | null
          confidence_level: string | null
          created_at: string | null
          first_observed_at: string | null
          id: string
          insight_text: string
          insight_type: string
          is_active: boolean | null
          last_reinforced_at: string | null
          profile_id: string
          reinforcement_count: number | null
          source_conversation_id: string | null
        }
        Insert: {
          company_id?: string | null
          confidence_level?: string | null
          created_at?: string | null
          first_observed_at?: string | null
          id?: string
          insight_text: string
          insight_type: string
          is_active?: boolean | null
          last_reinforced_at?: string | null
          profile_id: string
          reinforcement_count?: number | null
          source_conversation_id?: string | null
        }
        Update: {
          company_id?: string | null
          confidence_level?: string | null
          created_at?: string | null
          first_observed_at?: string | null
          id?: string
          insight_text?: string
          insight_type?: string
          is_active?: boolean | null
          last_reinforced_at?: string | null
          profile_id?: string
          reinforcement_count?: number | null
          source_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_insights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_insights_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          industry: string | null
          industry_keywords: Json | null
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          industry?: string | null
          industry_keywords?: Json | null
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          industry?: string | null
          industry_keywords?: Json | null
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_feature_flags: {
        Row: {
          company_id: string
          created_at: string
          enabled_at: string | null
          enabled_by: string | null
          flag_id: string
          id: string
          is_enabled: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          flag_id: string
          id?: string
          is_enabled?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          flag_id?: string
          id?: string
          is_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_feature_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_feature_flags_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_feature_flags_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      company_knowledge: {
        Row: {
          category: string | null
          company_id: string
          content: string | null
          created_at: string
          document_type: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean
          is_global: boolean | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          content?: string | null
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          content?: string | null
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_knowledge_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_knowledge_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_recommendations: {
        Row: {
          ai_reasoning: string | null
          clicked_at: string | null
          completed_at: string | null
          created_at: string | null
          employee_capability_id: string | null
          expires_at: string | null
          id: string
          match_score: number | null
          profile_id: string | null
          resource_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          clicked_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          employee_capability_id?: string | null
          expires_at?: string | null
          id?: string
          match_score?: number | null
          profile_id?: string | null
          resource_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          clicked_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          employee_capability_id?: string | null
          expires_at?: string | null
          id?: string
          match_score?: number | null
          profile_id?: string | null
          resource_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_recommendations_employee_capability_id_fkey"
            columns: ["employee_capability_id"]
            isOneToOne: false
            referencedRelation: "employee_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_recommendations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_recommendations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          action_items: Json | null
          conversation_id: string
          created_at: string | null
          emotional_tone: string | null
          follow_up_completed_at: string | null
          follow_up_needed: boolean | null
          follow_up_scheduled_for: string | null
          follow_up_topic: string | null
          id: string
          key_topics: string[] | null
          profile_id: string
          summary_text: string
        }
        Insert: {
          action_items?: Json | null
          conversation_id: string
          created_at?: string | null
          emotional_tone?: string | null
          follow_up_completed_at?: string | null
          follow_up_needed?: boolean | null
          follow_up_scheduled_for?: string | null
          follow_up_topic?: string | null
          id?: string
          key_topics?: string[] | null
          profile_id: string
          summary_text: string
        }
        Update: {
          action_items?: Json | null
          conversation_id?: string
          created_at?: string | null
          emotional_tone?: string | null
          follow_up_completed_at?: string | null
          follow_up_needed?: boolean | null
          follow_up_scheduled_for?: string | null
          follow_up_topic?: string | null
          id?: string
          key_topics?: string[] | null
          profile_id?: string
          summary_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_summaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_id: string
          context_snapshot: Json | null
          created_at: string
          duration_seconds: number | null
          id: string
          profile_id: string
          source: string | null
          title: string | null
          transcript_summary: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          context_snapshot?: Json | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          profile_id: string
          source?: string | null
          title?: string | null
          transcript_summary?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          context_snapshot?: Json | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          profile_id?: string
          source?: string | null
          title?: string | null
          transcript_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_capabilities: {
        Row: {
          ai_confidence_score: number | null
          approved_at: string | null
          approved_by: string | null
          category: string
          company_id: string | null
          created_at: string | null
          created_by_job_description: string | null
          description: string | null
          full_description: string | null
          id: string
          name: string
          rejection_reason: string | null
          status: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          category: string
          company_id?: string | null
          created_at?: string | null
          created_by_job_description?: string | null
          description?: string | null
          full_description?: string | null
          id?: string
          name: string
          rejection_reason?: string | null
          status?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          company_id?: string | null
          created_at?: string | null
          created_by_job_description?: string | null
          description?: string | null
          full_description?: string | null
          id?: string
          name?: string
          rejection_reason?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_capabilities_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_capabilities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          document_type: string | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_status: string | null
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          storage_path: string
          summary: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          document_type?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          storage_path: string
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          document_type?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          storage_path?: string
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_insights: {
        Row: {
          company_id: string | null
          confidence: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          insight_text: string
          insight_type: string
          is_actionable: boolean | null
          is_active: boolean | null
          products_mentioned: string[] | null
          profile_id: string | null
          source_conversation_id: string | null
          source_message_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          confidence?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          insight_text: string
          insight_type: string
          is_actionable?: boolean | null
          is_active?: boolean | null
          products_mentioned?: string[] | null
          profile_id?: string | null
          source_conversation_id?: string | null
          source_message_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          confidence?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          insight_text?: string
          insight_type?: string
          is_actionable?: boolean | null
          is_active?: boolean | null
          products_mentioned?: string[] | null
          profile_id?: string | null
          source_conversation_id?: string | null
          source_message_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_insights_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_insights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_insights_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "sales_coach_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchase_history: {
        Row: {
          address_1: string | null
          address_2: string | null
          amount: number | null
          avg_price: number | null
          bonus_amount: number | null
          bonus_category: string | null
          category_11_4: string | null
          city: string | null
          company_id: string | null
          created_at: string | null
          customer_code: string | null
          customer_name: string
          epa_number: string | null
          id: string
          imported_at: string | null
          phone: string | null
          product_code: string | null
          product_description: string | null
          quantity: number | null
          quantity_11_4: number | null
          rep_name: string | null
          sale_date: string | null
          season: string | null
          sort_category: string | null
          source_file: string | null
          state: string | null
          unit_of_measure: string | null
          zip_code: string | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          amount?: number | null
          avg_price?: number | null
          bonus_amount?: number | null
          bonus_category?: string | null
          category_11_4?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_code?: string | null
          customer_name: string
          epa_number?: string | null
          id?: string
          imported_at?: string | null
          phone?: string | null
          product_code?: string | null
          product_description?: string | null
          quantity?: number | null
          quantity_11_4?: number | null
          rep_name?: string | null
          sale_date?: string | null
          season?: string | null
          sort_category?: string | null
          source_file?: string | null
          state?: string | null
          unit_of_measure?: string | null
          zip_code?: string | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          amount?: number | null
          avg_price?: number | null
          bonus_amount?: number | null
          bonus_category?: string | null
          category_11_4?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_code?: string | null
          customer_name?: string
          epa_number?: string | null
          id?: string
          imported_at?: string | null
          phone?: string | null
          product_code?: string | null
          product_description?: string | null
          quantity?: number | null
          quantity_11_4?: number | null
          rep_name?: string | null
          sale_date?: string | null
          season?: string | null
          sort_category?: string | null
          source_file?: string | null
          state?: string | null
          unit_of_measure?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchase_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_industry_news: {
        Row: {
          capability_context: string | null
          created_at: string
          id: string
          industry: string
          news_date: string
          news_items: Json
        }
        Insert: {
          capability_context?: string | null
          created_at?: string
          id?: string
          industry: string
          news_date?: string
          news_items: Json
        }
        Update: {
          capability_context?: string | null
          created_at?: string
          id?: string
          industry?: string
          news_date?: string
          news_items?: Json
        }
        Relationships: []
      }
      deal_coaching_messages: {
        Row: {
          content: string
          created_at: string
          deal_id: string
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          deal_id: string
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          deal_id?: string
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_coaching_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_coaching_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          referral_code: string | null
          source: string | null
          status: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          source?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          source?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      development_ideas: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_requests: {
        Row: {
          admin_notes: string | null
          company_id: string | null
          created_at: string | null
          description: string
          id: string
          implemented_at: string | null
          priority: string | null
          profile_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          company_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          implemented_at?: string | null
          priority?: string | null
          profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          implemented_at?: string | null
          priority?: string | null
          profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_responses: {
        Row: {
          adaptability_application_frequency: string | null
          additional_feedback: string | null
          additional_responses: Json | null
          biggest_difficulty: string | null
          biggest_frustration: string | null
          biggest_work_obstacle: string | null
          burnout_frequency: string | null
          communication_application_frequency: string | null
          company_id: string | null
          company_size: string | null
          company_supporting_goal: boolean | null
          confidence_score: number | null
          created_at: string | null
          daily_energy_level: string | null
          department_or_team: string | null
          employment_status: string | null
          energy_drain_area: string | null
          feels_valued: boolean | null
          focus_quality: string | null
          growth_barrier: string | null
          has_written_job_description: boolean | null
          id: string
          job_title_or_role: string | null
          leadership_application_frequency: string | null
          leadership_should_understand: string | null
          learning_motivation: string | null
          learning_preference:
            | Database["public"]["Enums"]["learning_preference"]
            | null
          listens_to_podcasts: boolean | null
          manager_support_quality: string | null
          manages_others: boolean | null
          mental_drain_frequency: string | null
          most_important_job_aspect: string | null
          natural_strength: string | null
          needed_training: string | null
          needed_training_for_effectiveness: string | null
          one_year_vision: string | null
          profile_id: string | null
          reads_books_articles: boolean | null
          recent_accomplishment: string | null
          recent_challenge: string | null
          retention_improvement_suggestion: string | null
          role_clarity_score: number | null
          sees_growth_path: boolean | null
          sees_leadership_path: boolean | null
          skill_to_master: string | null
          strategic_thinking_application_frequency: string | null
          submitted_at: string | null
          support_needed_from_leadership: string | null
          survey_version: string | null
          technical_application_frequency: string | null
          three_year_goal: string | null
          twelve_month_growth_goal: string | null
          typeform_response_id: string | null
          typeform_start_date: string | null
          typeform_submit_date: string | null
          watches_youtube: boolean | null
          weekly_development_hours: number | null
          what_enjoy_most: string | null
          why_people_leave_opinion: string | null
          work_life_integration_score: number | null
          work_life_sacrifice_frequency: string | null
          workload_status: Database["public"]["Enums"]["workload_status"] | null
          would_stay_if_offered_similar: string | null
          years_in_current_role: string | null
          years_with_company: string | null
        }
        Insert: {
          adaptability_application_frequency?: string | null
          additional_feedback?: string | null
          additional_responses?: Json | null
          biggest_difficulty?: string | null
          biggest_frustration?: string | null
          biggest_work_obstacle?: string | null
          burnout_frequency?: string | null
          communication_application_frequency?: string | null
          company_id?: string | null
          company_size?: string | null
          company_supporting_goal?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          daily_energy_level?: string | null
          department_or_team?: string | null
          employment_status?: string | null
          energy_drain_area?: string | null
          feels_valued?: boolean | null
          focus_quality?: string | null
          growth_barrier?: string | null
          has_written_job_description?: boolean | null
          id?: string
          job_title_or_role?: string | null
          leadership_application_frequency?: string | null
          leadership_should_understand?: string | null
          learning_motivation?: string | null
          learning_preference?:
            | Database["public"]["Enums"]["learning_preference"]
            | null
          listens_to_podcasts?: boolean | null
          manager_support_quality?: string | null
          manages_others?: boolean | null
          mental_drain_frequency?: string | null
          most_important_job_aspect?: string | null
          natural_strength?: string | null
          needed_training?: string | null
          needed_training_for_effectiveness?: string | null
          one_year_vision?: string | null
          profile_id?: string | null
          reads_books_articles?: boolean | null
          recent_accomplishment?: string | null
          recent_challenge?: string | null
          retention_improvement_suggestion?: string | null
          role_clarity_score?: number | null
          sees_growth_path?: boolean | null
          sees_leadership_path?: boolean | null
          skill_to_master?: string | null
          strategic_thinking_application_frequency?: string | null
          submitted_at?: string | null
          support_needed_from_leadership?: string | null
          survey_version?: string | null
          technical_application_frequency?: string | null
          three_year_goal?: string | null
          twelve_month_growth_goal?: string | null
          typeform_response_id?: string | null
          typeform_start_date?: string | null
          typeform_submit_date?: string | null
          watches_youtube?: boolean | null
          weekly_development_hours?: number | null
          what_enjoy_most?: string | null
          why_people_leave_opinion?: string | null
          work_life_integration_score?: number | null
          work_life_sacrifice_frequency?: string | null
          workload_status?:
            | Database["public"]["Enums"]["workload_status"]
            | null
          would_stay_if_offered_similar?: string | null
          years_in_current_role?: string | null
          years_with_company?: string | null
        }
        Update: {
          adaptability_application_frequency?: string | null
          additional_feedback?: string | null
          additional_responses?: Json | null
          biggest_difficulty?: string | null
          biggest_frustration?: string | null
          biggest_work_obstacle?: string | null
          burnout_frequency?: string | null
          communication_application_frequency?: string | null
          company_id?: string | null
          company_size?: string | null
          company_supporting_goal?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          daily_energy_level?: string | null
          department_or_team?: string | null
          employment_status?: string | null
          energy_drain_area?: string | null
          feels_valued?: boolean | null
          focus_quality?: string | null
          growth_barrier?: string | null
          has_written_job_description?: boolean | null
          id?: string
          job_title_or_role?: string | null
          leadership_application_frequency?: string | null
          leadership_should_understand?: string | null
          learning_motivation?: string | null
          learning_preference?:
            | Database["public"]["Enums"]["learning_preference"]
            | null
          listens_to_podcasts?: boolean | null
          manager_support_quality?: string | null
          manages_others?: boolean | null
          mental_drain_frequency?: string | null
          most_important_job_aspect?: string | null
          natural_strength?: string | null
          needed_training?: string | null
          needed_training_for_effectiveness?: string | null
          one_year_vision?: string | null
          profile_id?: string | null
          reads_books_articles?: boolean | null
          recent_accomplishment?: string | null
          recent_challenge?: string | null
          retention_improvement_suggestion?: string | null
          role_clarity_score?: number | null
          sees_growth_path?: boolean | null
          sees_leadership_path?: boolean | null
          skill_to_master?: string | null
          strategic_thinking_application_frequency?: string | null
          submitted_at?: string | null
          support_needed_from_leadership?: string | null
          survey_version?: string | null
          technical_application_frequency?: string | null
          three_year_goal?: string | null
          twelve_month_growth_goal?: string | null
          typeform_response_id?: string | null
          typeform_start_date?: string | null
          typeform_submit_date?: string | null
          watches_youtube?: boolean | null
          weekly_development_hours?: number | null
          what_enjoy_most?: string | null
          why_people_leave_opinion?: string | null
          work_life_integration_score?: number | null
          work_life_sacrifice_frequency?: string | null
          workload_status?:
            | Database["public"]["Enums"]["workload_status"]
            | null
          would_stay_if_offered_similar?: string | null
          years_in_current_role?: string | null
          years_with_company?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_scores: {
        Row: {
          burnout_score: number | null
          calculated_at: string
          career_score: number | null
          clarity_score: number | null
          company_id: string
          created_at: string
          engagement_score: number | null
          id: string
          learning_score: number | null
          manager_score: number | null
          profile_id: string
          retention_score: number | null
          skills_score: number | null
        }
        Insert: {
          burnout_score?: number | null
          calculated_at?: string
          career_score?: number | null
          clarity_score?: number | null
          company_id: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          learning_score?: number | null
          manager_score?: number | null
          profile_id: string
          retention_score?: number | null
          skills_score?: number | null
        }
        Update: {
          burnout_score?: number | null
          calculated_at?: string
          career_score?: number | null
          clarity_score?: number | null
          company_id?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          learning_score?: number | null
          manager_score?: number | null
          profile_id?: string
          retention_score?: number | null
          skills_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          body: string | null
          company_id: string | null
          id: string
          opened_at: string | null
          profile_id: string | null
          resources_included: Json | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          id?: string
          opened_at?: string | null
          profile_id?: string | null
          resources_included?: Json | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          id?: string
          opened_at?: string | null
          profile_id?: string | null
          resources_included?: Json | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_deliveries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          body_text: string
          company_id: string | null
          created_at: string
          current_events_used: Json | null
          deal_id: string | null
          email_type: string | null
          id: string
          personalization_context: string | null
          profile_id: string
          recipient_email: string | null
          recipient_name: string | null
          sales_company_id: string | null
          status: string | null
          subject: string
        }
        Insert: {
          body_text: string
          company_id?: string | null
          created_at?: string
          current_events_used?: Json | null
          deal_id?: string | null
          email_type?: string | null
          id?: string
          personalization_context?: string | null
          profile_id: string
          recipient_email?: string | null
          recipient_name?: string | null
          sales_company_id?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          body_text?: string
          company_id?: string | null
          created_at?: string
          current_events_used?: Json | null
          deal_id?: string | null
          email_type?: string | null
          id?: string
          personalization_context?: string | null
          profile_id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          sales_company_id?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_sales_company_id_fkey"
            columns: ["sales_company_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          brief_format: string | null
          created_at: string
          email_enabled: boolean
          frequency: string
          id: string
          include_podcast: boolean | null
          preferred_day: string | null
          preferred_time: string
          profile_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          brief_format?: string | null
          created_at?: string
          email_enabled?: boolean
          frequency?: string
          id?: string
          include_podcast?: boolean | null
          preferred_day?: string | null
          preferred_time?: string
          profile_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          brief_format?: string | null
          created_at?: string
          email_enabled?: boolean
          frequency?: string
          id?: string
          include_podcast?: boolean | null
          preferred_day?: string | null
          preferred_time?: string
          profile_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reply_logs: {
        Row: {
          created_at: string
          email_body: string
          email_from: string
          email_id: string | null
          email_subject: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          parsed_data: Json | null
          processed_at: string | null
          processing_status: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          email_body: string
          email_from: string
          email_id?: string | null
          email_subject?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          parsed_data?: Json | null
          processed_at?: string | null
          processing_status?: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          email_body?: string
          email_from?: string
          email_id?: string | null
          email_subject?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          parsed_data?: Json | null
          processed_at?: string | null
          processing_status?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_reply_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_ai_recommendations: {
        Row: {
          ai_readiness_score: number | null
          created_at: string
          estimated_weekly_hours_saved: number | null
          generated_at: string
          id: string
          job_description_id: string | null
          last_podcast_mention: string | null
          mentioned_in_podcast: boolean | null
          priority_tasks: Json
          profile_id: string
          prompt_library: Json | null
          recommendations: Json
          recommended_tools: Json
          updated_at: string
          workflow_data: Json | null
        }
        Insert: {
          ai_readiness_score?: number | null
          created_at?: string
          estimated_weekly_hours_saved?: number | null
          generated_at?: string
          id?: string
          job_description_id?: string | null
          last_podcast_mention?: string | null
          mentioned_in_podcast?: boolean | null
          priority_tasks?: Json
          profile_id: string
          prompt_library?: Json | null
          recommendations?: Json
          recommended_tools?: Json
          updated_at?: string
          workflow_data?: Json | null
        }
        Update: {
          ai_readiness_score?: number | null
          created_at?: string
          estimated_weekly_hours_saved?: number | null
          generated_at?: string
          id?: string
          job_description_id?: string | null
          last_podcast_mention?: string | null
          mentioned_in_podcast?: boolean | null
          priority_tasks?: Json
          profile_id?: string
          prompt_library?: Json | null
          recommendations?: Json
          recommended_tools?: Json
          updated_at?: string
          workflow_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_ai_recommendations_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ai_recommendations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_capabilities: {
        Row: {
          ai_reasoning: string | null
          assigned_at: string | null
          capability_id: string | null
          current_level: Database["public"]["Enums"]["capability_level"] | null
          id: string
          last_updated: string | null
          manager_assessed_at: string | null
          marked_not_relevant: boolean | null
          not_relevant_reason: string | null
          priority: number | null
          profile_id: string | null
          self_assessed_at: string | null
          self_assessed_level: string | null
          self_assessment_notes: string | null
          target_level: Database["public"]["Enums"]["capability_level"] | null
        }
        Insert: {
          ai_reasoning?: string | null
          assigned_at?: string | null
          capability_id?: string | null
          current_level?: Database["public"]["Enums"]["capability_level"] | null
          id?: string
          last_updated?: string | null
          manager_assessed_at?: string | null
          marked_not_relevant?: boolean | null
          not_relevant_reason?: string | null
          priority?: number | null
          profile_id?: string | null
          self_assessed_at?: string | null
          self_assessed_level?: string | null
          self_assessment_notes?: string | null
          target_level?: Database["public"]["Enums"]["capability_level"] | null
        }
        Update: {
          ai_reasoning?: string | null
          assigned_at?: string | null
          capability_id?: string | null
          current_level?: Database["public"]["Enums"]["capability_level"] | null
          id?: string
          last_updated?: string | null
          manager_assessed_at?: string | null
          marked_not_relevant?: boolean | null
          not_relevant_reason?: string | null
          priority?: number | null
          profile_id?: string | null
          self_assessed_at?: string | null
          self_assessed_level?: string | null
          self_assessment_notes?: string | null
          target_level?: Database["public"]["Enums"]["capability_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_capabilities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_risk_flags: {
        Row: {
          auto_generated: boolean
          company_id: string
          created_at: string
          detected_at: string
          id: string
          notes: string | null
          profile_id: string
          resolved_at: string | null
          risk_level: string
          risk_score: number
          risk_type: string
        }
        Insert: {
          auto_generated?: boolean
          company_id: string
          created_at?: string
          detected_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          resolved_at?: string | null
          risk_level: string
          risk_score: number
          risk_type: string
        }
        Update: {
          auto_generated?: boolean
          company_id?: string
          created_at?: string
          detected_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          resolved_at?: string | null
          risk_level?: string
          risk_score?: number
          risk_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_risk_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_risk_flags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_name: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_name: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_name?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      feedback_requests: {
        Row: {
          created_at: string
          dismissed: boolean
          dismissed_at: string | null
          employee_id: string
          id: string
          manager_id: string
          message: string
          request_type: string
        }
        Insert: {
          created_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          employee_id: string
          id?: string
          manager_id: string
          message: string
          request_type: string
        }
        Update: {
          created_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          employee_id?: string
          id?: string
          manager_id?: string
          message?: string
          request_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      field_map_analyses: {
        Row: {
          analysis_result: Json | null
          company_id: string | null
          created_at: string | null
          customer_id: string | null
          field_name: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          key_insights: string | null
          map_type: string | null
          profile_id: string | null
          raw_ai_response: string | null
          sales_opportunities: string[] | null
          updated_at: string | null
        }
        Insert: {
          analysis_result?: Json | null
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          field_name?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          key_insights?: string | null
          map_type?: string | null
          profile_id?: string | null
          raw_ai_response?: string | null
          sales_opportunities?: string[] | null
          updated_at?: string | null
        }
        Update: {
          analysis_result?: Json | null
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          field_name?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          key_insights?: string | null
          map_type?: string | null
          profile_id?: string | null
          raw_ai_response?: string | null
          sales_opportunities?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_map_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_map_analyses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_map_analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      greatness_keys: {
        Row: {
          company_id: string
          created_at: string
          earned_at: string
          habit_id: string | null
          id: string
          profile_id: string
          streak_length: number
        }
        Insert: {
          company_id: string
          created_at?: string
          earned_at?: string
          habit_id?: string | null
          id?: string
          profile_id: string
          streak_length: number
        }
        Update: {
          company_id?: string
          created_at?: string
          earned_at?: string
          habit_id?: string | null
          id?: string
          profile_id?: string
          streak_length?: number
        }
        Relationships: [
          {
            foreignKeyName: "greatness_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "greatness_keys_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "leading_indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_journal: {
        Row: {
          company_id: string
          created_at: string
          entry_date: string
          entry_source: string
          entry_text: string
          id: string
          profile_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entry_date: string
          entry_source?: string
          entry_text: string
          id?: string
          profile_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entry_date?: string
          entry_source?: string
          entry_text?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_journal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_journal_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_completions: {
        Row: {
          completed_date: string
          created_at: string
          habit_id: string
          id: string
          notes: string | null
          profile_id: string
        }
        Insert: {
          completed_date: string
          created_at?: string
          habit_id: string
          id?: string
          notes?: string | null
          profile_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          habit_id?: string
          id?: string
          notes?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "leading_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_completions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jericho_action_log: {
        Row: {
          action_data: Json | null
          action_type: string
          can_undo: boolean | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          profile_id: string
          triggered_by: string | null
          undone_at: string | null
        }
        Insert: {
          action_data?: Json | null
          action_type: string
          can_undo?: boolean | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          profile_id: string
          triggered_by?: string | null
          undone_at?: string | null
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          can_undo?: boolean | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          profile_id?: string
          triggered_by?: string | null
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jericho_action_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jericho_action_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          analysis_results: Json | null
          capabilities_assigned: Json | null
          company_id: string
          created_at: string
          description: string
          id: string
          is_current: boolean
          profile_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          analysis_results?: Json | null
          capabilities_assigned?: Json | null
          company_id: string
          created_at?: string
          description: string
          id?: string
          is_current?: boolean
          profile_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          analysis_results?: Json | null
          capabilities_assigned?: Json | null
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          is_current?: boolean
          profile_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_descriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_descriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          author: string | null
          created_at: string
          domain_ids: string[] | null
          duration_minutes: number | null
          id: string
          metadata: Json | null
          source_platform: string | null
          source_type: string
          source_url: string | null
          tags: string[] | null
          title: string
          transcript: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          domain_ids?: string[] | null
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          source_platform?: string | null
          source_type?: string
          source_url?: string | null
          tags?: string[] | null
          title: string
          transcript: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          author?: string | null
          created_at?: string
          domain_ids?: string[] | null
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          source_platform?: string | null
          source_type?: string
          source_url?: string | null
          tags?: string[] | null
          title?: string
          transcript?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: []
      }
      leading_indicators: {
        Row: {
          company_id: string
          created_at: string
          current_streak: number
          habit_description: string | null
          habit_name: string
          habit_type: string
          id: string
          is_active: boolean
          linked_capability_id: string | null
          linked_goal_id: string | null
          longest_streak: number
          profile_id: string
          streak_history: Json | null
          target_frequency: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_streak?: number
          habit_description?: string | null
          habit_name: string
          habit_type?: string
          id?: string
          is_active?: boolean
          linked_capability_id?: string | null
          linked_goal_id?: string | null
          longest_streak?: number
          profile_id: string
          streak_history?: Json | null
          target_frequency?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_streak?: number
          habit_description?: string | null
          habit_name?: string
          habit_type?: string
          id?: string
          is_active?: boolean
          linked_capability_id?: string | null
          linked_goal_id?: string | null
          longest_streak?: number
          profile_id?: string
          streak_history?: Json | null
          target_frequency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leading_indicators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leading_indicators_linked_capability_id_fkey"
            columns: ["linked_capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leading_indicators_linked_goal_id_fkey"
            columns: ["linked_goal_id"]
            isOneToOne: false
            referencedRelation: "ninety_day_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leading_indicators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_roadmaps: {
        Row: {
          company_id: string
          context_snapshot: Json
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          profile_id: string
          roadmap_data: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          context_snapshot?: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          profile_id: string
          roadmap_data?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          context_snapshot?: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          profile_id?: string
          roadmap_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_roadmaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_roadmaps_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_login_date: string
          longest_streak: number
          profile_id: string
          total_logins: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_login_date: string
          longest_streak?: number
          profile_id: string
          total_logins?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_login_date?: string
          longest_streak?: number
          profile_id?: string
          total_logins?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_streaks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          company_id: string
          employee_id: string
          id: string
          manager_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          company_id: string
          employee_id: string
          id?: string
          manager_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          company_id?: string
          employee_id?: string
          id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_requests: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          manager_notes: string | null
          preferred_date: string | null
          requested_manager_id: string
          requester_id: string
          scheduled_date: string | null
          status: string | null
          topic: string | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          manager_notes?: string | null
          preferred_date?: string | null
          requested_manager_id: string
          requester_id: string
          scheduled_date?: string | null
          status?: string | null
          topic?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          manager_notes?: string | null
          preferred_date?: string | null
          requested_manager_id?: string
          requester_id?: string
          scheduled_date?: string | null
          status?: string | null
          topic?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_requested_manager_id_fkey"
            columns: ["requested_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ninety_day_targets: {
        Row: {
          benchmarks: Json | null
          by_when: string | null
          category: string
          company_id: string
          completed: boolean | null
          created_at: string
          goal_number: number
          goal_text: string | null
          goal_type: string
          id: string
          profile_id: string
          quarter: string
          sprints: Json | null
          support_needed: string | null
          updated_at: string
          year: number
        }
        Insert: {
          benchmarks?: Json | null
          by_when?: string | null
          category: string
          company_id: string
          completed?: boolean | null
          created_at?: string
          goal_number: number
          goal_text?: string | null
          goal_type?: string
          id?: string
          profile_id: string
          quarter: string
          sprints?: Json | null
          support_needed?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          benchmarks?: Json | null
          by_when?: string | null
          category?: string
          company_id?: string
          completed?: boolean | null
          created_at?: string
          goal_number?: number
          goal_text?: string | null
          goal_type?: string
          id?: string
          profile_id?: string
          quarter?: string
          sprints?: Json | null
          support_needed?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ninety_day_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ninety_day_targets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_one_notes: {
        Row: {
          action_items: Json | null
          calendar_invite_sent: boolean | null
          company_id: string
          concerns: string | null
          created_at: string
          employee_id: string
          id: string
          manager_id: string
          meeting_date: string
          next_meeting_date: string | null
          notes: string | null
          scheduled_time: string | null
          updated_at: string
          wins: string | null
        }
        Insert: {
          action_items?: Json | null
          calendar_invite_sent?: boolean | null
          company_id: string
          concerns?: string | null
          created_at?: string
          employee_id: string
          id?: string
          manager_id: string
          meeting_date: string
          next_meeting_date?: string | null
          notes?: string | null
          scheduled_time?: string | null
          updated_at?: string
          wins?: string | null
        }
        Update: {
          action_items?: Json | null
          calendar_invite_sent?: boolean | null
          company_id?: string
          concerns?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          manager_id?: string
          meeting_date?: string
          next_meeting_date?: string | null
          notes?: string | null
          scheduled_time?: string | null
          updated_at?: string
          wins?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_notes_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          ai_draft: string | null
          ai_summary: string | null
          areas_for_improvement: string | null
          calendar_invite_sent: boolean | null
          company_id: string
          created_at: string
          employee_acknowledged_at: string | null
          employee_notes: string | null
          goals_met: Json | null
          goals_missed: Json | null
          id: string
          manager_completed_at: string | null
          manager_notes: string | null
          overall_rating: number | null
          profile_id: string
          review_date: string
          review_type: string
          scheduled_by: string
          scheduled_time: string | null
          status: string
          strengths: string | null
          updated_at: string
        }
        Insert: {
          ai_draft?: string | null
          ai_summary?: string | null
          areas_for_improvement?: string | null
          calendar_invite_sent?: boolean | null
          company_id: string
          created_at?: string
          employee_acknowledged_at?: string | null
          employee_notes?: string | null
          goals_met?: Json | null
          goals_missed?: Json | null
          id?: string
          manager_completed_at?: string | null
          manager_notes?: string | null
          overall_rating?: number | null
          profile_id: string
          review_date: string
          review_type?: string
          scheduled_by: string
          scheduled_time?: string | null
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          ai_draft?: string | null
          ai_summary?: string | null
          areas_for_improvement?: string | null
          calendar_invite_sent?: boolean | null
          company_id?: string
          created_at?: string
          employee_acknowledged_at?: string | null
          employee_notes?: string | null
          goals_met?: Json | null
          goals_missed?: Json | null
          id?: string
          manager_completed_at?: string | null
          manager_notes?: string | null
          overall_rating?: number | null
          profile_id?: string
          review_date?: string
          review_type?: string
          scheduled_by?: string
          scheduled_time?: string | null
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_goals: {
        Row: {
          company_id: string
          created_at: string
          id: string
          one_year_vision: string | null
          personal_one_year_vision: string | null
          personal_three_year_vision: string | null
          profile_id: string
          three_year_vision: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          one_year_vision?: string | null
          personal_one_year_vision?: string | null
          personal_three_year_vision?: string | null
          profile_id: string
          three_year_vision?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          one_year_vision?: string | null
          personal_one_year_vision?: string | null
          personal_three_year_vision?: string | null
          profile_id?: string
          three_year_vision?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_content_usage: {
        Row: {
          content_hash: string | null
          content_id: string | null
          content_type: string
          created_at: string
          episode_date: string
          id: string
          mentioned_at: string
          profile_id: string
        }
        Insert: {
          content_hash?: string | null
          content_id?: string | null
          content_type: string
          created_at?: string
          episode_date: string
          id?: string
          mentioned_at?: string
          profile_id: string
        }
        Update: {
          content_hash?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          episode_date?: string
          id?: string
          mentioned_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_content_usage_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episodes: {
        Row: {
          audio_url: string | null
          capability_focus_index: number | null
          capability_id: string | null
          challenge_completed_at: string | null
          company_id: string
          content_type: string
          created_at: string
          daily_challenge: string | null
          duration_seconds: number | null
          episode_date: string
          id: string
          intro_music_url: string | null
          is_welcome_episode: boolean | null
          listened_at: string | null
          outro_music_url: string | null
          profile_id: string
          script: string
          title: string
          topics_covered: Json | null
          updated_at: string
          yesterday_summary: string | null
        }
        Insert: {
          audio_url?: string | null
          capability_focus_index?: number | null
          capability_id?: string | null
          challenge_completed_at?: string | null
          company_id: string
          content_type?: string
          created_at?: string
          daily_challenge?: string | null
          duration_seconds?: number | null
          episode_date: string
          id?: string
          intro_music_url?: string | null
          is_welcome_episode?: boolean | null
          listened_at?: string | null
          outro_music_url?: string | null
          profile_id: string
          script: string
          title: string
          topics_covered?: Json | null
          updated_at?: string
          yesterday_summary?: string | null
        }
        Update: {
          audio_url?: string | null
          capability_focus_index?: number | null
          capability_id?: string | null
          challenge_completed_at?: string | null
          company_id?: string
          content_type?: string
          created_at?: string
          daily_challenge?: string | null
          duration_seconds?: number | null
          episode_date?: string
          id?: string
          intro_music_url?: string | null
          is_welcome_episode?: boolean | null
          listened_at?: string | null
          outro_music_url?: string | null
          profile_id?: string
          script?: string
          title?: string
          topics_covered?: Json | null
          updated_at?: string
          yesterday_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episodes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episodes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_feedback: {
        Row: {
          context_snapshot: Json | null
          created_at: string
          episode_id: string
          feedback_text: string | null
          id: string
          profile_id: string
          rating: string
        }
        Insert: {
          context_snapshot?: Json | null
          created_at?: string
          episode_id: string
          feedback_text?: string | null
          id?: string
          profile_id: string
          rating: string
        }
        Update: {
          context_snapshot?: Json | null
          created_at?: string
          episode_id?: string
          feedback_text?: string | null
          id?: string
          profile_id?: string
          rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_feedback_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_learning: {
        Row: {
          company_id: string | null
          confidence_score: number | null
          created_at: string
          feedback_count: number | null
          id: string
          learned_response: string
          pattern_key: string
          pattern_type: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          feedback_count?: number | null
          id?: string
          learned_response: string
          pattern_key: string
          pattern_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          feedback_count?: number | null
          id?: string
          learned_response?: string
          pattern_key?: string
          pattern_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_learning_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      point_config: {
        Row: {
          activity_type: string
          base_points: number
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          activity_type: string
          base_points: number
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          activity_type?: string
          base_points?: number
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          activity_type: string
          base_points: number
          company_id: string
          created_at: string
          description: string | null
          final_points: number
          id: string
          multiplier_applied: number
          profile_id: string
        }
        Insert: {
          activity_type: string
          base_points: number
          company_id: string
          created_at?: string
          description?: string | null
          final_points: number
          id?: string
          multiplier_applied?: number
          profile_id: string
        }
        Update: {
          activity_type?: string
          base_points?: number
          company_id?: string
          created_at?: string
          description?: string | null
          final_points?: number
          id?: string
          multiplier_applied?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_company_changes: {
        Row: {
          change_source: string | null
          changed_at: string | null
          changed_by: string | null
          id: string
          new_company_id: string | null
          old_company_id: string | null
          profile_id: string | null
        }
        Insert: {
          change_source?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_company_id?: string | null
          old_company_id?: string | null
          profile_id?: string | null
        }
        Update: {
          change_source?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_company_id?: string | null
          old_company_id?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_company_changes_new_company_id_fkey"
            columns: ["new_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_company_changes_old_company_id_fkey"
            columns: ["old_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_company_changes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          company_logo_url: string | null
          created_at: string | null
          created_by_admin: boolean | null
          email: string | null
          full_name: string | null
          has_seen_manager_onboarding: boolean | null
          hide_daily_brief: boolean
          id: string
          is_active: boolean | null
          is_admin: boolean | null
          is_super_admin: boolean | null
          job_title: string | null
          phone: string | null
          phone_verified: boolean | null
          podcast_duration_minutes: number | null
          registration_complete: boolean | null
          role: string | null
          sms_opted_in: boolean | null
          sms_opted_in_at: string | null
          timezone: string | null
          updated_at: string | null
          voice_opted_in: boolean | null
          voice_opted_in_at: string | null
        }
        Insert: {
          company_id?: string | null
          company_logo_url?: string | null
          created_at?: string | null
          created_by_admin?: boolean | null
          email?: string | null
          full_name?: string | null
          has_seen_manager_onboarding?: boolean | null
          hide_daily_brief?: boolean
          id: string
          is_active?: boolean | null
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          job_title?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          podcast_duration_minutes?: number | null
          registration_complete?: boolean | null
          role?: string | null
          sms_opted_in?: boolean | null
          sms_opted_in_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          voice_opted_in?: boolean | null
          voice_opted_in_at?: string | null
        }
        Update: {
          company_id?: string | null
          company_logo_url?: string | null
          created_at?: string | null
          created_by_admin?: boolean | null
          email?: string | null
          full_name?: string | null
          has_seen_manager_onboarding?: boolean | null
          hide_daily_brief?: boolean
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          job_title?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          podcast_duration_minutes?: number | null
          registration_complete?: boolean | null
          role?: string | null
          sms_opted_in?: boolean | null
          sms_opted_in_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          voice_opted_in?: boolean | null
          voice_opted_in_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          column_status: string
          context: Json | null
          created_at: string
          created_by_jericho: boolean | null
          description: string | null
          due_date: string | null
          id: string
          position: number
          priority: string | null
          profile_id: string
          project_id: string | null
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          column_status?: string
          context?: Json | null
          created_at?: string
          created_by_jericho?: boolean | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: string | null
          profile_id: string
          project_id?: string | null
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          column_status?: string
          context?: Json | null
          created_at?: string
          created_by_jericho?: boolean | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: string | null
          profile_id?: string
          project_id?: string | null
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_readiness: {
        Row: {
          assessed_at: string
          assessed_by: string
          capability_gaps: Json | null
          capability_readiness_pct: number | null
          career_path_id: string | null
          company_id: string
          created_at: string
          estimated_ready_date: string | null
          experience_readiness_pct: number | null
          id: string
          next_assessment_due: string | null
          overall_readiness_pct: number
          performance_readiness_pct: number | null
          profile_id: string
          readiness_summary: string | null
          recommended_actions: Json | null
          strengths: Json | null
          target_role: string
          updated_at: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string
          capability_gaps?: Json | null
          capability_readiness_pct?: number | null
          career_path_id?: string | null
          company_id: string
          created_at?: string
          estimated_ready_date?: string | null
          experience_readiness_pct?: number | null
          id?: string
          next_assessment_due?: string | null
          overall_readiness_pct: number
          performance_readiness_pct?: number | null
          profile_id: string
          readiness_summary?: string | null
          recommended_actions?: Json | null
          strengths?: Json | null
          target_role: string
          updated_at?: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string
          capability_gaps?: Json | null
          capability_readiness_pct?: number | null
          career_path_id?: string | null
          company_id?: string
          created_at?: string
          estimated_ready_date?: string | null
          experience_readiness_pct?: number | null
          id?: string
          next_assessment_due?: string | null
          overall_readiness_pct?: number
          performance_readiness_pct?: number | null
          profile_id?: string
          readiness_summary?: string | null
          recommended_actions?: Json | null
          strengths?: Json | null
          target_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_readiness_career_path_id_fkey"
            columns: ["career_path_id"]
            isOneToOne: false
            referencedRelation: "career_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_readiness_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_readiness_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recognition_analytics: {
        Row: {
          capability_id: string | null
          category: string | null
          company_id: string
          created_at: string
          giver_id: string
          id: string
          impact_level: string | null
          receiver_id: string
          recognition_id: string
        }
        Insert: {
          capability_id?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          giver_id: string
          id?: string
          impact_level?: string | null
          receiver_id: string
          recognition_id: string
        }
        Update: {
          capability_id?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          giver_id?: string
          id?: string
          impact_level?: string | null
          receiver_id?: string
          recognition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_analytics_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_analytics_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_analytics_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_analytics_recognition_id_fkey"
            columns: ["recognition_id"]
            isOneToOne: false
            referencedRelation: "recognition_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      recognition_notes: {
        Row: {
          capability_id: string | null
          category: string | null
          company_id: string
          created_at: string
          description: string
          given_by: string
          given_to: string
          goal_id: string | null
          id: string
          impact_level: string | null
          is_quick_kudos: boolean | null
          recognition_date: string
          template_id: string | null
          title: string
          visibility: string
        }
        Insert: {
          capability_id?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          description: string
          given_by: string
          given_to: string
          goal_id?: string | null
          id?: string
          impact_level?: string | null
          is_quick_kudos?: boolean | null
          recognition_date?: string
          template_id?: string | null
          title: string
          visibility?: string
        }
        Update: {
          capability_id?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string
          given_by?: string
          given_to?: string
          goal_id?: string | null
          id?: string
          impact_level?: string | null
          is_quick_kudos?: boolean | null
          recognition_date?: string
          template_id?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_notes_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_notes_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_notes_given_to_fkey"
            columns: ["given_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_notes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "personal_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      recognition_templates: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          description_prompt: string | null
          display_order: number | null
          id: string
          is_system_template: boolean | null
          title: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description_prompt?: string | null
          display_order?: number | null
          id?: string
          is_system_template?: boolean | null
          title: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description_prompt?: string | null
          display_order?: number | null
          id?: string
          is_system_template?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_leads: {
        Row: {
          contact_name: string | null
          converted_at: string | null
          created_at: string
          deal_value: number | null
          id: string
          lead_company: string | null
          lead_email: string | null
          partner_id: string
          status: string
        }
        Insert: {
          contact_name?: string | null
          converted_at?: string | null
          created_at?: string
          deal_value?: number | null
          id?: string
          lead_company?: string | null
          lead_email?: string | null
          partner_id: string
          status?: string
        }
        Update: {
          contact_name?: string | null
          converted_at?: string | null
          created_at?: string
          deal_value?: number | null
          id?: string
          lead_company?: string | null
          lead_email?: string | null
          partner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          commission_rate: number
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          referral_code: string
          status: string
          user_id: string | null
        }
        Insert: {
          commission_rate?: number
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          referral_code: string
          status?: string
          user_id?: string | null
        }
        Update: {
          commission_rate?: number
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          referral_code?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referral_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          paid_at: string | null
          partner_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          paid_at?: string | null
          partner_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_payouts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "referral_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_metadata: {
        Row: {
          attribution_source: string | null
          company_name: string | null
          created_at: string | null
          goal_details: string | null
          id: string
          primary_goal: string | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          attribution_source?: string | null
          company_name?: string | null
          created_at?: string | null
          goal_details?: string | null
          id?: string
          primary_goal?: string | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          attribution_source?: string | null
          company_name?: string | null
          created_at?: string | null
          goal_details?: string | null
          id?: string
          primary_goal?: string | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_metadata_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resend_emails: {
        Row: {
          created_at: string | null
          email_id: string
          from_email: string
          html: string | null
          id: string
          processed_at: string | null
          subject: string | null
          text: string | null
          to_email: string | null
        }
        Insert: {
          created_at?: string | null
          email_id: string
          from_email: string
          html?: string | null
          id?: string
          processed_at?: string | null
          subject?: string | null
          text?: string | null
          to_email?: string | null
        }
        Update: {
          created_at?: string | null
          email_id?: string
          from_email?: string
          html?: string | null
          id?: string
          processed_at?: string | null
          subject?: string | null
          text?: string | null
          to_email?: string | null
        }
        Relationships: []
      }
      resource_capabilities: {
        Row: {
          capability_id: string
          created_at: string
          id: string
          resource_id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          id?: string
          resource_id: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_capabilities_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_ratings: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          rating: number
          resource_id: string
          review_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          rating: number
          resource_id: string
          review_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          rating?: number
          resource_id?: string
          review_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_ratings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_suggestions: {
        Row: {
          company_id: string
          content_type: string
          created_at: string | null
          description: string | null
          external_url: string
          id: string
          profile_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_capability_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          content_type: string
          created_at?: string | null
          description?: string | null
          external_url: string
          id?: string
          profile_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_capability_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          content_type?: string
          created_at?: string | null
          description?: string | null
          external_url?: string
          id?: string
          profile_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_capability_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_suggestions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_suggestions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_suggestions_suggested_capability_id_fkey"
            columns: ["suggested_capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          authors: string | null
          capability_id: string | null
          capability_level:
            | Database["public"]["Enums"]["capability_level"]
            | null
          company_id: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string | null
          description: string | null
          estimated_time_minutes: number | null
          external_id: string | null
          external_url: string | null
          id: string
          is_active: boolean | null
          publisher: string | null
          rating: number | null
          title: string
          url: string | null
        }
        Insert: {
          authors?: string | null
          capability_id?: string | null
          capability_level?:
            | Database["public"]["Enums"]["capability_level"]
            | null
          company_id?: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          description?: string | null
          estimated_time_minutes?: number | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_active?: boolean | null
          publisher?: string | null
          rating?: number | null
          title: string
          url?: string | null
        }
        Update: {
          authors?: string | null
          capability_id?: string | null
          capability_level?:
            | Database["public"]["Enums"]["capability_level"]
            | null
          company_id?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          description?: string | null
          estimated_time_minutes?: number | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_active?: boolean | null
          publisher?: string | null
          rating?: number | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_interest_indicators: {
        Row: {
          admin_viewed: boolean
          company_id: string
          created_at: string
          id: string
          indicated_at: string
          item_details: Json | null
          item_title: string
          item_type: string
          manager_viewed: boolean
          profile_id: string
        }
        Insert: {
          admin_viewed?: boolean
          company_id: string
          created_at?: string
          id?: string
          indicated_at?: string
          item_details?: Json | null
          item_title: string
          item_type: string
          manager_viewed?: boolean
          profile_id: string
        }
        Update: {
          admin_viewed?: boolean
          company_id?: string
          created_at?: string
          id?: string
          indicated_at?: string
          item_details?: Json | null
          item_title?: string
          item_type?: string
          manager_viewed?: boolean
          profile_id?: string
        }
        Relationships: []
      }
      sales_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["sales_activity_type"]
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          notes: string | null
          outcome: string | null
          profile_id: string
          scheduled_for: string | null
          subject: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["sales_activity_type"]
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          profile_id: string
          scheduled_for?: string | null
          subject?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["sales_activity_type"]
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          profile_id?: string
          scheduled_for?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_coach_conversations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          profile_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_coach_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_coach_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_coach_feedback: {
        Row: {
          company_id: string | null
          context_snapshot: Json | null
          created_at: string | null
          feedback_text: string | null
          id: string
          message_id: string | null
          profile_id: string | null
          rating: string
          recommendation_type: string | null
        }
        Insert: {
          company_id?: string | null
          context_snapshot?: Json | null
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          message_id?: string | null
          profile_id?: string | null
          rating: string
          recommendation_type?: string | null
        }
        Update: {
          company_id?: string | null
          context_snapshot?: Json | null
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          message_id?: string | null
          profile_id?: string | null
          rating?: string
          recommendation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_coach_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_coach_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "sales_coach_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_coach_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_coach_learning: {
        Row: {
          company_id: string
          confidence_score: number | null
          created_at: string | null
          feedback_count: number | null
          id: string
          learned_response: string
          pattern_key: string
          pattern_type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          confidence_score?: number | null
          created_at?: string | null
          feedback_count?: number | null
          id?: string
          learned_response: string
          pattern_key: string
          pattern_type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          confidence_score?: number | null
          created_at?: string | null
          feedback_count?: number | null
          id?: string
          learned_response?: string
          pattern_key?: string
          pattern_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_coach_learning_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_coach_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_companies: {
        Row: {
          annual_revenue: string | null
          created_at: string
          customer_since: number | null
          employee_count: string | null
          grower_history: string | null
          id: string
          industry: string | null
          location: string | null
          name: string
          notes: string | null
          operation_details: Json | null
          profile_id: string
          research_citations: Json | null
          research_date: string | null
          source: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          annual_revenue?: string | null
          created_at?: string
          customer_since?: number | null
          employee_count?: string | null
          grower_history?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name: string
          notes?: string | null
          operation_details?: Json | null
          profile_id: string
          research_citations?: Json | null
          research_date?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          annual_revenue?: string | null
          created_at?: string
          customer_since?: number | null
          employee_count?: string | null
          grower_history?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          operation_details?: Json | null
          profile_id?: string
          research_citations?: Json | null
          research_date?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_companies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_company_intelligence: {
        Row: {
          buying_signals: Json | null
          company_id: string
          competitive_intel: string | null
          created_at: string
          id: string
          key_contacts: Json | null
          last_research_at: string | null
          objections_history: Json | null
          personal_details: Json | null
          preferences: Json | null
          profile_id: string
          relationship_notes: string | null
          research_data: Json | null
          updated_at: string
        }
        Insert: {
          buying_signals?: Json | null
          company_id: string
          competitive_intel?: string | null
          created_at?: string
          id?: string
          key_contacts?: Json | null
          last_research_at?: string | null
          objections_history?: Json | null
          personal_details?: Json | null
          preferences?: Json | null
          profile_id: string
          relationship_notes?: string | null
          research_data?: Json | null
          updated_at?: string
        }
        Update: {
          buying_signals?: Json | null
          company_id?: string
          competitive_intel?: string | null
          created_at?: string
          id?: string
          key_contacts?: Json | null
          last_research_at?: string | null
          objections_history?: Json | null
          personal_details?: Json | null
          preferences?: Json | null
          profile_id?: string
          relationship_notes?: string | null
          research_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_intelligence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_intelligence_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          is_decision_maker: boolean | null
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          profile_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          profile_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deals: {
        Row: {
          company_id: string | null
          created_at: string
          customer_type: string | null
          deal_name: string
          estimated_acres: number | null
          expected_close_date: string | null
          id: string
          last_activity_at: string | null
          loss_reason: string | null
          notes: string | null
          primary_contact_id: string | null
          priority: number | null
          probability: number | null
          profile_id: string
          stage: Database["public"]["Enums"]["deal_stage"]
          target_categories: Json | null
          updated_at: string
          value: number | null
          win_notes: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_type?: string | null
          deal_name: string
          estimated_acres?: number | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          loss_reason?: string | null
          notes?: string | null
          primary_contact_id?: string | null
          priority?: number | null
          probability?: number | null
          profile_id: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          target_categories?: Json | null
          updated_at?: string
          value?: number | null
          win_notes?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_type?: string | null
          deal_name?: string
          estimated_acres?: number | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          loss_reason?: string | null
          notes?: string | null
          primary_contact_id?: string | null
          priority?: number | null
          probability?: number | null
          profile_id?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          target_categories?: Json | null
          updated_at?: string
          value?: number | null
          win_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "sales_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_knowledge: {
        Row: {
          category: string | null
          company_id: string | null
          content: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          stage?: Database["public"]["Enums"]["deal_stage"] | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          stage?: Database["public"]["Enums"]["deal_stage"] | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_knowledge_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_knowledge_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prep_documents: {
        Row: {
          call_objective: string | null
          call_type: string | null
          company_id: string
          created_at: string
          deal_id: string | null
          discovery_questions: Json | null
          id: string
          is_public: boolean
          next_steps: string | null
          objection_handlers: Json | null
          product_recommendations: Json | null
          profile_id: string
          prospect_company: string | null
          prospect_name: string | null
          prospect_role: string | null
          share_token: string
          talking_points: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          call_objective?: string | null
          call_type?: string | null
          company_id: string
          created_at?: string
          deal_id?: string | null
          discovery_questions?: Json | null
          id?: string
          is_public?: boolean
          next_steps?: string | null
          objection_handlers?: Json | null
          product_recommendations?: Json | null
          profile_id: string
          prospect_company?: string | null
          prospect_name?: string | null
          prospect_role?: string | null
          share_token?: string
          talking_points?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          call_objective?: string | null
          call_type?: string | null
          company_id?: string
          created_at?: string
          deal_id?: string | null
          discovery_questions?: Json | null
          id?: string
          is_public?: boolean
          next_steps?: string | null
          objection_handlers?: Json | null
          product_recommendations?: Json | null
          profile_id?: string
          prospect_company?: string | null
          prospect_name?: string | null
          prospect_role?: string | null
          share_token?: string
          talking_points?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_prep_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prep_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prep_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          company_id: string | null
          created_at: string
          direction: string
          error_message: string | null
          id: string
          message: string
          message_type: string | null
          parsed_data: Json | null
          parsed_intent: string | null
          phone_number: string
          processed_at: string | null
          profile_id: string | null
          status: string | null
          twilio_sid: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          message: string
          message_type?: string | null
          parsed_data?: Json | null
          parsed_intent?: string | null
          phone_number: string
          processed_at?: string | null
          profile_id?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          message?: string
          message_type?: string | null
          parsed_data?: Json | null
          parsed_intent?: string | null
          phone_number?: string
          processed_at?: string | null
          profile_id?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_learning_notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string | null
          notification_type: string
          report_id: string | null
          sent_to: string[] | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          notification_type: string
          report_id?: string | null
          sent_to?: string[] | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          notification_type?: string
          report_id?: string | null
          sent_to?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_learning_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "strategic_learning_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_learning_reports: {
        Row: {
          budget_scenarios: Json | null
          cohorts: Json
          company_id: string
          executive_summary: Json | null
          expires_at: string
          generated_at: string
          id: string
          narrative: string | null
          roi_projections: Json | null
        }
        Insert: {
          budget_scenarios?: Json | null
          cohorts?: Json
          company_id: string
          executive_summary?: Json | null
          expires_at?: string
          generated_at?: string
          id?: string
          narrative?: string | null
          roi_projections?: Json | null
        }
        Update: {
          budget_scenarios?: Json | null
          cohorts?: Json
          company_id?: string
          executive_summary?: Json | null
          expires_at?: string
          generated_at?: string
          id?: string
          narrative?: string | null
          roi_projections?: Json | null
        }
        Relationships: []
      }
      training_cohorts: {
        Row: {
          capability_name: string | null
          cohort_name: string
          created_at: string
          employee_count: number
          employee_ids: string[]
          estimated_cost_aggressive: number | null
          estimated_cost_conservative: number | null
          estimated_cost_moderate: number | null
          estimated_cost_per_employee: number | null
          expected_roi_percentage: number | null
          id: string
          priority: number | null
          recommended_solutions: Json | null
          report_id: string
          timeline_weeks: number | null
          total_estimated_cost: number | null
        }
        Insert: {
          capability_name?: string | null
          cohort_name: string
          created_at?: string
          employee_count: number
          employee_ids: string[]
          estimated_cost_aggressive?: number | null
          estimated_cost_conservative?: number | null
          estimated_cost_moderate?: number | null
          estimated_cost_per_employee?: number | null
          expected_roi_percentage?: number | null
          id?: string
          priority?: number | null
          recommended_solutions?: Json | null
          report_id: string
          timeline_weeks?: number | null
          total_estimated_cost?: number | null
        }
        Update: {
          capability_name?: string | null
          cohort_name?: string
          created_at?: string
          employee_count?: number
          employee_ids?: string[]
          estimated_cost_aggressive?: number | null
          estimated_cost_conservative?: number | null
          estimated_cost_moderate?: number | null
          estimated_cost_per_employee?: number | null
          expected_roi_percentage?: number | null
          id?: string
          priority?: number | null
          recommended_solutions?: Json | null
          report_id?: string
          timeline_weeks?: number | null
          total_estimated_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_cohorts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "strategic_learning_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      training_roi_tracking: {
        Row: {
          baseline_value: number | null
          company_id: string
          created_at: string
          current_value: number | null
          id: string
          measured_at: string
          metric_type: string
          notes: string | null
          period_end: string
          period_start: string
        }
        Insert: {
          baseline_value?: number | null
          company_id: string
          created_at?: string
          current_value?: number | null
          id?: string
          measured_at?: string
          metric_type: string
          notes?: string | null
          period_end: string
          period_start: string
        }
        Update: {
          baseline_value?: number | null
          company_id?: string
          created_at?: string
          current_value?: number | null
          id?: string
          measured_at?: string
          metric_type?: string
          notes?: string | null
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_roi_tracking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          metadata: Json | null
          profile_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          profile_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_data_completeness: {
        Row: {
          created_at: string | null
          has_90_day_goals: boolean | null
          has_active_habits: boolean | null
          has_chatted_with_jericho: boolean | null
          has_completed_diagnostic: boolean | null
          has_personal_vision: boolean | null
          has_received_resource: boolean | null
          has_recent_achievements: boolean | null
          has_self_assessed_capabilities: boolean | null
          id: string
          last_jericho_prompt: string | null
          onboarding_phase: string | null
          onboarding_score: number | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          has_90_day_goals?: boolean | null
          has_active_habits?: boolean | null
          has_chatted_with_jericho?: boolean | null
          has_completed_diagnostic?: boolean | null
          has_personal_vision?: boolean | null
          has_received_resource?: boolean | null
          has_recent_achievements?: boolean | null
          has_self_assessed_capabilities?: boolean | null
          id?: string
          last_jericho_prompt?: string | null
          onboarding_phase?: string | null
          onboarding_score?: number | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          has_90_day_goals?: boolean | null
          has_active_habits?: boolean | null
          has_chatted_with_jericho?: boolean | null
          has_completed_diagnostic?: boolean | null
          has_personal_vision?: boolean | null
          has_received_resource?: boolean | null
          has_recent_achievements?: boolean | null
          has_self_assessed_capabilities?: boolean | null
          id?: string
          last_jericho_prompt?: string | null
          onboarding_phase?: string | null
          onboarding_score?: number | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_data_completeness_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_flags: {
        Row: {
          created_at: string
          enabled_at: string | null
          enabled_by: string | null
          flag_id: string
          id: string
          is_enabled: boolean
          profile_id: string
        }
        Insert: {
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          flag_id: string
          id?: string
          is_enabled?: boolean
          profile_id: string
        }
        Update: {
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          flag_id?: string
          id?: string
          is_enabled?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_flags_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feature_flags_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feature_flags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          external_email: string | null
          external_user_id: string | null
          id: string
          integration_type: string
          last_sync_at: string | null
          metadata: Json | null
          profile_id: string
          refresh_token: string | null
          scopes: string[] | null
          sync_error: string | null
          sync_status: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          external_email?: string | null
          external_user_id?: string | null
          id?: string
          integration_type: string
          last_sync_at?: string | null
          metadata?: Json | null
          profile_id: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_error?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          external_email?: string | null
          external_user_id?: string | null
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          metadata?: Json | null
          profile_id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_error?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          profile_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_scores: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_activity_date: string | null
          monthly_points: number
          profile_id: string
          streak_multiplier: number
          total_points: number
          updated_at: string
          weekly_points: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_activity_date?: string | null
          monthly_points?: number
          profile_id: string
          streak_multiplier?: number
          total_points?: number
          updated_at?: string
          weekly_points?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_activity_date?: string | null
          monthly_points?: number
          profile_id?: string
          streak_multiplier?: number
          total_points?: number
          updated_at?: string
          weekly_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          audio_minutes_used: number | null
          conversation_id: string
          created_at: string
          duration_seconds: number | null
          elevenlabs_session_id: string | null
          ended_at: string | null
          id: string
          profile_id: string
          started_at: string
        }
        Insert: {
          audio_minutes_used?: number | null
          conversation_id: string
          created_at?: string
          duration_seconds?: number | null
          elevenlabs_session_id?: string | null
          ended_at?: string | null
          id?: string
          profile_id: string
          started_at?: string
        }
        Update: {
          audio_minutes_used?: number | null
          conversation_id?: string
          created_at?: string
          duration_seconds?: number | null
          elevenlabs_session_id?: string | null
          ended_at?: string | null
          id?: string
          profile_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_voice_sessions_conversation"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_voice_sessions_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_monthly_costs: {
        Row: {
          call_count: number | null
          company_id: string | null
          model_provider: string | null
          model_used: string | null
          month: string | null
          total_cost_usd: number | null
          total_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_create_profile: {
        Args: {
          p_admin_id: string
          p_email: string
          p_full_name?: string
          p_is_admin?: boolean
        }
        Returns: string
      }
      award_points: {
        Args: {
          p_activity_type: string
          p_description?: string
          p_profile_id: string
        }
        Returns: number
      }
      check_and_award_badges: { Args: { user_id: string }; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      get_partner_id_by_referral_code: {
        Args: { p_referral_code: string }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      refresh_user_completeness: {
        Args: { user_id: string }
        Returns: undefined
      }
      reset_periodic_points: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "manager" | "user" | "partner"
      burnout_level: "energized" | "normal" | "tired" | "drained" | "burned_out"
      capability_level: "foundational" | "advancing" | "independent" | "mastery"
      content_type:
        | "article"
        | "video"
        | "podcast"
        | "book"
        | "course"
        | "tool"
        | "template"
      deal_stage:
        | "prospecting"
        | "discovery"
        | "proposal"
        | "closing"
        | "follow_up"
      engagement_level:
        | "very_engaged"
        | "engaged"
        | "neutral"
        | "disengaged"
        | "very_disengaged"
      learning_preference:
        | "visual"
        | "reading"
        | "hands_on"
        | "auditory"
        | "mixed"
      sales_activity_type: "call" | "email" | "meeting" | "note" | "task"
      workload_status:
        | "very_manageable"
        | "manageable"
        | "stretched"
        | "overwhelmed"
        | "unsustainable"
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
      app_role: ["super_admin", "admin", "manager", "user", "partner"],
      burnout_level: ["energized", "normal", "tired", "drained", "burned_out"],
      capability_level: ["foundational", "advancing", "independent", "mastery"],
      content_type: [
        "article",
        "video",
        "podcast",
        "book",
        "course",
        "tool",
        "template",
      ],
      deal_stage: [
        "prospecting",
        "discovery",
        "proposal",
        "closing",
        "follow_up",
      ],
      engagement_level: [
        "very_engaged",
        "engaged",
        "neutral",
        "disengaged",
        "very_disengaged",
      ],
      learning_preference: [
        "visual",
        "reading",
        "hands_on",
        "auditory",
        "mixed",
      ],
      sales_activity_type: ["call", "email", "meeting", "note", "task"],
      workload_status: [
        "very_manageable",
        "manageable",
        "stretched",
        "overwhelmed",
        "unsustainable",
      ],
    },
  },
} as const
