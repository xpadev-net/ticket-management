import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization } from '@/lib/auth';
import { createApiResponse, createApiError, idSchema, eventSchema, ApiResponse } from '@/lib/schema';
import { z } from 'zod';

export type EventSessionResponse = {
  id: string;
  name: string;
  date: string;
  location: string;
  capacity: number;
  sold: number;
  tickets: Array<{
    id: string;
    used: boolean;
    name: string;
    email: string;
    usedAt: string | null;
    qrCode: string;
  }>;
}

export type EventResponse = {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  }
  sessions: EventSessionResponse[];
  tags: Array<{
    id: string;
    name: string;
  }>;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<EventResponse>>> {
  try {
    const validatedParams = idSchema.safeParse({ id: params.id });
    if (!validatedParams.success) {
      return NextResponse.json(
        createApiError('無効なイベントIDです'),
        { status: 400 }
      );
    }

    const { id } = validatedParams.data;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organization: true,
        sessions: {
          include: {
            tickets: true,
          }
        },
        tags: true
      }
    });

    if (!event) {
      return NextResponse.json(
        createApiError('イベントが見つかりません'),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiResponse({
      id: event.id,
      name: event.name,
      description: event.description,
      organizationId: event.organizationId,
      organization: {
        id: event.organization.id, 
        name: event.organization.name
      },
      sessions: event.sessions.map(session => ({
        id: session.id,
        name: session.name,
        date: session.date.toISOString(),
        location: session.location,
        capacity: session.capacity,
        sold: session.tickets.length,
        tickets: session.tickets.map(ticket => ({
          id: ticket.id,
          used: ticket.used,
          name: ticket.name,
          email: ticket.email,
          usedAt: ticket.usedAt ? ticket.usedAt.toISOString() : null,
          qrCode: ticket.qrCode
        })),
      })),
      tags: event.tags.map(tag => ({ id: tag.id, name: tag.name}))
    }));
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      createApiError('イベントの取得に失敗しました'),
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const validatedParams = idSchema.safeParse({ id: params.id });
    if (!validatedParams.success) {
      return NextResponse.json(
        createApiError('無効なイベントIDです'),
        { status: 400 }
      );
    }

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

    const { id } = validatedParams.data;
    
    // 既存のイベントを取得
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        organization: true,
        sessions: true,
        tags: true
      }
    });

    if (!existingEvent) {
      return NextResponse.json(
        createApiError('イベントが見つかりません'),
        { status: 404 }
      );
    }

    // 組織に対する権限チェック
    if (existingEvent.organizationId) {
      const role = await getUserRoleInOrganization(user.id, existingEvent.organizationId);
      if (!role) {
        return NextResponse.json(
          createApiError('このイベントを編集する権限がありません'),
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const validationResult = eventSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { name, description, sessions, tags, organizationId } = validationResult.data;

    // イベントの更新
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        name,
        description,
        organizationId,
        sessions: {
          deleteMany: {},
          create: sessions.map(session => ({
            name: session.name,
            date: session.date,
            location: session.location,
            capacity: session.capacity
          }))
        },
        tags: tags ? {
          deleteMany: {},
          create: tags.map(tagName => ({
            name: tagName
          }))
        } : undefined
      },
      include: {
        organization: true,
        sessions: true,
        tags: true
      }
    });

    return NextResponse.json(createApiResponse({ event: updatedEvent }));
  } catch (error) {
    console.error('Error updating event:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('イベントの更新に失敗しました'),
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const validatedParams = idSchema.safeParse({ id: params.id });
    if (!validatedParams.success) {
      return NextResponse.json(
        createApiError('無効なイベントIDです'),
        { status: 400 }
      );
    }

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

    const { id } = validatedParams.data;

    // 既存のイベントを取得
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        organization: true,
        sessions: {
          include: {
            tickets: true
          }
        }
      }
    });

    if (!existingEvent) {
      return NextResponse.json(
        createApiError('イベントが見つかりません'),
        { status: 404 }
      );
    }

    // 組織に対する権限チェック
    if (existingEvent.organizationId) {
      const role = await getUserRoleInOrganization(user.id, existingEvent.organizationId);
      if (!role) {
        return NextResponse.json(
          createApiError('このイベントを削除する権限がありません'),
          { status: 403 }
        );
      }
    }

    // チケットが発行されているセッションがあるかチェック
    const hasTickets = existingEvent.sessions.some(session => session.tickets.length > 0);
    if (hasTickets) {
      return NextResponse.json(
        createApiError('チケットが発行されているイベントは削除できません'),
        { status: 400 }
      );
    }

    // イベントの削除（関連するタグとセッションは自動的に削除される）
    await prisma.event.delete({
      where: { id }
    });

    return NextResponse.json(
      createApiResponse({ message: 'イベントを削除しました' })
    );
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      createApiError('イベントの削除に失敗しました'),
      { status: 500 }
    );
  }
}