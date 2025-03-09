import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization, authenticateUser } from '@/lib/auth';
import { createApiResponse, createApiError, ApiResponse, idSchema, memberRoleUpdateSchema } from '@/lib/schema';
import { z } from 'zod';
import { MemberRole } from '@prisma/client';

// Define API types with Zod
const memberPathParamsSchema = z.object({
  id: z.string().uuid({ message: "有効な組織IDが必要です" }),
  userId: z.string().uuid({ message: "有効なユーザーIDが必要です" })
});

// Type inference from Zod schema
type MemberPathParams = z.infer<typeof memberPathParamsSchema>;

// Response types
type MemberInfo = {
  id: string;
  userId: string;
  role: MemberRole;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type OwnerInfo = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER';
};

// Helper function to extract and validate path parameters
async function getValidatedParams(req: NextRequest, params: { id: string, userId: string }): Promise<MemberPathParams | null> {
  try {
    return memberPathParamsSchema.parse({ 
      id: params.id,
      userId: params.userId 
    });
  } catch (e) {
    console.error('Invalid path parameters:', e);
    return null;
  }
}

// GET handler
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, userId: string }> }
): Promise<NextResponse<ApiResponse<MemberInfo | OwnerInfo>>> {
  try {
    const validatedParams = await getValidatedParams(req, await params);
    if (!validatedParams) {
      return NextResponse.json(
        createApiError('無効なIDパラメーターです'),
        { status: 400 }
      );
    }

    const currentUser = await authenticateUser(req);
    if (!currentUser) {
      return NextResponse.json(
        createApiError('認証が必要です'),
        { status: 401 }
      );
    }

    // 組織が存在するか確認
    const organization = await prisma.organization.findUnique({
      where: { id: validatedParams.id }
    });
    
    if (!organization) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    // 現在のユーザーの組織内での役割を取得
    const currentUserRole = await getUserRoleInOrganization(
      currentUser.id, 
      validatedParams.id
    );
    
    if (!currentUserRole) {
      return NextResponse.json(
        createApiError('この組織にアクセスする権限がありません'),
        { status: 403 }
      );
    }

    // オーナーの場合
    if (organization.ownerId === validatedParams.userId) {
      const ownerInfo = await prisma.user.findUnique({
        where: { id: validatedParams.userId },
        select: {
          id: true,
          name: true,
          email: true
        }
      });
      
      return NextResponse.json(
        createApiResponse({
          ...ownerInfo,
          role: 'OWNER'
        } as OwnerInfo)
      );
    }
    
    // メンバーの場合
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: validatedParams.userId,
          organizationId: validatedParams.id
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!membership) {
      return NextResponse.json(
        createApiError('このユーザーは組織のメンバーではありません'),
        { status: 404 }
      );
    }
    
    return NextResponse.json(createApiResponse(membership as MemberInfo));
  } catch (error) {
    console.error('Member API GET error:', error);
    return NextResponse.json(
      createApiError('エラーが発生しました'),
      { status: 500 }
    );
  }
}

// PUT handler
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  try {
    const validatedOrgId = idSchema.safeParse({ id: (await params).id });
    const validatedUserId = idSchema.safeParse({ id: (await params).userId });
    
    if (!validatedOrgId.success || !validatedUserId.success) {
      return NextResponse.json(
        createApiError('無効なパラメータです'),
        { status: 400 }
      );
    }

    const { id: organizationId } = validatedOrgId.data;
    const { id: targetUserId } = validatedUserId.data;

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
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    // ユーザーの組織に対する権限を確認
    const role = await getUserRoleInOrganization(user.id, organizationId);
    if (!role || (role !== 'OWNER' && role !== MemberRole.MANAGER)) {
      return NextResponse.json(
        createApiError('メンバーの役割を変更する権限がありません'),
        { status: 403 }
      );
    }

    // メンバーシップの確認
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      }
    });

    if (!membership) {
      return NextResponse.json(
        createApiError('指定されたメンバーが見つかりません'),
        { status: 404 }
      );
    }

    const body = await req.json();
    const validationResult = memberRoleUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { role: newRole } = validationResult.data;

    // オーナーの場合、マネージャーのみ変更可能
    if (role === 'OWNER' && newRole !== MemberRole.MANAGER) {
      return NextResponse.json(
        createApiError('オーナーはマネージャーの役割のみ変更できます'),
        { status: 403 }
      );
    }

    // マネージャーの場合、一般メンバーのみ変更可能
    if (role === MemberRole.MANAGER && newRole !== MemberRole.MEMBER) {
      return NextResponse.json(
        createApiError('マネージャーは一般メンバーの役割のみ変更できます'),
        { status: 403 }
      );
    }

    // メンバーシップの更新
    const updatedMembership = await prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      },
      data: {
        role: newRole
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(
      createApiResponse({ member: updatedMembership })
    );
  } catch (error) {
    console.error('Error updating member role:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('メンバーの役割の更新に失敗しました'),
      { status: 500 }
    );
  }
}

// DELETE handler
export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  try {
    const params = await _params;
    const validatedOrgId = idSchema.safeParse({ id: params.id });
    const validatedUserId = idSchema.safeParse({ id: params.userId });
    
    if (!validatedOrgId.success || !validatedUserId.success) {
      return NextResponse.json(
        createApiError('無効なパラメータです'),
        { status: 400 }
      );
    }

    const { id: organizationId } = validatedOrgId.data;
    const { id: targetUserId } = validatedUserId.data;

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
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    // ユーザーの組織に対する権限を確認
    const role = await getUserRoleInOrganization(user.id, organizationId);
    if (!role || (role !== 'OWNER' && role !== MemberRole.MANAGER)) {
      return NextResponse.json(
        createApiError('メンバーを削除する権限がありません'),
        { status: 403 }
      );
    }

    // メンバーシップの確認
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      return NextResponse.json(
        createApiError('指定されたメンバーが見つかりません'),
        { status: 404 }
      );
    }

    // オーナーは削除できない
    if (membership.user.id === organization.ownerId) {
      return NextResponse.json(
        createApiError('オーナーは削除できません'),
        { status: 403 }
      );
    }

    // マネージャーはマネージャーを削除できない
    if (role === MemberRole.MANAGER && membership.role === MemberRole.MANAGER) {
      return NextResponse.json(
        createApiError('マネージャーは他のマネージャーを削除できません'),
        { status: 403 }
      );
    }

    // メンバーシップの削除
    await prisma.organizationMember.delete({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      }
    });

    return NextResponse.json(
      createApiResponse({ message: 'メンバーを削除しました' })
    );
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      createApiError('メンバーの削除に失敗しました'),
      { status: 500 }
    );
  }
}