import { Geist, Geist_Mono } from "next/font/google";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicEventsResponse } from "@/app/api/public/events/route";
import useSWR from "swr";
import { swrFetcher } from "@/lib/fetcher";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Markdown } from "@/components/markdown";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const { data: events, error, isLoading } = useSWR<PublicEventsResponse>('/api/public/events', swrFetcher);

  if (isLoading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4">Error loading events: {error.message}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">イベントチケット</h1>
            <Link href="/admin/login">
              <Button variant="outline">管理者ログイン</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* ヒーローセクション */}
          <div className="text-center py-12">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              イベントを探す
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              開催予定のイベントチケットを購入できます
            </p>
          </div>

          {/* イベント一覧 */}
          <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">イベント一覧</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events?.events.map((event) => (
                <Card key={event.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription>
                      {new Date(event.startAt).toLocaleDateString()} - {new Date(event.endAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Markdown>{event.description}</Markdown>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {event.tags.map(({id, name}) => (
                        <span key={id} className="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm">
                          {name}
                        </span>
                      ))}
                    </div>
                    <Link href={`/events/${event.id}`}>
                      <Button className="w-full">詳細を見る</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            © 2024 イベントチケットシステム
          </p>
        </div>
      </footer>
    </div>
  );
}
