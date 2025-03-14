import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import QrScanner from '@/components/admin/QrScanner';
import { SessionStatsResponseItem } from '@/app/api/sessions/stats/route';

interface QrScannerSectionProps {
  isScanning: boolean;
  setIsScanning: (value: boolean) => void;
  selectedSession: SessionStatsResponseItem | null | undefined; // nullとundefined両方を許容
  showConfirmation: boolean;
  onScan: (qrCode: string) => void;
}

export function QrScannerSection({
  isScanning,
  setIsScanning,
  selectedSession,
  showConfirmation,
  onScan
}: QrScannerSectionProps) {
  return (
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
        <QrScanner onScan={onScan} paused={showConfirmation} />
      ) : (
        <div className="text-center py-12 text-gray-500">
          スキャンを開始するにはボタンをクリックしてください
        </div>
      )}
    </Card>
  );
}