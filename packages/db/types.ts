export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      appointment_events: {
        Row: {
          actor_id: string | null
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          appointment_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_event_kind"]
          previous_ends_at: string | null
          previous_starts_at: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          appointment_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["appointment_event_kind"]
          previous_ends_at?: string | null
          previous_starts_at?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          appointment_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_event_kind"]
          previous_ends_at?: string | null
          previous_starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          booked_by_account: string | null
          cancel_reason: string
          cancelled_at: string | null
          cancelled_by:
            | Database["public"]["Enums"]["appointment_canceller"]
            | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          modality: Database["public"]["Enums"]["appointment_modality"]
          notes: string
          origin: Database["public"]["Enums"]["appointment_origin"]
          patient_id: string
          payment_amount_cents: number
          payment_required: Database["public"]["Enums"]["booking_payment"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          price_cents: number
          professional_id: string
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          vat: Database["public"]["Enums"]["vat_treatment"]
        }
        Insert: {
          booked_by_account?: string | null
          cancel_reason?: string
          cancelled_at?: string | null
          cancelled_by?:
            | Database["public"]["Enums"]["appointment_canceller"]
            | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          modality?: Database["public"]["Enums"]["appointment_modality"]
          notes?: string
          origin?: Database["public"]["Enums"]["appointment_origin"]
          patient_id: string
          payment_amount_cents?: number
          payment_required?: Database["public"]["Enums"]["booking_payment"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_cents?: number
          professional_id: string
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vat?: Database["public"]["Enums"]["vat_treatment"]
        }
        Update: {
          booked_by_account?: string | null
          cancel_reason?: string
          cancelled_at?: string | null
          cancelled_by?:
            | Database["public"]["Enums"]["appointment_canceller"]
            | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          modality?: Database["public"]["Enums"]["appointment_modality"]
          notes?: string
          origin?: Database["public"]["Enums"]["appointment_origin"]
          patient_id?: string
          payment_amount_cents?: number
          payment_required?: Database["public"]["Enums"]["booking_payment"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_cents?: number
          professional_id?: string
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vat?: Database["public"]["Enums"]["vat_treatment"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          address_line: string
          booking_horizon_days: number
          booking_min_notice_hours: number
          cancellation_hours: number
          city: string
          email: string
          id: boolean
          invoice_footer: string
          invoice_prefix: string
          legal_name: string
          logo_path: string | null
          online_payments_enabled: boolean
          phone: string
          postal_code: string
          province: string
          rectifying_prefix: string
          tax_id: string
          timezone: string
          updated_at: string
          vat_exemption_text: string
          website: string
        }
        Insert: {
          address_line?: string
          booking_horizon_days?: number
          booking_min_notice_hours?: number
          cancellation_hours?: number
          city?: string
          email?: string
          id?: boolean
          invoice_footer?: string
          invoice_prefix?: string
          legal_name?: string
          logo_path?: string | null
          online_payments_enabled?: boolean
          phone?: string
          postal_code?: string
          province?: string
          rectifying_prefix?: string
          tax_id?: string
          timezone?: string
          updated_at?: string
          vat_exemption_text?: string
          website?: string
        }
        Update: {
          address_line?: string
          booking_horizon_days?: number
          booking_min_notice_hours?: number
          cancellation_hours?: number
          city?: string
          email?: string
          id?: boolean
          invoice_footer?: string
          invoice_prefix?: string
          legal_name?: string
          logo_path?: string | null
          online_payments_enabled?: boolean
          phone?: string
          postal_code?: string
          province?: string
          rectifying_prefix?: string
          tax_id?: string
          timezone?: string
          updated_at?: string
          vat_exemption_text?: string
          website?: string
        }
        Relationships: []
      }
      employee_schedules: {
        Row: {
          ends_at: string
          id: string
          profile_id: string
          starts_at: string
          weekday: number
        }
        Insert: {
          ends_at: string
          id?: string
          profile_id: string
          starts_at: string
          weekday: number
        }
        Update: {
          ends_at?: string
          id?: string
          profile_id?: string
          starts_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_off: {
        Row: {
          ends_at: string
          id: string
          profile_id: string
          reason: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          profile_id: string
          reason?: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          profile_id?: string
          reason?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_off_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardianships: {
        Row: {
          created_at: string
          guardian_id: string
          is_primary: boolean
          minor_id: string
          relationship: Database["public"]["Enums"]["guardian_relationship"]
        }
        Insert: {
          created_at?: string
          guardian_id: string
          is_primary?: boolean
          minor_id: string
          relationship: Database["public"]["Enums"]["guardian_relationship"]
        }
        Update: {
          created_at?: string
          guardian_id?: string
          is_primary?: boolean
          minor_id?: string
          relationship?: Database["public"]["Enums"]["guardian_relationship"]
        }
        Relationships: [
          {
            foreignKeyName: "guardianships_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardianships_minor_id_fkey"
            columns: ["minor_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          privacy_accepted_at: string | null
          privacy_version: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          address: string
          admin_notes: string
          archived_at: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          is_patient: boolean
          last_name: string
          phone: string | null
          search_text: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          admin_notes?: string
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_patient?: boolean
          last_name: string
          phone?: string | null
          search_text?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          admin_notes?: string
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_patient?: boolean
          last_name?: string
          phone?: string | null
          search_text?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          license_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          specialty_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          license_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          specialty_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          specialty_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          bookable_online: boolean
          booking_payment: Database["public"]["Enums"]["booking_payment"]
          booking_payment_value: number
          cancellation_hours: number | null
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          specialty_id: string
          updated_at: string
          vat: Database["public"]["Enums"]["vat_treatment"]
        }
        Insert: {
          bookable_online?: boolean
          booking_payment?: Database["public"]["Enums"]["booking_payment"]
          booking_payment_value?: number
          cancellation_hours?: number | null
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          specialty_id: string
          updated_at?: string
          vat?: Database["public"]["Enums"]["vat_treatment"]
        }
        Update: {
          bookable_online?: boolean
          booking_payment?: Database["public"]["Enums"]["booking_payment"]
          booking_payment_value?: number
          cancellation_hours?: number | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          specialty_id?: string
          updated_at?: string
          vat?: Database["public"]["Enums"]["vat_treatment"]
        }
        Relationships: [
          {
            foreignKeyName: "services_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agenda_busy: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ends_at: string
          professional_id: string
          starts_at: string
        }[]
      }
      f_unaccent: { Args: { value: string }; Returns: string }
      find_possible_duplicates: {
        Args: {
          p_email: string
          p_exclude?: string
          p_phone: string
          p_tax_id: string
        }
        Returns: {
          first_name: string
          id: string
          last_name: string
          matched: string[]
          wards: Json
        }[]
      }
      is_active_staff: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      normalize_phone: { Args: { value: string }; Returns: string }
      revoke_user_sessions: { Args: { target: string }; Returns: undefined }
      set_employee_schedule: {
        Args: { blocks: Json; target: string }
        Returns: undefined
      }
      staff_directory: {
        Args: never
        Returns: {
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          specialty_id: string
        }[]
      }
    }
    Enums: {
      actor_kind: "staff" | "patient"
      appointment_canceller: "patient" | "clinic"
      appointment_event_kind:
        | "created"
        | "moved"
        | "cancelled"
        | "no_show"
        | "restored"
      appointment_modality: "in_person" | "online"
      appointment_origin: "staff" | "web"
      appointment_status: "scheduled" | "cancelled" | "no_show"
      booking_payment: "none" | "fixed" | "percent" | "full"
      guardian_relationship: "madre" | "padre" | "tutor_legal" | "otro"
      payment_status: "not_required" | "pending" | "paid" | "refunded"
      user_role: "owner" | "employee"
      vat_treatment: "exempt" | "standard_21"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_kind: ["staff", "patient"],
      appointment_canceller: ["patient", "clinic"],
      appointment_event_kind: [
        "created",
        "moved",
        "cancelled",
        "no_show",
        "restored",
      ],
      appointment_modality: ["in_person", "online"],
      appointment_origin: ["staff", "web"],
      appointment_status: ["scheduled", "cancelled", "no_show"],
      booking_payment: ["none", "fixed", "percent", "full"],
      guardian_relationship: ["madre", "padre", "tutor_legal", "otro"],
      payment_status: ["not_required", "pending", "paid", "refunded"],
      user_role: ["owner", "employee"],
      vat_treatment: ["exempt", "standard_21"],
    },
  },
} as const

