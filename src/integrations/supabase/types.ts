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
      admin_activity: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          meta: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          meta?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          meta?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          venue: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          venue: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          venue?: string
        }
        Relationships: []
      }
      game_access: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_regenerated_by_admin_id: string | null
          match_id: string
          mobile: string
          pin_created_at: string
          pin_expires_at: string | null
          pin_hash: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_regenerated_by_admin_id?: string | null
          match_id: string
          mobile: string
          pin_created_at?: string
          pin_expires_at?: string | null
          pin_hash: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_regenerated_by_admin_id?: string | null
          match_id?: string
          mobile?: string
          pin_created_at?: string
          pin_expires_at?: string | null
          pin_hash?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_access_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_access_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      match_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type_enum"]
          file_path: string
          id: string
          match_id: string
          uploaded_at: string
          uploaded_by_admin_id: string | null
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type_enum"]
          file_path: string
          id?: string
          match_id: string
          uploaded_at?: string
          uploaded_by_admin_id?: string | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type_enum"]
          file_path?: string
          id?: string
          match_id?: string
          uploaded_at?: string
          uploaded_by_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_assets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_pricing_rules: {
        Row: {
          base_price_new: number
          base_price_returning: number | null
          created_at: string
          id: string
          loyalty_from_match_id: string | null
          match_id: string
          rule_type: Database["public"]["Enums"]["pricing_rule_type_enum"]
        }
        Insert: {
          base_price_new: number
          base_price_returning?: number | null
          created_at?: string
          id?: string
          loyalty_from_match_id?: string | null
          match_id: string
          rule_type?: Database["public"]["Enums"]["pricing_rule_type_enum"]
        }
        Update: {
          base_price_new?: number
          base_price_returning?: number | null
          created_at?: string
          id?: string
          loyalty_from_match_id?: string | null
          match_id?: string
          rule_type?: Database["public"]["Enums"]["pricing_rule_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "match_pricing_rules_loyalty_from_match_id_fkey"
            columns: ["loyalty_from_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_pricing_rules_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          disclaimer_enabled: boolean
          event_id: string
          id: string
          is_active_for_registration: boolean
          match_type: Database["public"]["Enums"]["match_type_enum"]
          name: string
          opponent: string | null
          prediction_mode: Database["public"]["Enums"]["prediction_mode_enum"]
          predictions_enabled: boolean
          start_time: string | null
          status: Database["public"]["Enums"]["match_status_enum"]
          venue: string
        }
        Insert: {
          created_at?: string
          disclaimer_enabled?: boolean
          event_id: string
          id?: string
          is_active_for_registration?: boolean
          match_type?: Database["public"]["Enums"]["match_type_enum"]
          name: string
          opponent?: string | null
          prediction_mode?: Database["public"]["Enums"]["prediction_mode_enum"]
          predictions_enabled?: boolean
          start_time?: string | null
          status?: Database["public"]["Enums"]["match_status_enum"]
          venue?: string
        }
        Update: {
          created_at?: string
          disclaimer_enabled?: boolean
          event_id?: string
          id?: string
          is_active_for_registration?: boolean
          match_type?: Database["public"]["Enums"]["match_type_enum"]
          name?: string
          opponent?: string | null
          prediction_mode?: Database["public"]["Enums"]["prediction_mode_enum"]
          predictions_enabled?: boolean
          start_time?: string | null
          status?: Database["public"]["Enums"]["match_status_enum"]
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      order_seat_pricing: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_applied: number
          price_reason: Database["public"]["Enums"]["price_reason_enum"]
          seat_index: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price_applied: number
          price_reason?: Database["public"]["Enums"]["price_reason_enum"]
          seat_index: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_applied?: number
          price_reason?: Database["public"]["Enums"]["price_reason_enum"]
          seat_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_seat_pricing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by_admin_id: string | null
          created_source: Database["public"]["Enums"]["created_source_enum"]
          event_id: string
          id: string
          match_id: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          payment_verified_at: string | null
          payment_verified_by_admin_id: string | null
          pricing_model_snapshot: Json
          purchaser_email: string | null
          purchaser_full_name: string
          purchaser_mobile: string
          seating_type: Database["public"]["Enums"]["seating_type_enum"]
          seats_count: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by_admin_id?: string | null
          created_source?: Database["public"]["Enums"]["created_source_enum"]
          event_id: string
          id?: string
          match_id: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          payment_verified_at?: string | null
          payment_verified_by_admin_id?: string | null
          pricing_model_snapshot?: Json
          purchaser_email?: string | null
          purchaser_full_name: string
          purchaser_mobile: string
          seating_type?: Database["public"]["Enums"]["seating_type_enum"]
          seats_count: number
          total_amount: number
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string | null
          created_source?: Database["public"]["Enums"]["created_source_enum"]
          event_id?: string
          id?: string
          match_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          payment_verified_at?: string | null
          payment_verified_by_admin_id?: string | null
          pricing_model_snapshot?: Json
          purchaser_email?: string | null
          purchaser_full_name?: string
          purchaser_mobile?: string
          seating_type?: Database["public"]["Enums"]["seating_type_enum"]
          seats_count?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_collections: {
        Row: {
          amount: number
          collected_at: string
          collected_by_admin_id: string
          id: string
          method: Database["public"]["Enums"]["collection_method_enum"]
          note: string | null
          order_id: string
          proof_id: string | null
          reference_no: string | null
        }
        Insert: {
          amount: number
          collected_at?: string
          collected_by_admin_id: string
          id?: string
          method: Database["public"]["Enums"]["collection_method_enum"]
          note?: string | null
          order_id: string
          proof_id?: string | null
          reference_no?: string | null
        }
        Update: {
          amount?: number
          collected_at?: string
          collected_by_admin_id?: string
          id?: string
          method?: Database["public"]["Enums"]["collection_method_enum"]
          note?: string | null
          order_id?: string
          proof_id?: string | null
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_collections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_collections_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "payment_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          ai_reason: string | null
          ai_verdict: Database["public"]["Enums"]["ai_verdict_enum"]
          created_at: string
          extracted_amount: number | null
          extracted_date: string | null
          extracted_note: string | null
          extracted_txn_id: string | null
          extracted_vpa: string | null
          file_path: string
          file_sha256: string
          id: string
          order_id: string
          uploaded_by: Database["public"]["Enums"]["proof_uploader_enum"]
        }
        Insert: {
          ai_reason?: string | null
          ai_verdict?: Database["public"]["Enums"]["ai_verdict_enum"]
          created_at?: string
          extracted_amount?: number | null
          extracted_date?: string | null
          extracted_note?: string | null
          extracted_txn_id?: string | null
          extracted_vpa?: string | null
          file_path: string
          file_sha256: string
          id?: string
          order_id: string
          uploaded_by?: Database["public"]["Enums"]["proof_uploader_enum"]
        }
        Update: {
          ai_reason?: string | null
          ai_verdict?: Database["public"]["Enums"]["ai_verdict_enum"]
          created_at?: string
          extracted_amount?: number | null
          extracted_date?: string | null
          extracted_note?: string | null
          extracted_txn_id?: string | null
          extracted_vpa?: string | null
          file_path?: string
          file_sha256?: string
          id?: string
          order_id?: string
          uploaded_by?: Database["public"]["Enums"]["proof_uploader_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          blocked_reason: string | null
          checked_in_at: string | null
          checked_in_by_admin_id: string | null
          event_id: string
          id: string
          issued_at: string
          match_id: string
          order_id: string
          qr_text: string
          seat_index: number
          status: Database["public"]["Enums"]["ticket_status_enum"]
        }
        Insert: {
          blocked_reason?: string | null
          checked_in_at?: string | null
          checked_in_by_admin_id?: string | null
          event_id: string
          id?: string
          issued_at?: string
          match_id: string
          order_id: string
          qr_text: string
          seat_index: number
          status?: Database["public"]["Enums"]["ticket_status_enum"]
        }
        Update: {
          blocked_reason?: string | null
          checked_in_at?: string | null
          checked_in_by_admin_id?: string | null
          event_id?: string
          id?: string
          issued_at?: string
          match_id?: string
          order_id?: string
          qr_text?: string
          seat_index?: number
          status?: Database["public"]["Enums"]["ticket_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      admin_role: "super_admin" | "admin" | "counter_staff"
      ai_verdict_enum: "verified" | "rejected" | "needs_manual_review"
      asset_type_enum:
        | "banner_image"
        | "poster_image"
        | "team_flag_1"
        | "team_flag_2"
        | "terms_pdf"
        | "seating_map_image"
      collection_method_enum: "cash" | "upi" | "card"
      created_source_enum: "self_register" | "manual_booking"
      match_status_enum:
        | "draft"
        | "registrations_open"
        | "registrations_closed"
        | "live"
        | "ended"
      match_type_enum: "group" | "semi_final" | "final" | "other"
      payment_method_enum: "pay_at_hotel" | "upi_qr" | "cash" | "card"
      payment_status_enum:
        | "unpaid"
        | "pending_verification"
        | "paid_verified"
        | "paid_rejected"
        | "paid_manual_verified"
      prediction_mode_enum: "per_ball" | "per_over" | "off"
      price_reason_enum:
        | "loyal_base"
        | "new_customer"
        | "extra_seat"
        | "legacy"
        | "standard"
      pricing_rule_type_enum: "standard" | "loyalty"
      proof_uploader_enum: "customer" | "admin"
      seating_type_enum: "regular" | "family"
      ticket_status_enum: "active" | "used" | "blocked"
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
      admin_role: ["super_admin", "admin", "counter_staff"],
      ai_verdict_enum: ["verified", "rejected", "needs_manual_review"],
      asset_type_enum: [
        "banner_image",
        "poster_image",
        "team_flag_1",
        "team_flag_2",
        "terms_pdf",
        "seating_map_image",
      ],
      collection_method_enum: ["cash", "upi", "card"],
      created_source_enum: ["self_register", "manual_booking"],
      match_status_enum: [
        "draft",
        "registrations_open",
        "registrations_closed",
        "live",
        "ended",
      ],
      match_type_enum: ["group", "semi_final", "final", "other"],
      payment_method_enum: ["pay_at_hotel", "upi_qr", "cash", "card"],
      payment_status_enum: [
        "unpaid",
        "pending_verification",
        "paid_verified",
        "paid_rejected",
        "paid_manual_verified",
      ],
      prediction_mode_enum: ["per_ball", "per_over", "off"],
      price_reason_enum: [
        "loyal_base",
        "new_customer",
        "extra_seat",
        "legacy",
        "standard",
      ],
      pricing_rule_type_enum: ["standard", "loyalty"],
      proof_uploader_enum: ["customer", "admin"],
      seating_type_enum: ["regular", "family"],
      ticket_status_enum: ["active", "used", "blocked"],
    },
  },
} as const
