import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { createApiResponse, createApiError, ApiResponse } from '@/lib/schema';

export type SessionStatsResponseItem = {
  id: string;
  name: string;
  date: string;
  location: string;
  capacity: number;
  event: {
    id: string;
    name: string;
  };
  stats: {
    total: number;
    checkedIn: number;
    remaining: number;
    capacityRemaining: number;
  }
}

export type SessionStatsResponse = SessionStatsResponseItem[];

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<SessionStatsResponse>>> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const orgs = await prisma.organization.findMany({
      where: {
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
    });


    const sessions = await prisma.eventSession.findMany({
      where: {
        event: {
          organizationId: {
            in: orgs.map(org => org.id)
          }
        }
      },  
      include: {
        event: true,
        tickets: true,
      },
      orderBy: {
        date: 'asc'
      }
    });

    const sessionStats = sessions.map(session => {
      const checkedIn = session.tickets.filter(ticket => ticket.used).length;
      return ({
        id: session.id,
        name: session.name,
        date: session.date.toISOString(),
        location: session.location,
        capacity: session.capacity,
        event: {
          id: session.event.id,
          name: session.event.name,
        },
        stats: {
          total: session.tickets.length,
          checkedIn: checkedIn,
          remaining: session.tickets.length - checkedIn,
          capacityRemaining:session.capacity - session.tickets.length,
        }
      })
    });

    return NextResponse.json(createApiResponse(sessionStats));
  } catch (error) {
    console.error('Error fetching session stats:', error);
    return NextResponse.json(createApiError('Internal Server Error'), { status: 500 });
  }
}