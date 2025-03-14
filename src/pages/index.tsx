import { useState, useEffect } from 'react';
import { Event, EventSession } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/fetcher';
import { Layout } from '@/components/layout/Layout';
import { SearchBar } from '@/components/SearchBar';
import { EventGrid } from '@/components/EventGrid';
import { PaginationBlock } from '@/components/PaginationBlock';

// 型定義
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
  if (router.query.query) queryParams.append('query', searchQuery);
  queryParams.append('page', currentPage.toString());
  
  const { data, error, isLoading } = useSWR<SearchResponse>(
    `/api/events?${queryParams.toString()}`,
    swrFetcher
  );

  // 検索処理
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

  // ページネーションリンク生成
  const createPageLink = (page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page.toString());
    return url.toString();
  };

  // ローディング表示
  if (isLoading) {
    return <Layout><div className="container mx-auto p-4">読み込み中...</div></Layout>;
  }

  // エラー表示
  if (error) {
    return (
      <Layout>
        <div className="container mx-auto p-4">
          エラーが発生しました: {error.message}
        </div>
      </Layout>
    );
  }

  // データが見つからない場合
  if (!data) {
    return <Layout><div className="container mx-auto p-4">データが見つかりませんでした</div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto p-4">
        {/* 検索バー */}
        <SearchBar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearch={handleSearch}
        />

        <h1 className="text-2xl font-bold mb-6">開催予定のイベント</h1>
        
        {/* イベントグリッド */}
        <EventGrid events={data.events} />
        
        {/* ページネーション */}
        {data.pagination.totalPages > 1 && (
          <div className="mt-6">
            <PaginationBlock 
              current={data.pagination.page} 
              total={data.pagination.totalPages} 
              link={createPageLink}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
