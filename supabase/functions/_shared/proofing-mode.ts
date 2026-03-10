import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

/**
 * Check if proofing mode is enabled.
 * When ON, emails should be logged to email_logs instead of sent.
 */
export async function isProofingMode(): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("feature_flags")
    .select("is_enabled")
    .eq("flag_name", "proofing_mode")
    .single();

  return data?.is_enabled === true;
}

/**
 * Log an email that would have been sent (used in proofing mode).
 */
export async function logEmail(params: {
  to: string;
  subject: string;
  bodyPreview: string;
  functionName: string;
  profileId?: string;
}): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from("email_logs").insert({
    to_address: params.to,
    subject: params.subject,
    body_preview: params.bodyPreview.substring(0, 500),
    function_name: params.functionName,
    profile_id: params.profileId || null,
    triggered_at: new Date().toISOString(),
  });

  console.log(`[PROOFING] Email logged (not sent): to=${params.to}, subject=${params.subject}`);
}
