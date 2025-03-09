import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Event, EventSession } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';

interface EventTag {
  id: string;
  name: string;
}

interface EventWithDetails extends Event {
  tags: EventTag[];
  sessions: EventSession[];
}

interface SearchResponse {
  events: EventWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function EventList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // URLクエリパラメータからの初期値設定
  useEffect(() => {
    const { query, tags, page } = router.query;
    if (query) setSearchQuery(query as string);
    if (tags) setSelectedTags(Array.isArray(tags) ? tags : [tags as string]);
    if (page) setCurrentPage(Number(page));
  }, [router.query]);

  // SWRを使用してイベント情報を取得
  const queryParams = new URLSearchParams();
  if (router.query.query) queryParams.append('query', router.query.query as string);
  if (router.query.tags) {
    const tags = Array.isArray(router.query.tags) ? router.query.tags : [router.query.tags as string];
    tags.forEach(tag => queryParams.append('tags', tag));
  }
  queryParams.append('page', (router.query.page || '1').toString());

  const { data, error, isLoading } = useSWR<SearchResponse>(
    `/api/events?${queryParams.toString()}`,
    swrFetcher
  );

  // 一意のタグ一覧を取得
  useEffect(() => {
    if (data?.events) {
      const uniqueTags = new Set<string>();
      data.events.forEach(event => {
        event.tags.forEach(tag => {
          uniqueTags.add(tag.name);
        });
      });
      setAllTags(Array.from(uniqueTags));
    }
  }, [data?.events]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push({
      pathname: router.pathname,
      query: {
        ...(searchQuery && { query: searchQuery }),
        ...(selectedTags.length > 0 && { tags: selectedTags }),
        page: 1
      }
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
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

  if (!data) {
    return <div className="container mx-auto p-4">データが見つかりませんでした</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="イベントを検索..."
              className="flex-1"
            />
            <Button type="submit">検索</Button>
          </div>
          
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  type="button"
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
      <h1 className="text-2xl font-bold mb-6">開催予定のイベント</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.events.map((event) => (
          <Card key={event.id} className="p-6">
            <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
            <p className="text-gray-600 mb-4">{event.description}</p>
            
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {event.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="font-semibold">開催予定セッション:</h3>
              <ul className="list-disc list-inside space-y-1">
                {event.sessions.map((session) => (
                  <li key={session.id} className="text-sm">
                    {new Date(session.date).toLocaleString('ja-JP')} @ {session.location}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <Link 
                href={`/events/${event.id}`}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                詳細・申し込み
              </Link>
            </div>
          </Card>
        ))}
      </div>
      
      {data.events.length === 0 && (
        <p className="text-center text-gray-600">
          条件に一致するイベントが見つかりませんでした。
        </p>
      )}
      {data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === data.pagination.page ? "default" : "outline"}
              onClick={() => {
                router.push({
                  pathname: router.pathname,
                  query: {
                    ...(searchQuery && { query: searchQuery }),
                    ...(selectedTags.length > 0 && { tags: selectedTags }),
                    page
                  }
                });
              }}
            >
              {page}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}