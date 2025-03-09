import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { User, MemberRole } from './types';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export type JWTPayload = Pick<User,"id"|"email"|"name">;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: JWTPayload): string {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error('Error verifying token :', error);
    return null;
  }
}

// Helper function to authenticate user from request
export async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return getUserFromToken(token);
}


export async function getUserFromToken(token: string): Promise<User | null> {
  const decoded = verifyToken(token);
  
  if (!decoded || !decoded.id) {
    return null;
  }
  
  return prisma.user.findUnique({
    where: { id: decoded.id }
  });
}

export async function getUserRoleInOrganization(userId: string, organizationId: string) {
  // 組織のオーナーかどうか確認
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      ownerId: userId
    }
  });

  if (organization) {
    return 'OWNER';
  }

  // メンバーとしての役割を確認
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId
      }
    }
  });

  return membership?.role || null;
}

export async function canManageRole(currentUserId: string, targetUserId: string, organizationId: string) {
  // 自分自身は変更できない
  if (currentUserId === targetUserId) {
    return false;
  }

  // 自分のロールを取得
  const currentUserRole = await getUserRoleInOrganization(currentUserId, organizationId);
  
  // オーナーは誰でも変更可能
  if (currentUserRole === 'OWNER') {
    return true;
  }
  
  // MANAGERはMANAGER以下のロールのみ変更可能
  if (currentUserRole === MemberRole.MANAGER) {
    const targetUserRole = await getUserRoleInOrganization(targetUserId, organizationId);
    
    // ターゲットがオーナーの場合は変更不可
    if (targetUserRole === 'OWNER') {
      return false;
    }
    
    return true;
  }
  
  // MEMBERは変更不可
  return false;
}
