import { getTenantDb } from "@/lib/db/with-tenant";
import { hasAtLeastRole } from "@/lib/auth/session";
import type { Ticket, TicketMessage } from "@/types/database";
import {
  createTicketSchema,
  addMessageSchema,
  setTicketStatusSchema,
  requesterSetStatusSchema,
  assignTicketSchema,
  listTicketsSchema,
  type CreateTicketInput,
  type AddMessageInput,
  type SetTicketStatusInput,
  type RequesterSetStatusInput,
  type AssignTicketInput,
  type ListTicketsInput,
} from "./schemas";

/**
 * Ticketing service. Every call runs through the RLS-bound tenant DAL, so the
 * database enforces tenant isolation and role-based access regardless of what
 * happens here. These functions add explicit tenant scoping and set the
 * author/role-derived fields; they NEVER use the service-role client.
 *
 * Intended to be wrapped by Server Actions / Route Handlers in the UI phase.
 */

/**
 * Create a ticket and its first message atomically (one transaction) via the
 * create_ticket_with_message RPC. The function is SECURITY INVOKER, so RLS still
 * scopes the inserts to the caller's tenant and identity.
 */
export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const data = createTicketSchema.parse(input);
  const db = await getTenantDb();

  const { data: ticket, error } = await db.raw.rpc(
    "create_ticket_with_message",
    {
      p_subject: data.subject,
      p_body: data.body,
      p_priority: data.priority ?? "normal",
      p_channel: data.channel ?? "portal",
    },
  );

  if (error || !ticket) {
    throw new Error(`Failed to create ticket: ${error?.message}`);
  }

  return ticket;
}

/**
 * Reopen ('open') or close ('closed') a ticket as its requester. Allowed by the
 * requester-own UPDATE policy and confined to status-only/open-or-closed by the
 * tickets_protect_immutable trigger.
 */
export async function requesterSetTicketStatus(
  input: RequesterSetStatusInput,
): Promise<Ticket> {
  const data = requesterSetStatusSchema.parse(input);
  const db = await getTenantDb();

  const { data: ticket, error } = await db.raw
    .from("tickets")
    .update({ status: data.status })
    .eq("id", data.ticketId)
    .eq("tenant_id", db.ctx.tenantId)
    .select("*")
    .single();

  if (error || !ticket) {
    throw new Error(`Failed to update ticket: ${error?.message}`);
  }
  return ticket;
}

/** List tickets visible to the caller (RLS: own for end-users, all for agents+). */
export async function listTickets(
  input?: ListTicketsInput,
): Promise<Ticket[]> {
  const { status, limit, offset } = listTicketsSchema.parse(input ?? {});
  const db = await getTenantDb();

  // Filters first (stay on the filter builder), then order/range.
  let filter = db.raw
    .from("tickets")
    .select("*")
    .eq("tenant_id", db.ctx.tenantId);
  if (status) filter = filter.eq("status", status);

  const { data, error } = await filter
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to list tickets: ${error.message}`);
  return data ?? [];
}

/** Fetch a single ticket plus its thread (RLS decides visibility). */
export async function getTicketWithMessages(ticketId: string): Promise<{
  ticket: Ticket;
  messages: TicketMessage[];
} | null> {
  const db = await getTenantDb();

  const { data: ticket } = await db.raw
    .from("tickets")
    .select("*")
    .eq("tenant_id", db.ctx.tenantId)
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return null;

  const { data: messages, error } = await db.raw
    .from("ticket_messages")
    .select("*")
    .eq("tenant_id", db.ctx.tenantId)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load messages: ${error.message}`);

  return { ticket, messages: messages ?? [] };
}

/** Post a reply. author_type is derived from the caller's role server-side. */
export async function addMessage(
  input: AddMessageInput,
): Promise<TicketMessage> {
  const data = addMessageSchema.parse(input);
  const db = await getTenantDb();

  const { data: message, error } = await db.raw
    .from("ticket_messages")
    .insert({
      tenant_id: db.ctx.tenantId,
      ticket_id: data.ticketId,
      author_id: db.ctx.userId,
      author_type: hasAtLeastRole(db.ctx.role, "agent") ? "agent" : "end_user",
      body: data.body,
    })
    .select("*")
    .single();

  if (error || !message) {
    throw new Error(`Failed to add message: ${error?.message}`);
  }
  return message;
}

/** Change ticket status (agents and above; also enforced by RLS). */
export async function setTicketStatus(
  input: SetTicketStatusInput,
): Promise<Ticket> {
  const data = setTicketStatusSchema.parse(input);
  const db = await getTenantDb();
  if (!hasAtLeastRole(db.ctx.role, "agent")) throw new Error("FORBIDDEN");

  const { data: ticket, error } = await db.raw
    .from("tickets")
    .update({ status: data.status })
    .eq("id", data.ticketId)
    .eq("tenant_id", db.ctx.tenantId)
    .select("*")
    .single();

  if (error || !ticket) {
    throw new Error(`Failed to update status: ${error?.message}`);
  }
  return ticket;
}

/** Assign (or unassign) a ticket to an agent in the same tenant. */
export async function assignTicket(
  input: AssignTicketInput,
): Promise<Ticket> {
  const data = assignTicketSchema.parse(input);
  const db = await getTenantDb();
  if (!hasAtLeastRole(db.ctx.role, "agent")) throw new Error("FORBIDDEN");

  const { data: ticket, error } = await db.raw
    .from("tickets")
    .update({ assignee_id: data.assigneeId })
    .eq("id", data.ticketId)
    .eq("tenant_id", db.ctx.tenantId)
    .select("*")
    .single();

  if (error || !ticket) {
    throw new Error(`Failed to assign ticket: ${error?.message}`);
  }
  return ticket;
}
