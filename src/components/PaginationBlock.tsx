import React from 'react';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';

interface PaginationBlockProps {
  current: number;
  total: number;
  link: (page: number) => string;
}

export function PaginationBlock({ current, total, link }: PaginationBlockProps) {
  // ページネーションに表示するページ番号を計算
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
            <PaginationPrevious href={link(current - 1)} />
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
            
            {current !== 1 && current !== total && (
              <PaginationItem>
                <PaginationLink href={link(current)} isActive={true}>
                  {current}
                </PaginationLink>
              </PaginationItem>
            )}
            
            {current < total - 1 && (
              <PaginationItem>
                <PaginationLink href={link(current + 1)}>{current + 1}</PaginationLink>
              </PaginationItem>
            )}
            
            {current < total - 2 && <PaginationEllipsis />}
            
            {current !== total && (
              <PaginationItem>
                <PaginationLink href={link(total)} isActive={current === total}>
                  {total}
                </PaginationLink>
              </PaginationItem>
            )}
          </>
        )}
        
        {current < total && (
          <PaginationItem>
            <PaginationNext href={link(current + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}