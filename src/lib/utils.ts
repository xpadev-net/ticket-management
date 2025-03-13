import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import QRCode from 'qrcode';
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// QRコードの生成
export async function generateQRCode(ticketId: string): Promise<string> {
  const qrData = JSON.stringify({
    ticketId,
    timestamp: Date.now(),
  });
  return await QRCode.toDataURL(qrData);
}

// チケット用のユニークなQRコード文字列を生成
export function generateTicketQRString(): string {
  return crypto.randomBytes(32).toString('hex');
}

// チケットのQRコードを検証
export function validateTicketQR(qrCode: string): boolean {
  // QRコードの形式を検証（この例では16進数64文字）
  return /^[0-9a-f]{64}$/.test(qrCode);
}

export const formatDate = (dateString: string|Date) => {
  return (dateString instanceof Date ? dateString : new Date(dateString)).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

