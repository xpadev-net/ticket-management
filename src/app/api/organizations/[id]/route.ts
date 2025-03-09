import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization } from '@/lib/auth';
import { createApiResponse, createApiError, idSchema, organizationSchema, ApiResponse } from '@/lib/schema';
import { z } from 'zod';
import { OrganizationResponseItem } from '../route';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<OrganizationResponseItem>>> {
  try {
    const validatedParams = idSchema.safeParse({ id: params.id });
    if (!validatedParams.success) {
      return NextResponse.json(
        createApiError('無効な組織IDです'),
        { status: 400 }
      );
    }

    const { id } = validatedParams.data;

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

    // ユーザーの組織に対する権限を確認
    const role = await getUserRoleInOrganization(user.id, id);
    if (!role) {
      return NextResponse.json(
        createApiError('この組織にアクセスする権限がありません'),
        { status: 403 }
      );
    }

    // 組織の詳細を取得
    const organization = await prisma.organization.findUnique({
      where: { id },
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
          orderBy: {
            createdAt: 'desc'
          },
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

    if (!organization) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiResponse({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      logoUrl: organization.logoUrl,
      role: role,
      owner: organization.owner,
      members: organization.members,
      events: organization.events.map(event => ({
        id: event.id,
        name: event.name,
        description: event.description,
        sessions: event.sessions.map(session => ({
          id: session.id,
          date: session.date.toISOString(),
          location: session.location
        }))
      }))
    }));
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      createApiError('組織の取得に失敗しました'),
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
        createApiError('無効な組織IDです'),
        { status: 400 }
      );
    }

    const { id } = validatedParams.data;

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

    // 組織が存在するか確認
    const existingOrg = await prisma.organization.findUnique({
      where: { id }
    });

    if (!existingOrg) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    // オーナーのみが編集可能
    if (existingOrg.ownerId !== user.id) {
      return NextResponse.json(
        createApiError('この組織を編集する権限がありません'),
        { status: 403 }
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

    // 組織の更新
    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        name,
        description,
        logoUrl
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
        }
      }
    });

    return NextResponse.json(createApiResponse({ organization: updatedOrg }));
  } catch (error) {
    console.error('Error updating organization:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('組織の更新に失敗しました'),
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
        createApiError('無効な組織IDです'),
        { status: 400 }
      );
    }

    const { id } = validatedParams.data;

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

    // 組織が存在するか確認
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        events: true
      }
    });

    if (!existingOrg) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    // オーナーのみが削除可能
    if (existingOrg.ownerId !== user.id) {
      return NextResponse.json(
        createApiError('この組織を削除する権限がありません'),
        { status: 403 }
      );
    }

    // イベントが存在する場合は削除不可
    if (existingOrg.events.length > 0) {
      return NextResponse.json(
        createApiError('イベントが存在する組織は削除できません'),
        { status: 400 }
      );
    }

    // 組織の削除
    await prisma.organization.delete({
      where: { id }
    });

    return NextResponse.json(
      createApiResponse({ message: '組織を削除しました' })
    );
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      createApiError('組織の削除に失敗しました'),
      { status: 500 }
    );
  }
}