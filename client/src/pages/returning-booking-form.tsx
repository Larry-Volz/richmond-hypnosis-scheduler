import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Clock, Video, Check, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

const issuesOptions = [
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
];

const returningClientSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
});

type ReturningClientFormData = z.infer<typeof returningClientSchema>;

export default function ReturningBookingFormPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const params = new URLSearchParams(search);
  const dateTime = params.get("dateTime");
  const duration = params.get("duration") || "60";

  const handleIssueChange = (issue: string, checked: boolean) => {
    if (checked) {
      setSelectedIssues(prev => [...prev, issue]);
    } else {
      setSelectedIssues(prev => prev.filter(i => i !== issue));
    }
  };

  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<ReturningClientFormData>({
    resolver: zodResolver(returningClientSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
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

  const onSubmit = async (data: ReturningClientFormData) => {
    if (!dateTime || !settings) return;

    if (selectedIssues.length === 0) {
      toast({
        title: "Required Field Missing",
        description: "Please select at least one issue you would like help with.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await bookMutation.mutateAsync({
        dateTime,
        duration: parseInt(duration),
        clientName: data.fullName,
        clientEmail: data.email,
        clientPhone: data.phone,
        guests: [],
        formResponses: { 
          clientType: "Returning Client",
          issues: selectedIssues,
          notes: notes || ""
        },
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
                Welcome back! Your appointment has been scheduled and a calendar invitation has been sent to your email.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>{format(parseISO(dateTime), "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>{format(parseISO(dateTime), "h:mm a")} ({duration} min)</span>
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

              <a href="https://richmondhypnosiscenter.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full" data-testid="button-back-to-site">
                  Back to Richmond Hypnosis Center
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-md mx-auto">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const parsedDateTime = parseISO(dateTime);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 md:p-8">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <p className="text-sm text-muted-foreground">Welcome back!</p>
                <CardTitle className="text-xl mt-1">Book Your Session</CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="bg-primary/5 rounded-lg p-4 mb-6">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{format(parsedDateTime, "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{format(parsedDateTime, "h:mm a")} ({duration} min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  <span>Google Meet</span>
                </div>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="pt-4 border-t">
                <Label className="text-base">Please check the issues you would like help with *</Label>
                <div className="mt-3 space-y-2">
                  {issuesOptions.map((issue) => (
                    <div key={issue} className="flex items-center gap-2">
                      <Checkbox
                        id={`issue-${issue}`}
                        checked={selectedIssues.includes(issue)}
                        onCheckedChange={(checked) => handleIssueChange(issue, checked as boolean)}
                        data-testid={`checkbox-issue-${issue.replace(/\s+/g, "-").toLowerCase()}`}
                      />
                      <Label htmlFor={`issue-${issue}`} className="text-sm font-normal cursor-pointer">
                        {issue}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Please share any questions or notes you think I should know of in advance. Thank you.</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="mt-2 min-h-[100px]"
                  data-testid="textarea-notes"
                />
              </div>

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
