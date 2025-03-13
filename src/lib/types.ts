import { Event as PrismaEvent, Ticket as PrismaTicket, Organization as PrismaOrganization, User as PrismaUser, OrganizationMember as PrismaMember, MemberRole, EventSession as PrismaEventSession } from '@prisma/client';

export type Ticket = PrismaTicket;
export type Event = PrismaEvent;
export type Organization = PrismaOrganization;
export type User = PrismaUser;
export type OrganizationMember = PrismaMember;
export type EventSession = PrismaEventSession;
export { MemberRole };

export interface TicketRequest {
  email: string;
  name: string;
  quantity: number;
  sessionId: string;  // eventId から sessionId に変更
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserRegistrationRequest {
  name: string;
  email: string;
  password: string;
}

export interface OrganizationRequest {
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface InviteMemberRequest {
  email: string; 
  role: MemberRole;
}

export interface UpdateRoleRequest {
  userId: string;
  role: MemberRole | 'OWNER';
}

export interface EventSessionRequest {
  name: string;
  date: string;
  location: string;
  capacity: number;
}

export interface EventRequest {
  name: string;
  description: string;
  organizationId?: string;
  capacity?: number;
  sessions: EventSessionRequest[];
}

export interface SearchQuery {
  query?: string;
  page?: number;
  limit?: number;
}