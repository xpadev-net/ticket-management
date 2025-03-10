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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// チケットタイプの定義
enum TicketType {
  GROUP = 'group',
  INDIVIDUAL = 'individual',
  PARTIAL = 'partial' // 部分受付モード
}

export default function TicketVerification() {
  const [isScanning, setIsScanning] = useState(false);
  const [lastVerifiedTicket, setLastVerifiedTicket] = useState<TicketStatusUpdateResponse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);
  const [processingTicket, setProcessingTicket] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // チケットタイプ選択のための状態
  const [ticketType, setTicketType] = useState<TicketType>(TicketType.INDIVIDUAL);
  // 団体チケットの人数入力のための状態
  const [groupSize, setGroupSize] = useState<number>(1);
  // 部分受付の人数入力のための状態
  const [partialUseCount, setPartialUseCount] = useState<number>(1);

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

      // すでに完全に使用済みの場合
      if (data.fullyUsed) {
        toast.warning(`このチケットは既にすべて使用済みです。`, {
          description: `${data.name}さん (${data.session.event.name} ${data.session.name})`,
          duration: 5000,
          id: 'ticket-fully-used',
        });
        setProcessingTicket(false);
        return;
      }
      
      // チケット情報に基づいて初期チケットタイプを設定
      // 部分的に使用済みの団体チケットの場合
      if (data.used && data.isGroup && data.usedCount > 0 && data.usedCount < data.groupSize) {
        // 部分的に使用済みの場合、部分受付モードをデフォルトに設定
        setTicketType(TicketType.PARTIAL);
        // 残りの人数を設定（デフォルト）
        const remainingCount = data.groupSize - data.usedCount;
        setPartialUseCount(remainingCount);
        
        // 確認ダイアログを表示
        setCurrentQrCode(qrCode);
        setShowConfirmation(true);
        toast.info(`団体チケットの部分受付`, {
          description: `${data.name}さん (既に${data.usedCount}名受付済 / 全${data.groupSize}名)`,
          duration: 5000,
          id: 'partial-use-ticket',
        });
        return;
      }

      // 未使用の場合
      if (!data.used) {
        // 適切なチケットタイプを自動選択
        if (data.isGroup && data.groupSize > 1) {
          setTicketType(TicketType.GROUP);
          setGroupSize(data.groupSize);
        } else {
          setTicketType(TicketType.INDIVIDUAL);
        }

        // 確認ダイアログを表示
        setCurrentQrCode(qrCode);
        setShowConfirmation(true);
        toast.success(`チケット読取成功`, {
          description: `${data.name}さん (${data.session.event.name} ${data.session.name})`,
          duration: 5000,
          id: 'ticket-verified',
        });
        return;
      }

      // その他の使用済み状態
      toast.warning(`このチケットは既に使用されています。`, {
        description: `${data.name}さん (${data.session.event.name} ${data.session.name})`,
        duration: 5000,
        id: 'ticket-used',
      });
      setProcessingTicket(false);

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
      let requestData: any = { 
        used: true
      };
      
      // 処理タイプに応じたリクエストデータを準備
      if (ticketType === TicketType.GROUP) {
        // 団体チケット（全員まとめて受付）
        requestData.isGroupTicket = true;
        requestData.groupSize = groupSize;
      } else if (ticketType === TicketType.PARTIAL) {
        // 部分受付モード
        requestData.partialUse = true;
        requestData.useCount = partialUseCount;
      } else {
        // 個人チケット
        requestData.isGroupTicket = false;
      }
      
      // 認証付きPUTリクエストを使用
      const data = await putWithAuth(
        `/api/tickets/${encodeURIComponent(currentQrCode)}`,
        requestData
      ) as TicketStatusUpdateResponse;

      setLastVerifiedTicket(data);

      // 成功メッセージを表示（処理タイプに応じたメッセージ）
      if (ticketType === TicketType.GROUP) {
        toast.success(`団体チケット(${groupSize}名)を使用しました: ${data.name}さん (${data.session.event.name} ${data.session.name})`, {
          duration: 5000,
          id: 'ticket-used',
        });
      } else if (ticketType === TicketType.PARTIAL) {
        toast.success(`団体チケットの一部(${partialUseCount}名)を使用しました: ${data.name}さん (全体${data.groupSize}名中${data.usedCount}名受付済)`, {
          duration: 5000,
          id: 'ticket-partial-used',
        });
      } else {
        toast.success(`個人チケットを使用しました: ${data.name}さん (${data.session.event.name} ${data.session.name})`, {
          duration: 5000,
          id: 'ticket-used',
        });
      }

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
  }, [currentQrCode, refreshSessionStats, ticketType, groupSize, partialUseCount]);

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

  // チケットタイプを切り替える関数
  const handleTicketTypeChange = (type: TicketType) => {
    setTicketType(type);
    // グループチケットの場合、デフォルトの人数を2に設定
    if (type === TicketType.GROUP && groupSize < 2) {
      setGroupSize(2);
    }
    // 部分受付モードに切り替えた場合は、部分受付用の人数を調整
    if (type === TicketType.PARTIAL && lastVerifiedTicket) {
      const remainingCount = lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount;
      setPartialUseCount(Math.min(partialUseCount, remainingCount)); 
    }
  };

  // 団体人数を変更する関数
  const handleGroupSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(e.target.value, 10);
    if (!isNaN(size) && size > 0) {
      setGroupSize(size);
    }
  };

  // 部分受付の人数を変更する関数
  const handlePartialUseCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10);
    if (!isNaN(count) && count > 0 && lastVerifiedTicket) {
      // 最大値は残りの人数に制限
      const remainingCount = lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount;
      setPartialUseCount(Math.min(count, remainingCount));
    }
  };

  // セッション読み込み中にエラーが発生した場合
  if (sessionsError) {
    toast.error('セッション情報の取得に失敗しました');
  }

  // 部分受付モードが選択可能かどうか（団体チケットが部分的に使用済みの場合のみ）
  const isPartialModeAvailable = lastVerifiedTicket && 
    lastVerifiedTicket.isGroup && 
    lastVerifiedTicket.usedCount < lastVerifiedTicket.groupSize;

  // 残りの人数を計算（部分受付用）
  const remainingCount = lastVerifiedTicket && lastVerifiedTicket.isGroup ? 
    lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount : 0;

  // チケットタイプの選択肢を生成（状況に応じて「部分受付」を表示）
  const getTicketTypeOptions = () => {
    const options = [
      {
        id: 'individual',
        value: TicketType.INDIVIDUAL,
        label: '個人チケット（バラ）',
        disabled: lastVerifiedTicket?.isGroup || false,
        description: '個人チケットとして受付します。一人ずつ個別に受付する場合に選択してください。'
      },
      {
        id: 'group',
        value: TicketType.GROUP,
        label: '団体チケット（1枚）',
        disabled: lastVerifiedTicket ? (!lastVerifiedTicket.isGroup || lastVerifiedTicket.used) : false,
        description: '全員分をまとめて受付します。全員が一緒に来場する場合に選択してください。'
      }
    ];

    // 部分受付モードが利用可能な場合のみ表示
    if (isPartialModeAvailable) {
      options.push({
        id: 'partial',
        value: TicketType.PARTIAL,
        label: `団体チケット 部分受付`,
        disabled: false,
        description: `全${lastVerifiedTicket!.groupSize}名中${lastVerifiedTicket!.usedCount}名受付済。残り${remainingCount}名のうち何名か受付します。`
      });
    }

    return options;
  };

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

        {/* チケット確認・処理ダイアログ */}
        <Dialog open={!!(showConfirmation && lastVerifiedTicket)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>チケット使用確認</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mb-4">
              {/* チケット基本情報 */}
              <div className="space-y-2">
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
                
                {/* 団体チケットの場合は人数情報を表示 */}
                {lastVerifiedTicket?.isGroup && (
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <p className="font-medium text-blue-700">
                      発券済団体チケット: {lastVerifiedTicket.groupSize}名
                      {lastVerifiedTicket.usedCount > 0 && ` (${lastVerifiedTicket.usedCount}名使用済)`}
                    </p>
                  </div>
                )}
              </div>

              {/* チケット受付方法の選択 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">受付方法を選択してください</h3>
                
                <RadioGroup 
                  value={ticketType}
                  onValueChange={(value) => handleTicketTypeChange(value as TicketType)}
                  className="space-y-3"
                >
                  {getTicketTypeOptions().map(option => (
                    <div 
                      key={option.id} 
                      className={`flex items-start space-x-2 ${option.disabled ? 'opacity-50' : ''}`}
                    >
                      <RadioGroupItem 
                        value={option.value} 
                        id={option.id} 
                        disabled={option.disabled}
                      />
                      <div className="grid gap-1">
                        <Label htmlFor={option.id} className="font-medium">
                          {option.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                
                {/* 団体チケットの場合の人数入力 */}
                {ticketType === TicketType.GROUP && (
                  <div className="mt-4 flex items-center gap-2">
                    <Label htmlFor="groupSize">人数:</Label>
                    <Input
                      type="number"
                      id="groupSize"
                      value={groupSize}
                      onChange={handleGroupSizeChange}
                      min="2"
                      max={lastVerifiedTicket?.groupSize || 10}
                      className="w-20 border border-gray-300 rounded p-1"
                    />
                    <span>名</span>
                  </div>
                )}
                
                {/* 部分受付の場合の人数入力 */}
                {ticketType === TicketType.PARTIAL && isPartialModeAvailable && (
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="partialUseCount">今回の受付人数:</Label>
                      <Input
                        type="number"
                        id="partialUseCount"
                        value={partialUseCount}
                        onChange={handlePartialUseCountChange}
                        min="1"
                        max={remainingCount}
                        className="w-20 border border-gray-300 rounded p-1"
                      />
                      <span>名</span>
                    </div>
                    <div className="text-sm text-blue-600">
                      残り {remainingCount} 名まで受付可能
                    </div>
                  </div>
                )}
              </div>
              
              {/* 受付処理概要 */}
              <div className="mt-4 p-2 bg-green-50 rounded">
                {ticketType === TicketType.GROUP ? (
                  <p className="font-medium text-green-700">
                    団体チケット: {groupSize}名として受付します
                  </p>
                ) : ticketType === TicketType.PARTIAL ? (
                  <>
                    <p className="font-medium text-green-700">
                      部分受付: {partialUseCount}名として受付します
                    </p>
                    <p className="text-sm text-green-600">
                      (全{lastVerifiedTicket?.groupSize}名中、すでに{lastVerifiedTicket?.usedCount}名受付済、
                      残り{(lastVerifiedTicket?.groupSize || 0) - (lastVerifiedTicket?.usedCount || 0) - partialUseCount}名)
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-green-700">
                    個人チケット: 1名として受付します
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-2">
              <Button onClick={handleCancelUse} variant="outline">
                キャンセル
              </Button>
              <Button onClick={handleUseTicket} className="bg-green-600 hover:bg-green-700">
                受付する
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
                  {lastVerifiedTicket.fullyUsed 
                    ? '完全に使用済み' 
                    : lastVerifiedTicket.used 
                      ? '部分的に使用済み' 
                      : '未使用'}
                </span>
              </div>
              {lastVerifiedTicket.usedAt && (
                <div>
                  <span className="font-medium">最初の使用日時: </span>
                  {formatDate(lastVerifiedTicket.usedAt)}
                </div>
              )}
              {lastVerifiedTicket.lastUsedAt && lastVerifiedTicket.lastUsedAt !== lastVerifiedTicket.usedAt && (
                <div>
                  <span className="font-medium">最後の使用日時: </span>
                  {formatDate(lastVerifiedTicket.lastUsedAt)}
                </div>
              )}
              
              {/* 団体チケットの情報を表示 */}
              {lastVerifiedTicket.isGroup && (
                <div className="mt-2 p-2 bg-blue-50 rounded">
                  <p className="font-medium text-blue-700">団体チケット: 合計{lastVerifiedTicket.groupSize}名</p>
                  {lastVerifiedTicket.usedCount > 0 && (
                    <p className="mt-1 text-blue-600">
                      受付済: {lastVerifiedTicket.usedCount}名
                      {!lastVerifiedTicket.fullyUsed && ` (残り${lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount}名未受付)`}
                    </p>
                  )}
                </div>
              )}
              
              {/* 部分受付の可能性がある場合に表示 */}
              {lastVerifiedTicket.isGroup && lastVerifiedTicket.used && !lastVerifiedTicket.fullyUsed && (
                <div className="mt-4">
                  <Button 
                    onClick={() => {
                      setTicketType(TicketType.PARTIAL);
                      setPartialUseCount(lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount);
                      setCurrentQrCode(lastVerifiedTicket.qrCode);
                      setShowConfirmation(true);
                    }}
                    size="sm"
                  >
                    残り{lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount}名を受付
                  </Button>
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
