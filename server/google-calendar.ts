// Google Calendar Integration
// Uses Replit's Google Calendar connector

import { google, calendar_v3 } from "googleapis";

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
      "/api/v2/connection?include_secrets=true&connector_names=google-calendar",
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
    throw new Error("Google Calendar not connected");
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableGoogleCalendarClient(): Promise<calendar_v3.Calendar> {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

// Get busy times from calendar for a specific date range
export async function getBusyTimes(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<{ start: Date; end: Date }[]> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busyTimes = response.data.calendars?.[calendarId]?.busy || [];
    
    return busyTimes.map((busy) => ({
      start: new Date(busy.start!),
      end: new Date(busy.end!),
    }));
  } catch (error) {
    console.error("Error fetching busy times:", error);
    throw error;
  }
}

// Create a calendar event with Google Meet
export async function createCalendarEvent(options: {
  calendarId: string;
  summary: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  reminderMinutes: number;
  timezone?: string;
  ownerEmail?: string;
}): Promise<{ eventId: string; meetLink: string | null }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const timezone = options.timezone || "America/New_York";

    // Build attendees list with owner marked as accepted
    const attendeesList = options.attendees.map((email) => {
      // If this is the owner's email, mark them as accepted
      if (options.ownerEmail && email.toLowerCase() === options.ownerEmail.toLowerCase()) {
        return { email, responseStatus: "accepted" as const };
      }
      return { email };
    });

    // Add owner as accepted attendee if not already in list
    if (options.ownerEmail && !options.attendees.some(e => e.toLowerCase() === options.ownerEmail!.toLowerCase())) {
      attendeesList.unshift({ email: options.ownerEmail, responseStatus: "accepted" as const });
    }

    const event = await calendar.events.insert({
      calendarId: options.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: options.summary,
        description: options.description,
        start: {
          dateTime: options.startTime.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: options.endTime.toISOString(),
          timeZone: timezone,
        },
        attendees: attendeesList,
        conferenceData: {
          createRequest: {
            requestId: `appointment-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: options.reminderMinutes },
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });

    return {
      eventId: event.data.id!,
      meetLink: event.data.hangoutLink || null,
    };
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

// Get calendar events for a date range
export async function getCalendarEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }
}
