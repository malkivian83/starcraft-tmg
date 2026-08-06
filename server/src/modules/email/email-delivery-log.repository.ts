import type { Pool, RowDataPacket } from 'mysql2/promise';

export type EmailMessageType = 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'SMTP_TEST' | 'ACCOUNT_VERIFIED' | 'SUPPORT_CREATED' | 'SUPPORT_REPLY';
export type EmailDeliveryStatus = 'SENT' | 'FAILED';

export interface EmailDeliveryLog {
  id: number;
  recipient: string;
  messageType: EmailMessageType;
  subject: string;
  status: EmailDeliveryStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface EmailDeliveryLogRow extends RowDataPacket {
  id: number;
  recipient: string;
  message_type: EmailMessageType;
  subject: string;
  status: EmailDeliveryStatus;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export class EmailDeliveryLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: Omit<EmailDeliveryLog, 'id' | 'createdAt'>): Promise<void> {
    await this.pool.execute(
      `INSERT INTO email_delivery_logs
        (recipient, message_type, subject, status, provider_message_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.recipient,
        input.messageType,
        input.subject,
        input.status,
        input.providerMessageId,
        input.errorMessage,
      ],
    );
  }

  async list(limit = 100): Promise<EmailDeliveryLog[]> {
    const safeLimit = Math.max(1, Math.min(250, Math.trunc(limit)));
    const [rows] = await this.pool.query<EmailDeliveryLogRow[]>(
      `SELECT id, recipient, message_type, subject, status,
              provider_message_id, error_message, created_at
       FROM email_delivery_logs
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit}`,
    );
    return rows.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      messageType: row.message_type,
      subject: row.subject,
      status: row.status,
      providerMessageId: row.provider_message_id,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }
}
