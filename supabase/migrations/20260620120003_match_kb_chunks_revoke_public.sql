-- New functions grant EXECUTE to PUBLIC by default, which would let the anon
-- role call the SECURITY DEFINER retrieval RPC. Lock it to authenticated +
-- service_role only. (authenticated access is intentional: the function hard-
-- filters to the caller's tenant and, for non-agents, to published articles.)
revoke execute on function public.match_kb_chunks(extensions.vector, integer)
  from public, anon;
grant execute on function public.match_kb_chunks(extensions.vector, integer)
  to authenticated, service_role;
