import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, addMonths, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Clock, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Settings, TimeSlot } from "@shared/schema";
import { useLocation } from "wouter";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingPage() {
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const availableSlotsUrl = selectedDate 
    ? `/api/available-slots?dateTime=${encodeURIComponent(selectedDate.toISOString())}`
    : null;

  const { data: availableSlots, isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: [availableSlotsUrl],
    enabled: !!selectedDate && !!availableSlotsUrl,
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = addDays(monthStart, -monthStart.getDay());
    const endDate = addDays(monthEnd, 6 - monthEnd.getDay());
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const minBookingDate = useMemo(() => {
    if (!settings) return addDays(new Date(), 1);
    const hoursAdvance = settings.minAdvanceBooking || 24;
    return addDays(new Date(), hoursAdvance / 24);
  }, [settings]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleDateClick = (date: Date) => {
    if (isBefore(startOfDay(date), startOfDay(minBookingDate))) return;
    setSelectedDate(date);
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    if (!settings) return;
    const params = new URLSearchParams({
      dateTime: slot.dateTime,
      duration: String(settings.appointmentDuration),
    });
    setLocation(`/book/info?${params.toString()}`);
  };

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-4xl p-4 md:p-8">
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8">
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 border-b px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{settings?.businessName || "Magical Mind Shifts Inc."}</p>
                <CardTitle className="text-xl">{settings?.ownerName || "Doc Volz"}</CardTitle>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              {/* Calendar Section */}
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Select a date & time</h3>
                
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    disabled={isSameMonth(currentMonth, new Date())}
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h4 className="text-base font-medium">
                    {format(currentMonth, "MMMM yyyy")}
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS_OF_WEEK.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isPast = isBefore(startOfDay(day), startOfDay(minBookingDate));
                    const isTodayDate = isToday(day);

                    return (
                      <button
                        key={index}
                        onClick={() => handleDateClick(day)}
                        disabled={!isCurrentMonth || isPast}
                        data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                        className={cn(
                          "aspect-square flex items-center justify-center text-sm rounded-md transition-colors",
                          !isCurrentMonth && "text-muted-foreground/30",
                          isCurrentMonth && !isPast && "hover:bg-primary/10 cursor-pointer",
                          isPast && isCurrentMonth && "text-muted-foreground/50 cursor-not-allowed",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                          isTodayDate && !isSelected && "border border-primary",
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>

                {/* Timezone */}
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Timezone: {settings?.timezone || "America/New_York"}</span>
                </div>
              </div>

              {/* Time Slots Section */}
              <div className="p-6">
                {selectedDate ? (
                  <>
                    <h3 className="text-lg font-semibold mb-4">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </h3>
                    {slotsLoading ? (
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : availableSlots && availableSlots.length > 0 ? (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {availableSlots.filter(s => s.available).map((slot, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            className="w-full justify-center h-12 text-base font-medium hover-elevate"
                            onClick={() => handleTimeSelect(slot)}
                            data-testid={`timeslot-${slot.time}`}
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No available times for this date.</p>
                        <p className="text-sm mt-1">Please select another date.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-center">Select a date to view available times</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="border-t p-6 bg-muted/30">
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {settings?.description}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
