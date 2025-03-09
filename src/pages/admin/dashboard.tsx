import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/fetcher';
import { OrganizationResponse, OrganizationResponseItem } from '@/app/api/organizations/route';

export default function Dashboard() {
  const { data, error } = useSWR<OrganizationResponse>('/api/organizations', fetchWithAuth);

  const loading = !data && !error;

  const renderOrganizationCard = (organization: OrganizationResponseItem) => (
    <Card key={organization.id} className="p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold mb-2">{organization.name}</h3>
          <p className="text-sm text-gray-500">
            イベント数: {organization.events.length}件
          </p>
        </div>
        <Link
          href={`/admin/organizations/${organization.id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          詳細を見る
        </Link>
      </div>
      {organization.events.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">最近のイベント</h4>
          <div className="space-y-2">
            {organization.events.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="flex justify-between items-center p-2 bg-gray-50 rounded"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                </div>
                <Link
                  href={`/admin/events/${event.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  詳細
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  if (loading || !data) {
    return (
      <AdminLayout title="ダッシュボード">
        <div className="flex justify-center items-center h-64">
          <p>読み込み中...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    toast.error(error.message);
  }

  return (
    <AdminLayout title="ダッシュボード">
      {data.length === 0 && data.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-4">
            まだ所属している組織がありません
          </h3>
          <Link
            href="/admin/organizations/new"
            className="text-blue-600 hover:text-blue-800"
          >
            組織を作成する
          </Link>
        </div>
      ) : (
        <div>
          {data.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">所属している組織</h2>
              {data.map(renderOrganizationCard)}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}