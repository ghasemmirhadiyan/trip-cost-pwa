import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(token);
  if (callerError || !caller) return json({ error: "Authentication required" }, 401);

  const body = await req.json().catch(() => null);
  const tripId = body?.trip_id;
  const name = String(body?.name || "").trim();
  const username = String(body?.username || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const phone = String(body?.phone || "").trim() || null;
  const shareWeight = Math.max(Number(body?.share_weight ?? 1), 0.001);
  const contributionTarget = Math.max(Number(body?.contribution_target ?? 0), 0);
  const role = body?.role === "admin" ? "admin" : "member";

  if (!tripId || !name || !username || !password) return json({ error: "نام، نام کاربری و رمز عبور الزامی است." }, 400);
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ error: "نام کاربری باید ۳ تا ۴۰ کاراکتر و شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد." }, 400);
  if (password.length < 6) return json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد." }, 400);

  const { data: callerMember } = await adminClient.from("trip_members").select("role").eq("trip_id", tripId).eq("user_id", caller.id).eq("active", true).maybeSingle();
  if (callerMember?.role !== "admin") return json({ error: "فقط مدیر سفر می‌تواند حساب بسازد." }, 403);

  const internalEmail = `${username}@trip.local`;
  const { data: existingProfile } = await adminClient.from("profiles").select("user_id").eq("username", username).maybeSingle();
  if (existingProfile) return json({ error: "این نام کاربری قبلاً استفاده شده است." }, 409);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone, username },
  });
  if (createError || !created.user) return json({ error: createError?.message || "ساخت حساب انجام نشد." }, 400);

  const newUserId = created.user.id;
  try {
    const { error: profileError } = await adminClient.from("profiles").insert({ user_id: newUserId, display_name: name, phone, username });
    if (profileError) throw profileError;

    const { data: member, error: memberError } = await adminClient.from("trip_members").insert({
      trip_id: tripId, user_id: newUserId, name, role, share_weight: shareWeight, contribution_target: contributionTarget, active: true,
    }).select("id").single();
    if (memberError) throw memberError;

    return json({ ok: true, user_id: newUserId, member_id: member.id, username, name });
  } catch (e) {
    await adminClient.auth.admin.deleteUser(newUserId);
    return json({ error: e?.message || "ثبت عضو انجام نشد." }, 400);
  }
});
