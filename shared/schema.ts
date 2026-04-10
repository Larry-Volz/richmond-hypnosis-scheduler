import { z } from "zod";

// Availability slot - represents a time block when appointments are available
export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6), // 0 = Sunday, 6 = Saturday
  startTime: z.string(), // "09:00"
  endTime: z.string(), // "17:00"
  enabled: z.boolean(),
});

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

// Form field definition
export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox", "radio", "number"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(), // For select, checkbox, radio
  placeholder: z.string().optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;

// Settings for the scheduling system
export const settingsSchema = z.object({
  bufferTime: z.number().min(0).default(15), // Minutes between appointments
  appointmentDuration: z.number().min(15).default(45), // Default appointment duration in minutes
  minAdvanceBooking: z.number().min(0).default(24), // Hours in advance required to book
  maxAppointmentsPerDay: z.number().min(1).default(8), // Max appointments shown per day
  reminderHours: z.number().min(1).default(24), // Hours before to send reminder
  calendarId: z.string().default("larry@richmondhypnosiscenter.com"), // Google Calendar ID to use
  ownerEmail: z.string().email().optional(), // Email to receive notifications
  ownerName: z.string().default("Doc Volz"),
  businessName: z.string().default("Magical Mind Shifts Inc."),
  appointmentTitle: z.string().default("Hypnosis screening for {name}"),
  description: z.string().default("During this initial consultation and free screening we will get to know each other a little bit. We will discuss your goals. I will test your ability to achieve hypnosis. And if I believe you are a suitable candidate and have a good prognosis for success then I will invite you to enroll in a program. We will develop a treatment plan based on your unique circumstances and best practices most likely to bring you complete success."),
  timezone: z.string().default("America/New_York"),
});

export type Settings = z.infer<typeof settingsSchema>;

// Appointment booking
export const appointmentSchema = z.object({
  id: z.string(),
  dateTime: z.string(), // ISO string
  duration: z.number(), // minutes
  clientName: z.string(),
  clientEmail: z.string().email(),
  clientPhone: z.string(),
  guests: z.array(z.string()).optional(),
  formResponses: z.record(z.string(), z.any()),
  calendarEventId: z.string().optional(),
  meetLink: z.string().optional(),
  status: z.enum(["pending", "confirmed", "cancelled"]),
  createdAt: z.string(),
});

export type Appointment = z.infer<typeof appointmentSchema>;

// Insert schemas
export const insertAppointmentSchema = appointmentSchema.omit({ id: true, calendarEventId: true, meetLink: true, status: true, createdAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// Available time slot for display
export const timeSlotSchema = z.object({
  time: z.string(), // "09:00"
  dateTime: z.string(), // Full ISO string
  available: z.boolean(),
});

export type TimeSlot = z.infer<typeof timeSlotSchema>;

// Default form fields based on the Odoo form
export const defaultFormFields: FormField[] = [
  { id: "issues", label: "What would you like help with? (check all that apply)", type: "checkbox", required: true, options: [
    "Smoking cessation",
    "Weight management",
    "Anxiety & stress",
    "Fear & phobia",
    "Confidence",
    "Pain reduction",
    "Stroke prevention & recovery coaching",
    "Learning hypnosis",
    "Other"
  ]},
  { id: "goal", label: "What is your goal? In your own words, what would you like to accomplish?", type: "textarea", required: true, placeholder: "Describe your goal..." },
  { id: "previousEfforts", label: "What have you already tried to address this?", type: "textarea", required: true, placeholder: "Describe your previous efforts..." },
  { id: "holdingBack", label: "What has stopped you from making this change in the past?", type: "textarea", required: true, placeholder: "What has been holding you back..." },
  { id: "lifeDifference", label: "How will your life be different once you've accomplished your goal? What will you be able to do, feel, or experience that you can't right now?", type: "textarea", required: true, placeholder: "Describe the expected changes..." },
  { id: "readinessScale", label: "On a scale of 1–10, how important is it to you to make this change right now?", type: "radio", required: true, options: [
    "1–3 (I'm exploring the idea)",
    "4–6 (I'm fairly motivated)",
    "7–9 (This is very important to me)",
    "10 (This is the most important thing in my life right now)"
  ]},
  { id: "whyNotLower", label: "Why didn't you pick a lower number?", type: "textarea", required: false, placeholder: "What makes you feel ready..." },
  { id: "motivation", label: "What motivated you to reach out today?", type: "textarea", required: true, placeholder: "What motivated you to reach out..." },
  { id: "support", label: "Are the people close to you supportive of this decision?", type: "radio", required: true, options: [
    "Yes, fully",
    "Somewhat",
    "They don't know yet",
    "No"
  ]},
  { id: "investment", label: "Are you ready to invest time and money to reach your personal best?", type: "radio", required: true, options: [
    "Yes, if necessary, I would be willing to do so.",
    "No, I would not be willing to make an investment in myself."
  ]},
  { id: "triggerContext", label: "When and where does this problem most often occur? (time of day, situations, triggers)", type: "textarea", required: false, placeholder: "e.g., After dinner, when stressed at work..." },
  { id: "behaviorPurpose", label: "Is there any part of this behavior that has served a purpose for you — even if it's been harmful overall?", type: "textarea", required: false, placeholder: "For example, smoking might relieve stress..." },
  { id: "referralSource", label: "Where did you hear about us?", type: "select", required: true, options: [
    "Referral from friend or family member",
    "Referred by a physician",
    "Referred by a therapist or counselor",
    "Internet search",
    "Social media",
    "Other"
  ]},
  { id: "notes", label: "Please share any questions or notes you think I should know of in advance.", type: "textarea", required: false, placeholder: "Any additional notes..." }
];

// Default availability (Monday-Friday 11am-6pm)
export const defaultAvailability: AvailabilitySlot[] = [
  { dayOfWeek: 0, startTime: "11:00", endTime: "18:00", enabled: false }, // Sunday
  { dayOfWeek: 1, startTime: "11:00", endTime: "18:00", enabled: true },  // Monday
  { dayOfWeek: 2, startTime: "11:00", endTime: "18:00", enabled: true },  // Tuesday
  { dayOfWeek: 3, startTime: "11:00", endTime: "18:00", enabled: true },  // Wednesday
  { dayOfWeek: 4, startTime: "11:00", endTime: "18:00", enabled: true },  // Thursday
  { dayOfWeek: 5, startTime: "11:00", endTime: "18:00", enabled: true },  // Friday
  { dayOfWeek: 6, startTime: "11:00", endTime: "18:00", enabled: false }, // Saturday
];

// Default settings
export const defaultSettings: Settings = {
  bufferTime: 15,
  appointmentDuration: 45,
  minAdvanceBooking: 24,
  maxAppointmentsPerDay: 8,
  reminderHours: 24,
  calendarId: "larry@richmondhypnosiscenter.com",
  ownerEmail: "larry@richmondhypnosiscenter.com",
  ownerName: "Doc Volz",
  businessName: "Richmond Hypnosis Center",
  appointmentTitle: "Hypnosis screening for {name}",
  description: "During this initial consultation and free screening we will get to know each other a little bit. We will discuss your goals. I will test your ability to achieve hypnosis. And if I believe you are a suitable candidate and have a good prognosis for success then I will invite you to enroll in a program. We will develop a treatment plan based on your unique circumstances and best practices most likely to bring you complete success.",
  timezone: "America/New_York",
};

// Keep legacy User types for compatibility
export const users = {
  id: "",
  username: "",
  password: "",
};

export type InsertUser = { username: string; password: string };
export type User = { id: string; username: string; password: string };
