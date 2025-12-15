import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  password: string;
  loginUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, password, loginUrl }: WelcomeEmailRequest = await req.json();

    console.log(`Sending welcome email to ${email} (${fullName})`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Jericho <noreply@updates.themomentumcompany.com>",
        to: [email],
        subject: "Welcome to Jericho - Your Growth Journey Starts Now!",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #ffffff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 40px;
                margin: 20px 0;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .header h1 {
                color: #2563eb;
                font-size: 28px;
                margin: 0;
              }
              .header-icon {
                font-size: 32px;
                margin-bottom: 10px;
              }
              .content {
                margin: 20px 0;
              }
              .credentials {
                background: #f8f9fa;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 20px;
                margin: 25px 0;
              }
              .credentials p {
                margin: 10px 0;
                font-size: 16px;
              }
              .credentials strong {
                color: #2563eb;
              }
              .cta-button {
                display: inline-block;
                background: #2563eb;
                color: white;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 6px;
                font-weight: 600;
                margin: 25px 0;
                text-align: center;
              }
              .steps {
                margin: 25px 0;
              }
              .steps ol {
                padding-left: 20px;
              }
              .steps li {
                margin: 8px 0;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                text-align: center;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="header-icon">🌟</div>
                <h1>Welcome to Jericho!</h1>
              </div>
              
              <div class="content">
                <p>Hi <strong>${fullName}</strong>,</p>
                
                <p>Your Jericho account is ready! Jericho helps you create a hyperpersonalized growth plan based on your role at your company, your personal and professional goals, and the things most important to you. Jericho uses your input to help create your personalized growth journey - helping you continue to be great at what you do, while helping you progress in your career!</p>
                
                <div class="credentials">
                  <p>📧 <strong>Email:</strong> ${email}</p>
                  <p>🔑 <strong>Password:</strong> ${password}</p>
                </div>
                
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="cta-button">Log In to Jericho →</a>
                </div>
                
                <div class="steps">
                  <p><strong>📋 Getting Started:</strong></p>
                  <ol>
                    <li>Click the button above to log in</li>
                    <li>Change your password for security</li>
                    <li>Complete your growth diagnostic</li>
                    <li>Meet Jericho, your AI growth coach!</li>
                  </ol>
                </div>
                
                <p>Questions? Reach out to your administrator.</p>
              </div>
              
              <div class="footer">
                <p>– The Jericho Team</p>
              </div>
            </div>
          </body>
        </html>
      `
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    const emailData = await emailResponse.json();
    console.log("Welcome email sent successfully:", emailData);

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
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
