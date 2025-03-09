import { useRouter } from 'next/router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TicketComplete() {
  const router = useRouter();
  const { eventName, sessionName, quantity } = router.query;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-lg mx-auto p-6 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">チケット申込完了</h1>
          <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-4">
            <p className="text-lg">チケットの申込が完了しました！</p>
          </div>
          
          <div className="text-left space-y-2 mb-6">
            <p><span className="font-semibold">イベント:</span> {eventName}</p>
            <p><span className="font-semibold">セッション:</span> {sessionName}</p>
            <p><span className="font-semibold">申込人数:</span> {quantity}名</p>
          </div>

          <p className="text-gray-600 mb-4">
            ご登録いただいたメールアドレスにチケット情報をお送りしましたので、ご確認ください。
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <Link href="/events" passHref>
            <Button variant="outline">イベント一覧に戻る</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}