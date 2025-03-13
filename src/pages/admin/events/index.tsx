import AdminLayout from '@/components/admin/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';
import { OrganizationResponse, OrganizationResponseItem } from '@/app/api/organizations/route';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Markdown } from '@/components/markdown';
import { EventCard } from '@/components/event-card';

export default function EventList() {
  const { data: organizationsData, error, isLoading } = useSWR<OrganizationResponse>(
    '/api/organizations',
    swrFetcher
  );

  const renderEventList = (org: OrganizationResponseItem) => (
    <div key={org.id} className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{org.name}のイベント</h2>
        <Link href={`/admin/events/new?organizationId=${org.id}`}>
          <Button>新規イベント作成</Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {org.events.map((event) => (
          <EventCard key={event.id} event={event} link={`/admin/events/${event.id}`} />
        ))}
        {org.events.length === 0 && (
          <div className="col-span-full text-center py-8 rounded-lg">
            <p className="">イベントがありません</p>
          </div>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout title="イベント管理">
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

  if (!organizationsData) {
    return (
      <AdminLayout title="イベント管理">
        <div className="text-center py-12">
          <p>データが見つかりませんでした</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="イベント管理">
      {organizationsData.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-4">
            まだ所属している組織がありません
          </h3>
          <Link href="/admin/organizations/new">
            <Button>組織を作成する</Button>
          </Link>
        </div>
      ) : (
        <div>
          {organizationsData.map(renderEventList)}
        </div>
      )}
    </AdminLayout>
  );
}
