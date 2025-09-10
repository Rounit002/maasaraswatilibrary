import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, X, Loader2, Pencil, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
          <Card className="p-6 shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-red-600">Something Went Wrong</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                An error occurred while loading the schedule. Please try refreshing the page or contact support if the issue persists.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ScheduleEvent {
  id: number;
  title: string;
  description: string | null;
  time: string;
  eventDate: string;
  fee: number;
}

const parseValidDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
};

const formatTimeForDisplay = (timeString: string | null | undefined): string => {
  if (!timeString || !timeString.includes(':')) return 'N/A';
  const [hour, minute] = timeString.split(':').map(Number);
  if (isNaN(hour) || isNaN(minute)) return 'Invalid time';

  const date = new Date();
  date.setHours(hour, minute, 0);

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
};

const formatDateForDisplay = (dateStr: string | Date): string => {
  const date = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00') : dateStr;
  if (isNaN(date.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

const SchedulePage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<ScheduleEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<ScheduleEvent | null>(null);

  const initialNewEventState = {
    title: '',
    date: new Date(),
    time: '',
    description: '',
    fee: 0,
  };
  const [newEvent, setNewEvent] = useState(initialNewEventState);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getSchedules();
      console.log('Raw API Response:', response);
      const schedules = Array.isArray(response.schedules) ? response.schedules : Array.isArray(response) ? response : [];
      const formattedSchedules = schedules
        .filter(schedule => schedule && typeof schedule === 'object') // Ensure valid objects
        .map((schedule: any) => ({
          id: schedule.id,
          title: schedule.title || '',
          description: schedule.description ?? '',
          time: schedule.time || '',
          eventDate: schedule.eventDate || '', // Rely on camelCase from interceptor
          fee: parseFloat(schedule.fee) || 0,
        }));
      setEvents(formattedSchedules);
    } catch (error: any) {
      console.error('Error caught in fetchEvents:', error);
      toast.error(error.message || 'Failed to load events');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleAddEventSubmit = async () => {
    if (!newEvent.title.trim() || !newEvent.time) {
      toast.error('Please fill in Event Title and Time.');
      return;
    }

    const eventDate = newEvent.date instanceof Date && !isNaN(newEvent.date.getTime()) ? newEvent.date : new Date();
    const dateStrYYYYMMDD = eventDate.toISOString().split('T')[0];

    const scheduleDataToSend = {
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || null,
      time: newEvent.time,
      eventDate: dateStrYYYYMMDD, // Ensure YYYY-MM-DD format
      fee: newEvent.fee,
    };

    console.log('Sending add event data:', scheduleDataToSend); // Debug log
    setIsLoading(true);
    try {
      await api.addSchedule(scheduleDataToSend);
      await fetchEvents();
      setIsAddDialogOpen(false);
      setNewEvent(initialNewEventState);
      toast.success('Event added successfully!');
    } catch (error: any) {
      console.error('Error in handleAddEventSubmit:', error);
      toast.error(error.message || 'Failed to add event.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEventSubmit = async () => {
    if (!eventToEdit) return;

    // Normalize eventDate to YYYY-MM-DD format
    const normalizedEventDate = parseValidDate(eventToEdit.eventDate);
    const dateStrYYYYMMDD = normalizedEventDate ? normalizedEventDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const updatedEvent = {
      ...eventToEdit,
      eventDate: dateStrYYYYMMDD,
    };

    console.log('Sending update event data:', updatedEvent); // Debug log
    setIsLoading(true);
    try {
      const { id, title, description, time, fee, eventDate } = updatedEvent;
      await api.updateSchedule(id, {
        title,
        description,
        time,
        eventDate,
        fee,
      });
      await fetchEvents();
      setIsEditDialogOpen(false);
      setEventToEdit(null);
      toast.success('Event updated successfully!');
    } catch (error: any) {
      console.error('Error in handleUpdateEventSubmit:', error);
      toast.error(error.message || 'Failed to update event.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    setIsLoading(true);
    try {
      await api.deleteSchedule(eventToDelete.id);
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDelete.id));
      toast.success('Event removed from schedule.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete event.');
    } finally {
      setIsLoading(false);
      setEventToDelete(null);
    }
  };

  const filteredEvents = selectedDate
    ? events.filter(event => {
        const eventDateObj = parseValidDate(event.eventDate);
        if (!eventDateObj) return false;
        return (
          eventDateObj.getFullYear() === selectedDate.getFullYear() &&
          eventDateObj.getMonth() === selectedDate.getMonth() &&
          eventDateObj.getDate() === selectedDate.getDate()
        );
      })
    : events;

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Schedules & Events</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">Manage your daily activities and classes.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 space-y-8">
                  <Card className="shadow-lg border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Calendar</span>
                        <CalendarIcon className="h-5 w-5 text-gray-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="p-0"
                      />
                      <div className="mt-4 space-y-2">
                        <Button
                          onClick={() => {
                            setNewEvent({ ...initialNewEventState, date: selectedDate || new Date() });
                            setIsAddDialogOpen(true);
                          }}
                          disabled={isLoading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Plus size={18} className="mr-2" /> Add New Event
                        </Button>
                        {selectedDate && (
                          <Button
                            variant="ghost"
                            className="w-full text-red-500 hover:text-red-600"
                            onClick={() => setSelectedDate(undefined)}
                            disabled={isLoading}
                          >
                            <X size={16} className="mr-2" /> Clear Selection
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <Card className="shadow-lg border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle>
                        {selectedDate ? `Events for ${formatDateForDisplay(selectedDate)}` : 'All Upcoming Events'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="py-12 flex justify-center items-center">
                          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                      ) : (
                        <Table>
                          <TableCaption>
                            {filteredEvents.length === 0 ? 'No events to display.' : 'A list of your scheduled events.'}
                          </TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[150px]">Event</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Fee</TableHead>
                              <TableHead className="hidden md:table-cell">Description</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEvents.map((event) => (
                              <TableRow key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <TableCell className="font-medium">{event.title}</TableCell>
                                <TableCell>{formatTimeForDisplay(event.time)}</TableCell>
                                <TableCell>₹{event.fee.toFixed(2)}</TableCell>
                                <TableCell className="hidden md:table-cell max-w-xs truncate">{event.description || '—'}</TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700" onClick={() => { setEventToEdit(event); setIsEditDialogOpen(true); }}>
                                    <Pencil size={16} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setEventToDelete(event)}>
                                    <Trash2 size={16} />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[480px] dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle>Add New Event</DialogTitle>
              <DialogDescription>Fill in the details for your new schedule event.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input id="eventTitle" placeholder="Event Title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
              <Input id="eventTime" type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} />
              <Input id="eventFee" type="number" placeholder="Fee" value={newEvent.fee} onChange={(e) => setNewEvent({ ...newEvent, fee: parseFloat(e.target.value) || 0 })} />
              <Textarea id="eventDescription" placeholder="Description (optional)" value={newEvent.description || ''} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
              <div className="text-sm text-gray-500 dark:text-gray-400">Date: {formatDateForDisplay(newEvent.date)}</div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleAddEventSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2"/>} Add Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[480px] dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>Update the details for this schedule event.</DialogDescription>
            </DialogHeader>
            {eventToEdit && (
              <div className="grid gap-4 py-4">
                <Input id="editEventTitle" placeholder="Event Title" value={eventToEdit.title} onChange={(e) => setEventToEdit({ ...eventToEdit, title: e.target.value })} />
                <Input id="editEventTime" type="time" value={eventToEdit.time} onChange={(e) => setEventToEdit({ ...eventToEdit, time: e.target.value })} />
                <Input id="editEventFee" type="number" placeholder="Fee" value={eventToEdit.fee} onChange={(e) => setEventToEdit({ ...eventToEdit, fee: parseFloat(e.target.value) || 0 })} />
                <Textarea id="editEventDescription" placeholder="Description (optional)" value={eventToEdit.description || ''} onChange={(e) => setEventToEdit({ ...eventToEdit, description: e.target.value })} />
                <div className="text-sm text-gray-500 dark:text-gray-400">Date: {formatDateForDisplay(eventToEdit.eventDate)}</div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleUpdateEventSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2"/>} Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!eventToDelete} onOpenChange={() => setEventToDelete(null)}>
          <DialogContent className="sm:max-w-md dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the event
                <span className="font-bold"> "{eventToDelete?.title}"</span>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2"/>} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
};

export default SchedulePage;