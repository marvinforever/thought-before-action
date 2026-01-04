import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarInviteRequest {
  managerEmail: string;
  managerName: string;
  employeeEmail: string;
  employeeName: string;
  meetingType: "one_on_one" | "review";
  meetingTitle: string;
  meetingDate: string; // YYYY-MM-DD
  meetingTime: string; // HH:MM
  durationMinutes?: number;
  description?: string;
}

function generateICS(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string }[];
}): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@jericho.app`;
  const now = new Date();

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Jericho//Calendar Invite//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(now)}
DTSTART:${formatDate(params.startDate)}
DTEND:${formatDate(params.endDate)}
SUMMARY:${params.title}
DESCRIPTION:${params.description.replace(/\n/g, "\\n")}
ORGANIZER;CN=${params.organizer.name}:mailto:${params.organizer.email}
`;

  params.attendees.forEach((attendee) => {
    icsContent += `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${attendee.name}:mailto:${attendee.email}\n`;
  });

  icsContent += `STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

async function sendEmailWithResend(params: {
  to: string;
  subject: string;
  html: string;
  attachments: { filename: string; content: string; content_type: string }[];
}): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Jericho <onboarding@resend.dev>",
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-calendar-invite function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CalendarInviteRequest = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    const {
      managerEmail,
      managerName,
      employeeEmail,
      employeeName,
      meetingType,
      meetingTitle,
      meetingDate,
      meetingTime,
      durationMinutes = 30,
      description = "",
    } = body;

    // Parse date and time
    const [year, month, day] = meetingDate.split("-").map(Number);
    const [hours, minutes] = meetingTime.split(":").map(Number);
    
    const startDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    console.log(`Creating invite for ${meetingTitle} on ${startDate.toISOString()}`);

    // Generate ICS content
    const icsContent = generateICS({
      title: meetingTitle,
      startDate,
      endDate,
      description: description || `${meetingType === "one_on_one" ? "1:1 Meeting" : "Performance Review"} scheduled via Jericho`,
      organizer: { name: managerName, email: managerEmail },
      attendees: [
        { name: managerName, email: managerEmail },
        { name: employeeName, email: employeeEmail },
      ],
    });

    console.log("Generated ICS content");

    // Convert ICS to base64 for attachment
    const icsBase64 = btoa(icsContent);

    // Send email to both manager and employee
    const emailBody = `
      <h2>${meetingTitle}</h2>
      <p><strong>Date:</strong> ${new Date(meetingDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      <p><strong>Time:</strong> ${meetingTime}</p>
      <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
      <p><strong>Participants:</strong> ${managerName}, ${employeeName}</p>
      ${description ? `<p><strong>Notes:</strong> ${description}</p>` : ""}
      <hr>
      <p>A calendar invite is attached. Add it to your calendar to receive reminders.</p>
      <p style="color: #666; font-size: 12px;">Sent via Jericho</p>
    `;

    const attachments = [
      {
        filename: "invite.ics",
        content: icsBase64,
        content_type: "text/calendar;method=REQUEST",
      },
    ];

    // Send to manager
    const managerEmailResult = await sendEmailWithResend({
      to: managerEmail,
      subject: `📅 ${meetingTitle}`,
      html: emailBody,
      attachments,
    });

    console.log("Sent to manager:", managerEmailResult);

    // Send to employee
    const employeeEmailResult = await sendEmailWithResend({
      to: employeeEmail,
      subject: `📅 ${meetingTitle}`,
      html: emailBody,
      attachments,
    });

    console.log("Sent to employee:", employeeEmailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Calendar invites sent successfully",
        managerEmailId: managerEmailResult.id,
        employeeEmailId: employeeEmailResult.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending calendar invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
