import { useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { EventSessionRequest } from '@/lib/types';
import { generateQRCode } from '@/lib/utils';
import useSWR, { mutate } from 'swr';
import { swrFetcher, putWithAuth } from '@/lib/fetcher';
import { EventResponse, EventSessionResponse } from '@/app/api/events/[id]/route';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StyledMarkdown } from '@/components/markdown';

const formatDateForInput = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toISOString().slice(0, 16);
};

export default function EventDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { data: event, error, isLoading } = useSWR<EventResponse>(
    id ? `/api/events/${id}` : null,
    swrFetcher
  );
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [sessions, setSessions] = useState<EventSessionRequest[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');


  // 初期データをフォームにセット
  if (event && !editing && formData.name === '') {
    setFormData({
      name: event.name,
      description: event.description,
    });
    setSessions(event.sessions.map((session: EventSessionResponse) => ({
      name: session.name,
      date: formatDateForInput(session.date),
      location: session.location,
      capacity: session.capacity
    })));
    setTags(event.tags.map((tag: { name: string }) => tag.name));
  }


  const formatDateForDisplay = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await putWithAuth(`/api/events/${id}`, {
        ...formData,
        sessions: sessions.map(session => ({
          ...session,
          capacity: parseInt(session.capacity.toString())
        })),
        tags
      });
      toast.success('イベント情報を更新しました');
      setEditing(false);
      mutate(`/api/events/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'イベント情報の更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!confirm('このイベントを削除してもよろしいですか？')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('イベントの削除に失敗しました');
      }
      toast.success('イベントを削除しました');
      router.push('/admin/events');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'イベントの削除に失敗しました');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSessionChange = (index: number, field: keyof EventSessionRequest, value: string) => {
    setSessions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addSession = () => {
    setSessions(prev => [
      ...prev,
      {
        name: `第${prev.length + 1}回`,
        date: '',
        location: '',
        capacity: 0
      }
    ]);
  };

  const removeSession = (index: number) => {
    setSessions(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = (e: React.MouseEvent) => {
    e.preventDefault();
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  if (isLoading) {
    return (
      <AdminLayout title="イベント詳細">
        <div className="flex justify-center items-center h-64">
          <p>読み込み中...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="エラー">
        <div className="text-center py-12">
          <p>エラーが発生しました: {error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!event) {
    return (
      <AdminLayout title="イベント詳細">
        <div className="text-center py-12">
          <p>イベントが見つかりませんでした</p>
        </div>
      </AdminLayout>
    );
  }

  const ViewTickets = ({ session }: { session: EventSessionResponse }) => {
    const [ticketsVisible, setTicketsVisible] = useState(false);
    const [qrVisible, setQrVisible] = useState<{ [key: string]: boolean }>({});
    const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});

    const toggleQR = async (ticketId: string, qrCode: string) => {
      if (!qrCodes[ticketId]) {
        try {
          const qrDataUrl = await generateQRCode(qrCode);
          setQrCodes(prev => ({ ...prev, [ticketId]: qrDataUrl }));
        } catch (error) {
          toast.error(`QRコードの生成に失敗しました: ${error instanceof Error ? error.message : 'エラーが発生しました'}`);
          return;
        }
      }
      setQrVisible(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
    };

    if (!ticketsVisible) {
      return (
        <Button
          variant="outline"
          onClick={() => setTicketsVisible(true)}
        >
          チケット一覧を表示
        </Button>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">チケット一覧</h4>
          <Button
            variant="outline"
            onClick={() => setTicketsVisible(false)}
          >
            閉じる
          </Button>
        </div>
        {session.tickets && session.tickets.length > 0 ? (
          <div className="space-y-4">
            {session.tickets.map(ticket => (
              <Card key={ticket.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{ticket.name}</p>
                    <p className="text-sm text-gray-500">{ticket.email}</p>
                    <p className="text-sm mt-1">
                      <span className={ticket.used ? "text-red-600" : "text-green-600"}>
                        {ticket.used ? '使用済み' : '未使用'}
                      </span>
                      {ticket.usedAt && ` (${formatDateForDisplay(ticket.usedAt)})`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleQR(ticket.id, ticket.qrCode)}
                  >
                    {qrVisible[ticket.id] ? 'QRコードを隠す' : 'QRコードを表示'}
                  </Button>
                </div>
                {qrVisible[ticket.id] && qrCodes[ticket.id] && (
                  <div className="mt-4 flex justify-center">
                    <img src={qrCodes[ticket.id]} alt="Ticket QR Code" className="w-48 h-48" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">チケットの発行はまだありません</p>
        )}
      </div>
    );
  };

  return (
    <AdminLayout title={"イベント詳細"}>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="mb-4">
            <p className="text-sm">主催: {event.organization.name}</p>
          </div>

          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">イベント名</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">イベント説明</Label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border rounded min-h-[100px]"
                />
                <p className="text-sm text-gray-500 mt-1">
                  マークダウン記法が使用できます。見出し(#)、リスト(*)、強調(**太字**)、リンク([リンク](URL))などが使えます。
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">開催回</h3>
                  <Button type="button" onClick={addSession} variant="outline">
                    開催回を追加
                  </Button>
                </div>

                {sessions.map((session, index) => (
                  <Card key={index} className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">開催回 {index + 1}</h4>
                      {sessions.length > 1 && (
                        <Button 
                          type="button"
                          onClick={() => removeSession(index)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </Button>
                      )}
                    </div>

                    <div>
                      <Label htmlFor={`session-name-${index}`}>回の名前</Label>
                      <Input
                        id={`session-name-${index}`}
                        value={session.name}
                        onChange={(e) => handleSessionChange(index, 'name', e.target.value)}
                        required
                        placeholder="第1回、昼の部など"
                      />
                    </div>

                    <div>
                      <Label htmlFor={`session-date-${index}`}>開催日時</Label>
                      <Input
                        id={`session-date-${index}`}
                        type="datetime-local"
                        value={session.date}
                        onChange={(e) => handleSessionChange(index, 'date', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor={`session-location-${index}`}>開催場所</Label>
                      <Input
                        id={`session-location-${index}`}
                        value={session.location}
                        onChange={(e) => handleSessionChange(index, 'location', e.target.value)}
                        required
                        placeholder="開催場所を入力"
                      />
                    </div>

                    <div>
                      <Label htmlFor={`session-capacity-${index}`}>定員</Label>
                      <Input
                        id={`session-capacity-${index}`}
                        type="number"
                        min="1"
                        value={session.capacity}
                        onChange={(e) => handleSessionChange(index, 'capacity', e.target.value)}
                        required
                        placeholder="定員を入力"
                      />
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Label>タグ</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-sm flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="新しいタグを入力..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(e as unknown as React.MouseEvent);
                      }
                    }}
                  />
                  <Button type="button" onClick={addTag} variant="outline">
                    追加
                  </Button>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={isLoading}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '保存中...' : '保存'}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{event.name}</h2>
                </div>
                <div className="flex space-x-4">
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    編集
                  </Button>
                  <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-800">
                    削除
                  </Button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">イベント説明</h3>
                <Card>
                  <CardContent>
                    <StyledMarkdown>{event.description}</StyledMarkdown>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 pt-6 border-t space-y-4">
                <h3 className="text-lg font-semibold">開催回一覧</h3>
                <div className="grid gap-4">
                  {event.sessions.map((session) => (
                    <Card key={session.id} className="p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium">{session.name}</h4>
                          <p className="text-sm text-gray-500">
                          {formatDateForDisplay(session.date)} @ {session.location}
                          </p>
                          <p className="text-sm text-gray-500">
                          申込数: {session.sold} / 残数: {session.capacity - session.sold} / 定員: {session.capacity}
                          </p>
                        </div>
                        <ViewTickets session={session} />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {event.tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">タグ</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="px-2 py-1 rounded-full text-sm"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}