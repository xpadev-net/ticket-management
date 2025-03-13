import prisma from "@/lib/prisma";
import { ApiResponse, idSchema, createApiError, createApiResponse } from "@/lib/schema";
import { NextRequest, NextResponse } from "next/server";

export type PublicEventSessionResponse = {
  id: string;
  name: string;
  date: string;
  location: string;
  capacity: number;
  sold: number;
  available: number;
}

export type PublicEventResponse = {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  }
  sessions: PublicEventSessionResponse[];
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PublicEventResponse>>> {
  try {
    const validatedParams = idSchema.safeParse(await params);
    if (!validatedParams.success) {
      return NextResponse.json(
        createApiError('無効なイベントIDです'),
        { status: 400 }
      );
    }

    const { id } = validatedParams.data;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organization: true,
        sessions: {
          include: {
            tickets: true,
          },
          orderBy: {
            date: 'asc'
          }
        },
      }
    });

    if (!event) {
      return NextResponse.json(
        createApiError('イベントが見つかりません'),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiResponse({
      id: event.id,
      name: event.name,
      description: event.description,
      organizationId: event.organizationId,
      organization: {
        id: event.organization.id, 
        name: event.organization.name
      },
      sessions: event.sessions.map(session => ({
        id: session.id,
        name: session.name,
        date: session.date.toISOString(),
        location: session.location,
        capacity: session.capacity,
        sold: session.tickets.length,
        available: Math.max(0, session.capacity - session.tickets.length),
      })),
    }));
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      createApiError('イベントの取得に失敗しました'),
      { status: 500 }
    );
  }
}