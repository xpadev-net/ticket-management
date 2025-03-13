import { useState, useId } from 'react';
import { useRouter } from 'next/router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import useSWR from 'swr';
import { postWithAuth, swrFetcher } from '@/lib/fetcher';
import { PublicEventResponse } from '@/app/api/public/events/[id]/route';
import { Textarea } from '@/components/ui/textarea';
import { TicketGenerationResponse } from '@/app/api/public/tickets/route';
import { TicketGenerationRequest } from '@/lib/schema';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { StyledMarkdown } from '@/components/markdown';
import { SessionCard } from '@/components/session-card';

interface TicketFormData {
  name: string;
  nameKana: string;
  email: string;
  quantity: number;
  isGroupTicket: boolean;
  notes: string;
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
    nameKana: '',
    email: '',
    quantity: 1,
    isGroupTicket: false,
    notes: '', // 備考欄の初期値
  });
  const [submitting, setSubmitting] = useState(false);
  const accordionId = useId();
  
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
          quantity: formData.quantity,
          isGroup: formData.isGroupTicket
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

  // セッション選択ハンドラ
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
  };

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

  // セッション日時をフォーマットする関数
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">{event.name}</h1>
        <StyledMarkdown>{event.description}</StyledMarkdown>
        <h2 className="text-xl font-bold mb-4">チケット申し込み</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* セッション選択のアコーディオン */}
          <div className="mb-6">
            <Accordion 
              type="single" 
              collapsible 
              className="w-full" 
              value={selectedSession ? undefined : accordionId}
            >
              <AccordionItem value={accordionId}>
                <AccordionTrigger className="py-4">
                  {selectedSessionData ? (
                    <div className="text-left">
                      {selectedSessionData.name} - {formatDate(selectedSessionData.date)} @ {selectedSessionData.location}
                    </div>
                  ) : (
                    <div>セッションを選択してください</div>
                  )}
                </AccordionTrigger>
                <AccordionContent className='flex flex-col gap-2 py-2'>
                  {event.sessions.map((session) => (
                    <SessionCard 
                      key={session.id} 
                      session={{
                        ...session,
                        event: { name: event.name }
                      }} 
                      onClick={() => handleSessionSelect(session.id)}
                      className={selectedSession === session.id
                        ? 'border-blue-500'
                        : 'hover:border-blue-300'}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* セッション選択後のみ表示する申込フォーム */}
          {selectedSessionData && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="quantity">申込人数</Label>
                <Input
                  disabled={submitting}
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedSessionData.available}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  required
                />
                <p className="text-sm text-gray-600 mt-1">
                  残り{selectedSessionData.available}席
                </p>
              </div>

              {/* チケットタイプ選択 - 2人以上の場合のみ表示 */}
              {formData.quantity >= 2 && (
                <div>
                  <Label className="mb-2 block">チケットタイプ</Label>
                  <RadioGroup 
                    value={formData.isGroupTicket ? 'group' : 'individual'} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      isGroupTicket: value === 'group' 
                    })}
                    className="flex flex-col space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individual" id="individual" />
                      <Label htmlFor="individual" className="cursor-pointer">
                        個人チケット（バラ）- 人数分のチケットを発行します
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="group" id="group" />
                      <Label htmlFor="group" className="cursor-pointer">
                        団体チケット（1枚） - グループ全員で1枚のチケットを使用します
                      </Label>
                    </div>
                  </RadioGroup>
                  <div className="mt-2 text-sm text-foreground/60">
                    <p>※団体チケットは、家族やグループで一緒に入場する場合に適しています。1枚のQRコードで全員が一緒に入場できます。</p>
                    <p>※個人チケットは、同行者が別々のタイミングで入場する可能性がある場合に適しています。代表者に全員分のQRコードが送付されます。</p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="name">お名前</Label>
                <Input
                  disabled={submitting}
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="nameKana">お名前（ふりがな）</Label>
                <Input
                  disabled={submitting}
                  id="nameKana"
                  value={formData.nameKana}
                  onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                  required
                  placeholder="ひらがなで入力してください"
                />
              </div>

              <div>
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  disabled={submitting}
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              {/* 備考欄を追加 */}
              <div>
                <Label htmlFor="notes">備考</Label>
                <Textarea
                  disabled={submitting}
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="要望や配慮が必要な事項があればご記入ください"
                  className="min-h-[100px]"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? '送信中...' : 'チケットを申し込む'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}