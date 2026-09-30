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
          kind: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash: string
          kind?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string
          kind?: string
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
      appointment_reminders: {
        Row: {
          appointment_id: string
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          error: string
          id: string
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
        }
        Insert: {
          appointment_id: string
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          error?: string
          id?: string
          recipient: string
          sent_at?: string | null
          status: Database["public"]["Enums"]["reminder_status"]
        }
        Update: {
          appointment_id?: string
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          error?: string
          id?: string
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
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
      consents: {
        Row: {
          birth_date: string
          created_at: string
          email: string | null
          first_name: string
          guardian_name: string
          id: string
          last_name: string
          link_method: Database["public"]["Enums"]["consent_link_method"] | null
          linked_at: string | null
          linked_by: string | null
          marketing: boolean
          media_for_training: boolean
          pdf_path: string
          person_id: string | null
          privacy_accepted: boolean
          search_text: string | null
          signed_at: string
          sources: string[]
          tax_id: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          email?: string | null
          first_name: string
          guardian_name?: string
          id?: string
          last_name: string
          link_method?:
            | Database["public"]["Enums"]["consent_link_method"]
            | null
          linked_at?: string | null
          linked_by?: string | null
          marketing: boolean
          media_for_training: boolean
          pdf_path: string
          person_id?: string | null
          privacy_accepted?: boolean
          search_text?: string | null
          signed_at: string
          sources?: string[]
          tax_id: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          email?: string | null
          first_name?: string
          guardian_name?: string
          id?: string
          last_name?: string
          link_method?:
            | Database["public"]["Enums"]["consent_link_method"]
            | null
          linked_at?: string | null
          linked_by?: string | null
          marketing?: boolean
          media_for_training?: boolean
          pdf_path?: string
          person_id?: string | null
          privacy_accepted?: boolean
          search_text?: string | null
          signed_at?: string
          sources?: string[]
          tax_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
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
      invoice_emails: {
        Row: {
          id: string
          invoice_id: string
          sent_at: string
          sent_by: string
          sent_to: string
        }
        Insert: {
          id?: string
          invoice_id: string
          sent_at?: string
          sent_by: string
          sent_to: string
        }
        Update: {
          id?: string
          invoice_id?: string
          sent_at?: string
          sent_by?: string
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_emails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_emails_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_records: {
        Row: {
          aeat_status: string | null
          canonical: string
          generated_at: string
          hash: string
          id: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_record_kind"]
          previous_hash: string
          sent_at: string | null
        }
        Insert: {
          aeat_status?: string | null
          canonical: string
          generated_at: string
          hash: string
          id?: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_record_kind"]
          previous_hash: string
          sent_at?: string | null
        }
        Update: {
          aeat_status?: string | null
          canonical?: string
          generated_at?: string
          hash?: string
          id?: string
          invoice_id?: string
          kind?: Database["public"]["Enums"]["invoice_record_kind"]
          previous_hash?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_series: {
        Row: {
          code: Database["public"]["Enums"]["invoice_series_code"]
          format: string
          locked: boolean
          next_number: number
          year: number
        }
        Insert: {
          code: Database["public"]["Enums"]["invoice_series_code"]
          format: string
          locked?: boolean
          next_number?: number
          year: number
        }
        Update: {
          code?: Database["public"]["Enums"]["invoice_series_code"]
          format?: string
          locked?: boolean
          next_number?: number
          year?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          code: string
          id: string
          issued_at: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          number: number
          payment_id: string
          reason: string
          rectifies_invoice_id: string | null
          replaces_invoice_id: string | null
          series: Database["public"]["Enums"]["invoice_series_code"]
          snapshot: Json
          status: Database["public"]["Enums"]["invoice_status"]
          total_cents: number
        }
        Insert: {
          code: string
          id?: string
          issued_at: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          number: number
          payment_id: string
          reason?: string
          rectifies_invoice_id?: string | null
          replaces_invoice_id?: string | null
          series: Database["public"]["Enums"]["invoice_series_code"]
          snapshot: Json
          status?: Database["public"]["Enums"]["invoice_status"]
          total_cents: number
        }
        Update: {
          code?: string
          id?: string
          issued_at?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          number?: number
          payment_id?: string
          reason?: string
          rectifies_invoice_id?: string | null
          replaces_invoice_id?: string | null
          series?: Database["public"]["Enums"]["invoice_series_code"]
          snapshot?: Json
          status?: Database["public"]["Enums"]["invoice_status"]
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_rectifies_invoice_id_fkey"
            columns: ["rectifies_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaces_invoice_id_fkey"
            columns: ["replaces_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string
          collected_at: string
          collected_by: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string
          vat: Database["public"]["Enums"]["vat_treatment"]
          void_reason: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_cents: number
          appointment_id: string
          collected_at?: string
          collected_by: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string
          vat: Database["public"]["Enums"]["vat_treatment"]
          void_reason?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_cents?: number
          appointment_id?: string
          collected_at?: string
          collected_by?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string
          vat?: Database["public"]["Enums"]["vat_treatment"]
          void_reason?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          calendar_token: string | null
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
          calendar_token?: string | null
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
          calendar_token?: string | null
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
      _free_slots: {
        Args: {
          p_from: string
          p_ignore_appointment: string
          p_professional_id: string
          p_service_id: string
          p_to: string
        }
        Returns: {
          professional_id: string
          starts_at: string
        }[]
      }
      add_my_person: {
        Args: {
          p_accept_privacy: boolean
          p_birth_date: string
          p_first_name: string
          p_guardian_id: string
          p_is_patient: boolean
          p_last_name: string
          p_phone: string
          p_privacy_version: string
          p_relationship: Database["public"]["Enums"]["guardian_relationship"]
        }
        Returns: string
      }
      agenda_busy: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ends_at: string
          professional_id: string
          starts_at: string
        }[]
      }
      append_invoice_record: {
        Args: { p_invoice_id: string; p_type: string }
        Returns: undefined
      }
      available_slots: {
        Args: {
          p_from: string
          p_professional_id: string
          p_service_id: string
          p_to: string
        }
        Returns: {
          professional_id: string
          starts_at: string
        }[]
      }
      book_appointment: {
        Args: {
          p_person_id: string
          p_professional_id: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: string
      }
      booking_catalog: {
        Args: never
        Returns: {
          bookable_online: boolean
          duration_minutes: number
          phone_only: boolean
          price_cents: number
          professionals: Json
          service_id: string
          service_name: string
          specialty_id: string
          specialty_name: string
        }[]
      }
      booking_horizon_days: { Args: never; Returns: number }
      calendar_feed: {
        Args: { p_token: string }
        Returns: {
          appointment_id: string
          ends_at: string
          starts_at: string
          summary: string
          updated_at: string
        }[]
      }
      calendar_owner: { Args: { p_token: string }; Returns: string }
      cancel_my_appointment: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      clinic_invoice_header: { Args: never; Returns: Json }
      collect_payment: {
        Args: {
          p_amount_cents: number
          p_appointment_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note: string
        }
        Returns: string
      }
      complete_my_birth_date: {
        Args: { p_birth_date: string; p_person_id: string }
        Returns: undefined
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
      format_invoice_code: {
        Args: { p_format: string; p_number: number; p_year: number }
        Returns: string
      }
      invoice_alta_canonical: {
        Args: {
          p_code: string
          p_generated_at: string
          p_issued_on: string
          p_issuer_tax_id: string
          p_previous_hash: string
          p_total_cents: number
          p_type: string
          p_vat_cents: number
        }
        Returns: string
      }
      invoice_detail: {
        Args: { p_invoice_id: string }
        Returns: {
          appointment_id: string
          code: string
          id: string
          issued_at: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          patient_id: string
          payment_id: string
          professional_id: string
          qr: Json
          reason: string
          related: Json
          snapshot: Json
          status: Database["public"]["Enums"]["invoice_status"]
          total_cents: number
        }[]
      }
      invoice_hash: { Args: { p_canonical: string }; Returns: string }
      is_active_staff: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_valid_spanish_tax_id: { Args: { p_value: string }; Returns: boolean }
      issue_full_invoice: {
        Args: { p_invoice_id: string; p_recipient: Json }
        Returns: string
      }
      issue_rectifying_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: string
      }
      issue_simplified_invoice: {
        Args: { p_payment_id: string }
        Returns: string
      }
      link_consent: {
        Args: { p_consent_id: string; p_person_id: string }
        Returns: undefined
      }
      list_invoices: {
        Args: {
          p_end?: string
          p_kind?: Database["public"]["Enums"]["invoice_kind"]
          p_limit?: number
          p_offset?: number
          p_patient_id?: string
          p_professional_id?: string
          p_query?: string
          p_start?: string
        }
        Returns: {
          code: string
          id: string
          issued_at: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          patient_id: string
          patient_name: string
          payment_id: string
          professional_id: string
          recipient_name: string
          rectified_by_code: string
          replaced_by_code: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_cents: number
          total_count: number
        }[]
      }
      list_payments: {
        Args: { p_end: string; p_professional_id?: string; p_start: string }
        Returns: {
          amount_cents: number
          collected_at: string
          collected_by: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          patient_id: string
          patient_name: string
          professional_id: string
          service_name: string
          void_reason: string
          voided_at: string
        }[]
      }
      match_consent_person: {
        Args: {
          p_birth_date: string
          p_email: string
          p_first_name: string
          p_tax_id: string
        }
        Returns: {
          method: Database["public"]["Enums"]["consent_link_method"]
          person_id: string
        }[]
      }
      my_appointments: {
        Args: never
        Returns: {
          can_change: boolean
          can_reschedule: boolean
          cancelled_by: Database["public"]["Enums"]["appointment_canceller"]
          change_deadline: string
          ends_at: string
          id: string
          origin: Database["public"]["Enums"]["appointment_origin"]
          person_id: string
          person_name: string
          professional_id: string
          professional_name: string
          service_id: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      my_calendar_token: { Args: never; Returns: string }
      my_contact: {
        Args: { p_person_id: string }
        Returns: {
          address: string
          phone: string
        }[]
      }
      my_people: {
        Args: never
        Returns: {
          birth_date: string
          first_name: string
          id: string
          is_minor: boolean
          is_patient: boolean
          last_name: string
          relation: string
        }[]
      }
      my_privacy_accepted: { Args: never; Returns: boolean }
      my_reschedule_slots: {
        Args: { p_appointment_id: string; p_from: string; p_to: string }
        Returns: {
          professional_id: string
          starts_at: string
        }[]
      }
      next_invoice_number: {
        Args: {
          p_issued_at: string
          p_series: Database["public"]["Enums"]["invoice_series_code"]
        }
        Returns: {
          invoice_code: string
          invoice_number: number
        }[]
      }
      normalize_phone: { Args: { value: string }; Returns: string }
      payment_totals: {
        Args: { p_end: string; p_professional_id?: string; p_start: string }
        Returns: {
          cents: number
          method: Database["public"]["Enums"]["payment_method"]
        }[]
      }
      pending_payments: {
        Args: { p_since: string }
        Returns: {
          appointment_id: string
          patient_id: string
          patient_name: string
          professional_id: string
          service_name: string
          starts_at: string
          suggested_cents: number
        }[]
      }
      record_invoice_email: {
        Args: { p_email: string; p_invoice_id: string }
        Returns: string
      }
      regenerate_my_calendar_token: { Args: never; Returns: string }
      reminder_candidates: {
        Args: { p_day: string }
        Returns: {
          appointment_id: string
          can_change: boolean
          change_deadline: string
          ends_at: string
          person_name: string
          professional_name: string
          recipients: string[]
          service_name: string
          starts_at: string
        }[]
      }
      reschedule_my_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string }
        Returns: string
      }
      revoke_calendar_token: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
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
      suggested_amount: { Args: { p_appointment_id: string }; Returns: number }
      unlink_consent: { Args: { p_consent_id: string }; Returns: undefined }
      update_my_contact: {
        Args: { p_address: string; p_person_id: string; p_phone: string }
        Returns: undefined
      }
      void_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
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
      consent_link_method:
        | "auto_tax_id"
        | "auto_guardian"
        | "auto_email"
        | "manual"
      guardian_relationship: "madre" | "padre" | "tutor_legal" | "otro"
      invoice_kind: "simplified" | "full" | "rectifying"
      invoice_record_kind: "alta" | "anulacion"
      invoice_series_code: "main" | "rectifying"
      invoice_status: "issued" | "replaced"
      payment_method: "cash" | "card" | "bizum" | "transfer"
      payment_status: "not_required" | "pending" | "paid" | "refunded"
      reminder_channel: "email" | "sms"
      reminder_status: "pending" | "sent" | "failed"
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
      consent_link_method: [
        "auto_tax_id",
        "auto_guardian",
        "auto_email",
        "manual",
      ],
      guardian_relationship: ["madre", "padre", "tutor_legal", "otro"],
      invoice_kind: ["simplified", "full", "rectifying"],
      invoice_record_kind: ["alta", "anulacion"],
      invoice_series_code: ["main", "rectifying"],
      invoice_status: ["issued", "replaced"],
      payment_method: ["cash", "card", "bizum", "transfer"],
      payment_status: ["not_required", "pending", "paid", "refunded"],
      reminder_channel: ["email", "sms"],
      reminder_status: ["pending", "sent", "failed"],
      user_role: ["owner", "employee"],
      vat_treatment: ["exempt", "standard_21"],
    },
  },
} as const

