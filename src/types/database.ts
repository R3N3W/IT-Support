export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_interactions: {
        Row: {
          answer: string | null
          confidence: number | null
          created_at: string
          escalated: boolean
          escalation_reason:
            | Database["public"]["Enums"]["escalation_reason"]
            | null
          id: string
          latency_ms: number | null
          model: string | null
          question: string
          retrieved_chunk_ids: string[]
          tenant_id: string
          ticket_id: string | null
          token_usage: Json | null
        }
        Insert: {
          answer?: string | null
          confidence?: number | null
          created_at?: string
          escalated?: boolean
          escalation_reason?:
            | Database["public"]["Enums"]["escalation_reason"]
            | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          question: string
          retrieved_chunk_ids?: string[]
          tenant_id: string
          ticket_id?: string | null
          token_usage?: Json | null
        }
        Update: {
          answer?: string | null
          confidence?: number | null
          created_at?: string
          escalated?: boolean
          escalation_reason?:
            | Database["public"]["Enums"]["escalation_reason"]
            | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          question?: string
          retrieved_chunk_ids?: string[]
          tenant_id?: string
          ticket_id?: string | null
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          ai_confidence: number | null
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["escalation_reason"]
          resolved_at: string | null
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["escalation_reason"]
          resolved_at?: string | null
          tenant_id: string
          ticket_id: string
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["escalation_reason"]
          resolved_at?: string | null
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_ticket_fk"
            columns: ["ticket_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          source: Database["public"]["Enums"]["kb_source"]
          status: Database["public"]["Enums"]["kb_article_status"]
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: Database["public"]["Enums"]["kb_source"]
          status?: Database["public"]["Enums"]["kb_article_status"]
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: Database["public"]["Enums"]["kb_source"]
          status?: Database["public"]["Enums"]["kb_article_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          article_id: string
          chunk_index: number
          content: string
          content_hash: string
          created_at: string
          embedding: string | null
          embedding_model: string | null
          id: string
          tenant_id: string
          token_count: number
          updated_at: string
        }
        Insert: {
          article_id: string
          chunk_index: number
          content: string
          content_hash: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          tenant_id: string
          token_count?: number
          updated_at?: string
        }
        Update: {
          article_id?: string
          chunk_index?: number
          content?: string
          content_hash?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          tenant_id?: string
          token_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_article_fk"
            columns: ["article_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "kb_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      match_kb_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          article_id: string
          content: string
          distance: number
          id: string
        }[]
      }
    }
    Enums: {
      escalation_reason:
        | "low_confidence"
        | "no_context"
        | "user_request"
        | "policy"
      job_status: "pending" | "running" | "succeeded" | "failed"
      job_type: "embed_article"
      kb_article_status: "draft" | "published" | "archived"
      kb_source: "manual" | "upload" | "url"
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
export type KbArticle = Database["public"]["Tables"]["kb_articles"]["Row"]
export type KbChunk = Database["public"]["Tables"]["kb_chunks"]["Row"]
export type Job = Database["public"]["Tables"]["jobs"]["Row"]
export type Escalation = Database["public"]["Tables"]["escalations"]["Row"]
export type AiInteraction =
  Database["public"]["Tables"]["ai_interactions"]["Row"]

export type UserRole = Database["public"]["Enums"]["user_role"]
export type TenantStatus = Database["public"]["Enums"]["tenant_status"]
export type TicketStatus = Database["public"]["Enums"]["ticket_status"]
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"]
export type TicketChannel = Database["public"]["Enums"]["ticket_channel"]
export type MessageAuthorType =
  Database["public"]["Enums"]["message_author_type"]
export type KbArticleStatus =
  Database["public"]["Enums"]["kb_article_status"]
export type KbSource = Database["public"]["Enums"]["kb_source"]
export type JobType = Database["public"]["Enums"]["job_type"]
export type JobStatus = Database["public"]["Enums"]["job_status"]
export type EscalationReason =
  Database["public"]["Enums"]["escalation_reason"]
