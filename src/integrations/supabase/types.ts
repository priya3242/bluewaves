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
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      passengers: {
        Row: {
          created_at: string
          fare: number
          id: string
          linked_sms_id: string | null
          name: string
          notes: string | null
          payment_method: string
          payment_status: string
          phone: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fare?: number
          id?: string
          linked_sms_id?: string | null
          name: string
          notes?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fare?: number
          id?: string
          linked_sms_id?: string | null
          name?: string
          notes?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passengers_linked_sms_fk"
            columns: ["linked_sms_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passengers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          amount: number | null
          bank_from: string | null
          bank_to: string | null
          from_number: string | null
          id: string
          is_upi: boolean
          linked_passenger_id: string | null
          raw: Json | null
          received_at: string
          received_stamp: number | null
          sender_name: string | null
          sent_stamp: number | null
          sim: string | null
          text: string
          upi_id: string | null
          upi_ref: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          bank_from?: string | null
          bank_to?: string | null
          from_number?: string | null
          id?: string
          is_upi?: boolean
          linked_passenger_id?: string | null
          raw?: Json | null
          received_at?: string
          received_stamp?: number | null
          sender_name?: string | null
          sent_stamp?: number | null
          sim?: string | null
          text: string
          upi_id?: string | null
          upi_ref?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          bank_from?: string | null
          bank_to?: string | null
          from_number?: string | null
          id?: string
          is_upi?: boolean
          linked_passenger_id?: string | null
          raw?: Json | null
          received_at?: string
          received_stamp?: number | null
          sender_name?: string | null
          sent_stamp?: number | null
          sim?: string | null
          text?: string
          upi_id?: string | null
          upi_ref?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_linked_passenger_id_fkey"
            columns: ["linked_passenger_id"]
            isOneToOne: false
            referencedRelation: "passengers"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          base_fare: number
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          trip_date: string
          trip_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_fare?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          trip_date?: string
          trip_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_fare?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          trip_date?: string
          trip_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
