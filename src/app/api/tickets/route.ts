import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse, createApiError, ticketGenerationSchema } from '@/lib/schema';
import { z } from 'zod';
import { generateQRCode } from '@/lib/utils';
import { generateTicketEmailHtml, generateTicketEmailText } from '@/lib/email';
import { randomUUID } from 'crypto';

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const validationResult = ticketGenerationSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        createApiError(errorMessage),
        { status: 400 }
      );
    }

    const { sessionId, applicant } = validationResult.data;
    const { name, email, quantity } = applicant;

    // セッション存在チェックと容量チェック
    const session = await prisma.eventSession.findUnique({
      where: { id: sessionId },
      include: {
        tickets: true,
        event: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        createApiError('セッションが見つかりません'),
        { status: 404 }
      );
    }

    // 残り定員のチェック
    const remainingCapacity = session.capacity - session.tickets.length;
    if (remainingCapacity < quantity) {
      return NextResponse.json(
        createApiError(`定員を超過しています。残り定員: ${remainingCapacity}枚`),
        { status: 400 }
      );
    }

    // QRコード生成とチケット作成
    const tickets = await Promise.all(
      Array.from({ length: quantity }, async () => {
        return prisma.ticket.create({
          data: {
            qrCode: crypto.randomUUID(),
            email,
            name,
            sessionId: session.id
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
      })
    );

    // メール送信用のHTML/テキスト生成
    const emailHtml = generateTicketEmailHtml(tickets);
    const emailText = generateTicketEmailText(tickets);

    // TODO: 実際のメール送信処理
    console.log(`To: ${email}`);
    console.log('Subject: チケット発行のお知らせ');
    console.log('Text:', emailText);
    console.log('HTML:', emailHtml);

    return NextResponse.json(createApiResponse({ tickets }));
  } catch (error) {
    console.error('Error generating tickets:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('無効なリクエストデータです'),
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        createApiError(error.message),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError('チケットの生成に失敗しました'),
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        createApiError('メールアドレスが必要です'),
        { status: 400 }
      );
    }

    // メールアドレスに紐づくチケット一覧を取得
    const tickets = await prisma.ticket.findMany({
      where: {
        email: email
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(createApiResponse({ tickets }));
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      createApiError('チケット一覧の取得に失敗しました'),
      { status: 500 }
    );
  }
}