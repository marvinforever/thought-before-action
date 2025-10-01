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
      capabilities: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          full_description: string | null
          id: string
          level: Database["public"]["Enums"]["capability_level"] | null
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          full_description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["capability_level"] | null
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          full_description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["capability_level"] | null
          name?: string
        }
        Relationships: []
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
      employee_capabilities: {
        Row: {
          ai_reasoning: string | null
          assigned_at: string | null
          capability_id: string | null
          current_level: Database["public"]["Enums"]["capability_level"] | null
          id: string
          last_updated: string | null
          priority: number | null
          profile_id: string | null
          target_level: Database["public"]["Enums"]["capability_level"] | null
        }
        Insert: {
          ai_reasoning?: string | null
          assigned_at?: string | null
          capability_id?: string | null
          current_level?: Database["public"]["Enums"]["capability_level"] | null
          id?: string
          last_updated?: string | null
          priority?: number | null
          profile_id?: string | null
          target_level?: Database["public"]["Enums"]["capability_level"] | null
        }
        Update: {
          ai_reasoning?: string | null
          assigned_at?: string | null
          capability_id?: string | null
          current_level?: Database["public"]["Enums"]["capability_level"] | null
          id?: string
          last_updated?: string | null
          priority?: number | null
          profile_id?: string | null
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
      get_user_company_id: {
        Args: { _user_id: string }
        Returns: string
      }
      is_super_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
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
