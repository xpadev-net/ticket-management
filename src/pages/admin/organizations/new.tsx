import { useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function NewOrganization() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '組織の作成に失敗しました');
      }

      toast.success('組織を作成しました');
      router.push(`/admin/organizations/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '組織の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <AdminLayout title="組織の新規作成">
    <Card className="max-w-2xl mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="name">組織名</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="組織名を入力"
          />
        </div>

        <div>
          <Label htmlFor="description">説明</Label>
          <Input
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="組織の説明を入力（任意）"
          />
        </div>

        <div>
          <Label htmlFor="logoUrl">ロゴURL</Label>
          <Input
            id="logoUrl"
            name="logoUrl"
            type="url"
            value={formData.logoUrl}
            onChange={handleChange}
            placeholder="ロゴのURLを入力（任意）"
          />
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