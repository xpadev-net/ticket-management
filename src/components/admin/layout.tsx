import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/fetcher';
import { User } from '@/lib/types';
import { ModeToggle } from '../theme-selecter';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const router = useRouter();
  const {data: user, isLoading} = useSWR<User>('/api/users/me', fetchWithAuth);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/admin/login');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <nav className="shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/admin/dashboard" className="text-xl font-bold">
                  チケット管理システム
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <LinkItem href="/admin/dashboard">ダッシュボード</LinkItem>
                <LinkItem href="/admin/organizations">組織管理</LinkItem>
                <LinkItem href="/admin/events">イベント管理</LinkItem>
                <LinkItem href="/admin/tickets">チケット受付</LinkItem>
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
              <div className="mr-4">
                <span className="text-sm">{user?.name}</span>
              </div>
              <ModeToggle />
              <Button variant="outline" onClick={handleLogout}>ログアウト</Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {children}
        </div>
      </div>
    </div>
  );
}

const LinkItem = ({ href, children }: {href: string, children?: ReactNode}) => {
  const router = useRouter();
  return (
    <Link href={href}
      className={`${
        router.pathname.startsWith(href)
        ? 'border-indigo-500'
        : 'border-transparent hover:border-gray-300'
      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
      {children}
    </Link>
  )
}
