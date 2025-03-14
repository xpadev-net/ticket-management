import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SessionStatsResponseItem } from '@/app/api/sessions/stats/route';

interface SessionStatisticsProps {
  session: SessionStatsResponseItem;
}

export function SessionStatistics({ session }: SessionStatisticsProps) {
  const calculateProgress = (checkedIn: number, total: number) => {
    if (total === 0) return 0;
    return (checkedIn / total) * 100;
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">受付状況</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>参加予定者数:</span>
          <span className="font-medium">{session.stats.total}人</span>
        </div>

        <div className="flex items-center justify-between">
          <span>受付済み:</span>
          <span className="font-medium text-green-600">{session.stats.checkedIn}人</span>
        </div>

        <div className="flex items-center justify-between">
          <span>未受付:</span>
          <span className="font-medium text-amber-600">{session.stats.remaining}人</span>
        </div>

        <div className="flex items-center justify-between">
          <span>残席数:</span>
          <span className="font-medium">{session.stats.capacityRemaining}席</span>
        </div>

        {/* Progress bar */}
        <Progress value={calculateProgress(session.stats.checkedIn, session.stats.total)} />
        
        <div className="text-xs text-center">
          {session.stats.checkedIn} / {session.stats.total}
          ({Math.round(calculateProgress(session.stats.checkedIn, session.stats.total))}%)
        </div>
      </div>
    </Card>
  );
}