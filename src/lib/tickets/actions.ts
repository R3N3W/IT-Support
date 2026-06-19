"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TicketPriority, TicketStatus } from "@/types/database";
import {
  createTicket,
  addMessage,
  setTicketStatus,
  assignTicket,
} from "./service";
import { TICKET_PRIORITIES } from "./schemas";

/** End-user (or agent) files a new ticket, then lands on its detail page. */
export async function createTicketAction(formData: FormData) {
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  const priorityRaw = String(formData.get("priority") ?? "");
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(priorityRaw)
    ? (priorityRaw as TicketPriority)
    : undefined;

  const ticket = await createTicket({ subject, body, priority });
  revalidatePath("/portal");
  redirect(`/portal/tickets/${ticket.id}`);
}

/** Post a reply on a ticket. basePath is "/admin" or "/portal". */
export async function addMessageAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "");
  const basePath = String(formData.get("basePath") ?? "/portal");

  await addMessage({ ticketId, body });
  revalidatePath(`${basePath}/tickets/${ticketId}`);
}

/** Change a ticket's status (agents+; also enforced by RLS). */
export async function setStatusAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "") as TicketStatus;

  await setTicketStatus({ ticketId, status });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
}

/** Assign or unassign a ticket (agents+). Empty value clears the assignee. */
export async function assignAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const assigneeIdRaw = String(formData.get("assigneeId") ?? "");
  const assigneeId = assigneeIdRaw === "" ? null : assigneeIdRaw;

  await assignTicket({ ticketId, assigneeId });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
}
