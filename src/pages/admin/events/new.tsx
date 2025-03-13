import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Organization, EventSessionRequest } from '@/lib/types';
import useSWR from 'swr';
import { OrganizationResponse } from '@/app/api/organizations/route';
import { fetchWithAuth, postWithAuth } from '@/lib/fetcher';
import { EventCreateResponse } from '@/app/api/events/route';

export default function NewEvent() {
  const router = useRouter();
  const { organizationId } = router.query;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organizationId: organizationId || ''
  });
  const [sessions, setSessions] = useState<EventSessionRequest[]>([{
    name: '第1回',
    date: '',
    location: '',
    capacity: 0
  }]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const { data: organizations, error } = useSWR<OrganizationResponse>('/api/organizations', fetchWithAuth);

  useEffect(() => {
    if (organizationId) {
      setFormData(prev => ({ ...prev, organizationId: organizationId as string }));
    }
  }, [organizationId]);

  if (error || !organizations) {
    return <div>エラーが発生しました</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await postWithAuth<EventCreateResponse>('/api/events', {
        ...formData,
        sessions: sessions.map(session => ({
          ...session,
          capacity: parseInt(session.capacity.toString())
        })),
        tags
      });

      toast.success('イベントを作成しました');
      router.push(`/admin/events/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'イベントの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  return (
    <AdminLayout title="イベントの新規作成">
      <Card className="max-w-2xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="organizationId">主催組織</Label>
            <select
              id="organizationId"
              name="organizationId"
              value={formData.organizationId}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            >
              <option value="">組織を選択</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="name">イベント名</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="イベント名を入力"
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
              placeholder="イベントの説明を入力"
              className="w-full p-2 border rounded min-h-[100px]"
            />
            <p className="text-sm text-gray-500 mt-1">
              マークダウン記法が使用できます。見出し(#)、リスト(*)、強調(**太字**)、リンク([リンク](URL))などが使えます。
            </p>
          </div>

          <div className="space-y-2">
            <Label>タグ</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="text-gray-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
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

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '作成中...' : '作成'}
            </Button>
          </div>
        </form>
      </Card>
    </AdminLayout>
  );
}