import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Event, EventSession } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Layout } from '@/components/layout/Layout';
import Markdown from 'react-markdown';

interface EventWithDetails extends Event {
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
  const [currentPage, setCurrentPage] = useState(1);

  // URLクエリパラメータからの初期値設定
  useEffect(() => {
    const { query, page } = router.query;
    if (query) setSearchQuery(query as string);
    if (page) setCurrentPage(Number(page));
  }, [router.query]);

  // SWRを使用してイベント情報を取得
  const queryParams = new URLSearchParams();
  if (router.query.query) queryParams.append('query', router.query.query as string);
  queryParams.append('page', (router.query.page || '1').toString());

  const { data, error, isLoading } = useSWR<SearchResponse>(
    `/api/events?${queryParams.toString()}`,
    swrFetcher
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push({
      pathname: router.pathname,
      query: {
        ...(searchQuery && { query: searchQuery }),
        page: 1
      }
    });
  };

  if (isLoading) {
    return <Layout><div className="container mx-auto p-4">読み込み中...</div></Layout>;
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto p-4">
          エラーが発生しました: {error.message}
        </div>
      </Layout>
    );
  }

  if (!data) {
    return <Layout><div className="container mx-auto p-4">データが見つかりませんでした</div></Layout>;
  }

  return (
    <Layout>
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
          </form>
        </div>
        <h1 className="text-2xl font-bold mb-6">開催予定のイベント</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.events.map((event) => (
            <Card key={event.id} className="p-6">
              <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
              <div className="text-sm mb-4 line-clamp-4 max-w-none">
                <Markdown>{event.description}</Markdown>
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
        <PaginationBlock current={data.pagination.page} total={data.pagination.totalPages} link={(v)=>{
          const url = new URL(window.location.href);
          url.searchParams.set('page', v.toString());
          return url.toString();
        }}/>
      </div>
    </Layout>
  );
}

const PaginationBlock = ({ current, total, link}: {
  current: number;
  total: number;
  link: (page: number) => string;
}) => {
  const targets = (()=>{
    if (total < 6) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current < 4) {
      return [1,2,3,4,total];
    }
    if (current > total - 3) {
      return [1,total-3,total-2,total-1,total];
    }
    return [1,current-1,current,current+1,total];
  })();
  return (
    <Pagination>
      <PaginationContent>
        {current > 1 && (
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
        )}
        {total < 6 ? (
          Array.from({ length: total }, (_, i) => i + 1).map((page) => (
            <PaginationItem key={page}>
              <PaginationLink href={link(page)} isActive={current === page}>
                {page}
              </PaginationLink>
            </PaginationItem>
          ))
        ) : (
          <>
            <PaginationItem>
              <PaginationLink href={link(1)} isActive={current === 1}>
                1
              </PaginationLink>
            </PaginationItem>
            {current > 3 && <PaginationEllipsis />}
            {current > 2 && (
              <PaginationItem>
                <PaginationLink href={link(current - 1)}>{current - 1}</PaginationLink>
              </PaginationItem>
              )}
            {current < total - 2 && <PaginationEllipsis />}
            {current < total - 1 && (
              <PaginationItem>
                <PaginationLink href={link(total)}>{total}</PaginationLink>
              </PaginationItem>
            )}
            {current < total && (
              <PaginationItem>  
                <PaginationLink href={link(current + 1)}>{current + 1}</PaginationLink>
              </PaginationItem>
            )}
          </>
        )}
        {total > 1 && current < total && (
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
