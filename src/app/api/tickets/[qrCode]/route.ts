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
  isGroup: boolean;
  groupSize: number;
  usedCount: number;
  fullyUsed: boolean;
  lastUsedAt: string | null;
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
  { params }: { params: Promise<{ qrCode: string }> }
): Promise<NextResponse<ApiResponse<TicketResponse>>> {
  try {
    const validationResult = qrCodeSchema.safeParse(await params);
    if (!validationResult.success) {
      return NextResponse.json(
        createApiError('チケットコードが無効です'),
        { status: 400 }
      );
    }

    const { qrCode } = validationResult.data;

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
        isGroup: ticket.isGroup,
        groupSize: ticket.groupSize,
        usedCount: ticket.usedCount,
        fullyUsed: ticket.fullyUsed,
        lastUsedAt: ticket.lastUsedAt?.toISOString() || null,
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
  isGroup: boolean;
  groupSize: number;
  usedCount: number;
  fullyUsed: boolean;
  lastUsedAt: string | null;
  session: {
    id: string;
    name: string,
    date: string;
    location: string;
    event: {
      id: string;
      name: string;
    }
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
): Promise<NextResponse<ApiResponse<TicketStatusUpdateResponse>>> {
  try {
    // QRコードの検証
    const validatedParams = qrCodeSchema.safeParse(await params);
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

    const { used, isGroupTicket, groupSize, partialUse, useCount, manualUpdate, usedCount, fullyUsed } = validationResult.data;

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

    // 手動更新の場合は特別な処理を行う
    if (manualUpdate) {
      // 更新データの準備
      const updateData: any = {
        used
      };

      // 団体チケットの場合は追加データを設定
      if (ticket.isGroup) {
        // 受付人数を直接設定
        updateData.usedCount = usedCount;
        updateData.fullyUsed = fullyUsed;
      } else {
        // 個人チケットの場合
        updateData.usedCount = used ? 1 : 0;
        updateData.fullyUsed = used;
      }

      // 使用状態が変わる場合、日時を更新
      if (!ticket.used && used) {
        updateData.usedAt = new Date(); // 初回使用日時を設定
      }

      // 最終使用日時を更新（状態が変わった場合のみ）
      if (ticket.used !== used || 
          (ticket.isGroup && ticket.usedCount !== usedCount)) {
        updateData.lastUsedAt = new Date();
      }

      // チケットの更新
      const updatedTicket = await prisma.ticket.update({
        where: { qrCode },
        data: updateData,
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
        isGroup: updatedTicket.isGroup,
        groupSize: updatedTicket.groupSize,
        usedCount: updatedTicket.usedCount,
        fullyUsed: updatedTicket.fullyUsed,
        lastUsedAt: updatedTicket.lastUsedAt?.toISOString() || null,
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
    }

    // 通常のQRスキャン処理（既存のロジック）
    // 個人チケットを団体として受付しようとした場合はエラー
    if (!ticket.isGroup && isGroupTicket) {
      return NextResponse.json(
        createApiError('個人チケットは団体として受付できません。個人チケットで処理してください。'),
        { status: 400 }
      );
    }

    // チケットが完全に使用済みの場合はエラー
    if (ticket.fullyUsed) {
      return NextResponse.json(
        createApiError('このチケットは既に全員分使用済みです'),
        { status: 400 }
      );
    }

    // 更新データの準備
    const now = new Date();
    const updateData: any = {
      lastUsedAt: now
    };
    
    // 初回使用の場合はusedAtを設定
    if (!ticket.used) {
      updateData.usedAt = now;
      updateData.used = true;
    }

    // 団体チケットの処理
    if (ticket.isGroup) {
      // 部分受付（団体チケットの場合）
      if (partialUse && useCount) {
        // 使用人数のチェック
        const remainingCount = ticket.groupSize - ticket.usedCount;
        if (useCount > remainingCount) {
          return NextResponse.json(
            createApiError(`受付人数が残りの人数を超えています。残り: ${remainingCount}名`),
            { status: 400 }
          );
        }

        // 使用人数を加算
        const newUsedCount = ticket.usedCount + useCount;
        updateData.usedCount = newUsedCount;
        
        // 全員分使用済みかどうか
        updateData.fullyUsed = newUsedCount >= ticket.groupSize;
      } else {
        // 通常の使用（一度に全員分を使用）
        updateData.usedCount = groupSize || ticket.groupSize;
        updateData.fullyUsed = true;
      }
    } else {
      // 個人チケットの場合は単純に使用済みに
      updateData.usedCount = 1;
      updateData.fullyUsed = true;
    }

    // チケットの更新
    const updatedTicket = await prisma.ticket.update({
      where: { qrCode },
      data: updateData,
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
      isGroup: updatedTicket.isGroup,
      groupSize: updatedTicket.groupSize,
      usedCount: updatedTicket.usedCount,
      fullyUsed: updatedTicket.fullyUsed,
      lastUsedAt: updatedTicket.lastUsedAt?.toISOString() || null,
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