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
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          author_type: Database["public"]["Enums"]["message_author_type"]
          body: string
          created_at: string
          id: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_type: Database["public"]["Enums"]["message_author_type"]
          body: string
          created_at?: string
          id?: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_type?: Database["public"]["Enums"]["message_author_type"]
          body?: string
          created_at?: string
          id?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_fk"
            columns: ["ticket_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      tickets: {
        Row: {
          ai_handled: boolean
          assignee_id: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          created_at: string
          escalated: boolean
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_handled?: boolean
          assignee_id?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          escalated?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_handled?: boolean
          assignee_id?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          escalated?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_fk"
            columns: ["requester_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_ticket_with_message: {
        Args: {
          p_body: string
          p_channel?: Database["public"]["Enums"]["ticket_channel"]
          p_priority?: Database["public"]["Enums"]["ticket_priority"]
          p_subject: string
        }
        Returns: {
          ai_handled: boolean
          assignee_id: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          created_at: string
          escalated: boolean
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      message_author_type: "end_user" | "agent" | "ai" | "system"
      tenant_status: "active" | "suspended" | "cancelled"
      ticket_channel: "widget" | "email" | "portal"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      user_role: "owner" | "admin" | "agent" | "end_user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"]
export type UserProfile = Database["public"]["Tables"]["users"]["Row"]
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"]
export type TicketMessage =
  Database["public"]["Tables"]["ticket_messages"]["Row"]

export type UserRole = Database["public"]["Enums"]["user_role"]
export type TenantStatus = Database["public"]["Enums"]["tenant_status"]
export type TicketStatus = Database["public"]["Enums"]["ticket_status"]
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"]
export type TicketChannel = Database["public"]["Enums"]["ticket_channel"]
export type MessageAuthorType =
  Database["public"]["Enums"]["message_author_type"]
