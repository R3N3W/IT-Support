-- Phase 2: ticketing enums.
create type public.ticket_status   as enum ('open', 'pending', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_channel  as enum ('widget', 'email', 'portal');
create type public.message_author_type as enum ('end_user', 'agent', 'ai', 'system');
