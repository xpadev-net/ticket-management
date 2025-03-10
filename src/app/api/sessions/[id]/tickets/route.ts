import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { createApiError, createApiResponse } from "@/lib/schema";

export type SessionTicketsResponse = {
  tickets: {
    id: string;
    name: string;
    email: string;
    isGroup: boolean;
    groupSize: number;
    used: boolean;
    fullyUsed: boolean;
    usedCount: number;
    lastUsedAt: Date | null;
  }[];
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(createApiError("認証が必要です"), { status: 401 });
  }

  const token = authHeader.substring(7);
  const user = await getUserFromToken(token);
  if (!user) {
    return NextResponse.json(createApiError("認証が必要です"), { status: 401 });
  }

  

  const eventSession = await prisma.eventSession.findUnique({
    where: { 
      id: (await params).id,
      event: {
        organization: {
          OR: [
            {
              members: {
                some: {
                  userId: user.id
                }
              }
            },
            {
              ownerId: user.id
            }
          ]
        }
      }
    },
    include: {
      event: true,
      tickets: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!eventSession) {
    return NextResponse.json(createApiError("セッションが見つかりません"), { status: 404 });
  }

  const tickets = eventSession.tickets.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    email: ticket.email,
    isGroup: ticket.isGroup,
    groupSize: ticket.groupSize,
    used: ticket.used,
    fullyUsed: ticket.fullyUsed,
    usedCount: ticket.usedCount,
    lastUsedAt: ticket.lastUsedAt,
  }));

  return NextResponse.json(createApiResponse({ tickets }));
}