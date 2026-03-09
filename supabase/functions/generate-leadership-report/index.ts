import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[leadership-report] Starting for profile ${profileId}`);

    // Create report record
    const { data: report, error: reportErr } = await supabase
      .from("leadership_reports")
      .insert({ profile_id: profileId, status: "generating" })
      .select("id, share_token")
      .single();

    if (reportErr) throw reportErr;
    const reportId = report.id;

    // ====== GATHER ALL DATA ======
    const [profileRes, contextRes, capabilitiesRes, capLevelsRes, insightsRes] = await Promise.all([
      supabase.from("profiles").select("full_name, job_title, role, email, company_id, team_size").eq("id", profileId).single(),
      supabase.from("user_active_context").select("*").eq("profile_id", profileId).maybeSingle(),
      supabase.from("capabilities").select("id, name, category, description").eq("status", "approved").limit(100),
      supabase.from("capability_levels").select("capability_id, level, description"),
      supabase.from("coaching_insights").select("insight_text, insight_type").eq("profile_id", profileId).eq("is_active", true).limit(20),
    ]);

    const profile = profileRes.data;
    const context = contextRes.data as any;
    const allCapabilities = capabilitiesRes.data || [];
    const capLevels = capLevelsRes.data || [];
    const insights = insightsRes.data || [];

    if (!profile) throw new Error("Profile not found");

    let companyName = "";
    let companyId = profile.company_id;
    if (companyId) {
      const { data: co } = await supabase.from("companies").select("name").eq("id", companyId).single();
      companyName = co?.name || "";
    }

    // Update report with company_id
    await supabase.from("leadership_reports").update({ company_id: companyId, delivery_email: profile.email }).eq("id", reportId);

    // Extract onboarding data
    const od = context?.onboarding_data || {};
    const name = profile.full_name || "Leader";
    const title = profile.job_title || profile.role || od.role_org || "Professional";
    const organization = companyName || od.role_org || "";
    const tenure = od.tenure || "Not specified";
    const teamSize = profile.team_size || od.team_size || null;
    const engagementScore = od.engagement_score || null;
    const careerGrowthScore = od.career_growth_score || null;
    const roleClarityScore = od.role_clarity_score || null;
    const visionGreatYear = od.vision_great_year || "";
    const naturalStrengths = od.natural_strengths || "";
    const hardestPart = od.hardest_part || "";
    const obstacles = od.obstacles || "";
    const proudestAccomplishment = od.proudest_accomplishment || "";
    const learningFormats = od.learning_formats || "";
    const timeAvailable = od.time_available || "";

    // ====== STEP 1: CAPABILITY MAPPING ======
    console.log(`[leadership-report] Step 1: Capability mapping`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const capMappingPrompt = `You are an expert organizational development consultant. Select 10-12 capabilities most relevant for this person and assign levels.

PERSON:
- Name: ${name}
- Title/Role: ${title}
- Organization: ${organization}
- Tenure: ${tenure}
- Team Size: ${teamSize || "Unknown"}
- Engagement: ${engagementScore}/10
- Career Growth Satisfaction: ${careerGrowthScore}/10
- Role Clarity: ${roleClarityScore}/10
- Natural Strengths: ${naturalStrengths}
- Biggest Challenge: ${hardestPart}
- Obstacles: ${obstacles}

AVAILABLE CAPABILITIES:
${allCapabilities.map((c: any) => `- ${c.name} (${c.category}): ${c.description || ""}`).join("\n")}

INSTRUCTIONS:
1. Select 10-12 capabilities most relevant to "${title}" role
2. Assign current_level (1-4) based on tenure "${tenure}" and self-reported data
3. For top 3 priorities: target = current + 1
4. For 2 stretch goals: target = current + 2
5. Remaining: target = current (on track)

