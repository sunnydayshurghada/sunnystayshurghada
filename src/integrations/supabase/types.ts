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
      booking_financial_items: {
        Row: {
          amount: number
          booking_id: string | null
          charged_to: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          direction: string
          exchange_rate: number | null
          exchange_rate_at: string | null
          id: string
          immutable_snapshot: boolean
          item_type: string
          property_id: string
          reason: string | null
          source: string
          source_amount: number | null
          source_currency: string | null
          statement_id: string | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          charged_to?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          direction?: string
          exchange_rate?: number | null
          exchange_rate_at?: string | null
          id?: string
          immutable_snapshot?: boolean
          item_type: string
          property_id: string
          reason?: string | null
          source?: string
          source_amount?: number | null
          source_currency?: string | null
          statement_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          charged_to?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          direction?: string
          exchange_rate?: number | null
          exchange_rate_at?: string | null
          id?: string
          immutable_snapshot?: boolean
          item_type?: string
          property_id?: string
          reason?: string | null
          source?: string
          source_amount?: number | null
          source_currency?: string | null
          statement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_financial_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_financial_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_service_items: {
        Row: {
          actual_cost: number | null
          booking_id: string
          completed_at: string | null
          completed_by: string | null
          cost_bearer: string
          created_at: string
          currency: string
          description_snapshot: string
          id: string
          included_in_management_fee: boolean
          notes: string | null
          property_id: string
          quantity: number
          receipt_url: string | null
          service_id: string | null
          status: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          booking_id: string
          completed_at?: string | null
          completed_by?: string | null
          cost_bearer?: string
          created_at?: string
          currency?: string
          description_snapshot?: string
          id?: string
          included_in_management_fee?: boolean
          notes?: string | null
          property_id: string
          quantity?: number
          receipt_url?: string | null
          service_id?: string | null
          status?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          booking_id?: string
          completed_at?: string | null
          completed_by?: string | null
          cost_bearer?: string
          created_at?: string
          currency?: string
          description_snapshot?: string
          id?: string
          included_in_management_fee?: boolean
          notes?: string | null
          property_id?: string
          quantity?: number
          receipt_url?: string | null
          service_id?: string | null
          status?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_service_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
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
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checkin: string
          checkout: string
          cleaning_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          deposit_amount: number
          discount_amount: number
          financial_snapshot: Json | null
          guest_email: string
          guest_language: string
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
          refund_amount: number
          refund_status: string
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checkin: string
          checkout: string
          cleaning_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          deposit_amount?: number
          discount_amount?: number
          financial_snapshot?: Json | null
          guest_email: string
          guest_language?: string
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
          refund_amount?: number
          refund_status?: string
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checkin?: string
          checkout?: string
          cleaning_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          deposit_amount?: number
          discount_amount?: number
          financial_snapshot?: Json | null
          guest_email?: string
          guest_language?: string
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
          refund_amount?: number
          refund_status?: string
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
      cost_receipts: {
        Row: {
          amount: number | null
          booking_id: string | null
          created_at: string
          currency: string
          file_name: string
          file_path: string
          id: string
          note: string | null
          property_id: string
          receipt_type: string
          service_item_id: string | null
          statement_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string
          file_name?: string
          file_path: string
          id?: string
          note?: string | null
          property_id: string
          receipt_type?: string
          service_item_id?: string | null
          statement_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string
          file_name?: string
          file_path?: string
          id?: string
          note?: string | null
          property_id?: string
          receipt_type?: string
          service_item_id?: string | null
          statement_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_receipts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_receipts_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "booking_service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_receipts_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_prices: {
        Row: {
          calculated_price: number | null
          created_at: string
          currency: string
          date: string
          final_price: number | null
          id: string
          manual_override: boolean
          minimum_nights: number | null
          override_expires_at: string | null
          override_reason: string | null
          price: number
          price_source: string
          pricelabs_price: number | null
          property_id: string
          provider_updated_at: string | null
          source: string
          updated_at: string
        }
        Insert: {
          calculated_price?: number | null
          created_at?: string
          currency?: string
          date: string
          final_price?: number | null
          id?: string
          manual_override?: boolean
          minimum_nights?: number | null
          override_expires_at?: string | null
          override_reason?: string | null
          price: number
          price_source?: string
          pricelabs_price?: number | null
          property_id: string
          provider_updated_at?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          calculated_price?: number | null
          created_at?: string
          currency?: string
          date?: string
          final_price?: number | null
          id?: string
          manual_override?: boolean
          minimum_nights?: number | null
          override_expires_at?: string | null
          override_reason?: string | null
          price?: number
          price_source?: string
          pricelabs_price?: number | null
          property_id?: string
          provider_updated_at?: string | null
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
          attempts: number
          booking_id: string | null
          created_at: string
          error: string | null
          id: string
          language: string | null
          last_attempt_at: string | null
          message_id: string | null
          property_id: string | null
          recipient: string
          recipient_type: string
          sent_at: string | null
          status: string
          subject: string | null
          template: string
        }
        Insert: {
          attempts?: number
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          message_id?: string | null
          property_id?: string | null
          recipient: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
        }
        Update: {
          attempts?: number
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          message_id?: string | null
          property_id?: string | null
          recipient?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
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
      email_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          language: string
          property_id: string | null
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          language?: string
          property_id?: string | null
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          language?: string
          property_id?: string | null
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_property_id_fkey"
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
      owner_financial_questions: {
        Row: {
          answer: string | null
          booking_id: string | null
          created_at: string
          id: string
          message: string
          owner_user_id: string | null
          property_id: string | null
          statement_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          message: string
          owner_user_id?: string | null
          property_id?: string | null
          statement_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          message?: string
          owner_user_id?: string | null
          property_id?: string | null
          statement_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_financial_questions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_financial_questions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_financial_questions_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_payouts: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          internal_note: string | null
          method: string | null
          owner_user_id: string | null
          paid_on: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          receipt_url: string | null
          statement_id: string | null
          status: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          internal_note?: string | null
          method?: string | null
          owner_user_id?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string | null
          receipt_url?: string | null
          statement_id?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          internal_note?: string | null
          method?: string | null
          owner_user_id?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string | null
          receipt_url?: string | null
          statement_id?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_payouts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payouts_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_statements: {
        Row: {
          adjustments: number
          breakdown: Json
          created_at: string
          currency: string
          finalized_at: string | null
          gross_booking_revenue: number
          guest_fees: number
          id: string
          management_fees: number
          owner_net_amount: number
          owner_user_id: string | null
          paid_at: string | null
          paid_out_amount: number
          payment_fees: number
          period_end: string
          period_start: string
          platform_fees: number
          property_id: string | null
          refunds: number
          service_costs: number
          status: string
          updated_at: string
        }
        Insert: {
          adjustments?: number
          breakdown?: Json
          created_at?: string
          currency?: string
          finalized_at?: string | null
          gross_booking_revenue?: number
          guest_fees?: number
          id?: string
          management_fees?: number
          owner_net_amount?: number
          owner_user_id?: string | null
          paid_at?: string | null
          paid_out_amount?: number
          payment_fees?: number
          period_end: string
          period_start: string
          platform_fees?: number
          property_id?: string | null
          refunds?: number
          service_costs?: number
          status?: string
          updated_at?: string
        }
        Update: {
          adjustments?: number
          breakdown?: Json
          created_at?: string
          currency?: string
          finalized_at?: string | null
          gross_booking_revenue?: number
          guest_fees?: number
          id?: string
          management_fees?: number
          owner_net_amount?: number
          owner_user_id?: string | null
          paid_at?: string | null
          paid_out_amount?: number
          payment_fees?: number
          period_end?: string
          period_start?: string
          platform_fees?: number
          property_id?: string | null
          refunds?: number
          service_costs?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_statements_property_id_fkey"
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
      pricing_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          property_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          property_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_audit_log_property_id_fkey"
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
          adjustment_type: string
          adjustment_value: number
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
          adjustment_type?: string
          adjustment_value?: number
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
          adjustment_type?: string
          adjustment_value?: number
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
          arrival_instructions: string | null
          base_price: number
          bathrooms: number
          bedrooms: number
          beds: number
          check_in_time: string
          check_out_time: string
          cleaning_fee: number
          created_at: string
          currency: string
          departure_instructions: string | null
          direct_booking_enabled: boolean
          email_from_name: string | null
          email_signature: string | null
          full_description: string | null
          host_contact: string | null
          house_rules: string | null
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
          arrival_instructions?: string | null
          base_price?: number
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_time?: string
          check_out_time?: string
          cleaning_fee?: number
          created_at?: string
          currency?: string
          departure_instructions?: string | null
          direct_booking_enabled?: boolean
          email_from_name?: string | null
          email_signature?: string | null
          full_description?: string | null
          host_contact?: string | null
          house_rules?: string | null
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
          arrival_instructions?: string | null
          base_price?: number
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_time?: string
          check_out_time?: string
          cleaning_fee?: number
          created_at?: string
          currency?: string
          departure_instructions?: string | null
          direct_booking_enabled?: boolean
          email_from_name?: string | null
          email_signature?: string | null
          full_description?: string | null
          host_contact?: string | null
          house_rules?: string | null
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
      property_financial_settings: {
        Row: {
          cleaning_belongs_to_owner: boolean
          commission_fixed: number
          commission_percent: number
          created_at: string
          payment_fee_percent: number
          property_id: string
          updated_at: string
        }
        Insert: {
          cleaning_belongs_to_owner?: boolean
          commission_fixed?: number
          commission_percent?: number
          created_at?: string
          payment_fee_percent?: number
          property_id: string
          updated_at?: string
        }
        Update: {
          cleaning_belongs_to_owner?: boolean
          commission_fixed?: number
          commission_percent?: number
          created_at?: string
          payment_fee_percent?: number
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_financial_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      property_management_agreements: {
        Row: {
          active: boolean
          calculation_basis: string
          created_at: string
          currency: string
          fee_type: string
          fixed_fee: number
          id: string
          minimum_fee: number
          notes: string | null
          percentage_rate: number
          property_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          calculation_basis?: string
          created_at?: string
          currency?: string
          fee_type?: string
          fixed_fee?: number
          id?: string
          minimum_fee?: number
          notes?: string | null
          percentage_rate?: number
          property_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          calculation_basis?: string
          created_at?: string
          currency?: string
          fee_type?: string
          fixed_fee?: number
          id?: string
          minimum_fee?: number
          notes?: string | null
          percentage_rate?: number
          property_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_management_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_notification_recipients: {
        Row: {
          active: boolean
          created_at: string
          id: string
          property_id: string
          receive_booking_changes: boolean
          receive_calendar_errors: boolean
          receive_cancellations: boolean
          receive_confirmed_bookings: boolean
          receive_new_inquiries: boolean
          receive_payments: boolean
          recipient_email: string
          recipient_name: string
          recipient_role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          property_id: string
          receive_booking_changes?: boolean
          receive_calendar_errors?: boolean
          receive_cancellations?: boolean
          receive_confirmed_bookings?: boolean
          receive_new_inquiries?: boolean
          receive_payments?: boolean
          recipient_email: string
          recipient_name: string
          recipient_role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          property_id?: string
          receive_booking_changes?: boolean
          receive_calendar_errors?: boolean
          receive_cancellations?: boolean
          receive_confirmed_bookings?: boolean
          receive_new_inquiries?: boolean
          receive_payments?: boolean
          recipient_email?: string
          recipient_name?: string
          recipient_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_notification_recipients_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_pricing_settings: {
        Row: {
          base_price: number
          cleaning_fee: number
          created_at: string
          currency: string
          direct_booking_adjustment_fixed: number
          direct_booking_adjustment_percent: number
          extra_guest_after: number
          extra_guest_fee: number
          id: string
          last_minute_days: number | null
          last_minute_discount_percent: number
          length_of_stay_discount_percent: number
          length_of_stay_nights: number | null
          maximum_price: number
          minimum_price: number
          minimum_stay: number
          monthly_discount_percent: number
          pricelabs_enabled: boolean
          pricelabs_last_sync_at: string | null
          pricelabs_listing_id: string | null
          pricelabs_sync_error: string | null
          pricelabs_sync_status: string | null
          pricing_mode: string
          property_id: string
          updated_at: string
          weekend_price: number | null
          weekly_discount_percent: number
        }
        Insert: {
          base_price?: number
          cleaning_fee?: number
          created_at?: string
          currency?: string
          direct_booking_adjustment_fixed?: number
          direct_booking_adjustment_percent?: number
          extra_guest_after?: number
          extra_guest_fee?: number
          id?: string
          last_minute_days?: number | null
          last_minute_discount_percent?: number
          length_of_stay_discount_percent?: number
          length_of_stay_nights?: number | null
          maximum_price?: number
          minimum_price?: number
          minimum_stay?: number
          monthly_discount_percent?: number
          pricelabs_enabled?: boolean
          pricelabs_last_sync_at?: string | null
          pricelabs_listing_id?: string | null
          pricelabs_sync_error?: string | null
          pricelabs_sync_status?: string | null
          pricing_mode?: string
          property_id: string
          updated_at?: string
          weekend_price?: number | null
          weekly_discount_percent?: number
        }
        Update: {
          base_price?: number
          cleaning_fee?: number
          created_at?: string
          currency?: string
          direct_booking_adjustment_fixed?: number
          direct_booking_adjustment_percent?: number
          extra_guest_after?: number
          extra_guest_fee?: number
          id?: string
          last_minute_days?: number | null
          last_minute_discount_percent?: number
          length_of_stay_discount_percent?: number
          length_of_stay_nights?: number | null
          maximum_price?: number
          minimum_price?: number
          minimum_stay?: number
          monthly_discount_percent?: number
          pricelabs_enabled?: boolean
          pricelabs_last_sync_at?: string | null
          pricelabs_listing_id?: string | null
          pricelabs_sync_error?: string | null
          pricelabs_sync_status?: string | null
          pricing_mode?: string
          property_id?: string
          updated_at?: string
          weekend_price?: number | null
          weekly_discount_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_pricing_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_service_agreements: {
        Row: {
          active: boolean
          automatic_charge: boolean
          calculation_type: string
          cost_bearer: string
          created_at: string
          currency: string
          custom_price: number | null
          id: string
          included_in_management_fee: boolean
          notes: string | null
          property_id: string
          provided_by_sunny_stays: boolean
          service_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          visible_to_guest: boolean
          visible_to_owner: boolean
        }
        Insert: {
          active?: boolean
          automatic_charge?: boolean
          calculation_type?: string
          cost_bearer?: string
          created_at?: string
          currency?: string
          custom_price?: number | null
          id?: string
          included_in_management_fee?: boolean
          notes?: string | null
          property_id: string
          provided_by_sunny_stays?: boolean
          service_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          visible_to_guest?: boolean
          visible_to_owner?: boolean
        }
        Update: {
          active?: boolean
          automatic_charge?: boolean
          calculation_type?: string
          cost_bearer?: string
          created_at?: string
          currency?: string
          custom_price?: number | null
          id?: string
          included_in_management_fee?: boolean
          notes?: string | null
          property_id?: string
          provided_by_sunny_stays?: boolean
          service_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          visible_to_guest?: boolean
          visible_to_owner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "property_service_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_service_agreements_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      property_user_assignments: {
        Row: {
          active: boolean
          assignment_role: string
          can_create_calendar_blocks: boolean
          can_download_statements: boolean
          can_manage_prices: boolean
          can_receive_notifications: boolean
          can_submit_financial_question: boolean
          can_view_bookings: boolean
          can_view_calendar: boolean
          can_view_financials: boolean
          can_view_guest_contact_data: boolean
          can_view_owner_statements: boolean
          can_view_payments: boolean
          can_view_receipts: boolean
          can_view_service_agreement: boolean
          can_view_service_costs: boolean
          created_at: string
          id: string
          ownership_share_percent: number | null
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          assignment_role?: string
          can_create_calendar_blocks?: boolean
          can_download_statements?: boolean
          can_manage_prices?: boolean
          can_receive_notifications?: boolean
          can_submit_financial_question?: boolean
          can_view_bookings?: boolean
          can_view_calendar?: boolean
          can_view_financials?: boolean
          can_view_guest_contact_data?: boolean
          can_view_owner_statements?: boolean
          can_view_payments?: boolean
          can_view_receipts?: boolean
          can_view_service_agreement?: boolean
          can_view_service_costs?: boolean
          created_at?: string
          id?: string
          ownership_share_percent?: number | null
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          assignment_role?: string
          can_create_calendar_blocks?: boolean
          can_download_statements?: boolean
          can_manage_prices?: boolean
          can_receive_notifications?: boolean
          can_submit_financial_question?: boolean
          can_view_bookings?: boolean
          can_view_calendar?: boolean
          can_view_financials?: boolean
          can_view_guest_contact_data?: boolean
          can_view_owner_statements?: boolean
          can_view_payments?: boolean
          can_view_receipts?: boolean
          can_view_service_agreement?: boolean
          can_view_service_costs?: boolean
          created_at?: string
          id?: string
          ownership_share_percent?: number | null
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_user_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          property_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          property_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          property_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          active: boolean
          calculation_type: string
          category: string
          created_at: string
          currency: string
          default_cost_bearer: string
          default_price: number
          description: string | null
          id: string
          key: string
          name: Json
          publicly_visible: boolean
          sort_order: number
          tax_percent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          calculation_type?: string
          category?: string
          created_at?: string
          currency?: string
          default_cost_bearer?: string
          default_price?: number
          description?: string | null
          id?: string
          key: string
          name?: Json
          publicly_visible?: boolean
          sort_order?: number
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          calculation_type?: string
          category?: string
          created_at?: string
          currency?: string
          default_cost_bearer?: string
          default_price?: number
          description?: string | null
          id?: string
          key?: string
          name?: Json
          publicly_visible?: boolean
          sort_order?: number
          tax_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          first_name: string
          invitation_accepted_at: string | null
          invitation_expires_at: string | null
          invited_at: string | null
          last_login_at: string | null
          last_name: string
          phone: string | null
          preferred_language: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          first_name?: string
          invitation_accepted_at?: string | null
          invitation_expires_at?: string | null
          invited_at?: string | null
          last_login_at?: string | null
          last_name?: string
          phone?: string | null
          preferred_language?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          first_name?: string
          invitation_accepted_at?: string | null
          invitation_expires_at?: string | null
          invited_at?: string | null
          last_login_at?: string | null
          last_name?: string
          phone?: string | null
          preferred_language?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      has_property_permission: {
        Args: { _permission: string; _property_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
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
      app_role: "admin" | "super_admin" | "booking_manager" | "owner"
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
      app_role: ["admin", "super_admin", "booking_manager", "owner"],
    },
  },
} as const
