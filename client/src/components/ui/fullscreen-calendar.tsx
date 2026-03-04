import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  amount?: number;
  color?: string;
  category?: string;
}

interface FullScreenCalendarProps {
  events?: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function FullScreenCalendar({
  events = [],
  onDateSelect,
  onEventClick,
  className,
}: FullScreenCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = format(event.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [events]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday header row */}
      <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-700">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {calendarDays.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(day)}
              className={cn(
                'relative flex flex-col items-start p-1.5 border-b border-r border-neutral-100 dark:border-neutral-800 text-left transition-colors min-h-[80px]',
                !inMonth && 'bg-neutral-50/50 dark:bg-neutral-900/50',
                inMonth && 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                selected && 'bg-neutral-100 dark:bg-neutral-800 ring-2 ring-inset ring-neutral-900 dark:ring-white'
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium',
                  !inMonth && 'text-neutral-300 dark:text-neutral-600',
                  inMonth && 'text-neutral-700 dark:text-neutral-300',
                  today && 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold'
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Event dots / pills */}
              <div className="mt-0.5 w-full space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className={cn(
                      'text-[10px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80',
                      event.color
                        ? ''
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                    )}
                    style={event.color ? { backgroundColor: event.color, color: '#fff' } : undefined}
                    title={event.title}
                  >
                    {event.amount !== undefined && (
                      <span className="font-semibold">${event.amount.toFixed(0)} </span>
                    )}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 px-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FullScreenCalendar;
