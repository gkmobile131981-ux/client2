export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          role: 'owner' | 'staff';
          staff_id: string | null;
          shop_id: string | null;
          is_active: boolean;
          created_at: string;
        }
        Insert: {
          id: string;
          name: string;
          role: 'owner' | 'staff';
          staff_id?: string | null;
          shop_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        }
        Update: {
          id?: string;
          name?: string;
          role?: 'owner' | 'staff';
          staff_id?: string | null;
          shop_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          }
        ]
      }
      shops: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          address: string | null;
          phone: string | null;
          owner_id: string;
        }
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          owner_id: string;
        }
        Update: {
          id?: string;
          name?: string;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          owner_id?: string;
        }
        Relationships: [
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string;
          address: string | null;
          photo_url: string | null;
          created_at: string;
        }
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone: string;
          address?: string | null;
          photo_url?: string | null;
          created_at?: string;
        }
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          phone?: string;
          address?: string | null;
          photo_url?: string | null;
          created_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          }
        ]
      }
      devices: {
        Row: {
          id: string;
          customer_id: string;
          brand: string;
          model: string;
          imei: string | null;
          problem: string;
          quality: string | null;
          physical_damage: string | null;
          front_photo_url: string | null;
          back_photo_url: string | null;
        }
        Insert: {
          id?: string;
          customer_id: string;
          brand: string;
          model: string;
          imei?: string | null;
          problem: string;
          quality?: string | null;
          physical_damage?: string | null;
          front_photo_url?: string | null;
          back_photo_url?: string | null;
        }
        Update: {
          id?: string;
          customer_id?: string;
          brand?: string;
          model?: string;
          imei?: string | null;
          problem?: string;
          quality?: string | null;
          physical_damage?: string | null;
          front_photo_url?: string | null;
          back_photo_url?: string | null;
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      repairs: {
        Row: {
          id: string;
          job_number: string;
          device_id: string;
          shop_id: string;
          estimate: number;
          advance: number;
          balance: number;
          status: 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
          delivery_date: string | null;
          staff_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }
        Insert: {
          id?: string;
          job_number: string;
          device_id: string;
          shop_id: string;
          estimate?: number;
          advance?: number;
          status?: 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
          delivery_date?: string | null;
          staff_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
        Update: {
          id?: string;
          job_number?: string;
          device_id?: string;
          shop_id?: string;
          estimate?: number;
          advance?: number;
          status?: 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
          delivery_date?: string | null;
          staff_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "repairs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      repair_history: {
        Row: {
          id: string;
          repair_id: string;
          changed_by: string | null;
          old_status: string;
          new_status: string;
          note: string | null;
          created_at: string;
        }
        Insert: {
          id?: string;
          repair_id: string;
          changed_by?: string | null;
          old_status: string;
          new_status: string;
          note?: string | null;
          created_at?: string;
        }
        Update: {
          id?: string;
          repair_id?: string;
          changed_by?: string | null;
          old_status?: string;
          new_status?: string;
          note?: string | null;
          created_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "repair_history_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_auth_user_shop_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
