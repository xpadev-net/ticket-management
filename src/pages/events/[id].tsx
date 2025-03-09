import { useState } from 'react';
import { useRouter } from 'next/router';
import { Event as PrismaEvent, EventSession as PrismaEventSession } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';

interface TicketFormData {
  name: string;
  email: string;
  quantity: number;
}

interface EventSession extends PrismaEventSession {
  availableSeats: number;
}

interface EventWithAvailability extends Omit<PrismaEvent, 'sessions'> {
  sessions: EventSession[];
}

export default function EventPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: event, error, isLoading } = useSWR<EventWithAvailability>(
    id ? `/api/events/${id}` : null,
    swrFetcher
  );
  
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [formData, setFormData] = useState<TicketFormData>({
    name: '',
    email: '',
    quantity: 1
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) {
      toast.error('セッションを選択してください');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSession,
          ...formData,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'チケットの申し込みに失敗しました');
      }
      // 申込完了ページへリダイレクト
      const selectedSessionData = event?.sessions.find(s => s.id === selectedSession);
      router.push({
        pathname: '/events/complete',
        query: {
          eventName: event?.name,
          sessionName: selectedSessionData?.name,
          quantity: formData.quantity
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'チケットの申し込みに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSessionData = selectedSession
    ? event?.sessions.find(s => s.id === selectedSession)
    : null;

  if (isLoading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        エラーが発生しました: {error.message}
      </div>
    );
  }

  if (!event) {
    return <div className="container mx-auto p-4">イベントが見つかりません</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">{event.name}</h1>
        <p className="mb-6">{event.description}</p>
        <h2 className="text-xl font-bold mb-4">チケット申し込み</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="session">セッション選択</Label>
            <select
              id="session"
              className="w-full p-2 border rounded"
              value={selectedSession || ''}
              onChange={(e) => setSelectedSession(e.target.value)}
              required
            >
              <option value="">セッションを選択してください</option>
              {event.sessions.map((session) => (
                <option 
                  key={session.id} 
                  value={session.id}
                  disabled={session.availableSeats <= 0}
                >
                  {session.name} - {new Date(session.date).toLocaleString('ja-JP')} @ {session.location}
                  （残り{session.availableSeats}席）
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="quantity">申込人数</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={selectedSessionData?.availableSeats || 1}
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              required
            />
            {selectedSessionData && (
              <p className="text-sm text-gray-600 mt-1">
                残り{selectedSessionData.availableSeats}席
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="name">お名前</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <Button type="submit" disabled={submitting || !selectedSession}>
            {submitting ? '送信中...' : 'チケットを申し込む'}
          </Button>
        </form>
      </Card>
    </div>
  );
}