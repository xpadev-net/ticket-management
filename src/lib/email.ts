import { Ticket } from '@prisma/client';

interface TicketWithDetails extends Ticket {
  session: {
    name: string;
    date: Date;
    location: string;
    event: {
      name: string;
    };
  };
}

export function generateTicketEmailHtml(tickets: TicketWithDetails[]) {
  const event = tickets[0].session.event;
  const session = tickets[0].session;
  const applicantName = tickets[0].name; // 代表者名

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .ticket-list { margin-top: 20px; }
          .ticket-summary { margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
          .ticket-item { margin-bottom: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${event.name}</h1>
            <p>${session.name}</p>
            <p>開催日時: ${session.date.toLocaleString('ja-JP')}</p>
            <p>開催場所: ${session.location}</p>
          </div>

          <p>${applicantName} 様</p>
          <p>この度は、お申し込みいただき、ありがとうございます。</p>
          
          <div class="ticket-summary">
            <p><strong>チケット申込内容</strong></p>
            <p>枚数: ${tickets.length}枚</p>
            <p>代表者: ${applicantName}</p>
          </div>

          <p>以下のリンクから、各チケットの確認・印刷が可能です。</p>

          <div class="ticket-list">
            ${tickets.map((ticket, index) => `
              <div class="ticket-item">
                <p><strong>チケット ${index + 1}</strong></p>
                <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/tickets/${ticket.qrCode}" class="button">チケットを表示</a></p>
              </div>
            `).join('')}
          </div>

          <p>イベント当日は、チケットのQRコードをご提示ください。</p>
          <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
        </div>
      </body>
    </html>
  `;
}

export function generateTicketEmailText(tickets: TicketWithDetails[]) {
  const event = tickets[0].session.event;
  const session = tickets[0].session;
  const applicantName = tickets[0].name; // 代表者名

  const ticketLinks = tickets.map((ticket, index) => 
    `チケット ${index + 1}:\n` +
    `チケットURL: ${process.env.NEXT_PUBLIC_BASE_URL}/tickets/${ticket.qrCode}\n`
  ).join('\n');

  return `
${event.name}
${session.name}

開催日時: ${new Date(session.date).toLocaleString('ja-JP')}
開催場所: ${session.location}

${applicantName} 様

この度は、お申し込みいただき、ありがとうございます。

【チケット申込内容】
枚数: ${tickets.length}枚
代表者: ${applicantName}

以下のリンクから、各チケットの確認・印刷が可能です。

${ticketLinks}

イベント当日は、チケットのQRコードをご提示ください。
ご不明な点がございましたら、お気軽にお問い合わせください。
  `.trim();
}

type InvitationEmailParams = {
  to: string;
  organizationName: string;
  isExistingUser: boolean;
};

export const sendInvitationEmail = async ({
  to,
  organizationName,
  isExistingUser
}: InvitationEmailParams): Promise<void> => {
  // TODO: 実際のメール送信ロジックを実装
  console.log(`送信先: ${to}`);
  console.log(`組織名: ${organizationName}`);
  console.log(`既存ユーザー: ${isExistingUser}`);
};