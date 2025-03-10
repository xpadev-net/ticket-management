import { useState, useCallback, useId } from 'react';
import useSWR, { mutate } from 'swr';
import AdminLayout from '@/components/admin/layout';
import QrScanner from '@/components/admin/QrScanner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { swrFetcher, fetchWithAuth, putWithAuth } from '@/lib/fetcher';
import { SessionStatsResponse, SessionStatsResponseItem } from '@/app/api/sessions/stats/route';
import { TicketStatusUpdateResponse } from '@/app/api/tickets/[qrCode]/route';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

export default function TicketVerification() {
  const [isScanning, setIsScanning] = useState(false);
  const [lastVerifiedTicket, setLastVerifiedTicket] = useState<TicketStatusUpdateResponse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);
  const [processingTicket, setProcessingTicket] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: sessionsData, error: sessionsError, isLoading: isLoadingSessions } = useSWR<SessionStatsResponse>(
    '/api/sessions/stats',
    swrFetcher
  );

  // 使いやすいように型変換
  const availableSessions: SessionStatsResponseItem[] = sessionsData || [];
  const selectedSession = selectedSessionId
    ? availableSessions.find(s => s.id === selectedSessionId)
    : null;

  // セッション選択処理
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsScanning(false); // Close the selection menu
  };

  // セッション統計データを更新
  const refreshSessionStats = useCallback(() => {
    mutate('/api/sessions/stats');
  }, []);

  // チケットスキャン処理
  const handleScan = useCallback(async (qrCode: string) => {
    if (processingTicket || showConfirmation) return; // Prevent multiple scans while processing
    if (!selectedSession) {
      toast.error('セッションを選択してください');
      return;
    }

    try {
      setProcessingTicket(true);

      // 認証付きフェッチャーを使用してチケット情報を取得
      const data = await fetchWithAuth(`/api/tickets/${encodeURIComponent(qrCode)}`) as TicketStatusUpdateResponse;
      setLastVerifiedTicket(data);

      // Check if ticket is for the selected session
      if (data.session.id !== selectedSession.id) {
        toast.error(`このチケットは選択したセッション用ではありません。`,
          {
            description: (<div>
              <p>チケット: {data.session.event.name} {data.session.name}</p>
              <p>選択中: {selectedSession.event.name} {selectedSession.name}</p>
            </div>),
            duration: 8000,
            id: 'wrong-session',
          });
        setProcessingTicket(false);
        return;
      }

      // Show appropriate notification based on ticket status
      if (data.used) {
        toast.warning(`このチケットは既に使用されています。`, {
          description: `${data.name}さん (${data.session.event.name} ${data.session.name})`,
          duration: 5000,
          id: 'ticket-verified',
        });
        setProcessingTicket(false);
      } else {
        // Show confirmation dialog for unused tickets
        setCurrentQrCode(qrCode);
        setShowConfirmation(true);
        toast.success(`チケット読取成功`, {
          description: `${data.name}さん (${data.session.event.name} ${data.session.name})`,
          duration: 5000,
          id: 'ticket-verified',
        });
      }

      // Keep scanning active - don't call setIsScanning(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'チケットの検証に失敗しました');
      setProcessingTicket(false);
    }
  }, [processingTicket, showConfirmation, selectedSession]);

  // チケット使用処理
  const handleUseTicket = useCallback(async () => {
    if (!currentQrCode) return;

    try {
      // 認証付きPUTリクエストを使用
      const data = await putWithAuth(
        `/api/tickets/${encodeURIComponent(currentQrCode)}`,
        { used: true }
      ) as TicketStatusUpdateResponse;

      setLastVerifiedTicket(data);
      toast.success(`チケットを使用しました: ${data.name}さん (${data.session.event.name} ${data.session.name})`, {
        duration: 5000,
        id: 'ticket-used',
      });

      // セッション統計を更新
      refreshSessionStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'チケット使用の処理に失敗しました');
    } finally {
      // 確認ダイアログを閉じて処理中状態をリセット
      setShowConfirmation(false);
      setCurrentQrCode(null);
      setProcessingTicket(false);
    }
  }, [currentQrCode, refreshSessionStats]);

  const handleCancelUse = useCallback(() => {
    // 確認ダイアログを閉じる（チケットを使用せず）
    setShowConfirmation(false);
    setCurrentQrCode(null);
    setProcessingTicket(false);
    toast.info('チケットの使用をキャンセルしました', { duration: 3000 });
  }, []);

  const calculateProgress = (checkedIn: number, total: number) => {
    if (total === 0) return 0;
    return (checkedIn / total) * 100;
  };

  // セッション読み込み中にエラーが発生した場合
  if (sessionsError) {
    toast.error('セッション情報の取得に失敗しました');
  }

  return (
    <AdminLayout title="チケット受付">
      <div className="space-y-6">
        {/* Session selection */}
        <SessionSelection
          sessions={availableSessions}
          selectedSessionId={selectedSessionId}
          onSelect={handleSessionSelect}
        />
        {/* Session statistics */}
        {selectedSession && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">受付状況</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>参加予定者数:</span>
                <span className="font-medium">{selectedSession.stats.total}人</span>
              </div>

              <div className="flex items-center justify-between">
                <span>受付済み:</span>
                <span className="font-medium text-green-600">{selectedSession.stats.checkedIn}人</span>
              </div>

              <div className="flex items-center justify-between">
                <span>未受付:</span>
                <span className="font-medium text-amber-600">{selectedSession.stats.remaining}人</span>
              </div>

              <div className="flex items-center justify-between">
                <span>残席数:</span>
                <span className="font-medium">{selectedSession.stats.capacityRemaining}席</span>
              </div>

              {/* Progress bar */}
              <Progress value={calculateProgress(selectedSession.stats.checkedIn, selectedSession.stats.total)} />
              
              <div className="text-xs text-center">
                {selectedSession.stats.checkedIn} / {selectedSession.stats.total}
                ({Math.round(calculateProgress(selectedSession.stats.checkedIn, selectedSession.stats.total))}%)
              </div>
            </div>
          </Card>
        )}

        {/* QR Scanner */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">QRコードスキャン</h2>
            <Button
              onClick={() => setIsScanning(!isScanning)}
              variant={isScanning ? "outline" : "default"}
              disabled={!selectedSession || showConfirmation}
            >
              {isScanning ? 'スキャンを停止' : 'スキャンを開始'}
            </Button>
          </div>

          {!selectedSession ? (
            <div className="text-center py-12 text-amber-600">
              先にセッションを選択してください
            </div>
          ) : isScanning ? (
            <QrScanner onScan={handleScan} />
          ) : (
            <div className="text-center py-12 text-gray-500">
              スキャンを開始するにはボタンをクリックしてください
            </div>
          )}
        </Card>

        <Dialog open={!!(showConfirmation && lastVerifiedTicket)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle >チケット使用確認</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mb-4">
              <div>
                <span className="font-medium">参加者名: </span>
                {lastVerifiedTicket?.name}
              </div>
              <div>
                <span className="font-medium">イベント: </span>
                {lastVerifiedTicket?.session.event.name}
              </div>
              <div>
                <span className="font-medium">回: </span>
                {lastVerifiedTicket?.session.name}
              </div>
            </div>
            <p className="mb-4 font-medium">このチケットを使用済みとしてマークしますか？</p>
            <div className="flex space-x-4">
              <Button onClick={handleUseTicket} className="bg-green-600 hover:bg-green-700">
                使用する
              </Button>
              <Button onClick={handleCancelUse} variant="outline">
                キャンセル
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Last verified ticket information */}
        {lastVerifiedTicket && !showConfirmation && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">最後に確認したチケット</h2>
            <div className="space-y-2">
              <div>
                <span className="font-medium">イベント: </span>
                {lastVerifiedTicket.session.event.name}
              </div>
              <div>
                <span className="font-medium">回: </span>
                {lastVerifiedTicket.session.name}
              </div>
              <div>
                <span className="font-medium">日時: </span>
                {formatDate(lastVerifiedTicket.session.date)}
              </div>
              <div>
                <span className="font-medium">場所: </span>
                {lastVerifiedTicket.session.location}
              </div>
              <div>
                <span className="font-medium">参加者名: </span>
                {lastVerifiedTicket.name}
              </div>
              <div>
                <span className="font-medium">メールアドレス: </span>
                {lastVerifiedTicket.email}
              </div>
              <div>
                <span className="font-medium">ステータス: </span>
                <span className={lastVerifiedTicket.used ? "text-red-600" : "text-green-600"}>
                  {lastVerifiedTicket.used ? '使用済み' : '未使用'}
                </span>
              </div>
              {lastVerifiedTicket.usedAt && (
                <div>
                  <span className="font-medium">使用日時: </span>
                  {formatDate(lastVerifiedTicket.usedAt)}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

const SessionSelection = ({ sessions, selectedSessionId, onSelect }: {
  sessions: SessionStatsResponseItem[],
  selectedSessionId: string | null,
  onSelect: (sessionId: string) => void,
}) => {
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
            <Card
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedSessionId === session.id
                  ? 'border-blue-500'
                  : 'hover:border-blue-300'
                }`}
            >
              <div className="font-medium">{session.event.name}</div>
              <div>{session.name}</div>
              <div className="text-sm text-gray-600">{formatDate(session.date)}</div>
              <div className="text-sm text-gray-500">{session.location}</div>
            </Card>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
