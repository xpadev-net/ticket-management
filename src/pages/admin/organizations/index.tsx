import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';
import { OrganizationResponse } from '@/app/api/organizations/route';

export default function OrganizationList() {
  const { data: organizations, error, isLoading } = useSWR<OrganizationResponse>(
    '/api/organizations',
    swrFetcher
  );

  const renderOrganizationList = (orgs: OrganizationResponse, title: string, isOwned: boolean) => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {isOwned && (
          <Link href="/admin/organizations/new">
            <Button>新規作成</Button>
          </Link>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orgs.map((org) => (
          <Card key={org.id} className="p-6">
            <div className="flex flex-col h-full">
              <div>
                <h3 className="text-lg font-semibold mb-2">{org.name}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {org.description || '説明なし'}
                </p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-4 border-t">
                <div className="text-sm text-gray-500">
                  <p>メンバー: {org.members.length}名</p>
                  <p>イベント: {org.events.length}件</p>
                </div>
                <Link
                  href={`/admin/organizations/${org.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  詳細を見る
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout title="組織管理">
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

  if (!organizations) {
    return (
      <AdminLayout title="組織管理">
        <div className="text-center py-12">
          <p>データが見つかりませんでした</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="組織管理">
      {organizations.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-4">
            まだ所属している組織がありません
          </h3>
          <Link href="/admin/organizations/new">
            <Button>組織を作成する</Button>
          </Link>
        </div>
      ) : (
        <>
          {organizations.length > 0 &&
            renderOrganizationList(organizations, '所属している組織', true)}
        </>
      )}
    </AdminLayout>
  );
}