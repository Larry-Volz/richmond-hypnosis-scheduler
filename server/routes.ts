import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getBusyTimes, createCalendarEvent } from "./google-calendar";
import { sendEmail, formatAppointmentEmail } from "./google-mail";
import { settingsSchema, availabilitySlotSchema, insertAppointmentSchema } from "@shared/schema";
import { z } from "zod";
import { addMinutes, format, parseISO, startOfDay, endOfDay, addHours, isBefore, isAfter } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

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
      if (!dateStr) {
        return res.status(400).json({ message: "Date is required" });
      }

      const date = parseISO(dateStr);
      const settings = await storage.getSettings();
      const availability = await storage.getAvailability();
      const existingAppointments = await storage.getAppointments();
      const timezone = settings.timezone || "America/New_York";

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
      
      const [startHour, startMinute] = dayAvailability.startTime.split(":").map(Number);
      const [endHour, endMinute] = dayAvailability.endTime.split(":").map(Number);
      
      // Create start time in the configured timezone
      const startDate = new Date(zonedDate);
      startDate.setHours(startHour, startMinute, 0, 0);
      // Convert from zoned time to UTC for proper comparison
      let currentTime = fromZonedTime(startDate, timezone);
      
      const endDate = new Date(zonedDate);
      endDate.setHours(endHour, endMinute, 0, 0);
      const endTime = fromZonedTime(endDate, timezone);

      // Get busy times from Google Calendar
      let busyTimes: { start: Date; end: Date }[] = [];
      try {
        busyTimes = await getBusyTimes(
          settings.calendarId || "primary",
          startOfDay(date),
          endOfDay(date)
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

      let slotsCount = 0;
      
      while (isBefore(currentTime, endTime) && slotsCount < settings.maxAppointmentsPerDay) {
        const slotEnd = addMinutes(currentTime, settings.appointmentDuration);
        
        // Check if slot is in the past or before minimum booking time
        const isAvailable = !isBefore(currentTime, minBookingTime);
        
        // Check if slot conflicts with busy times from calendar
        const conflictsWithCalendar = busyTimes.some(busy => {
          return (
            (currentTime >= busy.start && currentTime < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end) ||
            (currentTime <= busy.start && slotEnd >= busy.end)
          );
        });

        // Check if slot conflicts with existing appointments
        const conflictsWithAppointments = dayAppointments.some(apt => {
          const aptStart = parseISO(apt.dateTime);
          const aptEnd = addMinutes(aptStart, apt.duration);
          return (
            (currentTime >= aptStart && currentTime < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (currentTime <= aptStart && slotEnd >= aptEnd)
          );
        });

        if (isAvailable && !conflictsWithCalendar && !conflictsWithAppointments) {
          // Format time in the configured timezone for display
          const zonedCurrentTime = toZonedTime(currentTime, timezone);
          slots.push({
            time: format(zonedCurrentTime, "h:mm a"),
            dateTime: currentTime.toISOString(),
            available: true,
          });
          slotsCount++;
        }

        // Move to next slot (duration + buffer)
        currentTime = addMinutes(currentTime, settings.appointmentDuration + settings.bufferTime);
      }

      res.json(slots);
    } catch (error: any) {
      console.error("Error getting available slots:", error);
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
        
        // Build description with form responses
        let description = `${settings.description}\n\n---\n\nClient Details:\n`;
        description += `Name: ${data.clientName}\n`;
        description += `Email: ${data.clientEmail}\n`;
        description += `Phone: ${data.clientPhone}\n\n`;
        description += `Form Responses:\n`;
        
        for (const [key, value] of Object.entries(data.formResponses)) {
          const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
          description += `${key}: ${displayValue}\n`;
        }

        const eventTitle = settings.appointmentTitle.replace("{name}", data.clientName);
        
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
          });

          await sendEmail({
            to: settings.ownerEmail,
            subject: `New Appointment: ${data.clientName} - ${format(parseISO(data.dateTime), "MMM d, yyyy 'at' h:mm a")}`,
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

  return httpServer;
}
