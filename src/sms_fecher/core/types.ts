export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  CREDIT = 'CREDIT',
  TRANSFER = 'TRANSFER',
  INVESTMENT = 'INVESTMENT',
  BALANCE_UPDATE = 'BALANCE_UPDATE',
}

export interface ParsedTransaction {
  amount: number;

  type: TransactionType;

  merchant: string | null;

  reference: string | null;

  accountLast4: string | null;

  balance: number | null;

  creditLimit: number | null;

  smsBody: string;

  sender: string;

  timestamp: number;

  bankName: string;

  isFromCard: boolean;

  currency: string;

  // OPTIONAL TRANSFER FIELDS
  fromAccount?: string | null;

  toAccount?: string | null;
}

export interface SmsMessage {
  _id: number;

  thread_id: number;

  address: string;

  person: string;

  date: number;

  date_sent: number;

  protocol: number;

  read: number;

  status: number;

  type: number;

  body: string;

  service_center: string;
}

/**
 * Balance-only notification model
 */
export interface BaseBalanceUpdateInfo {

  bankName: string;

  accountLast4: string | null;

  balance: number | null;

  asOfDate: string | null;
}