import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { swrFetcher, fetchWithAuth, putWithAuth } from '@/lib/fetcher';
import { SessionStatsResponse, SessionStatsResponseItem } from '@/app/api/sessions/stats/route';
import { TicketStatusUpdateResponse } from '@/app/api/tickets/[qrCode]/route';
import { SessionTicketsResponse } from '@/app/api/sessions/[id]/tickets/route';
import { TicketType } from '@/lib/types';

// コンポーネントのインポート
import { SessionSelection } from '@/components/admin/SessionSelection';
import { SessionStatistics } from '@/components/admin/SessionStatistics';
import { QrScannerSection } from '@/components/admin/QrScannerSection';
import { TicketConfirmationDialog } from '@/components/admin/TicketConfirmationDialog';
import { LastVerifiedTicket } from '@/components/admin/LastVerifiedTicket';
import { TicketTable } from '@/components/admin/TicketTable';

// チケットリクエストデータの型
interface TicketUseRequest {
  used: boolean;
  isGroupTicket?: boolean;
  groupSize?: number;
  partialUse?: boolean;
  useCount?: number;
}

// 自動更新の間隔（ミリ秒）
const AUTO_REFRESH_INTERVAL = 10000; // 10秒

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

  // セッション情報を10秒ごとに自動更新するように設定
  const { data: sessionsData, error: sessionsError, isLoading: isLoadingSessions } = useSWR<SessionStatsResponse>(
    '/api/sessions/stats',
    swrFetcher,
    { refreshInterval: AUTO_REFRESH_INTERVAL }
  );

  // チケット一覧を10秒ごとに自動更新するように設定
  const { data: ticketsData, error: ticketsError, isLoading: isLoadingTickets } = useSWR<SessionTicketsResponse>(
    selectedSessionId ? `/api/sessions/${selectedSessionId}/tickets` : null,
    swrFetcher,
    { refreshInterval: AUTO_REFRESH_INTERVAL }
  );

  // 使いやすいように型変換
  const availableSessions: SessionStatsResponseItem[] = sessionsData || [];
  const selectedSession = selectedSessionId
    ? availableSessions.find(s => s.id === selectedSessionId)
    : null;

  // セッション選択処理
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsScanning(false);
  };

  // セッション統計データを更新
  const refreshSessionStats = useCallback(() => {
    mutate('/api/sessions/stats');
  }, []);

  // チケット一覧の更新関数
  const refreshTickets = useCallback(() => {
    if (selectedSessionId) {
      mutate(`/api/sessions/${selectedSessionId}/tickets`);
    }
  }, [selectedSessionId]);

  // チケットスキャン処理
  const handleScan = useCallback(async (qrCode: string) => {
    if (processingTicket || showConfirmation) return; // Prevent multiple scans while processing
    if (!selectedSession) {
      toast.error('セッションを選択してください');
      return;
    }

    try {
      setProcessingTicket(true);
      const json = JSON.parse(qrCode);

      // 認証付きフェッチャーを使用してチケット情報を取得
      const data = await fetchWithAuth(`/api/tickets/${encodeURIComponent(json.ticketId)}`) as TicketStatusUpdateResponse;
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
        setCurrentQrCode(json.ticketId);
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
        setCurrentQrCode(json.ticketId);
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
      const requestData: TicketUseRequest = { 
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

      // セッション統計とチケット一覧を更新
      refreshSessionStats();
      refreshTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'チケット使用の処理に失敗しました');
    } finally {
      // 確認ダイアログを閉じて処理中状態をリセット
      setShowConfirmation(false);
      setCurrentQrCode(null);
      setProcessingTicket(false);
    }
  }, [currentQrCode, refreshSessionStats, ticketType, groupSize, partialUseCount, refreshTickets]);

  const handleCancelUse = useCallback(() => {
    // 確認ダイアログを閉じる（チケットを使用せず）
    setShowConfirmation(false);
    setCurrentQrCode(null);
    setProcessingTicket(false);
    toast.info('チケットの使用をキャンセルしました', { duration: 3000 });
  }, []);

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

  // 部分受付継続処理
  const handleContinuePartialUse = () => {
    if (!lastVerifiedTicket) return;
    
    setTicketType(TicketType.PARTIAL);
    setPartialUseCount(lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount);
    setCurrentQrCode(lastVerifiedTicket.qrCode);
    setShowConfirmation(true);
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
        {/* セッション選択 */}
        <SessionSelection
          sessions={availableSessions}
          selectedSessionId={selectedSessionId}
          onSelect={handleSessionSelect}
        />

        {/* セッション統計 */}
        {selectedSession && (
          <SessionStatistics session={selectedSession} />
        )}

        {/* QRスキャナー */}
        <QrScannerSection 
          isScanning={isScanning}
          setIsScanning={setIsScanning}
          selectedSession={selectedSession}
          showConfirmation={showConfirmation}
          onScan={handleScan}
        />

        {/* チケット確認・処理ダイアログ */}
        <TicketConfirmationDialog 
          showConfirmation={showConfirmation}
          lastVerifiedTicket={lastVerifiedTicket}
          ticketType={ticketType}
          groupSize={groupSize}
          partialUseCount={partialUseCount}
          remainingCount={remainingCount}
          isPartialModeAvailable={isPartialModeAvailable}
          ticketTypeOptions={getTicketTypeOptions()}
          onTicketTypeChange={handleTicketTypeChange}
          onGroupSizeChange={handleGroupSizeChange}
          onPartialUseCountChange={handlePartialUseCountChange}
          onUseTicket={handleUseTicket}
          onCancelUse={handleCancelUse}
        />

        {/* 最後に確認したチケット情報 */}
        {lastVerifiedTicket && !showConfirmation && (
          <LastVerifiedTicket 
            lastVerifiedTicket={lastVerifiedTicket} 
            onContinuePartialUse={handleContinuePartialUse} 
          />
        )}

        {/* チケット一覧 */}
        {selectedSession && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">チケット一覧</h2>
            <TicketTable
              tickets={ticketsData?.tickets || []}
              isLoading={isLoadingTickets}
              error={ticketsError}
              selectedSession={selectedSession}
              refreshTickets={refreshTickets}
            />
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