Return JSON only:
{
  "capability_matrix": [
    {
      "capability_name": "string",
      "capability_id": "uuid from the list",
      "category": "string",
      "current_level": 1-4,
      "target_level": 1-4,
      "is_priority": boolean,
      "is_stretch": boolean,
      "rationale": "Why this level assignment"
    }
  ]
}`;

    const capResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: capMappingPrompt }],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!capResponse.ok) {
      const err = await capResponse.text();
      console.error("Cap mapping AI error:", capResponse.status, err);
      throw new Error(`Capability mapping failed: ${capResponse.status}`);
    }

    const capData = await capResponse.json();
    let capMatrix;
    try {
      capMatrix = JSON.parse(capData.choices[0].message.content);
    } catch {
      const match = capData.choices[0].message.content.match(/\{[\s\S]*\}/);
      capMatrix = match ? JSON.parse(match[0]) : { capability_matrix: [] };
    }

    const matrix = capMatrix.capability_matrix || [];
    console.log(`[leadership-report] Mapped ${matrix.length} capabilities`);

    // Store matrix
    await supabase.from("leadership_reports").update({ capability_matrix: matrix }).eq("id", reportId);

    // Build level definitions lookup
    const levelDefs: Record<string, Record<string, string>> = {};
    for (const cl of capLevels) {
      if (!levelDefs[cl.capability_id]) levelDefs[cl.capability_id] = {};
      levelDefs[cl.capability_id][cl.level] = cl.description;
    }

    // Build enriched matrix with level definitions
    const enrichedMatrix = matrix.map((m: any) => {
      const defs = levelDefs[m.capability_id] || {};
      return { ...m, level_definitions: defs };
    });

    // ====== STEP 2: REPORT GENERATION ======
    console.log(`[leadership-report] Step 2: Report generation`);

    const levelName = (n: number) => ["", "foundational", "advancing", "independent", "mastery"][n] || "foundational";
    const totalCaps = matrix.length;

    const MASTER_PROMPT = `You are generating a Leadership Acceleration Report for Jericho by The Momentum Company.

This is a comprehensive, personalized growth document for a leader. It must feel premium, specific, and actionable — never generic.

PERSON CONTEXT:
- Name: ${name}
- Title: ${title}
- Organization: ${organization}
- Tenure: ${tenure}
- Team Size: ${teamSize || "Not specified"}
- Engagement Score: ${engagementScore}/10
- Career Growth Satisfaction: ${careerGrowthScore}/10
- Role Clarity: ${roleClarityScore}/10
- Vision for Great Year: ${visionGreatYear}
- Natural Strengths: ${naturalStrengths}
- Hardest Part of Job: ${hardestPart}
- Obstacles: ${obstacles}
- Proudest Accomplishment: ${proudestAccomplishment}
- Learning Preferences: ${learningFormats}
- Weekly Development Time: ${timeAvailable}
- Total Capabilities Assessed: ${totalCaps}

COACHING INSIGHTS OBSERVED:
${insights.map((i: any) => `- ${i.insight_text}`).join("\n") || "None yet"}

CAPABILITY MATRIX:
${JSON.stringify(enrichedMatrix, null, 2)}

REPORT STRUCTURE — Follow exactly:

SECTION 1: EXECUTIVE SUMMARY (200-300 words)
- Open with a personal, encouraging assessment of ${name}'s position
- Highlight their key strengths (reference ${naturalStrengths})
- Name 2-3 areas of opportunity
- Set the tone: "This report is your roadmap."

SECTION 2: LEADERSHIP PROFILE (300-400 words)
- Role context and what success looks like for "${title}"
- Tenure analysis: What ${tenure} in role typically means for development stage
- Team dynamics (if team_size > 0)
- Self-awareness assessment based on their diagnostic scores

SECTION 3: PATTERN ANALYSIS (400-500 words)
- Cross-reference engagement (${engagementScore}), career growth (${careerGrowthScore}), and clarity (${roleClarityScore})
- Identify the STORY these scores tell together (not just individual interpretations)
- Connect obstacles "${obstacles}" to score patterns
- Surface hidden strengths from "${proudestAccomplishment}"
- Name the 1-2 patterns that, if shifted, would create the most momentum

SECTION 4: THE BIG 3 — PRIORITY CAPABILITIES (800-1200 words)
For each of the top 3 priority capabilities from the matrix:
- Current Assessment: Where ${name} stands today (reference their role, not generic)
- Why This Matters: Business impact specific to "${title}" at "${organization}"
- The Path Forward: Concrete progression from current to target level
- Recommended Actions: 3-4 specific, actionable steps with resource types
- Quick Win: One thing they can do THIS WEEK
Each Big 3 section MUST have different action items — no overlap.

SECTION 5: DEVELOPMENT ROADMAP (300-400 words)
- Month 1: "Start Now" — immediate actions for the Big 3
- Month 2-3: "Build Momentum" — deeper skill building
- Month 3+: "Sustain & Stretch" — stretch goals and advanced development
- Tie back to "${visionGreatYear}"
- Reference preferred learning format: "${learningFormats}"

SECTION 6: LEARNING STRATEGY (200-300 words)
- Personalized to "${learningFormats}" preference
- Realistic given "${timeAvailable}" weekly time commitment
- Mix of free and paid resources
- Specific recommendations (real books, courses, podcasts — not made up)

