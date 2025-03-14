import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { SessionTicketsResponse } from '@/app/api/sessions/[id]/tickets/route';
import { TicketStatusUpdateResponse } from '@/app/api/tickets/[qrCode]/route';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { putWithAuth } from '@/lib/fetcher';
import { SessionStatsResponseItem } from '@/app/api/sessions/stats/route';

// チケットリクエストデータの型
interface TicketUpdateRequest {
  used: boolean;
  manualUpdate: boolean;
  usedCount?: number;
  fullyUsed?: boolean;
}

// エラー情報の型
interface ErrorInfo {
  message: string;
  status?: number;
}

// TicketTable用に適した型定義を作成
interface TicketTableProps {
  tickets: SessionTicketsResponse['tickets'];
  isLoading: boolean;
  error: ErrorInfo | null;
  selectedSession: SessionStatsResponseItem;
  refreshTickets: () => void;
}

export function TicketTable({ tickets, isLoading, error, selectedSession, refreshTickets }: TicketTableProps) {
  const [editingTicket, setEditingTicket] = useState<TicketStatusUpdateResponse | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // チケット編集ダイアログを開く
  const openEditDialog = (ticket: SessionTicketsResponse['tickets'][0]) => {
    // セッション情報がないので、選択中のセッション情報を使用して補完する
    if (!selectedSession) return;
    
    // 不足しているプロパティを補完してTicketStatusUpdateResponseの形に合わせる
    const completeTicket: TicketStatusUpdateResponse = {
      ...ticket,
      qrCode: ticket.id, // IDをQRコードとして使用
      usedAt: ticket.used && ticket.lastUsedAt ? ticket.lastUsedAt.toISOString() : null, // Date型をstring型に変換
      lastUsedAt: ticket.lastUsedAt ? ticket.lastUsedAt.toISOString() : null, // Date型をstring型に変換
      session: {
        id: selectedSession.id,
        name: selectedSession.name,
        date: selectedSession.date,
        location: selectedSession.location,
        event: {
          id: selectedSession.event.id,
          name: selectedSession.event.name,
        }
      }
    };
    
    setEditingTicket(completeTicket);
    setShowEditDialog(true);
  };

  // チケット編集ダイアログを閉じる
  const closeEditDialog = () => {
    setEditingTicket(null);
    setShowEditDialog(false);
  };

  // チケット状態を更新する処理
  const updateTicketStatus = async (status: { used: boolean, usedCount: number, fullyUsed: boolean }) => {
    if (!editingTicket) return;

    try {
      // 認証付きPUTリクエストを使用
      const requestData: TicketUpdateRequest = {
        used: status.used,
        manualUpdate: true, // 手動更新フラグを追加
      };

      if (editingTicket.isGroup) {
        requestData.usedCount = status.usedCount;
        requestData.fullyUsed = status.fullyUsed;
      }

      const data = await putWithAuth(
        `/api/tickets/${encodeURIComponent(editingTicket.qrCode)}`, 
        requestData
      ) as TicketStatusUpdateResponse;

      toast.success(`チケット状態を更新しました: ${data.name}さん`);
      refreshTickets();
      closeEditDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'チケット状態の更新に失敗しました');
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }
  
  if (error) {
    return (
      <div className="text-center py-4 text-red-600">
        チケット情報の取得に失敗しました
      </div>
    );
  }
  
  if (!tickets?.length) {
    return (
      <div className="text-center py-4 text-gray-500">
        チケットがありません
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[200px]'>
                  氏名
                </TableHead>
                <TableHead className='w-[200px]'>
                  メールアドレス
                </TableHead>
                <TableHead className='w-[50px]'>
                  種別
                </TableHead>
                <TableHead className='w-[100px]'>
                  状態
                </TableHead>
                <TableHead className='w-[100px]'>
                  最終使用日時
                </TableHead>
                <TableHead className='w-[80px]'>
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow 
                  key={ticket.id}
                >
                  <TableCell>
                    {ticket.name}
                  </TableCell>
                  <TableCell>
                    {ticket.email}
                  </TableCell>
                  <TableCell>
                    {ticket.isGroup ? (
                      `団体 (${ticket.groupSize}名)`
                    ) : '個人'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <Badge className={`${
                      ticket.fullyUsed
                        ? 'bg-gray-100 text-gray-800'
                        : ticket.used
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {ticket.fullyUsed 
                        ? '完全使用済' 
                        : ticket.used 
                          ? `部分使用済 (${ticket.usedCount}/${ticket.groupSize}名)` 
                          : '未使用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ticket.lastUsedAt 
                      ? formatDate(ticket.lastUsedAt)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(ticket)}
                    >
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* チケット編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>チケット状態の編集</DialogTitle>
          </DialogHeader>
          {editingTicket && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <span className="font-medium">参加者名: </span>
                  {editingTicket.name}
                </div>
                <div>
                  <span className="font-medium">イベント: </span>
                  {editingTicket.session.event.name}
                </div>
                <div>
                  <span className="font-medium">回: </span>
                  {editingTicket.session.name}
                </div>
                
                {/* チケットタイプに応じた編集UI */}
                {editingTicket.isGroup ? (
                  <div className="mt-4 space-y-4">
                    <h3 className="font-medium">団体チケット情報</h3>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="usedCount">受付人数:</Label>
                      <Input 
                        type="number" 
                        id="usedCount" 
                        value={editingTicket.usedCount}
                        min={0}
                        max={editingTicket.groupSize}
                        onChange={(e) => {
                          const count = parseInt(e.target.value);
                          if (!isNaN(count) && count >= 0 && count <= editingTicket.groupSize) {
                            setEditingTicket({
                              ...editingTicket,
                              usedCount: count,
                              used: count > 0,
                              fullyUsed: count >= editingTicket.groupSize
                            });
                          }
                        }} 
                      />
                      <span>/ {editingTicket.groupSize}名</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="fullyUsed" 
                        checked={editingTicket.fullyUsed}
                        onChange={(e) => {
                          setEditingTicket({
                            ...editingTicket,
                            fullyUsed: e.target.checked,
                            usedCount: e.target.checked ? editingTicket.groupSize : editingTicket.usedCount
                          });
                        }}
                      />
                      <Label htmlFor="fullyUsed">完全に使用済みにする</Label>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-medium">個人チケット情報</h3>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="ticketUsed" 
                        checked={editingTicket.used}
                        onChange={(e) => {
                          setEditingTicket({
                            ...editingTicket,
                            used: e.target.checked,
                            usedCount: e.target.checked ? 1 : 0,
                            fullyUsed: e.target.checked
                          });
                        }}
                      />
                      <Label htmlFor="ticketUsed">使用済みにする</Label>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-4">
                  <Button onClick={closeEditDialog} variant="outline">
                    キャンセル
                  </Button>
                  <Button 
                    onClick={() => updateTicketStatus({
                      used: editingTicket.used,
                      usedCount: editingTicket.usedCount,
                      fullyUsed: editingTicket.fullyUsed
                    })}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    更新する
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}