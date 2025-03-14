import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { TicketStatusUpdateResponse } from '@/app/api/tickets/[qrCode]/route';
import { TicketType } from '@/lib/types';

interface LastVerifiedTicketProps {
  lastVerifiedTicket: TicketStatusUpdateResponse;
  onContinuePartialUse: () => void;
}

export function LastVerifiedTicket({ lastVerifiedTicket, onContinuePartialUse }: LastVerifiedTicketProps) {
  return (
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
              onClick={onContinuePartialUse}
              size="sm"
            >
              残り{lastVerifiedTicket.groupSize - lastVerifiedTicket.usedCount}名を受付
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}