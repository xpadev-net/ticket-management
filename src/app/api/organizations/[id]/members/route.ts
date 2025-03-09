import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserRoleInOrganization } from '@/lib/auth';
import { createApiResponse, createApiError, idSchema, memberInviteSchema } from '@/lib/schema';
import { z } from 'zod';
import { sendInvitationEmail } from '@/lib/email';
import { MemberRole } from '@prisma/client';

export async function GET(
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

    // ユーザーの組織に対する権限を確認
    const role = await getUserRoleInOrganization(user.id, id);
    if (!role) {
      return NextResponse.json(
        createApiError('この組織にアクセスする権限がありません'),
        { status: 403 }
      );
    }

    // 組織が存在するか確認
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
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiResponse({ organization }));
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      createApiError('メンバー一覧の取得に失敗しました'),
      { status: 500 }
    );
  }
}

export async function POST(
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
    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('組織が見つかりません'),
        { status: 404 }
      );
    }

    // ユーザーの組織に対する権限を確認
    const role = await getUserRoleInOrganization(user.id, id);
    if (!role || (role !== 'OWNER' && role !== MemberRole.MANAGER)) {
      return NextResponse.json(
        createApiError('メンバーを招待する権限がありません'),
        { status: 403 }
      );
    }

    const body = await req.json();
    const validationResult = memberInviteSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { email, role: newMemberRole } = validationResult.data;

    // 既存のユーザーを検索
    let invitedUser = await prisma.user.findUnique({
      where: { email }
    });

    // オーナーは招待できない
    if (invitedUser && invitedUser.id === organization.ownerId) {
      return NextResponse.json(
        createApiError('オーナーを招待することはできません'),
        { status: 400 }
      );
    }

    // 既に組織のメンバーかチェック
    if (invitedUser) {
      const existingMembership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: invitedUser.id,
            organizationId: id
          }
        }
      });

      if (existingMembership) {
        return NextResponse.json(
          createApiError('このユーザーは既に組織のメンバーです'),
          { status: 400 }
        );
      }
    }

    // メンバーシップの作成
    if (invitedUser) {
      const membership = await prisma.organizationMember.create({
        data: {
          userId: invitedUser.id,
          organizationId: id,
          role: newMemberRole
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

      // 招待メールの送信
      await sendInvitationEmail({
        to: email,
        organizationName: organization.name,
        isExistingUser: true
      });

      return NextResponse.json(
        createApiResponse({ 
          message: '既存ユーザーを招待しました',
          member: membership
        })
      );
    } else {
      return NextResponse.json(
        createApiError('このユーザーは存在しません'),
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error inviting member:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('メンバーの招待に失敗しました'),
      { status: 500 }
    );
  }
}