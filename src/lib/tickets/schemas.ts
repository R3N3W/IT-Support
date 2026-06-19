import { z } from "zod";

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TICKET_CHANNELS = ["widget", "email", "portal"] as const;
export const TICKET_STATUSES = [
  "open",
  "pending",
  "resolved",
  "closed",
] as const;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  channel: z.enum(TICKET_CHANNELS).optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const addMessageSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(10_000),
});
export type AddMessageInput = z.infer<typeof addMessageSchema>;

export const setTicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(TICKET_STATUSES),
});
export type SetTicketStatusInput = z.infer<typeof setTicketStatusSchema>;

export const assignTicketSchema = z.object({
  ticketId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
});
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const listTicketsSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .default({});
export type ListTicketsInput = z.infer<typeof listTicketsSchema>;
