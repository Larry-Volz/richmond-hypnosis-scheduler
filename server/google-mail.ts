// Gmail Integration
// Uses Replit's Gmail connector

import { google, gmail_v1 } from "googleapis";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

let connectionSettings: any;

async function getAccessToken() {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=google-mail",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("Gmail not connected");
  }
  return accessToken;
}

// WARNING: Never cache this client.
export async function getUncachableGmailClient(): Promise<gmail_v1.Gmail> {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

// Send an email notification
export async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  try {
    const gmail = await getUncachableGmailClient();

    // Create the email message
    const emailLines = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      options.body,
    ];

    const email = emailLines.join("\r\n");
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    console.log("Email sent successfully to:", options.to);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Format appointment details for email
export function formatAppointmentEmail(appointment: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  dateTime: string;
  duration: number;
  meetLink?: string;
  formResponses: Record<string, any>;
  timezone?: string;
}): string {
  const timezone = appointment.timezone || "America/New_York";
  const appointmentDate = new Date(appointment.dateTime);
  const zonedDate = toZonedTime(appointmentDate, timezone);
  
  // Format the date in the configured timezone
  const formattedDate = format(zonedDate, "EEEE, MMMM d, yyyy 'at' h:mm a") + ` (${timezone.replace("_", " ")})`;

  let formResponsesHtml = "";
  for (const [key, value] of Object.entries(appointment.formResponses)) {
    const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
    formResponsesHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 500;">${key}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${displayValue}</td>
      </tr>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: 600; min-width: 120px; }
        .form-responses { margin-top: 20px; }
        .form-responses h3 { margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
        .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Appointment Booked!</h1>
        </div>
        <div class="content">
          <div class="details">
            <h2 style="margin-top: 0;">Appointment Details</h2>
            <p><strong>Client:</strong> ${appointment.clientName}</p>
            <p><strong>Email:</strong> ${appointment.clientEmail}</p>
            <p><strong>Phone:</strong> ${appointment.clientPhone}</p>
            <p><strong>Date & Time:</strong> ${formattedDate}</p>
            <p><strong>Duration:</strong> ${appointment.duration} minutes</p>
            ${appointment.meetLink ? `<p><strong>Meeting Link:</strong> <a href="${appointment.meetLink}">${appointment.meetLink}</a></p>` : ""}
          </div>
          
          <div class="form-responses">
            <h3>Form Responses</h3>
            <table>
              ${formResponsesHtml}
            </table>
          </div>

          ${appointment.meetLink ? `<a href="${appointment.meetLink}" class="button">Join Google Meet</a>` : ""}
        </div>
      </div>
    </body>
    </html>
  `;
}
