import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type SupportStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type SupportAuthorType = 'USER' | 'ADMIN';
export type SupportDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'NOT_APPLICABLE';

export interface SupportMessage {
  id: string;
  ticketId: string;
  authorType: SupportAuthorType;
  authorUserId: string | null;
  body: string;
  deliveryStatus: SupportDeliveryStatus;
  providerMessageId: string | null;
  deliveryError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string | null;
  contactEmail: string;
  subject: string;
  status: SupportStatus;
  termsVersion: string;
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
}

interface TicketRow extends RowDataPacket {
  id: string;
  user_id: string | null;
  contact_email: string;
  subject: string;
  status: SupportStatus;
  terms_version: string;
  terms_accepted_at: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow extends RowDataPacket {
  id: string;
  ticket_id: string;
  author_type: SupportAuthorType;
  author_user_id: string | null;
  body: string;
  delivery_status: SupportDeliveryStatus;
  provider_message_id: string | null;
  delivery_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

function mapTicket(row: TicketRow): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    contactEmail: row.contact_email,
    subject: row.subject,
    status: row.status,
    termsVersion: row.terms_version,
    termsAcceptedAt: row.terms_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): SupportMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorType: row.author_type,
    authorUserId: row.author_user_id,
    body: row.body,
    deliveryStatus: row.delivery_status,
    providerMessageId: row.provider_message_id,
    deliveryError: row.delivery_error,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  };
}

const ticketColumns = `SELECT id, user_id, contact_email, subject, status,
  terms_version, terms_accepted_at, created_at, updated_at FROM support_tickets`;
const messageColumns = `SELECT id, ticket_id, author_type, author_user_id, body,
  delivery_status, provider_message_id, delivery_error, delivered_at, created_at FROM support_messages`;

export class SupportRepository {
  constructor(private readonly pool: Pool) {}

  async createTicket(input: { userId: string | null; contactEmail: string; subject: string; body: string; termsVersion: string }): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    const ticketId = randomUUID();
    const messageId = randomUUID();
    return this.transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO support_tickets
          (id, user_id, contact_email, subject, terms_version, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [ticketId, input.userId, input.contactEmail, input.subject, input.termsVersion],
      );
      await connection.execute(
        `INSERT INTO support_messages
          (id, ticket_id, author_type, author_user_id, body, delivery_status)
         VALUES (?, ?, 'USER', ?, ?, 'PENDING')`,
        [messageId, ticketId, input.userId, input.body],
      );
      const ticket = await this.findTicketWithConnection(connection, ticketId);
      const message = await this.findMessageWithConnection(connection, messageId);
      if (!ticket || !message) throw new Error('No se pudo leer el soporte recién creado.');
      return { ticket, message };
    });
  }

  async listTickets(status?: SupportStatus): Promise<SupportTicket[]> {
    const values: string[] = [];
    const where = status ? ' WHERE status = ?' : '';
    if (status) values.push(status);
    const [rows] = await this.pool.execute<TicketRow[]>(`${ticketColumns}${where} ORDER BY updated_at DESC, id DESC`, values);
    return rows.map(mapTicket);
  }

  async countOpenTickets(): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM support_tickets WHERE status <> \'CLOSED\'');
    return Number(rows[0]?.total ?? 0);
  }

  async findTicket(id: string): Promise<SupportTicket | null> {
    const [rows] = await this.pool.execute<TicketRow[]>(`${ticketColumns} WHERE id = ?`, [id]);
    const ticket = rows[0] ? mapTicket(rows[0]) : null;
    if (!ticket) return null;
    const [messages] = await this.pool.execute<MessageRow[]>(`${messageColumns} WHERE ticket_id = ? ORDER BY created_at ASC, id ASC`, [id]);
    ticket.messages = messages.map(mapMessage);
    return ticket;
  }

  async addAdminReply(ticketId: string, authorUserId: string, body: string): Promise<SupportMessage | null> {
    const messageId = randomUUID();
    await this.transaction(async (connection) => {
      const [ticketRows] = await connection.execute<TicketRow[]>(`${ticketColumns} WHERE id = ? FOR UPDATE`, [ticketId]);
      if (!ticketRows[0]) return false;
      await connection.execute(
        `INSERT INTO support_messages
          (id, ticket_id, author_type, author_user_id, body, delivery_status)
         VALUES (?, ?, 'ADMIN', ?, ?, 'PENDING')`,
        [messageId, ticketId, authorUserId, body],
      );
      await connection.execute('UPDATE support_tickets SET status = \'ANSWERED\', updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
      return true;
    });
    const message = await this.findMessage(messageId);
    return message;
  }

  async setStatus(id: string, status: SupportStatus): Promise<boolean> {
    const [existing] = await this.pool.execute<RowDataPacket[]>('SELECT id FROM support_tickets WHERE id = ?', [id]);
    if (!existing[0]) return false;
    const [result] = await this.pool.execute<ResultSetHeader>('UPDATE support_tickets SET status = ? WHERE id = ?', [status, id]);
    return Number(result.affectedRows) >= 0;
  }

  async markMessageDelivery(id: string, status: Exclude<SupportDeliveryStatus, 'NOT_APPLICABLE' | 'PENDING'>, providerMessageId: string | null, deliveryError: string | null): Promise<void> {
    await this.pool.execute(
      `UPDATE support_messages SET delivery_status = ?, provider_message_id = ?,
        delivery_error = ?, delivered_at = ? WHERE id = ?`,
      [status, providerMessageId, deliveryError, status === 'SENT' ? new Date() : null, id],
    );
  }

  async findMessage(id: string): Promise<SupportMessage | null> {
    const [rows] = await this.pool.execute<MessageRow[]>(`${messageColumns} WHERE id = ?`, [id]);
    return rows[0] ? mapMessage(rows[0]) : null;
  }

  private async findTicketWithConnection(connection: PoolConnection, id: string): Promise<SupportTicket | null> {
    const [rows] = await connection.execute<TicketRow[]>(`${ticketColumns} WHERE id = ?`, [id]);
    return rows[0] ? mapTicket(rows[0]) : null;
  }

  private async findMessageWithConnection(connection: PoolConnection, id: string): Promise<SupportMessage | null> {
    const [rows] = await connection.execute<MessageRow[]>(`${messageColumns} WHERE id = ?`, [id]);
    return rows[0] ? mapMessage(rows[0]) : null;
  }

  private async transaction<T>(operation: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
