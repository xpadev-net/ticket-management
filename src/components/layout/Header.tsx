import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold">イベントチケット</h1>
          </Link>
          <Link href="/admin/login">
            <Button variant="outline">管理者ログイン</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}