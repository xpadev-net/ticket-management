import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { createApiResponse, createApiError, organizationSchema, ApiResponse } from '@/lib/schema';
import { z } from 'zod';
import { MemberRole } from '@/lib/types';

export type OrganizationResponseItem = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  role: 'OWNER' | MemberRole;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  members: {
    id: string;
    role: MemberRole;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  events: {
    id: string;
    name: string;
    description: string;
    sessions: {
      id: string;
      date: string;
      location: string;
    }[];
  }[];
};

export type OrganizationResponse = OrganizationResponseItem[];

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<OrganizationResponse>>> {
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

    // ユーザーの所属組織を取得
    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        events: {
          select: {
            id: true,
            name: true,
            description: true,
            sessions: {
              select: {
                id: true,
                date: true,
                location: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(createApiResponse(organizations.map((org)=>({
      id: org.id,
      name: org.name,
      description: org.description,
      logoUrl: org.logoUrl,
      role: org.ownerId === user.id ? 'OWNER' : org.members.find((member) => member.userId === user.id)?.role || 'MEMBER',
      owner: org.owner,
      members: org.members,
      events: org.events.map((event) => ({
        id: event.id,
        name: event.name,
        description: event.description,
        sessions: event.sessions.map((session) => ({
          id: session.id,
          date: session.date.toISOString(),
          location: session.location
        }))
      }))
    }))));
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      createApiError('組織一覧の取得に失敗しました'),
      { status: 500 }
    );
  }
}

export type OrganizationCreateResponse = {
  organization: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    owner: {
      id: string;
      name: string;
      email: string;
    };
  };
};
  

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<OrganizationCreateResponse>>> {
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
    const validationResult = organizationSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { name, description, logoUrl } = validationResult.data;

    // 組織の作成
    const organization = await prisma.organization.create({
      data: {
        name,
        description,
        logoUrl,
        ownerId: user.id
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(createApiResponse({ organization }));
  } catch (error) {
    console.error('Error creating organization:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('組織の作成に失敗しました'),
      { status: 500 }
    );
  }
}