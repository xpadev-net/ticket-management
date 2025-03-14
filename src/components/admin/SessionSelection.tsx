import { useId } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SessionCard } from '@/components/session-card';
import { SessionStatsResponseItem } from '@/app/api/sessions/stats/route';

interface SessionSelectionProps {
  sessions: SessionStatsResponseItem[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

export function SessionSelection({ sessions, selectedSessionId, onSelect }: SessionSelectionProps) {
  const id = useId();
  const selectedSession = selectedSessionId ? sessions.find(s => s.id === selectedSessionId) : null;

  return (
    <Accordion type="single" collapsible className="w-full" value={selectedSessionId ? undefined : id}>
      <AccordionItem value={id}>
        <AccordionTrigger>
          {selectedSession ? (
            <div>
              {selectedSession.event.name} {selectedSession.name}
            </div>
          ) : (
            <div>
              セッションを選択してください
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent className='flex flex-col gap-2'>
          {sessions.map((session) => (
            <SessionCard 
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={selectedSessionId === session.id
                ? 'border-blue-500'
                : 'hover:border-blue-300'}
              session={session}
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}