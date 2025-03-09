import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateQRCode } from '@/lib/utils';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';

interface Ticket {
  id: string;
  qrCode: string;
  name: string;
  email: string;
  used: boolean;
  usedAt: Date | null;
  session: {
    name: string;
    date: string;
    location: string;
    event: {
      name: string;
    };
  };
}

export default function TicketView() {
  const router = useRouter();
  const { qrCode } = router.query;
  const { data: ticket, error, isLoading } = useSWR<Ticket>(
    qrCode ? `/api/tickets/${qrCode}` : null,
    swrFetcher
  );
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // チケットデータが取得できたらQRコードを生成
  useEffect(() => {
    if (ticket?.ticket.qrCode) {
      generateQrCode();
    }
  }, [ticket]);

  const generateQrCode = async () => {
    if (!ticket?.ticket) return;
    try {
      const qrDataUrl = await generateQRCode(ticket.ticket.qrCode);
      setQrCodeImage(qrDataUrl);
    } catch (error) {
      toast.error('QRコードの生成に失敗しました');
    }
  };

  const handlePrint = () => {
    window.print();
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

  if (!ticket?.ticket) {
    return <div className="container mx-auto p-4">チケットが見つかりません</div>;
  }

  const ticketData = ticket.ticket;

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto p-6" ref={printRef}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{ticketData.session.event.name}</h1>
          <p className="text-gray-600 mt-2">{ticketData.session.name}</p>
        </div>
        <div className="space-y-4 mb-6">
          <div>
            <p className="font-semibold">開催日時:</p>
            <p>{new Date(ticketData.session.date).toLocaleString('ja-JP')}</p>
          </div>
          <div>
            <p className="font-semibold">開催場所:</p>
            <p>{ticketData.session.location}</p>
          </div>
          <div>
            <p className="font-semibold">参加者名:</p>
            <p>{ticketData.name}</p>
          </div>
          <div>
            <p className="font-semibold">ステータス:</p>
            <p className={ticketData.used ? "text-red-600" : "text-green-600"}>
              {ticketData.used ? '使用済み' : '未使用'}
              {ticketData.usedAt && ` (${new Date(ticketData.usedAt).toLocaleString('ja-JP')})`}
            </p>
          </div>
        </div>
        {qrCodeImage && (
          <div className="flex flex-col items-center space-y-4">
            <img src={qrCodeImage} alt="Ticket QR Code" className="w-64 h-64" />
            <p className="text-sm text-gray-500">チケットコード: {ticketData.qrCode}</p>
          </div>
        )}
        <div className="mt-6 flex justify-center print:hidden">
          <Button onClick={handlePrint}>
            印刷する
          </Button>
        </div>
      </Card>
    </div>
  );
}