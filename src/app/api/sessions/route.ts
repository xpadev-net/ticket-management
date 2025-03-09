import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization } from '@/lib/auth';
import { createApiResponse, createApiError } from '@/lib/schema';

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  try {
    // 認証チェック
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        createApiError('認証が必要です'),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json(
        createApiError('認証が必要です'),
        { status: 401 }
      );
    }

    // 組織IDのクエリパラメータを取得
    const searchParams = req.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        createApiError('組織IDが必要です'),
        { status: 400 }
      );
    }

    // 組織に対する権限チェック
    const role = await getUserRoleInOrganization(user.id, organizationId);
    if (!role) {
      return NextResponse.json(
        createApiError('この組織の統計情報を閲覧する権限がありません'),
        { status: 403 }
      );
    }

    // 組織の全セッションを取得
    const sessions = await prisma.eventSession.findMany({
      where: {
        event: {
          organizationId
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true
          }
        },
        tickets: {
          select: {
            id: true,
            used: true,
          }
        }
      }
    });

    // 統計情報の集計
    const stats = sessions.map(session => ({
      id: session.id,
      name: session.name,
      eventId: session.eventId,
      eventName: session.event.name,
      date: session.date,
      location: session.location,
      capacity: session.capacity,
      totalTickets: session.tickets.length,
      usedTickets: session.tickets.filter(ticket => ticket.used).length,
      remainingCapacity: session.capacity - session.tickets.length,
      utilizationRate: session.tickets.length > 0
        ? (session.tickets.filter(ticket => ticket.used).length / session.tickets.length) * 100
        : 0
    }));

    return NextResponse.json(createApiResponse({ stats }));
  } catch (error) {
    console.error('Error fetching session stats:', error);
    return NextResponse.json(
      createApiError('セッション統計情報の取得に失敗しました'),
      { status: 500 }
    );
  }
}