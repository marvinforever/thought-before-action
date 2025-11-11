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
      companies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      email_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          frequency: string
          id: string
          preferred_day: string | null
          preferred_time: string
          profile_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          frequency?: string
          id?: string
          preferred_day?: string | null
          preferred_time?: string
          profile_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          frequency?: string
          id?: string
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
          email_subject: string | null
          error_message: string | null
          id: string
          parsed_data: Json | null
          processed_at: string | null
          processing_status: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          email_body: string
          email_from: string
          email_subject?: string | null
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          processed_at?: string | null
          processing_status?: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          email_body?: string
          email_from?: string
          email_subject?: string | null
          error_message?: string | null
          id?: string
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
      leading_indicators: {
        Row: {
          company_id: string
          created_at: string
          current_streak: number
          habit_description: string | null
          habit_name: string
          id: string
          is_active: boolean
          linked_capability_id: string | null
          linked_goal_id: string | null
          longest_streak: number
          profile_id: string
          target_frequency: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_streak?: number
          habit_description?: string | null
          habit_name: string
          id?: string
          is_active?: boolean
          linked_capability_id?: string | null
          linked_goal_id?: string | null
          longest_streak?: number
          profile_id: string
          target_frequency?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_streak?: number
          habit_description?: string | null
          habit_name?: string
          id?: string
          is_active?: boolean
          linked_capability_id?: string | null
          linked_goal_id?: string | null
          longest_streak?: number
          profile_id?: string
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
            isOneToOne: true
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
          company_id: string
          concerns: string | null
          created_at: string
          employee_id: string
          id: string
          manager_id: string
          meeting_date: string
          next_meeting_date: string | null
          notes: string | null
          updated_at: string
          wins: string | null
        }
        Insert: {
          action_items?: Json | null
          company_id: string
          concerns?: string | null
          created_at?: string
          employee_id: string
          id?: string
          manager_id: string
          meeting_date: string
          next_meeting_date?: string | null
          notes?: string | null
          updated_at?: string
          wins?: string | null
        }
        Update: {
          action_items?: Json | null
          company_id?: string
          concerns?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          manager_id?: string
          meeting_date?: string
          next_meeting_date?: string | null
          notes?: string | null
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
          status: string
          strengths: string | null
          updated_at: string
        }
        Insert: {
          ai_draft?: string | null
          ai_summary?: string | null
          areas_for_improvement?: string | null
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
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          ai_draft?: string | null
          ai_summary?: string | null
          areas_for_improvement?: string | null
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
          profile_id: string
          three_year_vision: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          one_year_vision?: string | null
          profile_id: string
          three_year_vision?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          one_year_vision?: string | null
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
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_admin: boolean | null
          is_super_admin: boolean | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
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
      recognition_notes: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string
          given_by: string
          given_to: string
          id: string
          recognition_date: string
          title: string
          visibility: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description: string
          given_by: string
          given_to: string
          id?: string
          recognition_date?: string
          title: string
          visibility?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string
          given_by?: string
          given_to?: string
          id?: string
          recognition_date?: string
          title?: string
          visibility?: string
        }
        Relationships: [
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
        ]
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
      user_data_completeness: {
        Row: {
          created_at: string | null
          has_90_day_goals: boolean | null
          has_active_habits: boolean | null
          has_completed_diagnostic: boolean | null
          has_personal_vision: boolean | null
          has_recent_achievements: boolean | null
          has_self_assessed_capabilities: boolean | null
          id: string
          last_jericho_prompt: string | null
          onboarding_phase: string | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          has_90_day_goals?: boolean | null
          has_active_habits?: boolean | null
          has_completed_diagnostic?: boolean | null
          has_personal_vision?: boolean | null
          has_recent_achievements?: boolean | null
          has_self_assessed_capabilities?: boolean | null
          id?: string
          last_jericho_prompt?: string | null
          onboarding_phase?: string | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          has_90_day_goals?: boolean | null
          has_active_habits?: boolean | null
          has_completed_diagnostic?: boolean | null
          has_personal_vision?: boolean | null
          has_recent_achievements?: boolean | null
          has_self_assessed_capabilities?: boolean | null
          id?: string
          last_jericho_prompt?: string | null
          onboarding_phase?: string | null
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
      [_ in never]: never
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
    }
    Enums: {
      app_role: "super_admin" | "admin" | "manager" | "user"
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
      app_role: ["super_admin", "admin", "manager", "user"],
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
