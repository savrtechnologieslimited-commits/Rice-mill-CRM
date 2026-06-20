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
      batch_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_roles: string | null
          batch_id: string | null
          created_at: string
          details: Json | null
          entity: string
          id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_roles?: string | null
          batch_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          id?: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_roles?: string | null
          batch_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_audit_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_audit_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_audit_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          amount: number
          batch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_date?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          receipt_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "collections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "collections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          gstin: string | null
          id: string
          name: string
          outstanding: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name: string
          outstanding?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name?: string
          outstanding?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
        }
        Relationships: []
      }
      govt_agencies: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      govt_obligations: {
        Row: {
          agency_id: string | null
          batch_id: string | null
          created_at: string
          id: string
          paddy_received_qtl: number
          rice_due_qtl: number
          rice_returned_qtl: number
        }
        Insert: {
          agency_id?: string | null
          batch_id?: string | null
          created_at?: string
          id?: string
          paddy_received_qtl: number
          rice_due_qtl: number
          rice_returned_qtl?: number
        }
        Update: {
          agency_id?: string | null
          batch_id?: string | null
          created_at?: string
          id?: string
          paddy_received_qtl?: number
          rice_due_qtl?: number
          rice_returned_qtl?: number
        }
        Relationships: [
          {
            foreignKeyName: "govt_obligations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "govt_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "govt_obligations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "govt_obligations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "govt_obligations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          product: Database["public"]["Enums"]["product_type"]
          quantity_qtl: number
          updated_at: string
        }
        Insert: {
          product: Database["public"]["Enums"]["product_type"]
          quantity_qtl?: number
          updated_at?: string
        }
        Update: {
          product?: Database["public"]["Enums"]["product_type"]
          quantity_qtl?: number
          updated_at?: string
        }
        Relationships: []
      }
      mill_settings: {
        Row: {
          id: number
          opening_balances_set: boolean
          opening_bank: number
          opening_cash: number
          set_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          opening_balances_set?: boolean
          opening_bank?: number
          opening_cash?: number
          set_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          opening_balances_set?: boolean
          opening_bank?: number
          opening_cash?: number
          set_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paddy_batches: {
        Row: {
          batch_number: string
          created_at: string
          govt_agency_id: string | null
          id: string
          location: string | null
          moisture_pct: number | null
          net_quantity_qtl: number
          owner_name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          remaining_qtl: number
          status: Database["public"]["Enums"]["batch_status"]
          storage_choice: Database["public"]["Enums"]["storage_choice"]
          storage_image_url: string | null
          updated_at: string
          variety: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          govt_agency_id?: string | null
          id?: string
          location?: string | null
          moisture_pct?: number | null
          net_quantity_qtl: number
          owner_name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          remaining_qtl: number
          status?: Database["public"]["Enums"]["batch_status"]
          storage_choice: Database["public"]["Enums"]["storage_choice"]
          storage_image_url?: string | null
          updated_at?: string
          variety?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          govt_agency_id?: string | null
          id?: string
          location?: string | null
          moisture_pct?: number | null
          net_quantity_qtl?: number
          owner_name?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          remaining_qtl?: number
          status?: Database["public"]["Enums"]["batch_status"]
          storage_choice?: Database["public"]["Enums"]["storage_choice"]
          storage_image_url?: string | null
          updated_at?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paddy_batches_govt_agency_id_fkey"
            columns: ["govt_agency_id"]
            isOneToOne: false
            referencedRelation: "govt_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      paddy_intakes: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          deduction_qtl: number
          gross_weight_qtl: number
          id: string
          intake_date: string
          moisture_pct: number | null
          net_quantity_qtl: number
          photo_urls: string[] | null
          remarks: string | null
          tare_weight_qtl: number
          truck_number: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          deduction_qtl?: number
          gross_weight_qtl: number
          id?: string
          intake_date?: string
          moisture_pct?: number | null
          net_quantity_qtl: number
          photo_urls?: string[] | null
          remarks?: string | null
          tare_weight_qtl?: number
          truck_number?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          deduction_qtl?: number
          gross_weight_qtl?: number
          id?: string
          intake_date?: string
          moisture_pct?: number | null
          net_quantity_qtl?: number
          photo_urls?: string[] | null
          remarks?: string | null
          tare_weight_qtl?: number
          truck_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paddy_intakes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "paddy_intakes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "paddy_intakes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      procurements: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          purchase_rate: number
          supplier_id: string
          total_amount: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          purchase_rate: number
          supplier_id: string
          total_amount: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          purchase_rate?: number
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "procurements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "procurements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_runs: {
        Row: {
          batch_id: string
          bran_qtl: number
          broken_rice_qtl: number
          created_at: string
          created_by: string | null
          husk_qtl: number
          id: string
          notes: string | null
          paddy_used_qtl: number
          recovery_pct: number | null
          rice_qtl: number
          run_date: string
        }
        Insert: {
          batch_id: string
          bran_qtl?: number
          broken_rice_qtl?: number
          created_at?: string
          created_by?: string | null
          husk_qtl?: number
          id?: string
          notes?: string | null
          paddy_used_qtl: number
          recovery_pct?: number | null
          rice_qtl?: number
          run_date?: string
        }
        Update: {
          batch_id?: string
          bran_qtl?: number
          broken_rice_qtl?: number
          created_at?: string
          created_by?: string | null
          husk_qtl?: number
          id?: string
          notes?: string | null
          paddy_used_qtl?: number
          recovery_pct?: number | null
          rice_qtl?: number
          run_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "production_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "production_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          agency_id: string | null
          batch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          dispatch_type: Database["public"]["Enums"]["dispatch_type"]
          id: string
          notes: string | null
          product: Database["public"]["Enums"]["product_type"]
          quantity_qtl: number
          rate: number
          sale_date: string
          total_amount: number
          truck_number: string | null
        }
        Insert: {
          agency_id?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dispatch_type: Database["public"]["Enums"]["dispatch_type"]
          id?: string
          notes?: string | null
          product: Database["public"]["Enums"]["product_type"]
          quantity_qtl: number
          rate?: number
          sale_date?: string
          total_amount?: number
          truck_number?: string | null
        }
        Update: {
          agency_id?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dispatch_type?: Database["public"]["Enums"]["dispatch_type"]
          id?: string
          notes?: string | null
          product?: Database["public"]["Enums"]["product_type"]
          quantity_qtl?: number
          rate?: number
          sale_date?: string
          total_amount?: number
          truck_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "govt_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "sales_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "sales_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payment_date?: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_payables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "supplier_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_receivables"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "supplier_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "paddy_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          gstin: string | null
          id: string
          name: string
          outstanding: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name: string
          outstanding?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name?: string
          outstanding?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      batch_payables: {
        Row: {
          batch_date: string | null
          batch_id: string | null
          batch_number: string | null
          due_date: string | null
          net_quantity_qtl: number | null
          outstanding: number | null
          owner_name: string | null
          owner_type: Database["public"]["Enums"]["owner_type"] | null
          paid_amount: number | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          procurement_date: string | null
          procurement_pending: boolean | null
          purchase_rate: number | null
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
          variety: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_receivables: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          collected_amount: number | null
          customer_id: string | null
          customer_name: string | null
          last_sale_date: string | null
          outstanding: number | null
          owner_name: string | null
          sale_pending: boolean | null
          sold_amount: number | null
          variety: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number | null
          direction: string | null
          dt: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      email_for_username: { Args: { _username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      master_reset: { Args: never; Returns: undefined }
      next_batch_number: { Args: never; Returns: string }
      write_batch_audit: {
        Args: {
          _action: string
          _batch_id: string
          _details: Json
          _entity: string
          _summary: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "intake_clerk"
        | "procurement_manager"
        | "production_operator"
        | "sales_executive"
        | "accounts"
      batch_status: "available" | "drying" | "in_production" | "consumed"
      dispatch_type: "sale" | "government_return"
      expense_category:
        | "labour"
        | "diesel"
        | "electricity"
        | "repairs"
        | "transport"
        | "packing"
        | "miscellaneous"
      owner_type: "government" | "private"
      payment_mode: "cash" | "bank" | "upi" | "cheque" | "credit"
      product_type: "paddy" | "rice" | "bran" | "broken_rice" | "husk"
      storage_choice: "stored" | "drying" | "direct_production"
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
      app_role: [
        "owner",
        "intake_clerk",
        "procurement_manager",
        "production_operator",
        "sales_executive",
        "accounts",
      ],
      batch_status: ["available", "drying", "in_production", "consumed"],
      dispatch_type: ["sale", "government_return"],
      expense_category: [
        "labour",
        "diesel",
        "electricity",
        "repairs",
        "transport",
        "packing",
        "miscellaneous",
      ],
      owner_type: ["government", "private"],
      payment_mode: ["cash", "bank", "upi", "cheque", "credit"],
      product_type: ["paddy", "rice", "bran", "broken_rice", "husk"],
      storage_choice: ["stored", "drying", "direct_production"],
    },
  },
} as const
