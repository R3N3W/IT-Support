"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createTicket,
  addMessage,
  setTicketStatus,
  requesterSetTicketStatus,
  assignTicket,
} from "./service";
import {
  createTicketSchema,
  addMessageSchema,
  requesterSetStatusSchema,
  setTicketStatusSchema,
  assignTicketSchema,
  type ActionState,
} from "./schemas";

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

/** End-user (or agent) files a new ticket, then lands on its detail page. */
export async function createTicketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const priorityRaw = formData.get("priority");
  const parsed = createTicketSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    priority: priorityRaw ? priorityRaw : undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let ticketId: string;
  try {
    const ticket = await createTicket(parsed.data);
    ticketId = ticket.id;
  } catch (err) {
    return { error: messageOf(err) };
  }

  revalidatePath("/portal");
  redirect(`/portal/tickets/${ticketId}`); // outside try: redirect() throws by design
}

/** Post a reply on a ticket. basePath is "/admin" or "/portal". */
export async function addMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addMessageSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const basePath = String(formData.get("basePath") ?? "/portal");
  try {
    await addMessage(parsed.data);
  } catch (err) {
    return { error: messageOf(err) };
  }

  revalidatePath(`${basePath}/tickets/${parsed.data.ticketId}`);
  return { error: null };
}

/** Requester reopens/closes their own ticket. */
export async function requesterSetStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requesterSetStatusSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    await requesterSetTicketStatus(parsed.data);
  } catch (err) {
    return { error: messageOf(err) };
  }

  revalidatePath(`/portal/tickets/${parsed.data.ticketId}`);
  return { error: null };
}

/** Change a ticket's status (agents+; also enforced by RLS). */
export async function setStatusAction(formData: FormData) {
  const { ticketId, status } = setTicketStatusSchema.parse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
  });

  await setTicketStatus({ ticketId, status });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
}

/** Assign or unassign a ticket (agents+). Empty value clears the assignee. */
export async function assignAction(formData: FormData) {
  const assigneeIdRaw = formData.get("assigneeId");
  const { ticketId, assigneeId } = assignTicketSchema.parse({
    ticketId: formData.get("ticketId"),
    assigneeId:
      assigneeIdRaw === null || assigneeIdRaw === "" ? null : assigneeIdRaw,
  });

  await assignTicket({ ticketId, assigneeId });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
}
