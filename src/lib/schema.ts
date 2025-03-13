import { z } from 'zod';
import { MemberRole } from '@prisma/client';

// ベーシックな型定義
export const idSchema = z.object({
  id: z.string().uuid()
});

// QRコード関連
export const qrCodeSchema = z.object({
  qrCode: z.string().uuid()
});

// チケットステータス更新関連
export const ticketStatusUpdateSchema = z.object({
  used: z.boolean(),
  groupSize: z.number().int().positive().optional(), // 団体チケットの人数
  isGroupTicket: z.boolean().optional(), // 団体チケットフラグ
  partialUse: z.boolean().optional(), // 部分受付フラグ
  useCount: z.number().int().positive().optional() // 部分受付時の受付人数
});

// ログイン関連
export const loginSchema = z.object({
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  password: z.string().min(8, { message: "パスワードは8文字以上必要です" })
});

// ユーザー登録関連
export const userRegistrationSchema = z.object({
  name: z.string().min(1, { message: "名前を入力してください" }),
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  password: z.string().min(8, { message: "パスワードは8文字以上必要です" })
});

// 組織関連
export const organizationSchema = z.object({
  name: z.string().min(1, { message: "組織名を入力してください" }),
  description: z.string().optional(),
  logoUrl: z.preprocess((val) => val || undefined, z.string().url().optional())
});

// メンバー招待関連
export const inviteMemberSchema = z.object({
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  role: z.nativeEnum(MemberRole)
});

// メンバー招待関連
export const memberInviteSchema = z.object({
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  role: z.nativeEnum(MemberRole)
});

// メンバーロール更新関連
export const memberRoleUpdateSchema = z.object({
  role: z.nativeEnum(MemberRole)
});

// ロール更新関連
export const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.nativeEnum(MemberRole), z.literal('OWNER')])
});

// イベントセッション関連
export const eventSessionSchema = z.object({
  name: z.string().min(1, { message: "セッション名を入力してください" }),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "有効な日付を入力してください"
  }),
  location: z.string().min(1, { message: "場所を入力してください" }),
  capacity: z.number().int().positive({ message: "定員は正の整数で入力してください" })
});

// イベント関連
export const eventSchema = z.object({
  name: z.string().min(1, { message: "イベント名を入力してください" }),
  description: z.string().min(1, { message: "説明を入力してください" }),
  sessions: z.array(eventSessionSchema).min(1, { message: "セッションを少なくとも1つ追加してください" }),
  tags: z.array(z.string()).optional()
});

// チケットリクエスト関連
export const ticketRequestSchema = z.object({
  name: z.string().min(1, { message: "名前を入力してください" }),
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  quantity: z.number().int().positive({ message: "申込人数は正の整数で入力してください" }),
  sessionId: z.string().uuid()
});

// チケット申込者情報
export const ticketApplicantSchema = z.object({
  name: z.string().min(1, { message: "代表者名を入力してください" }),
  nameKana: z.string().min(1, { message: "ふりがなを入力してください" }),
  email: z.string().email({ message: "有効なメールアドレスを入力してください" }),
  quantity: z.number().int().min(1, { message: "枚数を入力してください" }).max(10, { message: "一度に申し込めるのは10枚までです" }),
  isGroupTicket: z.boolean().optional().default(false), // 団体チケットフラグ
  notes: z.string().optional() // 備考欄（任意）
});

// チケット生成関連
export const ticketGenerationSchema = z.object({
  sessionId: z.string().uuid(),
  applicant: ticketApplicantSchema
});
export type TicketGenerationRequest = z.infer<typeof ticketGenerationSchema>;

// 検索クエリ関連
export const searchQuerySchema = z.object({
  query: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10)
});

// APIレスポンス用ヘルパー
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false,
  error: string;
};

export const createApiResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data
});

export const createApiError = (message: string): ApiResponse<never> => ({
  success: false,
  error: message
});