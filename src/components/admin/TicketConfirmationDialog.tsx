import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TicketStatusUpdateResponse } from '@/app/api/tickets/[qrCode]/route';

// チケットタイプの定義
enum TicketType {
  GROUP = 'group',
  INDIVIDUAL = 'individual',
  PARTIAL = 'partial' // 部分受付モード
}

interface TicketOption {
  id: string;
  value: TicketType;
  label: string;
  disabled: boolean;
  description: string;
}

interface TicketConfirmationDialogProps {
  showConfirmation: boolean;
  lastVerifiedTicket: TicketStatusUpdateResponse | null;
  ticketType: TicketType;
  groupSize: number;
  partialUseCount: number;
  remainingCount: number;
  isPartialModeAvailable: boolean | null; // null許容に変更
  ticketTypeOptions: TicketOption[];
  onTicketTypeChange: (type: TicketType) => void;
  onGroupSizeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPartialUseCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUseTicket: () => void;
  onCancelUse: () => void;
}

export function TicketConfirmationDialog({
  showConfirmation,
  lastVerifiedTicket,
  ticketType,
  groupSize,
  partialUseCount,
  remainingCount,
  isPartialModeAvailable,
  ticketTypeOptions,
  onTicketTypeChange,
  onGroupSizeChange,
  onPartialUseCountChange,
  onUseTicket,
  onCancelUse
}: TicketConfirmationDialogProps) {
  return (
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
              onValueChange={(value) => onTicketTypeChange(value as TicketType)}
              className="space-y-3"
            >
              {ticketTypeOptions.map(option => (
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
                  onChange={onGroupSizeChange}
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
                    onChange={onPartialUseCountChange}
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
          <Button onClick={onCancelUse} variant="outline">
            キャンセル
          </Button>
          <Button onClick={onUseTicket} className="bg-green-600 hover:bg-green-700">
            受付する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}