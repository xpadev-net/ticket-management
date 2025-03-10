import { useState } from 'react';
import { useRouter } from 'next/router';
import { Event as PrismaEvent, EventSession as PrismaEventSession } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import useSWR from 'swr';
import { postWithAuth, swrFetcher } from '@/lib/fetcher';
import { PublicEventResponse } from '@/app/api/public/events/[id]/route';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TicketGenerationResponse } from '@/app/api/public/tickets/route';
import { TicketGenerationRequest } from '@/lib/schema';

interface TicketFormData {
  name: string;
  email: string;
  quantity: number;
}

export default function EventPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: event, error, isLoading } = useSWR<PublicEventResponse>(
    id ? `/api/public/events/${id}` : null,
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
      const response = await postWithAuth<TicketGenerationResponse,TicketGenerationRequest>('/api/public/tickets', {
        sessionId: selectedSession,
        applicant: formData
      });
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
            <Select onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="申し込むセッションを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {event.sessions.map((session) => (
                  <SelectItem 
                    key={session.id} 
                    value={session.id}
                    disabled={session.available <= 0}
                  >
                    {session.name} - {new Date(session.date).toLocaleString('ja-JP')} @ {session.location}
                    （残り{session.available}席）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quantity">申込人数</Label>
            <Input
              disabled={submitting || !selectedSession}
              id="quantity"
              type="number"
              min="1"
              max={selectedSessionData?.available || 1}
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              required
            />
            {selectedSessionData && (
              <p className="text-sm text-gray-600 mt-1">
                残り{selectedSessionData.available}席
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="name">お名前</Label>
            <Input
              disabled={submitting || !selectedSession}
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              disabled={submitting || !selectedSession}
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