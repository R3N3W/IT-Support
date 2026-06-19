// One-off helper: provision a smoke-test tenant with an agent + an end-user
// (real login passwords) so the UI can be driven end to end. Prints credentials.
// Tear down afterward (see smoke-teardown.mjs or delete by the printed slug).
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suffix = Date.now().toString(36);
const slug = `smoke-co-${suffix}`;
const agentEmail = `smoke-agent-${suffix}@example.test`;
const userEmail = `smoke-user-${suffix}@example.test`;
const password = "SmokeTest!2026";

const { data: tenant, error: tErr } = await admin
  .from("tenants")
  .insert({ name: "Smoke Co", slug })
  .select("id")
  .single();
if (tErr) {
  console.error("tenant insert:", tErr.message);
  process.exit(1);
}
const tenantId = tenant.id;

async function makeUser(email, role, displayName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role },
  });
  if (error) {
    console.error("createUser:", error.message);
    process.exit(1);
  }
  const { error: pErr } = await admin.from("users").upsert({
    id: data.user.id,
    tenant_id: tenantId,
    role,
    email,
    display_name: displayName,
  });
  if (pErr) {
    console.error("profile upsert:", pErr.message);
    process.exit(1);
  }
  return data.user.id;
}

const agentId = await makeUser(agentEmail, "agent", "Smoke Agent");
const userId = await makeUser(userEmail, "end_user", "Smoke User");

console.log(
  JSON.stringify(
    { tenantId, slug, agentEmail, userEmail, password, agentId, userId },
    null,
    2,
  ),
);
