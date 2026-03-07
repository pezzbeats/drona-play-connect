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
      admin_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          ball_no: number
          bowler_id: string | null
          created_at: string
          delivery_no: number
          extras_runs: number
          extras_type: Database["public"]["Enums"]["extras_type_enum"]
          fielder_id: string | null
          free_hit: boolean
          id: string
          innings_no: number
          is_wicket: boolean
          match_id: string
          non_striker_id: string | null
          notes: string | null
          out_player_id: string | null
          over_id: string
          over_no: number
          runs_off_bat: number
          striker_id: string | null
          wicket_type: string | null
        }
        Insert: {
          ball_no?: number
          bowler_id?: string | null
          created_at?: string
          delivery_no?: number
          extras_runs?: number
          extras_type?: Database["public"]["Enums"]["extras_type_enum"]
          fielder_id?: string | null
          free_hit?: boolean
          id?: string
          innings_no?: number
          is_wicket?: boolean
          match_id: string
          non_striker_id?: string | null
          notes?: string | null
          out_player_id?: string | null
          over_id: string
          over_no: number
          runs_off_bat?: number
          striker_id?: string | null
          wicket_type?: string | null
        }
        Update: {
          ball_no?: number
          bowler_id?: string | null
          created_at?: string
          delivery_no?: number
          extras_runs?: number
          extras_type?: Database["public"]["Enums"]["extras_type_enum"]
          fielder_id?: string | null
          free_hit?: boolean
          id?: string
          innings_no?: number
          is_wicket?: boolean
          match_id?: string
          non_striker_id?: string | null
          notes?: string | null
          out_player_id?: string | null
          over_id?: string
          over_no?: number
          runs_off_bat?: number
          striker_id?: string | null
          wicket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_fielder_id_fkey"
            columns: ["fielder_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_non_striker_id_fkey"
            columns: ["non_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_out_player_id_fkey"
            columns: ["out_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_over_id_fkey"
            columns: ["over_id"]
            isOneToOne: false
            referencedRelation: "over_control"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_striker_id_fkey"
            columns: ["striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
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
      gateway_secrets: {
        Row: {
          key: string
          updated_at: string
          updated_by_admin_id: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by_admin_id?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by_admin_id?: string | null
          value?: string
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          adjustment_reason: string | null
          correct_predictions: number
          id: string
          last_correct_at: string | null
          last_updated: string
          match_id: string
          mobile: string
          player_name: string | null
          points_adjustment: number
          rank_position: number | null
          tiebreaker_score: number
          total_points: number
          total_predictions: number
        }
        Insert: {
          adjustment_reason?: string | null
          correct_predictions?: number
          id?: string
          last_correct_at?: string | null
          last_updated?: string
          match_id: string
          mobile: string
          player_name?: string | null
          points_adjustment?: number
          rank_position?: number | null
          tiebreaker_score?: number
          total_points?: number
          total_predictions?: number
        }
        Update: {
          adjustment_reason?: string | null
          correct_predictions?: number
          id?: string
          last_correct_at?: string | null
          last_updated?: string
          match_id?: string
          mobile?: string
          player_name?: string | null
          points_adjustment?: number
          rank_position?: number | null
          tiebreaker_score?: number
          total_points?: number
          total_predictions?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
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
      match_flags: {
        Row: {
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by_admin_id: string | null
          match_id: string
          predictions_frozen: boolean
          scanning_frozen: boolean
          updated_at: string
          windows_locked: boolean
        }
        Insert: {
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by_admin_id?: string | null
          match_id: string
          predictions_frozen?: boolean
          scanning_frozen?: boolean
          updated_at?: string
          windows_locked?: boolean
        }
        Update: {
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by_admin_id?: string | null
          match_id?: string
          predictions_frozen?: boolean
          scanning_frozen?: boolean
          updated_at?: string
          windows_locked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "match_flags_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineup: {
        Row: {
          batting_order: number
          created_at: string
          id: string
          is_captain: boolean
          is_wk: boolean
          match_id: string
          player_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          batting_order: number
          created_at?: string
          id?: string
          is_captain?: boolean
          is_wk?: boolean
          match_id: string
          player_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          batting_order?: number
          created_at?: string
          id?: string
          is_captain?: boolean
          is_wk?: boolean
          match_id?: string
          player_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_live_state: {
        Row: {
          batting_team_id: string | null
          bowling_team_id: string | null
          current_bowler_id: string | null
          current_innings: number
          current_non_striker_id: string | null
          current_striker_id: string | null
          id: string
          innings1_overs: number
          innings1_score: number
          innings1_wickets: number
          innings2_overs: number
          innings2_score: number
          innings2_wickets: number
          last_delivery_summary: string | null
          match_id: string
          phase: Database["public"]["Enums"]["match_phase_enum"]
          super_over_active: boolean
          super_over_innings: number
          super_over_overs: number
          super_over_round: number
          super_over_score: number
          super_over_wickets: number
          target_runs: number | null
          updated_at: string
        }
        Insert: {
          batting_team_id?: string | null
          bowling_team_id?: string | null
          current_bowler_id?: string | null
          current_innings?: number
          current_non_striker_id?: string | null
          current_striker_id?: string | null
          id?: string
          innings1_overs?: number
          innings1_score?: number
          innings1_wickets?: number
          innings2_overs?: number
          innings2_score?: number
          innings2_wickets?: number
          last_delivery_summary?: string | null
          match_id: string
          phase?: Database["public"]["Enums"]["match_phase_enum"]
          super_over_active?: boolean
          super_over_innings?: number
          super_over_overs?: number
          super_over_round?: number
          super_over_score?: number
          super_over_wickets?: number
          target_runs?: number | null
          updated_at?: string
        }
        Update: {
          batting_team_id?: string | null
          bowling_team_id?: string | null
          current_bowler_id?: string | null
          current_innings?: number
          current_non_striker_id?: string | null
          current_striker_id?: string | null
          id?: string
          innings1_overs?: number
          innings1_score?: number
          innings1_wickets?: number
          innings2_overs?: number
          innings2_score?: number
          innings2_wickets?: number
          last_delivery_summary?: string | null
          match_id?: string
          phase?: Database["public"]["Enums"]["match_phase_enum"]
          super_over_active?: boolean
          super_over_innings?: number
          super_over_overs?: number
          super_over_round?: number
          super_over_score?: number
          super_over_wickets?: number
          target_runs?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_live_state_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_live_state_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_live_state_current_bowler_id_fkey"
            columns: ["current_bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_live_state_current_non_striker_id_fkey"
            columns: ["current_non_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_live_state_current_striker_id_fkey"
            columns: ["current_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_live_state_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
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
      match_roster: {
        Row: {
          created_at: string
          id: string
          is_batting_first: boolean
          match_id: string
          side: Database["public"]["Enums"]["roster_side_enum"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_batting_first?: boolean
          match_id: string
          side: Database["public"]["Enums"]["roster_side_enum"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_batting_first?: boolean
          match_id?: string
          side?: Database["public"]["Enums"]["roster_side_enum"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_roster_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_roster_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_scoring_config: {
        Row: {
          created_at: string
          leaderboard_frozen: boolean
          match_id: string
          points_per_correct: number
          points_per_over_correct: number
          speed_bonus_enabled: boolean
          speed_bonus_first_n: number
          speed_bonus_points: number
          tiebreaker_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          leaderboard_frozen?: boolean
          match_id: string
          points_per_correct?: number
          points_per_over_correct?: number
          speed_bonus_enabled?: boolean
          speed_bonus_first_n?: number
          speed_bonus_points?: number
          tiebreaker_mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          leaderboard_frozen?: boolean
          match_id?: string
          points_per_correct?: number
          points_per_over_correct?: number
          speed_bonus_enabled?: boolean
          speed_bonus_first_n?: number
          speed_bonus_points?: number
          tiebreaker_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_scoring_config_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
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
          gateway_response: Json | null
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
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          seating_type: Database["public"]["Enums"]["seating_type_enum"]
          seats_count: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by_admin_id?: string | null
          created_source?: Database["public"]["Enums"]["created_source_enum"]
          event_id: string
          gateway_response?: Json | null
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
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          seating_type?: Database["public"]["Enums"]["seating_type_enum"]
          seats_count: number
          total_amount: number
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string | null
          created_source?: Database["public"]["Enums"]["created_source_enum"]
          event_id?: string
          gateway_response?: Json | null
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
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
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
      over_control: {
        Row: {
          bowler_id: string | null
          created_at: string
          id: string
          innings_no: number
          match_id: string
          over_no: number
          status: Database["public"]["Enums"]["over_status_enum"]
        }
        Insert: {
          bowler_id?: string | null
          created_at?: string
          id?: string
          innings_no?: number
          match_id: string
          over_no: number
          status?: Database["public"]["Enums"]["over_status_enum"]
        }
        Update: {
          bowler_id?: string | null
          created_at?: string
          id?: string
          innings_no?: number
          match_id?: string
          over_no?: number
          status?: Database["public"]["Enums"]["over_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "over_control_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "over_control_match_id_fkey"
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
          ai_confidence: string | null
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
          fraud_flags: Json
          id: string
          order_id: string
          overridden_at: string | null
          overridden_by_admin_id: string | null
          override_reason: string | null
          uploaded_by: Database["public"]["Enums"]["proof_uploader_enum"]
        }
        Insert: {
          ai_confidence?: string | null
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
          fraud_flags?: Json
          id?: string
          order_id: string
          overridden_at?: string | null
          overridden_by_admin_id?: string | null
          override_reason?: string | null
          uploaded_by?: Database["public"]["Enums"]["proof_uploader_enum"]
        }
        Update: {
          ai_confidence?: string | null
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
          fraud_flags?: Json
          id?: string
          order_id?: string
          overridden_at?: string | null
          overridden_by_admin_id?: string | null
          override_reason?: string | null
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
      players: {
        Row: {
          created_at: string
          id: string
          jersey_number: number | null
          name: string
          role: Database["public"]["Enums"]["player_role_enum"]
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          name: string
          role?: Database["public"]["Enums"]["player_role_enum"]
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          name?: string
          role?: Database["public"]["Enums"]["player_role_enum"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_windows: {
        Row: {
          correct_answer: Json | null
          created_at: string
          id: string
          locks_at: string | null
          match_id: string
          opens_at: string | null
          options: Json
          over_id: string | null
          question: string | null
          status: Database["public"]["Enums"]["window_status_enum"]
          window_type: Database["public"]["Enums"]["window_type_enum"]
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          id?: string
          locks_at?: string | null
          match_id: string
          opens_at?: string | null
          options?: Json
          over_id?: string | null
          question?: string | null
          status?: Database["public"]["Enums"]["window_status_enum"]
          window_type?: Database["public"]["Enums"]["window_type_enum"]
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          id?: string
          locks_at?: string | null
          match_id?: string
          opens_at?: string | null
          options?: Json
          over_id?: string | null
          question?: string | null
          status?: Database["public"]["Enums"]["window_status_enum"]
          window_type?: Database["public"]["Enums"]["window_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "prediction_windows_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_windows_over_id_fkey"
            columns: ["over_id"]
            isOneToOne: false
            referencedRelation: "over_control"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean | null
          match_id: string
          mobile: string
          player_name: string | null
          points_earned: number
          prediction: Json
          window_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean | null
          match_id: string
          mobile: string
          player_name?: string | null
          points_earned?: number
          prediction: Json
          window_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean | null
          match_id?: string
          mobile?: string
          player_name?: string | null
          points_earned?: number
          prediction?: Json
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "prediction_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          created_at: string | null
          id: string
          key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      semifinal_eligibility: {
        Row: {
          full_name: string | null
          id: string
          match_label: string | null
          mobile: string
          notes: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string
          match_label?: string | null
          mobile: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string
          match_label?: string | null
          mobile?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      site_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      super_over_rounds: {
        Row: {
          activated_by_admin_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          innings_a_no: number
          innings_b_no: number
          is_tied: boolean
          match_id: string
          round_number: number
          status: string
          team_a_id: string | null
          team_a_score: number
          team_a_wickets: number
          team_b_id: string | null
          team_b_score: number
          team_b_wickets: number
          winner_team_id: string | null
        }
        Insert: {
          activated_by_admin_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          innings_a_no: number
          innings_b_no: number
          is_tied?: boolean
          match_id: string
          round_number?: number
          status?: string
          team_a_id?: string | null
          team_a_score?: number
          team_a_wickets?: number
          team_b_id?: string | null
          team_b_score?: number
          team_b_wickets?: number
          winner_team_id?: string | null
        }
        Update: {
          activated_by_admin_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          innings_a_no?: number
          innings_b_no?: number
          is_tied?: boolean
          match_id?: string
          round_number?: number
          status?: string
          team_a_id?: string | null
          team_a_score?: number
          team_a_wickets?: number
          team_b_id?: string | null
          team_b_score?: number
          team_b_wickets?: number
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_over_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_over_rounds_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_over_rounds_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_over_rounds_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          id: string
          logo_path: string | null
          name: string
          short_code: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          short_code: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          short_code?: string
        }
        Relationships: []
      }
      ticket_scan_log: {
        Row: {
          id: string
          ip_address: string | null
          match_id: string | null
          outcome: string
          qr_text_hash: string
          scanned_at: string
          scanned_by_admin_id: string | null
          ticket_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          match_id?: string | null
          outcome: string
          qr_text_hash: string
          scanned_at?: string
          scanned_by_admin_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          match_id?: string | null
          outcome?: string
          qr_text_hash?: string
          scanned_at?: string
          scanned_by_admin_id?: string | null
          ticket_id?: string | null
        }
        Relationships: []
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
      compute_pricing_quote: {
        Args: { p_match_id: string; p_mobile: string; p_seats_count: number }
        Returns: Json
      }
      get_admin_role: { Args: { _user_id: string }; Returns: string }
      get_order_with_tickets: {
        Args: { p_match_id: string; p_mobile: string }
        Returns: Json
      }
      mark_ticket_checkin: {
        Args: { p_admin_id: string; p_ticket_id: string }
        Returns: Json
      }
      set_active_match: { Args: { p_match_id: string }; Returns: undefined }
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
      extras_type_enum: "none" | "wide" | "no_ball" | "bye" | "leg_bye"
      match_phase_enum:
        | "pre"
        | "innings1"
        | "break"
        | "innings2"
        | "ended"
        | "super_over"
      match_status_enum:
        | "draft"
        | "registrations_open"
        | "registrations_closed"
        | "live"
        | "ended"
      match_type_enum: "group" | "semi_final" | "final" | "other"
      over_status_enum: "pending" | "active" | "complete" | "locked"
      payment_method_enum:
        | "pay_at_hotel"
        | "upi_qr"
        | "cash"
        | "card"
        | "razorpay"
      payment_status_enum:
        | "unpaid"
        | "pending_verification"
        | "paid_verified"
        | "paid_rejected"
        | "paid_manual_verified"
      player_role_enum: "batsman" | "bowler" | "all_rounder" | "wicketkeeper"
      prediction_mode_enum: "per_ball" | "per_over" | "off"
      price_reason_enum:
        | "loyal_base"
        | "new_customer"
        | "extra_seat"
        | "legacy"
        | "standard"
      pricing_rule_type_enum: "standard" | "loyalty"
      proof_uploader_enum: "customer" | "admin"
      roster_side_enum: "home" | "away"
      seating_type_enum: "regular" | "family"
      ticket_status_enum: "active" | "used" | "blocked"
      window_status_enum: "open" | "locked" | "resolved"
      window_type_enum: "ball" | "over"
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
      extras_type_enum: ["none", "wide", "no_ball", "bye", "leg_bye"],
      match_phase_enum: [
        "pre",
        "innings1",
        "break",
        "innings2",
        "ended",
        "super_over",
      ],
      match_status_enum: [
        "draft",
        "registrations_open",
        "registrations_closed",
        "live",
        "ended",
      ],
      match_type_enum: ["group", "semi_final", "final", "other"],
      over_status_enum: ["pending", "active", "complete", "locked"],
      payment_method_enum: [
        "pay_at_hotel",
        "upi_qr",
        "cash",
        "card",
        "razorpay",
      ],
      payment_status_enum: [
        "unpaid",
        "pending_verification",
        "paid_verified",
        "paid_rejected",
        "paid_manual_verified",
      ],
      player_role_enum: ["batsman", "bowler", "all_rounder", "wicketkeeper"],
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
      roster_side_enum: ["home", "away"],
      seating_type_enum: ["regular", "family"],
      ticket_status_enum: ["active", "used", "blocked"],
      window_status_enum: ["open", "locked", "resolved"],
      window_type_enum: ["ball", "over"],
    },
  },
} as const
