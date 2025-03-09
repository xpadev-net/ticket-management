import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, hashPassword } from '@/lib/auth';
import { createApiResponse, createApiError, userRegistrationSchema, ApiResponse } from '@/lib/schema';

type RegistrationResponseData = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<RegistrationResponseData>>> {
  try {
    const body = await req.json();
    const validationResult = userRegistrationSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { name, email, password } = validationResult.data;

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        createApiError('このメールアドレスは既に登録されています'),
        { status: 400 }
      );
    }

    // パスワードのハッシュ化
    const hashedPassword = await hashPassword(password);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    // JWTトークン生成
    const token = generateToken(user);

    return NextResponse.json(
      createApiResponse({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      })
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      createApiError('ユーザー登録に失敗しました'),
      { status: 500 }
    );
  }
}