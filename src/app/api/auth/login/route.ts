import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, verifyPassword } from '@/lib/auth';
import { createApiResponse, createApiError, ApiResponse } from '@/lib/schema';
import { z } from 'zod';
import { MemberRole } from '@prisma/client';

export type LoginedUser = {
  id: string;
  name: string;
  email: string;
  memberships: {
    id: string;
    role: MemberRole;
    organization: {
      id: string;
      name: string;
    };
  }[];
}

export type LoginResponseData = {
  token: string;
  user: LoginedUser;
};

// Login schema
const loginSchema = z.object({
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  password: z.string().min(8, { message: "パスワードは8文字以上である必要があります" })
});

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<LoginResponseData>>> {
  try {
    const body = await req.json();
    const validationResult = loginSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });
    
    if (!user) {
      return NextResponse.json(
        createApiError('メールアドレスかパスワードが正しくありません'),
        { status: 401 }
      );
    }
    
    // パスワード検証
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        createApiError('メールアドレスかパスワードが正しくありません'),
        { status: 401 }
      );
    }
    
    // JWTトークン生成
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    
    return NextResponse.json(
      createApiResponse({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          memberships: user.memberships.map(membership => ({
            id: membership.id,
            role: membership.role,
            organization: {
              id: membership.organization.id,
              name: membership.organization.name,
            }
          }))
        }
      })
    );
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('ログイン処理に失敗しました'),
      { status: 500 }
    );
  }
}