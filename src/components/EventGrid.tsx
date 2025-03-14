import React from 'react';
import { Event, EventSession } from '@/lib/types';
import { EventCard } from '@/components/event-card';

interface EventWithDetails extends Event {
  sessions: EventSession[];
}

interface EventGridProps {
  events: EventWithDetails[];
}

export function EventGrid({ events }: EventGridProps) {
  if (events.length === 0) {
    return (
      <p className="text-center text-gray-600">
        条件に一致するイベントが見つかりませんでした。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} link={`/events/${event.id}`} />
      ))}
    </div>
  );
}