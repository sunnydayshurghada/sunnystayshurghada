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
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      amenities: {
        Row: {
          category: string | null
          created_at: string
          id: string
          key: string
          label: Json
          property_id: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          key: string
          label?: Json
          property_id: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          key?: string
          label?: Json
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          auto_confirm_direct_bookings: boolean
          cleaning_fee: number
          currency: string
          deposit_fixed_amount: number
          deposit_percent: number
          hold_minutes: number
          id: boolean
          nightly_rate: number
          payment_mode: string
          payments_enabled: boolean
          updated_at: string
        }
        Insert: {
          auto_confirm_direct_bookings?: boolean
          cleaning_fee?: number
          currency?: string
          deposit_fixed_amount?: number
          deposit_percent?: number
          hold_minutes?: number
          id?: boolean
          nightly_rate?: number
          payment_mode?: string
          payments_enabled?: boolean
          updated_at?: string
        }
        Update: {
          auto_confirm_direct_bookings?: boolean
          cleaning_fee?: number
          currency?: string
          deposit_fixed_amount?: number
          deposit_percent?: number
          hold_minutes?: number
          id?: boolean
          nightly_rate?: number
          payment_mode?: string
          payments_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount_paid: number
          booking_number: string | null
          booking_status: string
          booking_type: string
          cancelled_at: string | null
          checkin: string
          checkout: string
          cleaning_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          deposit_amount: number
          discount_amount: number
          guest_email: string
          guest_name: string
          guest_phone: string | null
          guests: number
          id: string
          message: string | null
          nightly_total: number
          payment_expires_at: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          payment_transaction_id: string | null
          price_snapshot: Json | null
          property_id: string
          refunded_at: string | null
          source: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          booking_number?: string | null
          booking_status?: string
          booking_type?: string
          cancelled_at?: string | null
          checkin: string
          checkout: string
          cleaning_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          deposit_amount?: number
          discount_amount?: number
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          guests?: number
          id?: string
          message?: string | null
          nightly_total?: number
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_transaction_id?: string | null
          price_snapshot?: Json | null
          property_id?: string
          refunded_at?: string | null
          source?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          booking_number?: string | null
          booking_status?: string
          booking_type?: string
          cancelled_at?: string | null
          checkin?: string
          checkout?: string
          cleaning_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          deposit_amount?: number
          discount_amount?: number
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          guests?: number
          id?: string
          message?: string | null
          nightly_total?: number
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_transaction_id?: string | null
          price_snapshot?: Json | null
          property_id?: string
          refunded_at?: string | null
          source?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          entry_type: string
          external_uid: string | null
          guest_name: string | null
          guest_phone: string | null
          guests: number | null
          id: string
          last_seen_at: string | null
          note: string | null
          property_id: string
          source: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          entry_type?: string
          external_uid?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number | null
          id?: string
          last_seen_at?: string | null
          note?: string | null
          property_id?: string
          source?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          entry_type?: string
          external_uid?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number | null
          id?: string
          last_seen_at?: string | null
          note?: string | null
          property_id?: string
          source?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_integrations: {
        Row: {
          airbnb_ical_url: string | null
          created_at: string
          export_token: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_imported: number
          last_sync_status: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          airbnb_ical_url?: string | null
          created_at?: string
          export_token?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_imported?: number
          last_sync_status?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          airbnb_ical_url?: string | null
          created_at?: string
          export_token?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_imported?: number
          last_sync_status?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_prices: {
        Row: {
          created_at: string
          date: string
          id: string
          minimum_nights: number | null
          price: number
          property_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          minimum_nights?: number | null
          price: number
          property_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          minimum_nights?: number | null
          price?: number
          property_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_prices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          error: string | null
          id: string
          property_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          property_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          property_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_settings: {
        Row: {
          airbnb_ical_url: string | null
          cron_secret: string
          export_token: string
          id: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_imported: number
          last_sync_status: string | null
          updated_at: string
        }
        Insert: {
          airbnb_ical_url?: string | null
          cron_secret?: string
          export_token?: string
          id?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_imported?: number
          last_sync_status?: string | null
          updated_at?: string
        }
        Update: {
          airbnb_ical_url?: string | null
          cron_secret?: string
          export_token?: string
          id?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_imported?: number
          last_sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ical_sync_log: {
        Row: {
          id: string
          imported: number
          message: string | null
          property_id: string | null
          ran_at: string
          removed: number
          status: string
          trigger_source: string
        }
        Insert: {
          id?: string
          imported?: number
          message?: string | null
          property_id?: string | null
          ran_at?: string
          removed?: number
          status: string
          trigger_source?: string
        }
        Update: {
          id?: string
          imported?: number
          message?: string | null
          property_id?: string | null
          ran_at?: string
          removed?: number
          status?: string
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_sync_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          method: string | null
          property_id: string | null
          provider: string
          provider_transaction_id: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          property_id?: string | null
          provider: string
          provider_transaction_id?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          property_id?: string | null
          provider?: string
          provider_transaction_id?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          created_at: string
          end_date: string | null
          id: string
          minimum_nights: number | null
          name: string
          percent_adjustment: number | null
          price: number | null
          priority: number
          property_id: string
          rule_type: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          minimum_nights?: number | null
          name: string
          percent_adjustment?: number | null
          price?: number | null
          priority?: number
          property_id: string
          rule_type?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          minimum_nights?: number | null
          name?: string
          percent_adjustment?: number | null
          price?: number | null
          priority?: number
          property_id?: string
          rule_type?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          area: string | null
          base_price: number
          bathrooms: number
          bedrooms: number
          beds: number
          check_in_time: string
          check_out_time: string
          cleaning_fee: number
          created_at: string
          currency: string
          direct_booking_enabled: boolean
          full_description: string | null
          id: string
          instant_booking_enabled: boolean
          internal_name: string
          max_price: number
          maximum_guests: number
          maximum_nights: number
          min_price: number
          minimum_nights: number
          pricing_integration: string | null
          pricing_integration_ref: string | null
          public_name: string
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          translations: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          base_price?: number
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_time?: string
          check_out_time?: string
          cleaning_fee?: number
          created_at?: string
          currency?: string
          direct_booking_enabled?: boolean
          full_description?: string | null
          id?: string
          instant_booking_enabled?: boolean
          internal_name: string
          max_price?: number
          maximum_guests?: number
          maximum_nights?: number
          min_price?: number
          minimum_nights?: number
          pricing_integration?: string | null
          pricing_integration_ref?: string | null
          public_name: string
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          base_price?: number
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_time?: string
          check_out_time?: string
          cleaning_fee?: number
          created_at?: string
          currency?: string
          direct_booking_enabled?: boolean
          full_description?: string | null
          id?: string
          instant_booking_enabled?: boolean
          internal_name?: string
          max_price?: number
          maximum_guests?: number
          maximum_nights?: number
          min_price?: number
          minimum_nights?: number
          pricing_integration?: string | null
          pricing_integration_ref?: string | null
          public_name?: string
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: []
      }
      property_images: {
        Row: {
          alt_text: Json
          created_at: string
          id: string
          is_cover: boolean
          property_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt_text?: Json
          created_at?: string
          id?: string
          is_cover?: boolean
          property_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt_text?: Json
          created_at?: string
          id?: string
          is_cover?: boolean
          property_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      booked_ranges: {
        Row: {
          checkin: string | null
          checkout: string | null
        }
        Insert: {
          checkin?: string | null
          checkout?: string | null
        }
        Update: {
          checkin?: string | null
          checkout?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_confirm_booking: { Args: { _id: string }; Returns: string }
      admin_set_booking_status: {
        Args: { _id: string; _status: string }
        Returns: string
      }
      check_availability: {
        Args: { _checkin: string; _checkout: string }
        Returns: boolean
      }
      check_property_availability: {
        Args: { _checkin: string; _checkout: string; _property_id: string }
        Returns: boolean
      }
      claim_admin_role: { Args: never; Returns: boolean }
      create_booking_request: {
        Args: {
          _checkin: string
          _checkout: string
          _guest_email: string
          _guest_name: string
          _guest_phone: string
          _guests: number
          _message: string
        }
        Returns: string
      }
      create_property_booking_request: {
        Args: {
          _checkin: string
          _checkout: string
          _guest_email: string
          _guest_name: string
          _guest_phone: string
          _guests: number
          _message: string
          _property_id: string
        }
        Returns: string
      }
      default_property_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      public_blocked_ranges: {
        Args: never
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      public_blocked_ranges_for: {
        Args: { _property_id: string }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      release_expired_holds: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
