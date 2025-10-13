import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logId } = await req.json();
    console.log("Processing email reply log:", logId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the email log entry
    const { data: logEntry, error: logError } = await supabase
      .from("email_reply_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !logEntry) {
      throw new Error("Email log not found");
    }

    console.log("Found log entry for:", logEntry.email_from);

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_id")
      .eq("email", logEntry.email_from.toLowerCase())
      .single();

    if (profileError || !profile) {
      console.error("User not found for email:", logEntry.email_from);
      
      // Send automated response
      await supabase.functions.invoke("send-email-reply", {
        body: {
          toEmail: logEntry.email_from,
          subject: `Re: ${logEntry.email_subject}`,
          bodyText: `Hi there,\n\nI couldn't find your account in our system. Please make sure you're replying from the email address associated with your account, or contact support for assistance.\n\nBest,\nJericho`,
        },
      });

      await supabase
        .from("email_reply_logs")
        .update({
          processing_status: "error",
          error_message: "User not found",
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found user:", profile.full_name);

    // Rate limiting: Check emails in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { count } = await supabase
      .from("email_reply_logs")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("created_at", oneDayAgo.toISOString());

    if (count && count > 10) {
      console.log("Rate limit exceeded for user:", profile.id);
      
      await supabase.functions.invoke("send-email-reply", {
        body: {
          toEmail: profile.email,
          subject: `Re: ${logEntry.email_subject}`,
          bodyText: `Hi ${profile.full_name || 'there'},\n\nYou've reached the daily limit for email conversations. Please use the web app for extended conversations, or try again tomorrow.\n\nBest,\nJericho`,
        },
      });

      await supabase
        .from("email_reply_logs")
        .update({
          processing_status: "rate_limited",
          profile_id: profile.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({ error: "Rate limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create conversation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("source", "email")
      .gte("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: false })
      .limit(1);

    let conversationId: string;

    if (conversations && conversations.length > 0) {
      conversationId = conversations[0].id;
      console.log("Using existing conversation:", conversationId);
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          profile_id: profile.id,
          company_id: profile.company_id,
          title: "Email Conversation",
          source: "email",
        })
        .select()
        .single();

      if (convError || !newConv) {
        throw new Error("Failed to create conversation");
      }

      conversationId = newConv.id;
      console.log("Created new conversation:", conversationId);
    }

    // Store user's message in conversation
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: logEntry.email_body,
    });

    // Call chat-with-jericho to generate response
    console.log("Calling chat-with-jericho...");
    const { data: chatResponse, error: chatError } = await supabase.functions.invoke(
      "chat-with-jericho",
      {
        body: {
          conversationId,
          message: logEntry.email_body,
          stream: false,
        },
      }
    );

    if (chatError) {
      console.error("Error calling chat-with-jericho:", chatError);
      throw chatError;
    }

    const jerichoResponse = chatResponse.message || "I'm having trouble responding right now. Please try again later.";
    console.log("Got Jericho response, length:", jerichoResponse.length);

    // Send email reply
    const { error: sendError } = await supabase.functions.invoke("send-email-reply", {
      body: {
        toEmail: profile.email,
        toName: profile.full_name,
        subject: `Re: ${logEntry.email_subject}`,
        bodyText: jerichoResponse,
        inReplyTo: logEntry.parsed_data?.message_id,
      },
    });

    if (sendError) {
      console.error("Error sending email reply:", sendError);
      throw sendError;
    }

    // Update log as processed
    await supabase
      .from("email_reply_logs")
      .update({
        processing_status: "processed",
        profile_id: profile.id,
        processed_at: new Date().toISOString(),
        parsed_data: {
          ...logEntry.parsed_data,
          conversation_id: conversationId,
          response_sent: true,
        },
      })
      .eq("id", logId);

    console.log("Email reply processed successfully");

    return new Response(
      JSON.stringify({ success: true, conversationId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in process-email-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
