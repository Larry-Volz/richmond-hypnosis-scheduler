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
  calendarId: z.string().default("primary"), // Google Calendar ID to use
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
  { id: "goal", label: "What is your goal?", type: "textarea", required: true, placeholder: "Please describe your goal..." },
  { id: "issues", label: "Please check the issues you would like help with", type: "checkbox", required: true, options: [
    "stop smoking",
    "lose weight",
    "release anxiety",
    "overcome fear",
    "eliminate stress",
    "build confidence",
    "reduce pain",
    "learn hypnosis",
    "Motor imagery or other stroke-related help",
    "Other"
  ]},
  { id: "previousEfforts", label: "What have you done so far to address this", type: "textarea", required: true, placeholder: "Describe your previous efforts..." },
  { id: "lifeDifference", label: "What is going to be different in your life as a result of achieving this goal", type: "textarea", required: true, placeholder: "Describe the expected changes..." },
  { id: "holdingBack", label: "What has it been holding you back from making this change", type: "textarea", required: true, placeholder: "What has been holding you back..." },
  { id: "readinessScale", label: "How ready are you to make this change on a scale from one to 10", type: "select", required: true, options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
  { id: "whyNotLower", label: "Why didn't you pick a lower number", type: "textarea", required: false, placeholder: "What makes you feel ready..." },
  { id: "motivation", label: "Why now? What motivated you to reach out to me today?", type: "textarea", required: true, placeholder: "What motivated you to reach out..." },
  { id: "investment", label: "Are you ready to make an investment of time and money to reach your personal best?", type: "radio", required: true, options: [
    "Yes, if necessary, I would be willing to do so.",
    "No, I would not be willing to make an investment in myself."
  ]},
  { id: "referralSource", label: "Where did you hear about me?", type: "select", required: true, options: [
    "Google search",
    "Google ad",
    "other search engine",
    "Dr. referral (please tell us who to thank in the notes)",
    "friend referral (please tell us who to thank in the notes)",
    "Facebook",
    "Instagram",
    "LinkedIn",
    "YouTube",
    "threads",
    "other"
  ]},
  { id: "notes", label: "Please share any questions or notes you think I should know of in advance. Thank you.", type: "textarea", required: false, placeholder: "Any additional notes..." }
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
  calendarId: "primary",
  ownerEmail: "imaginologist@gmail.com",
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
