import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Clock, Calendar, Bell, Users, FileText, Loader2, Save, ExternalLink, Trash2, Plus } from "lucide-react";
import type { Settings as SettingsType, AvailabilitySlot, FormField, Appointment } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const settingsFormSchema = z.object({
  bufferTime: z.number().min(0),
  appointmentDuration: z.number().min(15),
  minAdvanceBooking: z.number().min(0),
  maxAppointmentsPerDay: z.number().min(1),
  reminderHours: z.number().min(1),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerName: z.string().min(1),
  businessName: z.string().min(1),
  appointmentTitle: z.string().min(1),
  description: z.string(),
  timezone: z.string(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("settings");

  const { data: settings, isLoading: settingsLoading } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  const { data: availability, isLoading: availabilityLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: ["/api/availability"],
  });

  const { data: formFields, isLoading: fieldsLoading } = useQuery<FormField[]>({
    queryKey: ["/api/form-fields"],
  });

  const { data: appointments, isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      bufferTime: settings?.bufferTime || 15,
      appointmentDuration: settings?.appointmentDuration || 45,
      minAdvanceBooking: settings?.minAdvanceBooking || 24,
      maxAppointmentsPerDay: settings?.maxAppointmentsPerDay || 8,
      reminderHours: settings?.reminderHours || 24,
      ownerEmail: settings?.ownerEmail || "",
      ownerName: settings?.ownerName || "Doc Volz",
      businessName: settings?.businessName || "Magical Mind Shifts Inc.",
      appointmentTitle: settings?.appointmentTitle || "Hypnosis screening for {name}",
      description: settings?.description || "",
      timezone: settings?.timezone || "America/New_York",
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        bufferTime: settings.bufferTime,
        appointmentDuration: settings.appointmentDuration,
        minAdvanceBooking: settings.minAdvanceBooking,
        maxAppointmentsPerDay: settings.maxAppointmentsPerDay,
        reminderHours: settings.reminderHours,
        ownerEmail: settings.ownerEmail || "",
        ownerName: settings.ownerName,
        businessName: settings.businessName,
        appointmentTitle: settings.appointmentTitle,
        description: settings.description,
        timezone: settings.timezone,
      });
    }
  }, [settings, form]);

  const settingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: async (data: AvailabilitySlot[]) => {
      return apiRequest("PUT", "/api/availability", data);
    },
    onSuccess: () => {
      toast({ title: "Availability saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/availability"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [localAvailability, setLocalAvailability] = useState<AvailabilitySlot[]>([]);

  // Sync local availability with fetched data
  useEffect(() => {
    if (availability) {
      setLocalAvailability(availability);
    }
  }, [availability]);

  const handleAvailabilityToggle = (dayOfWeek: number, enabled: boolean) => {
    const updated = localAvailability.map(slot =>
      slot.dayOfWeek === dayOfWeek ? { ...slot, enabled } : slot
    );
    setLocalAvailability(updated);
  };

  const handleAvailabilityTimeChange = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    const updated = localAvailability.map(slot =>
      slot.dayOfWeek === dayOfWeek ? { ...slot, [field]: value } : slot
    );
    setLocalAvailability(updated);
  };

  const onSettingsSubmit = (data: SettingsFormData) => {
    settingsMutation.mutate(data);
  };

  const saveAvailability = () => {
    availabilityMutation.mutate(localAvailability);
  };

  if (settingsLoading || availabilityLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Control Panel</h1>
            <p className="text-muted-foreground">Manage your scheduling settings and availability</p>
          </div>
          <Link href="/">
            <Button variant="outline" data-testid="button-view-booking-page">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Booking Page
            </Button>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="availability" className="gap-2" data-testid="tab-availability">
              <Clock className="w-4 h-4" />
              Availability
            </TabsTrigger>
            <TabsTrigger value="form" className="gap-2" data-testid="tab-form">
              <FileText className="w-4 h-4" />
              Form Fields
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2" data-testid="tab-appointments">
              <Calendar className="w-4 h-4" />
              Appointments
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <form onSubmit={form.handleSubmit(onSettingsSubmit)}>
              <div className="grid gap-6">
                {/* Business Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Business Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input
                          id="businessName"
                          {...form.register("businessName")}
                          data-testid="input-business-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ownerName">Your Name</Label>
                        <Input
                          id="ownerName"
                          {...form.register("ownerName")}
                          data-testid="input-owner-name"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ownerEmail">Notification Email</Label>
                      <Input
                        id="ownerEmail"
                        type="email"
                        {...form.register("ownerEmail")}
                        placeholder="Email to receive booking notifications"
                        data-testid="input-owner-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="appointmentTitle">Appointment Title Template</Label>
                      <Input
                        id="appointmentTitle"
                        {...form.register("appointmentTitle")}
                        placeholder="Use {name} for client's name"
                        data-testid="input-appointment-title"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Use {"{name}"} as a placeholder for the client's name</p>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...form.register("description")}
                        className="min-h-[120px]"
                        data-testid="textarea-description"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Scheduling Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Scheduling Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="appointmentDuration">Appointment Duration (minutes)</Label>
                        <Input
                          id="appointmentDuration"
                          type="number"
                          {...form.register("appointmentDuration", { valueAsNumber: true })}
                          data-testid="input-duration"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bufferTime">Buffer Time Between Appointments (minutes)</Label>
                        <Input
                          id="bufferTime"
                          type="number"
                          {...form.register("bufferTime", { valueAsNumber: true })}
                          data-testid="input-buffer"
                        />
                      </div>
                      <div>
                        <Label htmlFor="minAdvanceBooking">Minimum Advance Booking (hours)</Label>
                        <Input
                          id="minAdvanceBooking"
                          type="number"
                          {...form.register("minAdvanceBooking", { valueAsNumber: true })}
                          data-testid="input-advance"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxAppointmentsPerDay">Max Appointments Per Day</Label>
                        <Input
                          id="maxAppointmentsPerDay"
                          type="number"
                          {...form.register("maxAppointmentsPerDay", { valueAsNumber: true })}
                          data-testid="input-max-appointments"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reminders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      Reminders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-w-xs">
                      <Label htmlFor="reminderHours">Send Reminder (hours before)</Label>
                      <Input
                        id="reminderHours"
                        type="number"
                        {...form.register("reminderHours", { valueAsNumber: true })}
                        data-testid="input-reminder"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Timezone */}
                <Card>
                  <CardHeader>
                    <CardTitle>Timezone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={form.watch("timezone")}
                      onValueChange={(value) => form.setValue("timezone", value)}
                    >
                      <SelectTrigger className="max-w-xs" data-testid="select-timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="America/Phoenix">Arizona Time</SelectItem>
                        <SelectItem value="America/Anchorage">Alaska Time</SelectItem>
                        <SelectItem value="Pacific/Honolulu">Hawaii Time</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  disabled={settingsMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-save-settings"
                >
                  {settingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Availability Tab */}
          <TabsContent value="availability">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Availability</CardTitle>
                <CardDescription>Set your regular available hours for each day of the week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(localAvailability.length > 0 ? localAvailability : availability || []).map((slot) => (
                    <div
                      key={slot.dayOfWeek}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <Switch
                          checked={slot.enabled}
                          onCheckedChange={(checked) => handleAvailabilityToggle(slot.dayOfWeek, checked)}
                          data-testid={`switch-day-${slot.dayOfWeek}`}
                        />
                        <span className="font-medium">{DAYS_OF_WEEK[slot.dayOfWeek]}</span>
                      </div>
                      {slot.enabled && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => handleAvailabilityTimeChange(slot.dayOfWeek, "startTime", e.target.value)}
                            className="w-32"
                            data-testid={`input-start-${slot.dayOfWeek}`}
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => handleAvailabilityTimeChange(slot.dayOfWeek, "endTime", e.target.value)}
                            className="w-32"
                            data-testid={`input-end-${slot.dayOfWeek}`}
                          />
                        </div>
                      )}
                      {!slot.enabled && (
                        <span className="text-muted-foreground text-sm">Unavailable</span>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={saveAvailability}
                  disabled={availabilityMutation.isPending}
                  className="mt-6"
                  data-testid="button-save-availability"
                >
                  {availabilityMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Availability
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Form Fields Tab */}
          <TabsContent value="form">
            <Card>
              <CardHeader>
                <CardTitle>Intake Form Fields</CardTitle>
                <CardDescription>These fields are shown to clients when booking an appointment</CardDescription>
              </CardHeader>
              <CardContent>
                {fieldsLoading ? (
                  <Skeleton className="h-[400px]" />
                ) : (
                  <div className="space-y-4">
                    {formFields?.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex items-start gap-4 p-4 rounded-lg bg-muted/30"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{field.label}</span>
                            {field.required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">{field.type}</Badge>
                          </div>
                          {field.options && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Options: {field.options.slice(0, 3).join(", ")}
                              {field.options.length > 3 && ` +${field.options.length - 3} more`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-sm text-muted-foreground mt-4">
                      Form field editing coming soon. Contact support to modify your intake form.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Appointments</CardTitle>
                <CardDescription>View and manage your scheduled appointments</CardDescription>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : appointments && appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/30"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{apt.clientName}</span>
                            <Badge
                              variant={apt.status === "confirmed" ? "default" : apt.status === "cancelled" ? "destructive" : "secondary"}
                            >
                              {apt.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(parseISO(apt.dateTime), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {apt.clientEmail} | {apt.clientPhone}
                          </p>
                        </div>
                        {apt.meetLink && (
                          <a href={apt.meetLink} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" data-testid={`button-join-${apt.id}`}>
                              Join Meeting
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No appointments scheduled yet.</p>
                    <p className="text-sm mt-1">Appointments will appear here once clients book.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
