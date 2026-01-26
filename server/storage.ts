import { randomUUID } from "crypto";
import type { 
  Settings, 
  AvailabilitySlot, 
  FormField, 
  Appointment, 
  InsertAppointment 
} from "@shared/schema";
import { defaultSettings, defaultAvailability, defaultFormFields } from "@shared/schema";

export interface IStorage {
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
  
  // Availability
  getAvailability(): Promise<AvailabilitySlot[]>;
  updateAvailability(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]>;
  
  // Form Fields
  getFormFields(): Promise<FormField[]>;
  updateFormFields(fields: FormField[]): Promise<FormField[]>;
  
  // Appointments
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private settings: Settings;
  private availability: AvailabilitySlot[];
  private formFields: FormField[];
  private appointments: Map<string, Appointment>;

  constructor() {
    this.settings = { ...defaultSettings };
    this.availability = [...defaultAvailability];
    this.formFields = [...defaultFormFields];
    this.appointments = new Map();
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...updates };
    return { ...this.settings };
  }

  // Availability
  async getAvailability(): Promise<AvailabilitySlot[]> {
    return [...this.availability];
  }

  async updateAvailability(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> {
    this.availability = [...slots];
    return [...this.availability];
  }

  // Form Fields
  async getFormFields(): Promise<FormField[]> {
    return [...this.formFields];
  }

  async updateFormFields(fields: FormField[]): Promise<FormField[]> {
    this.formFields = [...fields];
    return [...this.formFields];
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).sort((a, b) => 
      new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
    const appointment: Appointment = {
      ...data,
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined> {
    const existing = this.appointments.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...data };
    this.appointments.set(id, updated);
    return updated;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    return this.appointments.delete(id);
  }
}

export const storage = new MemStorage();
