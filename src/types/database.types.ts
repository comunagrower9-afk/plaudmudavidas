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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_events: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json
          order_id: string | null
          result_status: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          result_status?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          result_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          auth_user_id: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          email_normalized: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          email_normalized?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          email_normalized?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          lock_token: string | null
          locked_at: string | null
          metadata: Json
          next_attempt_at: string | null
          order_id: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status_enum"]
          template_key: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          lock_token?: string | null
          locked_at?: string | null
          metadata?: Json
          next_attempt_at?: string | null
          order_id?: string | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status_enum"]
          template_key: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          lock_token?: string | null
          locked_at?: string | null
          metadata?: Json
          next_attempt_at?: string | null
          order_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status_enum"]
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          external_product_id: string | null
          id: string
          image_url: string | null
          metadata: Json
          order_id: string
          product_name: string
          quantity: number
          sku: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_product_id?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          order_id: string
          product_name: string
          quantity: number
          sku?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_product_id?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          order_id?: string
          product_name?: string
          quantity?: number
          sku?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          created_at: string
          currency: string
          customer_id: string
          delivered_at: string | null
          estimated_delivery_end: string | null
          estimated_delivery_start: string | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status_enum"]
          id: string
          metadata: Json
          order_number: string | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          shipped_at: string | null
          shipping_address: Json | null
          subtotal: number
          total: number
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
          vega_order_id: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          delivered_at?: string | null
          estimated_delivery_end?: string | null
          estimated_delivery_start?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status_enum"]
          id?: string
          metadata?: Json
          order_number?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          shipped_at?: string | null
          shipping_address?: Json | null
          subtotal: number
          total: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          vega_order_id: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          delivered_at?: string | null
          estimated_delivery_end?: string | null
          estimated_delivery_start?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status_enum"]
          id?: string
          metadata?: Json
          order_number?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          shipped_at?: string | null
          shipping_address?: Json | null
          subtotal?: number
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          vega_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string | null
          external_event_id: string | null
          id: string
          location: string | null
          occurred_at: string
          order_id: string
          payload: Json
          source: string
          status: Database["public"]["Enums"]["fulfillment_status_enum"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_event_id?: string | null
          id?: string
          location?: string | null
          occurred_at: string
          order_id: string
          payload?: Json
          source: string
          status: Database["public"]["Enums"]["fulfillment_status_enum"]
        }
        Update: {
          created_at?: string
          description?: string | null
          external_event_id?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          order_id?: string
          payload?: Json
          source?: string
          status?: Database["public"]["Enums"]["fulfillment_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          external_event_id: string | null
          id: string
          idempotency_key: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          signature_valid: boolean | null
          status: Database["public"]["Enums"]["webhook_status_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          idempotency_key: string
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["webhook_status_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          idempotency_key?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["webhook_status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_order: { Args: { p_order_id: string }; Returns: Json }
      admin_register_order_shipment: {
        Args: {
          p_carrier?: string
          p_order_identifier: string
          p_replace_existing?: boolean
          p_tracking_code: string
        }
        Returns: Json
      }
      admin_search_orders: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: Json
      }
      claim_customer_account: { Args: never; Returns: Json }
      current_user_is_admin: { Args: never; Returns: boolean }
      register_order_shipment: {
        Args: {
          p_carrier?: string
          p_order_identifier: string
          p_replace_existing?: boolean
          p_tracking_code: string
        }
        Returns: Json
      }
    }
    Enums: {
      email_status_enum:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
      fulfillment_status_enum:
        | "unfulfilled"
        | "processing"
        | "shipped"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "exception"
        | "returned"
        | "cancelled"
      payment_status_enum:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
        | "chargeback"
      webhook_status_enum: "received" | "processed" | "failed" | "ignored"
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
      email_status_enum: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
      ],
      fulfillment_status_enum: [
        "unfulfilled",
        "processing",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "exception",
        "returned",
        "cancelled",
      ],
      payment_status_enum: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "chargeback",
      ],
      webhook_status_enum: ["received", "processed", "failed", "ignored"],
    },
  },
} as const
