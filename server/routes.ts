import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getBusyTimes, createCalendarEvent } from "./google-calendar";
import { sendEmail, formatAppointmentEmail } from "./google-mail";
import { settingsSchema, availabilitySlotSchema, insertAppointmentSchema } from "@shared/schema";
import { z } from "zod";
import { addMinutes, format, parseISO, startOfDay, endOfDay, addHours, isBefore, isAfter } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { google } from "googleapis";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update settings
  app.put("/api/settings", async (req, res) => {
    try {
      const updates = settingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(updates);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get availability
  app.get("/api/availability", async (req, res) => {
    try {
      const availability = await storage.getAvailability();
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update availability
  app.put("/api/availability", async (req, res) => {
    try {
      const slots = z.array(availabilitySlotSchema).parse(req.body);
      const availability = await storage.updateAvailability(slots);
      res.json(availability);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get form fields
  app.get("/api/form-fields", async (req, res) => {
    try {
      const fields = await storage.getFormFields();
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get available time slots for a specific date
  app.get("/api/available-slots", async (req, res) => {
    try {
      const dateStr = req.query.dateTime as string;
      const durationParam = req.query.duration as string;
      const slotIntervalParam = req.query.slotInterval as string;
      
      if (!dateStr) {
        return res.status(400).json({ message: "Date is required" });
      }

      const date = parseISO(dateStr);
      const settings = await storage.getSettings();
      const availability = await storage.getAvailability();
      const existingAppointments = await storage.getAppointments();
      const timezone = settings.timezone || "America/New_York";
      
      // Use custom duration and slot interval if provided
      const appointmentDuration = durationParam ? parseInt(durationParam) : settings.appointmentDuration;
      const slotInterval = slotIntervalParam ? parseInt(slotIntervalParam) : 60; // Default to hourly

      // Convert the date to the configured timezone
      const zonedDate = toZonedTime(date, timezone);
      
      // Get the day of week for the selected date (in timezone)
      const dayOfWeek = zonedDate.getDay();
      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);

      if (!dayAvailability || !dayAvailability.enabled) {
        return res.json([]);
      }

      // Calculate minimum booking time based on settings
      const now = new Date();
      const minBookingTime = addHours(now, settings.minAdvanceBooking);

      // Generate time slots based on availability
      const slots: { time: string; dateTime: string; available: boolean }[] = [];
      
      const [startHour] = dayAvailability.startTime.split(":").map(Number);
      const [endHour] = dayAvailability.endTime.split(":").map(Number);

      // Get busy times from Google Calendar (check both calendars)
      let busyTimes: { start: Date; end: Date }[] = [];
      try {
        busyTimes = await getBusyTimes(
          settings.calendarId || "primary",
          startOfDay(date),
          endOfDay(date),
          ["imaginologist@gmail.com"]
        );
      } catch (error) {
        console.error("Error fetching calendar busy times:", error);
        // Continue without calendar integration if it fails
      }
      // Filter existing appointments for this day
      const dayAppointments = existingAppointments.filter(apt => {
        const aptDate = parseISO(apt.dateTime);
        return aptDate.toDateString() === date.toDateString() && apt.status !== "cancelled";
      });

      // Generate all possible slots based on slotInterval (30 min = half-hourly, 60 min = hourly)
      const allSlots: { hour: number; minute: number; time: Date }[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotInterval) {
          // Check if slot end time is within availability
          const slotEndMinutes = hour * 60 + minute + appointmentDuration;
          const endHourMinutes = endHour * 60;
          if (slotEndMinutes > endHourMinutes) continue;
          
          const slotDate = new Date(zonedDate);
          slotDate.setHours(hour, minute, 0, 0);
          const slotTime = fromZonedTime(slotDate, timezone);
          allSlots.push({ hour, minute, time: slotTime });
        }
      }

      // Filter to only available slots (no conflicts)
      const availableSlots = allSlots.filter(slot => {
        const slotEnd = addMinutes(slot.time, appointmentDuration);
        
        // Check if slot is in the past or before minimum booking time
        if (isBefore(slot.time, minBookingTime)) return false;
        
        // Check if slot conflicts with busy times from calendar
        const conflictsWithCalendar = busyTimes.some(busy => {
          return (
            (slot.time >= busy.start && slot.time < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end) ||
            (slot.time <= busy.start && slotEnd >= busy.end)
          );
        });
        if (conflictsWithCalendar) return false;

        // Check if slot conflicts with existing appointments
        const conflictsWithAppointments = dayAppointments.some(apt => {
          const aptStart = parseISO(apt.dateTime);
          const aptEnd = addMinutes(aptStart, apt.duration);
          return (
            (slot.time >= aptStart && slot.time < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (slot.time <= aptStart && slotEnd >= aptEnd)
          );
        });
        if (conflictsWithAppointments) return false;

        return true;
      });

      // Randomize which slots to offer (by default, randomly select a subset)
      const randomize = req.query.randomize !== "false";
      let selectedSlots = [...availableSlots];
      
      if (randomize && selectedSlots.length > settings.maxAppointmentsPerDay) {
        // Shuffle and pick random subset
        for (let i = selectedSlots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [selectedSlots[i], selectedSlots[j]] = [selectedSlots[j], selectedSlots[i]];
        }
        selectedSlots = selectedSlots.slice(0, settings.maxAppointmentsPerDay);
      }

      // Sort back to chronological order for display
      selectedSlots.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Format slots for response
      for (const slot of selectedSlots) {
        const zonedSlotTime = toZonedTime(slot.time, timezone);
        slots.push({
          time: format(zonedSlotTime, "h:mm a"),
          dateTime: slot.time.toISOString(),
          available: true,
        });
      }

      res.json(slots);
    } catch (error: any) {
      console.error("Error getting available slots:", error);
      res.status(500).json({ message: error.message });
    }
  });

 // Get ALL available slots for a date — no randomization, for practitioner use
  app.get("/api/available-slots/all", async (req, res) => {
    try {
      const dateStr = req.query.dateTime as string;
      const durationParam = req.query.duration as string;
      if (!dateStr) return res.status(400).json({ message: "Date is required" });
      const date = parseISO(dateStr);
      const settings = await storage.getSettings();
      const availability = await storage.getAvailability();
      const existingAppointments = await storage.getAppointments();
      const timezone = settings.timezone || "America/New_York";
      const appointmentDuration = durationParam ? parseInt(durationParam) : settings.appointmentDuration;
      const zonedDate = toZonedTime(date, timezone);
      const dayOfWeek = zonedDate.getDay();
      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);
      if (!dayAvailability || !dayAvailability.enabled) return res.json([]);
      const now = new Date();
      const minBookingTime = addHours(now, settings.minAdvanceBooking);
      const [startHour] = dayAvailability.startTime.split(":").map(Number);
      const [endHour] = dayAvailability.endTime.split(":").map(Number);
      let busyTimes: { start: Date; end: Date }[] = [];
      try {
        busyTimes = await getBusyTimes(
          settings.calendarId || "primary",
          startOfDay(date),
          endOfDay(date),
          ["imaginologist@gmail.com"]
        );
      } catch (error) {
        console.error("Error fetching busy times:", error);
      }
      const dayAppointments = existingAppointments.filter(apt => {
        const aptDate = parseISO(apt.dateTime);
        return aptDate.toDateString() === date.toDateString() && apt.status !== "cancelled";
      });
      const slots: { time: string; dateTime: string; available: boolean }[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        const slotDate = new Date(zonedDate);
        slotDate.setHours(hour, 0, 0, 0);
        const slotTime = fromZonedTime(slotDate, timezone);
        const slotEnd = addMinutes(slotTime, appointmentDuration);
        if (isBefore(slotTime, minBookingTime)) continue;
        const conflictsWithCalendar = busyTimes.some(busy =>
          (slotTime >= busy.start && slotTime < busy.end) ||
          (slotEnd > busy.start && slotEnd <= busy.end) ||
          (slotTime <= busy.start && slotEnd >= busy.end)
        );
        if (conflictsWithCalendar) continue;
        const conflictsWithAppointments = dayAppointments.some(apt => {
          const aptStart = parseISO(apt.dateTime);
          const aptEnd = addMinutes(aptStart, apt.duration);
          return (
            (slotTime >= aptStart && slotTime < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (slotTime <= aptStart && slotEnd >= aptEnd)
          );
        });
        if (conflictsWithAppointments) continue;
        const zonedSlotTime = toZonedTime(slotTime, timezone);
        slots.push({
          time: format(zonedSlotTime, "h:mm a"),
          dateTime: slotTime.toISOString(),
          available: true,
        });
      }
      res.json(slots);
    } catch (error: any) {
      console.error("Error getting all available slots:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all appointments
  app.get("/api/appointments", async (req, res) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create appointment
  app.post("/api/appointments", async (req, res) => {
    try {
      const data = insertAppointmentSchema.parse(req.body);
      const settings = await storage.getSettings();

      // Create the appointment in storage first
      const appointment = await storage.createAppointment(data);

      // Create calendar event with Google Meet
      let calendarEventId: string | undefined;
      let meetLink: string | undefined;

      try {
        const startTime = parseISO(data.dateTime);
        const endTime = addMinutes(startTime, data.duration);
        
        const isReturningClient = data.formResponses?.clientType === "Returning Client";
        const issuesArray = data.formResponses?.issues;
        const issuesText = Array.isArray(issuesArray) ? issuesArray.join(", ") : (issuesArray || "");
        
        // Build description with form responses
        // For returning clients, skip the "During this initial consultation..." paragraph
        let description = isReturningClient 
          ? `Client Details:\n`
          : `${settings.description}\n\n---\n\nClient Details:\n`;
        description += `Name: ${data.clientName}\n`;
        description += `Email: ${data.clientEmail}\n`;
        description += `Phone: ${data.clientPhone}\n\n`;
        description += `Form Responses:\n`;
        
        for (const [key, value] of Object.entries(data.formResponses)) {
          const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
          description += `${key}: ${displayValue}\n`;
        }

        // Different title for new vs returning clients
        const eventTitle = isReturningClient
          ? `${data.clientName} ${issuesText}`.trim()
          : settings.appointmentTitle.replace("{name}", data.clientName);
        
        const attendees = [data.clientEmail];
        if (data.guests && data.guests.length > 0) {
          attendees.push(...data.guests);
        }

        const result = await createCalendarEvent({
          calendarId: settings.calendarId || "primary",
          summary: eventTitle,
          description,
          startTime,
          endTime,
          attendees,
          reminderMinutes: settings.reminderHours * 60,
          timezone: settings.timezone,
          ownerEmail: settings.ownerEmail,
        });

        calendarEventId = result.eventId;
        meetLink = result.meetLink || undefined;
      } catch (error) {
        console.error("Error creating calendar event:", error);
        // Continue without calendar if it fails - still save the appointment
      }

      // Update appointment with calendar details
      const updatedAppointment = await storage.updateAppointment(appointment.id, {
        calendarEventId,
        meetLink,
        status: "confirmed",
      });

      // Send lead to CRM
      if (process.env.CRM_WEBHOOK_URL) {
        try {
          const webhookPayload = JSON.stringify({
            clientName: data.clientName,
            clientEmail: data.clientEmail,
            clientPhone: data.clientPhone,
            dateTime: data.dateTime,
            formResponses: data.formResponses
          });
          const webhookUrl = new URL(process.env.CRM_WEBHOOK_URL);
          const https = await import('https');
          await new Promise<void>((resolve, reject) => {
            const req = https.request({
              hostname: webhookUrl.hostname,
              path: webhookUrl.pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': process.env.CRM_WEBHOOK_SECRET || '',
                'Content-Length': Buffer.byteLength(webhookPayload)
              }
            }, (res) => {
              res.on('data', () => {});
              res.on('end', () => { console.log('CRM webhook sent, status:', res.statusCode); resolve(); });
            });
            req.on('error', (err) => { console.error('CRM webhook error:', err); resolve(); });
            req.write(webhookPayload);
            req.end();
          });
        } catch (err) {
          console.error('CRM webhook error:', err);
        }
      }
      
      // Send email notification to owner
      if (settings.ownerEmail) {
        try {
          const emailBody = formatAppointmentEmail({
            clientName: data.clientName,
            clientEmail: data.clientEmail,
            clientPhone: data.clientPhone,
            dateTime: data.dateTime,
            duration: data.duration,
            meetLink,
            formResponses: data.formResponses,
            timezone: settings.timezone,
          });

          // Format subject line in the configured timezone
          const zonedDateTime = toZonedTime(parseISO(data.dateTime), settings.timezone || "America/New_York");
          const subjectDate = format(zonedDateTime, "MMM d, yyyy 'at' h:mm a");
          
          // Get issues from form responses for subject line
          const issues = data.formResponses?.issues;
          const issuesText = Array.isArray(issues) ? issues.join(", ") : (issues || "");
          const isReturningClient = data.formResponses?.clientType === "Returning Client";
          
          // Different subject format for new vs returning clients
          const subject = isReturningClient 
            ? `${data.clientName} ${issuesText}`.trim()
            : `free hypnosis screening ${data.clientName} ${issuesText}`.trim();

          await sendEmail({
            to: settings.ownerEmail,
            subject,
            body: emailBody,
          });
        } catch (error) {
          console.error("Error sending notification email:", error);
          // Continue even if email fails
        }
      }

      res.json(updatedAppointment || appointment);
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update appointment
  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const appointment = await storage.updateAppointment(id, updates);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete appointment
  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAppointment(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================
  // UPCOMING APPOINTMENTS — lookup by client email
  // Queries larry@richmondhypnosiscenter.com calendar using
  // the scheduler's RHC OAuth credentials
  // ============================================================
  app.get("/api/calendar/upcoming", async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) return res.status(400).json({ error: "email query parameter required" });

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://strokementor-crm-production.up.railway.app/auth/google/callback'
      );
      oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

      const cal = google.calendar({ version: "v3", auth: oauth2Client });
      const now = new Date();
      const sixWeeksOut = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000);

      const response = await cal.events.list({
        calendarId: "larry@richmondhypnosiscenter.com",
        timeMin: now.toISOString(),
        timeMax: sixWeeksOut.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 20,
        q: email as string,
      });

      const events = response.data.items || [];
      const clientEmail = (email as string).toLowerCase();

      const matches = events.filter((event: any) => {
        const attendees = (event.attendees || []).map((a: any) => (a.email || "").toLowerCase());
        const desc = (event.description || "").toLowerCase();
        return attendees.includes(clientEmail) || desc.includes(clientEmail);
      }).map((event: any) => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        meetLink: event.hangoutLink || null,
        htmlLink: event.htmlLink,
      }));

      res.json(matches);
    } catch (error: any) {
      console.error("Error fetching upcoming appointments:", error.message);
      res.status(500).json({ error: "Failed to fetch upcoming appointments" });
    }
  });

  return httpServer;
}
