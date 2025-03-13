import { generateTicketEmailHtml, generateTicketEmailText, sendTicketEmail } from "@/lib/email";
import prisma from "@/lib/prisma";
import { ApiResponse, createApiError, createApiResponse, ticketGenerationSchema } from "@/lib/schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export type TicketGenerationResponse = {
  tickets: Array<{
    id: string;
    qrCode: string;
    name: string;
    nameKana: string;
    email: string;
    notes?: string; // 備考欄フィールドを追加
    sessionId: string;
    isGroup: boolean;
    groupSize: number;
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
  }>
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<TicketGenerationResponse>>> {
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
    const { name, nameKana, email, quantity, isGroupTicket, notes } = applicant; // notesを追加

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

    let tickets = [];

    if (isGroupTicket) {
      // 団体チケットの場合: 1枚のチケットを発行
      const ticket = await prisma.ticket.create({
        data: {
          qrCode: crypto.randomUUID(),
          email,
          name,
          nameKana,
          notes, // notesフィールドを追加
          sessionId: session.id,
          isGroup: true,
          groupSize: quantity
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
      tickets = [ticket];
    } else {
      // 個人チケットの場合: 人数分のチケットを発行
      tickets = await Promise.all(
        Array.from({ length: quantity }, async () => {
          return prisma.ticket.create({
            data: {
              qrCode: crypto.randomUUID(),
              email,
              name,
              nameKana,
              notes, // notesフィールドを追加 
              sessionId: session.id,
              isGroup: false,
              groupSize: 1
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
    }

    // メール送信用のHTML/テキスト生成
    const emailHtml = generateTicketEmailHtml(tickets);
    const emailText = generateTicketEmailText(tickets);

    // Resendを使用してメール送信
    await sendTicketEmail(email, emailHtml, emailText);

    return NextResponse.json(createApiResponse({
      tickets: tickets.map(ticket => ({
        id: ticket.id,
        qrCode: ticket.qrCode,
        name: ticket.name,
        nameKana: ticket.nameKana,
        email: ticket.email,
        notes: ticket.notes || undefined,
        sessionId: ticket.sessionId,
        isGroup: ticket.isGroup,
        groupSize: ticket.groupSize,
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
      }))
    }));
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
