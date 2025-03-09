import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization } from '@/lib/auth';
import { createApiResponse, createApiError, eventSchema, searchQuerySchema, ApiResponse } from '@/lib/schema';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

type EventsApiResponse = {
  events: {
    id: string;
    name: string;
    description: string;
    organization: {
      id: string;
      name: string;
    };
    sessions: {
      id: string;
      name: string;
      date: string;
      location: string;
      capacity: number;
    }[];
    tags: {
      id: string;
      name: string;
    }[];
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<EventsApiResponse>>> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page_str = searchParams.get('page');
    const limit_str = searchParams.get('limit');
    const queryParams = {
      query: searchParams.get('query') || undefined,
      tags: searchParams.getAll('tags') || undefined,
      page: page_str ? parseInt(page_str) : undefined,
      limit: limit_str ? parseInt(limit_str) : undefined
    };

    const validationResult = searchQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { query, tags, page, limit } = validationResult.data;
    const skip = (page - 1) * limit;

    // 検索条件の構築
    const where: Prisma.EventWhereInput = {
      OR: query
        ? [
            { name: { contains: query } },
            { description: { contains: query } },
            { sessions: { some: { name: { contains: query } } } }
          ]
        : undefined,
      AND: tags
        ? [{ 
            tags: { 
              some: { 
                name: { 
                  in: Array.isArray(tags) ? tags : [tags] 
                } 
              } 
            } 
          }]
        : undefined
    };

    const [events, total] = await prisma.$transaction([
      prisma.event.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          sessions: {
            orderBy: {
              date: 'asc'
            }
          },
          tags: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.event.count({ where })
    ]);

    return NextResponse.json(
      createApiResponse({
        events: events.map(event => ({
          id: event.id,
          name: event.name,
          description: event.description,
          organization: {
            id: event.organization.id,
            name: event.organization.name
          },
          sessions: event.sessions.map(session => ({
            id: session.id,
            name: session.name,
            date: session.date.toISOString(),
            location: session.location,
            capacity: session.capacity
          })),
          tags: event.tags
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    );
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      createApiError('イベント一覧の取得に失敗しました'),
      { status: 500 }
    );
  }
}

export async function POST(
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

    // 組織に対する権限チェック
    const role = await getUserRoleInOrganization(user.id, organizationId);
    if (!role) {
      return NextResponse.json(
        createApiError('この組織でイベントを作成する権限がありません'),
        { status: 403 }
      );
    }

    // イベントの作成
    const event = await prisma.event.create({
      data: {
        name,
        description,
        organization: {
          connect: { id: organizationId }
        },
        sessions: {
          create: sessions.map(session => ({
            name: session.name,
            date: session.date,
            location: session.location,
            capacity: session.capacity
          }))
        },
        tags: tags ? {
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

    return NextResponse.json(
      createApiResponse({ event })
    );
  } catch (error) {
    console.error('Error creating event:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        createApiError('指定された組織が見つかりません'),
        { status: 404 }
      );
    }
    return NextResponse.json(
      createApiError('イベントの作成に失敗しました'),
      { status: 500 }
    );
  }
}