SECTION 7: YOUR NEXT MOVE (200-300 words)
- 3 specific next steps they should take TODAY
- CTA: "Start your free coaching conversation → askjericho.com/try"
- CTA: "Download the full Jericho platform → askjericho.com"
- Close with a motivating, personalized statement that references their vision

FORMATTING:
- Use markdown headers (## for sections, ### for subsections)
- Use bold for key terms and emphasis
- Use bullet points and numbered lists for actions
- Include at least 6 CTAs linking to askjericho.com/try or askjericho.com throughout
- Write in second person ("you") — direct, warm, coaching voice
- Total target: 4,000-7,000 words
- Every sentence must be complete — never truncate`;

    const reportResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: MASTER_PROMPT },
          { role: "user", content: "Generate the Leadership Acceleration Report. Follow every section specification exactly." },
        ],
        temperature: 0.8,
        max_tokens: 16000,
      }),
    });

    if (!reportResponse.ok) {
      const err = await reportResponse.text();
      console.error("Report generation AI error:", reportResponse.status, err);
      if (reportResponse.status === 429) {
        await supabase.from("leadership_reports").update({ status: "rate_limited" }).eq("id", reportId);
        return new Response(JSON.stringify({ error: "Rate limited, will retry" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Report generation failed: ${reportResponse.status}`);
    }

    const reportData = await reportResponse.json();
    const reportText = reportData.choices?.[0]?.message?.content || "";

    // ====== STEP 3: QUALITY GATES ======
    console.log(`[leadership-report] Step 3: Quality gates`);

    const wordCount = reportText.split(/\s+/).length;
    const hasBig3 = reportText.toLowerCase().includes("big 3") || reportText.toLowerCase().includes("priority capabilities");
    const ctaCount = (reportText.match(/askjericho\.com/gi) || []).length;
    const truncatedSentences = (reportText.match(/[^.!?]\s*$/gm) || []).length;
    
    // Check for duplicate action items across Big 3 sections
    const actionMatches = reportText.match(/(?:quick win|recommended action|action item)[:\s]*([^\n]+)/gi) || [];
    const uniqueActions = new Set(actionMatches.map((a: string) => a.toLowerCase().trim()));
    const hasUniqueActions = uniqueActions.size >= actionMatches.length * 0.7;

    const qualityChecks = {
      word_count: wordCount,
      word_count_pass: wordCount >= 3500 && wordCount <= 8000,
      has_big_3: hasBig3,
      cta_count: ctaCount,
      cta_pass: ctaCount >= 6,
      truncated_sentences: truncatedSentences,
      unique_actions: hasUniqueActions,
      overall_pass: wordCount >= 3500 && hasBig3 && ctaCount >= 4,
    };

    console.log(`[leadership-report] Quality: ${wordCount} words, ${ctaCount} CTAs, Big3: ${hasBig3}`);

    // Parse report into sections for structured storage
    const sections: Record<string, string> = {};
    const sectionRegex = /##\s+(.+?)(?=\n##\s|\n*$)/gs;
    let match;
    let lastKey = "intro";
    const lines = reportText.split("\n");
    let currentSection = "";
    let currentContent = "";

    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (currentSection) sections[currentSection] = currentContent.trim();
        currentSection = line.replace("## ", "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
        currentContent = "";
      } else {
        currentContent += line + "\n";
      }
    }
    if (currentSection) sections[currentSection] = currentContent.trim();

    const reportContent = {
      full_text: reportText,
      sections,
      metadata: {
        name,
        title,
        organization,
        generated_at: new Date().toISOString(),
        model_used: "gemini-2.5-pro",
      },
    };

    // ====== STEP 4 & 5: Store + Email ======
    console.log(`[leadership-report] Step 5: Email delivery`);

    const reportUrl = `https://askjericho.com/report/${report.share_token}`;

    // Update report record
    await supabase.from("leadership_reports").update({
      status: qualityChecks.overall_pass ? "completed" : "completed_with_warnings",
      report_content: reportContent,
      word_count: wordCount,
      quality_checks: qualityChecks,
      pdf_url: reportUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", reportId);

    // Store report URL in user_active_context
    await supabase.from("user_active_context").update({
      report_url: reportUrl,
    }).eq("profile_id", profileId);

    // Extract teaser insight from Pattern Analysis section
    const patternSection = sections["pattern_analysis"] || sections["3_pattern_analysis"] || 
      Object.values(sections).find((v: string) => v.toLowerCase().includes("pattern")) || "";
    const teaserLines = patternSection.split("\n").filter((l: string) => l.trim().length > 30);
    const teaser = teaserLines[0]?.replace(/^[#*\-\s]+/, "").trim() || 
      `Based on your diagnostic scores and self-assessment, we've identified key patterns that will accelerate your growth.`;

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY && profile.email) {
      const firstName = name.split(" ")[0];
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Jericho <jericho@sender.askjericho.com>",
            to: [profile.email],
            subject: `${name}, your Leadership Acceleration Report is ready`,
            html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" style="background-color:#0F1419;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" style="max-width:600px;width:100%;">

<tr><td align="center" style="padding-bottom:32px;">
  <table role="presentation"><tr>
    <td style="background:linear-gradient(135deg,#E5A530,#F5C563);width:48px;height:48px;border-radius:12px;text-align:center;vertical-align:middle;">
      <span style="font-size:24px;font-weight:bold;color:#0F1419;">J</span>
    </td>
    <td style="padding-left:12px;"><span style="font-size:28px;font-weight:700;color:#FFF;">Jericho</span></td>
  </tr></table>
</td></tr>

<tr><td>
<table role="presentation" width="100%" style="background:linear-gradient(180deg,#1A2332,#151D2B);border-radius:16px;border:1px solid rgba(229,165,48,0.2);">
<tr><td style="padding:40px 40px 24px;">
  <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFF;">Your Leadership Acceleration Report is Ready 🚀</h1>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <p style="margin:0;font-size:16px;line-height:1.7;color:#9CA3AF;">Hey ${firstName},</p>
  <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#9CA3AF;">I've analyzed your diagnostic data and built a personalized leadership development plan just for you. Here's a preview:</p>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <table role="presentation" width="100%" style="background:rgba(229,165,48,0.08);border-radius:12px;border:1px solid rgba(229,165,48,0.25);">
  <tr><td style="padding:24px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#E5A530;text-transform:uppercase;letter-spacing:1px;">📊 KEY INSIGHT</p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#D1D5DB;font-style:italic;">"${teaser}"</p>
  </td></tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px 16px;">
  <table role="presentation" width="100%">
  <tr>
    <td style="width:33%;text-align:center;padding:12px 4px;">
      <p style="margin:0;font-size:28px;font-weight:700;color:#E5A530;">${totalCaps}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Capabilities</p>
    </td>
    <td style="width:33%;text-align:center;padding:12px 4px;">
      <p style="margin:0;font-size:28px;font-weight:700;color:#60A5FA;">${matrix.filter((m: any) => m.is_priority).length}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Priorities</p>
    </td>
    <td style="width:33%;text-align:center;padding:12px 4px;">
      <p style="margin:0;font-size:28px;font-weight:700;color:#34D399;">${wordCount.toLocaleString()}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Words</p>
    </td>
  </tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px 32px;" align="center">
  <table role="presentation"><tr>
    <td style="border-radius:10px;background:linear-gradient(135deg,#E5A530,#D4942A);box-shadow:0 4px 14px rgba(229,165,48,0.35);">
      <a href="${reportUrl}" style="display:inline-block;padding:16px 48px;font-size:16px;font-weight:600;color:#0F1419;text-decoration:none;border-radius:10px;">Download Your Report →</a>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:0 40px 40px;" align="center">
  <p style="margin:0 0 16px;font-size:14px;color:#6B7280;">Ready to take action on your report?</p>
  <a href="https://askjericho.com/try" style="font-size:14px;color:#60A5FA;text-decoration:underline;">Start your free coaching conversation with Jericho →</a>
</td></tr>

</table>
</td></tr>

<tr><td style="padding:32px 20px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#4B5563;">Powered by The Momentum Company</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`,
          }),
        });

        await supabase.from("leadership_reports").update({ 
          delivered_at: new Date().toISOString() 
        }).eq("id", reportId);

        console.log(`[leadership-report] Email delivered to ${profile.email}`);
      } catch (emailErr) {
        console.error("Email delivery error:", emailErr);
      }
    }

    // ====== STEP 6: Also trigger IGP generation ======
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-growth-plan-recommendations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile_id: profileId }),
      });
      console.log(`[leadership-report] IGP generation triggered`);
    } catch (e) {
      console.error("IGP trigger error (non-blocking):", e);
    }

    console.log(`[leadership-report] Complete! Report ${reportId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      reportId, 
      reportUrl,
      wordCount,
      qualityChecks,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[leadership-report] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
