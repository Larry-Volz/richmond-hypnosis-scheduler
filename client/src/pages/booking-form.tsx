import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Clock, Video, Check, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings, FormField } from "@shared/schema";
import { Link } from "wouter";

const bookingFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
  guests: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

export default function BookingFormPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);

  const params = new URLSearchParams(search);
  const dateTime = params.get("dateTime");
  const duration = params.get("duration");

  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: formFields, isLoading: fieldsLoading } = useQuery<FormField[]>({
    queryKey: ["/api/form-fields"],
  });

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      guests: "",
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/appointments", data);
      return response;
    },
    onSuccess: (data) => {
      setAppointmentDetails(data);
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormResponses(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setFormResponses(prev => {
      const current = prev[fieldId] || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter((o: string) => o !== option) };
      }
    });
  };

  const onSubmit = async (data: BookingFormData) => {
    if (!dateTime || !settings) return;

    // Validate required custom fields
    const missingFields: string[] = [];
    formFields?.forEach(field => {
      if (field.required) {
        const value = formResponses[field.id];
        if (!value || (Array.isArray(value) && value.length === 0)) {
          missingFields.push(field.label);
        }
      }
    });

    if (missingFields.length > 0) {
      toast({
        title: "Required Fields Missing",
        description: `Please complete: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await bookMutation.mutateAsync({
        dateTime,
        duration: parseInt(duration || String(settings.appointmentDuration)),
        clientName: data.fullName,
        clientEmail: data.email,
        clientPhone: data.phone,
        guests: data.guests ? data.guests.split(",").map(g => g.trim()).filter(Boolean) : [],
        formResponses,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!dateTime) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Invalid booking link. Please select a time slot first.</p>
            <div className="mt-4 flex justify-center">
              <Link href="/">
                <Button data-testid="button-back-to-calendar">Back to Calendar</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess && appointmentDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Appointment Confirmed!</h2>
              <p className="text-muted-foreground mb-6">
                Your appointment has been scheduled and a calendar invitation has been sent to your email.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>{format(parseISO(dateTime), "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>{format(parseISO(dateTime), "h:mm a")} ({duration || settings?.appointmentDuration} min)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5 text-primary" />
                  <span>Google Meet video call</span>
                </div>
              </div>

              {appointmentDetails.meetLink && (
                <a
                  href={appointmentDetails.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mb-4"
                >
                  <Button className="w-full" data-testid="button-join-meet">
                    <Video className="w-4 h-4 mr-2" />
                    Join Google Meet
                  </Button>
                </a>
              )}

              <Link href="/">
                <Button variant="outline" className="w-full" data-testid="button-book-another">
                  Book Another Appointment
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settingsLoading || fieldsLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-[800px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const parsedDateTime = parseISO(dateTime);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <p className="text-sm text-muted-foreground">Add more details about you</p>
                <CardTitle className="text-xl mt-1">Complete Your Booking</CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Appointment Summary */}
            <div className="bg-primary/5 rounded-lg p-4 mb-6">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{format(parsedDateTime, "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{format(parsedDateTime, "h:mm a")} ({duration || settings?.appointmentDuration} min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  <span>Google Meet</span>
                </div>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full name *</Label>
                  <Input
                    id="fullName"
                    {...form.register("fullName")}
                    placeholder="Your full name"
                    data-testid="input-fullname"
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.fullName.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="your@email.com"
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...form.register("phone")}
                    placeholder="Your phone number"
                    data-testid="input-phone"
                  />
                  <p className="text-xs text-muted-foreground mt-1">We will use it to remind you of this appointment.</p>
                  {form.formState.errors.phone && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="guests">Guests (optional)</Label>
                  <Input
                    id="guests"
                    {...form.register("guests")}
                    placeholder="Add guest emails, separated by commas"
                    data-testid="input-guests"
                  />
                </div>
              </div>

              {/* Dynamic Form Fields */}
              {formFields && formFields.length > 0 && (
                <div className="space-y-6 pt-4 border-t">
                  {formFields.map((field) => (
                    <div key={field.id}>
                      <Label className="text-base">
                        {field.label} {field.required && "*"}
                      </Label>
                      
                      {field.type === "text" && (
                        <Input
                          placeholder={field.placeholder}
                          value={formResponses[field.id] || ""}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="mt-2"
                          data-testid={`input-${field.id}`}
                        />
                      )}

                      {field.type === "textarea" && (
                        <Textarea
                          placeholder={field.placeholder}
                          value={formResponses[field.id] || ""}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="mt-2 min-h-[100px]"
                          data-testid={`textarea-${field.id}`}
                        />
                      )}

                      {field.type === "select" && field.options && (
                        <Select
                          value={formResponses[field.id] || ""}
                          onValueChange={(value) => handleFieldChange(field.id, value)}
                        >
                          <SelectTrigger className="mt-2" data-testid={`select-${field.id}`}>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {field.type === "checkbox" && field.options && (
                        <div className="mt-2 space-y-2">
                          {field.options.map((option) => (
                            <div key={option} className="flex items-center gap-2">
                              <Checkbox
                                id={`${field.id}-${option}`}
                                checked={(formResponses[field.id] || []).includes(option)}
                                onCheckedChange={(checked) => handleCheckboxChange(field.id, option, checked as boolean)}
                                data-testid={`checkbox-${field.id}-${option.replace(/\s+/g, "-").toLowerCase()}`}
                              />
                              <Label htmlFor={`${field.id}-${option}`} className="text-sm font-normal cursor-pointer">
                                {option}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === "radio" && field.options && (
                        <RadioGroup
                          value={formResponses[field.id] || ""}
                          onValueChange={(value) => handleFieldChange(field.id, value)}
                          className="mt-2 space-y-2"
                        >
                          {field.options.map((option) => (
                            <div key={option} className="flex items-center gap-2">
                              <RadioGroupItem
                                value={option}
                                id={`${field.id}-${option}`}
                                data-testid={`radio-${field.id}-${option.replace(/\s+/g, "-").toLowerCase()}`}
                              />
                              <Label htmlFor={`${field.id}-${option}`} className="text-sm font-normal cursor-pointer">
                                {option}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
                data-testid="button-confirm-appointment"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Confirm Appointment"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
