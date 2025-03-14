import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (e: React.FormEvent) => void;
}

export function SearchBar({ searchQuery, setSearchQuery, handleSearch }: SearchBarProps) {
  return (
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
  );
}