import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse, createApiError } from '@/lib/schema';

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        createApiError('メールアドレスが必要です'),
        { status: 400 }
      );
    }

    // メールアドレスに紐づくチケット一覧を取得
    const tickets = await prisma.ticket.findMany({
      where: {
        email: email
      },
      include: {
        session: {
          include: {
            event: {
              include: {
                organization: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(createApiResponse({ tickets }));
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      createApiError('チケット一覧の取得に失敗しました'),
      { status: 500 }
    );
  }
}