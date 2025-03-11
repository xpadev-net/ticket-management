import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, createApiResponse } from "@/lib/schema";

export type PublicEventsResponse = {
  events: {
    id: string;
    name: string;
    description: string;
    date: string;
    imageUrl: string | null;
    tags: {
      id: string;
      name: string;
    }[];
    startAt: string;
    endAt: string;
    organization: {
      id: string;
      name: string;
    };
    sessions: {
      date: string;
      location: string;
    }[];
  }[];
};

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<PublicEventsResponse>>> {
  const events = await prisma.event.findMany({
    where: {
      sessions: {
        some: {
          date: {
            gte: new Date(),
          }
        }
      }
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      imageUrl: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      sessions: {
        select: {
          date: true,
          location: true,
        },
        orderBy: {
          date: 'asc',
        },
      },
    }
  });

  return NextResponse.json(createApiResponse({
    events: events.map((event) => ({
      ...event,
      date: event.sessions[0].date.toISOString(),
      startAt: event.sessions[0].date.toISOString(),
      endAt: event.sessions[event.sessions.length - 1].date.toISOString(),
      sessions: event.sessions.map((session) => ({
        date: session.date.toISOString(),
        location: session.location,
      })),
    })),
  }));
}