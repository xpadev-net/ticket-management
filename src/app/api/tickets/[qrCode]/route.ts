import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization } from '@/lib/auth';
import { createApiResponse, createApiError, qrCodeSchema, ticketStatusUpdateSchema, ApiResponse } from '@/lib/schema';
import { z } from 'zod';

export type TicketResponse = {
  id: string;
  qrCode: string;
  name: string;
  used: boolean;
  usedAt: string | null;
  session: {
    id: string;
    name: string;
    date: string;
    location: string;
    event: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
      }
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { qrCode: string } }
): Promise<NextResponse<ApiResponse<TicketResponse>>> {
  try {
    const validationResult = qrCodeSchema.safeParse({ qrCode: params.qrCode });
    if (!validationResult.success) {
      return NextResponse.json(
        createApiError('チケットコードが無効です'),
        { status: 400 }
      );
    }

    const { qrCode } = validationResult.data;

    // Check if this is an authenticated admin request or public access
    const authHeader = req.headers.get('authorization');
    let isAdminRequest = false;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = await getUserFromToken(token);
      isAdminRequest = !!user;
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { qrCode },
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
        }
      });

      if (!ticket) {
        return NextResponse.json(
          createApiError('チケットが見つかりません'),
          { status: 404 }
        );
      }

      return NextResponse.json(createApiResponse({
        id: ticket.id,
        qrCode: ticket.qrCode,
        name: ticket.name,
        used: ticket.used,
        usedAt: ticket.usedAt?.toISOString() || null,
        session: {
          id: ticket.session.id,
          name: ticket.session.name,
          date: ticket.session.date.toISOString(),
          location: ticket.session.location,
          event: {
            id: ticket.session.event.id,
            name: ticket.session.event.name,
            organization: {
              id: ticket.session.event.organization.id,
              name: ticket.session.event.organization.name
            }
          }
        }
      }));
    } catch (error) {
      console.error('Error fetching ticket:', error);
      return NextResponse.json(
        createApiError('チケット情報の取得に失敗しました'),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      createApiError('エラーが発生しました'),
      { status: 500 }
    );
  }
}

export type TicketStatusUpdateResponse = {
  id: string;
  qrCode: string;
  used: boolean;
  usedAt: string | null;
  name: string;
  email: string;
  session: {
    id: string;
    name: string,
    date: string;
    location: string;
    event: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
      }
    }
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { qrCode: string } }
): Promise<NextResponse<ApiResponse<TicketStatusUpdateResponse>>> {
  try {
    // QRコードの検証
    const validatedParams = qrCodeSchema.safeParse({ qrCode: params.qrCode });
    if (!validatedParams.success) {
      return NextResponse.json(
        createApiError('チケットコードが無効です'),
        { status: 400 }
      );
    }

    const { qrCode } = validatedParams.data;

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
        createApiError('無効なトークンです'),
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = ticketStatusUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { used } = validationResult.data;

    // チケットの検索と関連データの取得
    const ticket = await prisma.ticket.findUnique({
      where: { qrCode },
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
      }
    });

    if (!ticket) {
      return NextResponse.json(
        createApiError('チケットが見つかりません'),
        { status: 404 }
      );
    }

    // 組織に対する権限チェック
    const role = await getUserRoleInOrganization(user.id, ticket.session.event.organizationId);
    if (!role) {
      return NextResponse.json(
        createApiError('このチケットを更新する権限がありません'),
        { status: 403 }
      );
    }

    // チケットが既に使用済みかチェック
    if (ticket.used && used) {
      return NextResponse.json(
        createApiError('このチケットは既に使用済みです'),
        { status: 400 }
      );
    }

    // チケットの更新
    const updatedTicket = await prisma.ticket.update({
      where: { qrCode },
      data: {
        used,
        usedAt: used ? new Date() : null
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
      }
    });

    return NextResponse.json(createApiResponse({
      id: updatedTicket.id,
      qrCode: updatedTicket.qrCode,
      used: updatedTicket.used,
      usedAt: updatedTicket.usedAt?.toISOString() || null,
      name: updatedTicket.name,
      email: updatedTicket.email,
      session: {
        id: updatedTicket.session.id,
        name: updatedTicket.session.name,
        date: updatedTicket.session.date.toISOString(),
        location: updatedTicket.session.location,
        event: {
          id: updatedTicket.session.event.id,
          name: updatedTicket.session.event.name,
          organization: {
            id: updatedTicket.session.event.organization.id,
            name: updatedTicket.session.event.organization.name
          }
        }
      }
    }));
  } catch (error) {
    console.error('Error updating ticket:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('チケットの更新に失敗しました'),
      { status: 500 }
    );
  }
}