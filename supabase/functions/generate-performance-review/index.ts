import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employeeId, reviewPeriod } = await req.json();

    console.log("Generating performance review for employee:", employeeId);

    // Get employee details
    const { data: employee } = await supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", employeeId)
      .single();

    // Get 1-on-1 notes from the review period
    const { data: oneOnOnes } = await supabase
      .from("one_on_one_notes")
      .select("meeting_date, notes, wins, concerns, action_items")
      .eq("employee_id", employeeId)
      .order("meeting_date", { ascending: false })
      .limit(10);

    // Get recognition received
    const { data: recognition } = await supabase
      .from("recognition_notes")
      .select("title, description, category, recognition_date")
      .eq("given_to", employeeId)
      .order("recognition_date", { ascending: false })
      .limit(20);

    // Get capability progress
    const { data: capabilities } = await supabase
      .from("employee_capabilities")
      .select(`
        current_level,
        target_level,
        priority,
        capability:capabilities(name, category)
      `)
      .eq("profile_id", employeeId);

    // Get goals
    const { data: goals } = await supabase
      .from("ninety_day_targets")
      .select("goal_text, completed, category")
      .eq("profile_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get capability adjustments (manager feedback)
    const { data: adjustments } = await supabase
      .from("capability_adjustments")
      .select("previous_level, new_level, adjustment_reason, created_at")
      .eq("profile_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Construct context for AI
    const context = {
      employee: {
        name: employee?.full_name || "Employee",
        role: employee?.role || "Team Member"
      },
      reviewPeriod,
      oneOnOneNotes: oneOnOnes || [],
      recognition: recognition || [],
      capabilities: capabilities || [],
      goals: {
        all: goals || [],
        completed: goals?.filter(g => g.completed) || [],
        inProgress: goals?.filter(g => !g.completed) || []
      },
      capabilityAdjustments: adjustments || []
    };

    // Generate review using Lovable AI
    const prompt = `You are an expert performance review writer helping a manager create a comprehensive, fair, and constructive performance review.

EMPLOYEE CONTEXT:
- Name: ${context.employee.name}
- Role: ${context.employee.role}
- Review Period: ${reviewPeriod}

1-ON-1 MEETING NOTES:
${context.oneOnOneNotes.map(note => `
Date: ${note.meeting_date}
Wins: ${note.wins || 'None recorded'}
Concerns: ${note.concerns || 'None recorded'}
Notes: ${note.notes || 'No notes'}
`).join('\n')}

RECOGNITION RECEIVED:
${context.recognition.map(rec => `
- ${rec.title} (${rec.category || 'General'})
  ${rec.description}
`).join('\n')}

GOALS STATUS:
Completed (${context.goals.completed.length}/${context.goals.all.length}):
${context.goals.completed.map(g => `✓ ${g.goal_text}`).join('\n')}

In Progress:
${context.goals.inProgress.map(g => `○ ${g.goal_text}`).join('\n')}

CAPABILITY DEVELOPMENT:
${context.capabilities.map((cap: any) => `
- ${cap.capability.name} (${cap.capability.category})
  Current: ${cap.current_level} → Target: ${cap.target_level} (Priority: ${cap.priority})
`).join('\n')}

MANAGER FEEDBACK THROUGHOUT PERIOD:
${context.capabilityAdjustments.map(adj => `
- Level change: ${adj.previous_level} → ${adj.new_level}
  Reason: ${adj.adjustment_reason || 'Not specified'}
`).join('\n')}

Write a comprehensive performance review that includes:

1. **Overall Performance Summary** (2-3 paragraphs)
   - Synthesize the overall performance and growth
   - Reference specific examples from the data above

2. **Key Strengths** (bullet points)
   - Highlight 3-5 specific strengths with examples

3. **Areas for Improvement** (bullet points)
   - Identify 2-3 constructive areas for growth
   - Frame positively and include actionable suggestions

4. **Goal Achievement Analysis**
   - Comment on goal completion rate and quality
   - Note any patterns or standout achievements

5. **Development Progress**
   - Assess capability growth based on the adjustments and targets
   - Highlight progress and remaining development areas

6. **Recommendations for Next Period**
   - Suggest 2-3 focus areas
   - Recommend development opportunities

Keep the tone professional, balanced, and constructive. Use specific examples from the data. Be honest but supportive. This should help the employee understand their performance and grow.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reviewText = aiData.choices[0].message.content;

    console.log("Review generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        review: reviewText,
        context: {
          oneOnOneCount: context.oneOnOneNotes.length,
          recognitionCount: context.recognition.length,
          goalsCompleted: context.goals.completed.length,
          goalsTotal: context.goals.all.length
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error generating review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
