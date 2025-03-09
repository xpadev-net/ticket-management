import { useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MemberRole } from '@/lib/types';
import useSWR, { mutate } from 'swr';
import { swrFetcher, postWithAuth, putWithAuth } from '@/lib/fetcher';
import { OrganizationResponseItem } from '@/app/api/organizations/route';

export default function OrganizationDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { data: organization, error, isLoading } = useSWR<OrganizationResponseItem>(
    id ? `/api/organizations/${id}` : null,
    swrFetcher
  );
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: ''
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>(MemberRole.MEMBER);
  const [submitting, setSubmitting] = useState(false);

  // 初期データをフォームにセット
  if (organization && !editing && formData.name === '') {
    setFormData({
      name: organization.name,
      description: organization.description || '',
      logoUrl: organization.logoUrl || ''
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await putWithAuth(`/api/organizations/${id}`, formData);
      toast.success('組織情報を更新しました');
      setEditing(false);
      mutate(`/api/organizations/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '組織情報の更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await postWithAuth(`/api/organizations/${id}/members`, {
        email: inviteEmail,
        role: inviteRole
      });
      toast.success('メンバーを招待しました');
      setInviting(false);
      setInviteEmail('');
      mutate(`/api/organizations/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'メンバーの招待に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: MemberRole | 'OWNER') => {
    try {
      await putWithAuth(`/api/organizations/${id}/members/${userId}`, { role: newRole });
      toast.success('メンバーの役割を更新しました');
      mutate(`/api/organizations/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'メンバーの役割の更新に失敗しました');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('このメンバーを削除してもよろしいですか？')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/organizations/${id}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('メンバーの削除に失敗しました');
      }
      toast.success('メンバーを削除しました');
      mutate(`/api/organizations/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'メンバーの削除に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="組織詳細">
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

  if (!organization) {
    return (
      <AdminLayout title="組織詳細">
        <div className="text-center py-12">
          <p>組織が見つかりませんでした</p>
        </div>
      </AdminLayout>
    );
  }

  const canEdit = organization.role === 'OWNER' || organization.role === 'MANAGER';
  const canManageMembers = organization.role === 'OWNER' || organization.role === 'MANAGER';

  return (
    <AdminLayout title={organization.name}>
      <div className="space-y-6">
        <Card className="p-6">
          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">組織名</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">説明</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="logoUrl">ロゴURL</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                />
              </div>
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={submitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '保存中...' : '保存'}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{organization.name}</h2>
                  <p className="text-gray-500 mt-1">{organization.description || '説明なし'}</p>
                </div>
                {canEdit && (
                  <Button onClick={() => setEditing(true)}>編集</Button>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">所有者: {organization.owner.name}</p>
              </div>
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">メンバー管理</h3>
            {canManageMembers && (
              <Button onClick={() => setInviting(true)}>メンバーを招待</Button>
            )}
          </div>
          {inviting && (
            <form onSubmit={handleInvite} className="mb-6 p-4 rounded-lg">
              <div className="grid gap-4 mb-4">
                <div>
                  <Label htmlFor="inviteEmail">メールアドレス</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="招待するユーザーのメールアドレス"
                  />
                </div>
                <div>
                  <Label htmlFor="inviteRole">役割</Label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="w-full p-2 border rounded"
                  >
                    <option value={MemberRole.MEMBER}>一般メンバー</option>
                    {organization.role === 'OWNER' && (
                      <option value={MemberRole.MANAGER}>管理者</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviting(false)}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '招待中...' : '招待する'}
                </Button>
              </div>
            </form>
          )}
          <div className="space-y-4">
            {organization.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg"
              >
                <div>
                  <p className="font-medium">{member.user.name}</p>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
                <div className="flex items-center space-x-4">
                  {canManageMembers && (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user.id, e.target.value as MemberRole | 'OWNER')}
                        className="p-1 text-sm border rounded"
                        disabled={organization.role !== 'OWNER' && member.role === MemberRole.MANAGER}
                      >
                        <option value={MemberRole.MEMBER}>一般メンバー</option>
                        <option value={MemberRole.MANAGER}>管理者</option>
                        {organization.role === 'OWNER' && (
                          <option value="OWNER">所有者</option>
                        )}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user.id)}
                      >
                        削除
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}