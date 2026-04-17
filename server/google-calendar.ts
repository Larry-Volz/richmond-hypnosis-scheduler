import { google, calendar_v3 } from "googleapis";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://strokementor-crm-production.up.railway.app/auth/google/callback'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return oauth2Client;
}

export async function getBusyTimes(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  additionalCalendarIds: string[] = []
): Promise<{ start: Date; end: Date }[]> {
  try {
    const calendar = google.calendar({ version: "v3", auth: getOAuthClient() });

    // Build deduplicated list of all calendars to check
    const allCalendarIds = Array.from(new Set([calendarId, ...additionalCalendarIds]));

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: allCalendarIds.map((id) => ({ id })),
      },
    });

    // Merge busy times from all calendars into one array
    const merged: { start: Date; end: Date }[] = [];
    for (const id of allCalendarIds) {
      const busy = response.data.calendars?.[id]?.busy || [];
      for (const b of busy) {
        merged.push({ start: new Date(b.start!), end: new Date(b.end!) });
      }
    }
    return merged;
  } catch (error) {
    console.error("Error fetching busy times:", error);
    throw error;
  }
}

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
    const calendar = google.calendar({ version: "v3", auth: getOAuthClient() });
    const timezone = options.timezone || "America/New_York";

    const attendeesList = options.attendees.map((email) => {
      if (options.ownerEmail && email.toLowerCase() === options.ownerEmail.toLowerCase()) {
        return { email, responseStatus: "accepted" as const };
      }
      return { email };
    });

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
        start: { dateTime: options.startTime.toISOString(), timeZone: timezone },
        end: { dateTime: options.endTime.toISOString(), timeZone: timezone },
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

export async function getCalendarEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
  try {
    const calendar = google.calendar({ version: "v3", auth: getOAuthClient() });
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
