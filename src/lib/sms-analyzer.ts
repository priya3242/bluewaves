import { BankParserFactory } from '@/sms_fecher/parsers/BankParserFactory';
import { ParsedTransaction, TransactionType } from '@/sms_fecher/core/types';

export { TransactionType };
export type { ParsedTransaction };

interface SmsEntry {
  body: string;
  sender: string;
  timestamp: number;
}

export interface BankStats {
  income: number;
  expense: number;
  count: number;
}

export interface MerchantStats {
  total: number;
  count: number;
  type: TransactionType;
}

export interface AnalysisResult {
  transactions: ParsedTransaction[];
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  netBalance: number;
  bankBreakdown: Record<string, BankStats>;
  merchantBreakdown: Record<string, MerchantStats>;
  unparsedCount: number;
  unparsedMessages: string[];
  totalSmsCount: number;
  incomeCount: number;
  expenseCount: number;
  investmentCount: number;
}

/**
 * Parse raw SMS dump text into individual SMS entries.
 * Supports:
 *  - JSON array (with body/address fields)
 *  - Text blocks separated by blank lines or ---
 *  - "From: SENDER\nBody" format
 *  - "SENDER: body" single-line format
 */
function parseSmsInput(rawInput: string): SmsEntry[] {
  const entries: SmsEntry[] = [];

  // 1) Try JSON first
  const trimmed = rawInput.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      let json = JSON.parse(trimmed);
      if (!Array.isArray(json)) json = [json];
      return json.map((item: Record<string, unknown>, i: number) => ({
        body: String(item.body || item.message || item.text || ''),
        sender: String(item.address || item.sender || item.from || 'UNKNOWN'),
        timestamp: Number(item.date || item.timestamp || item.receivedStamp || item.sentStamp) || Date.now() - i * 60000,
      }));
    } catch {
      // Not valid JSON, fall through to text parsing
    }
  }

  // 2) Text format: split by blank lines or --- separators
  const blocks = rawInput
    .split(/\n\s*\n|^-{3,}$/m)
    .map(b => b.trim())
    .filter(Boolean);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check for "From: SENDER\nBody text" format
    const fromMatch = block.match(
      /^(?:From|Sender|Address)\s*:\s*(.+)\n([\s\S]+)/i
    );
    if (fromMatch) {
      entries.push({
        sender: fromMatch[1].trim(),
        body: fromMatch[2].trim(),
        timestamp: Date.now() - i * 60000,
      });
      continue;
    }

    // Check for "SENDER: body text" single-line format
    // Sender IDs are typically 2-15 uppercase alphanumeric + hyphens
    const colonMatch = block.match(/^([A-Z][A-Z0-9-]{1,15}):\s+([\s\S]+)/);
    if (colonMatch) {
      entries.push({
        sender: colonMatch[1].trim(),
        body: colonMatch[2].trim(),
        timestamp: Date.now() - i * 60000,
      });
      continue;
    }

    // Plain SMS body — no sender info
    entries.push({
      body: block,
      sender: 'UNKNOWN',
      timestamp: Date.now() - i * 60000,
    });
  }

  return entries;
}

/**
 * Run the full SMS analysis pipeline.
 */
export function analyzeSms(rawInput: string): AnalysisResult {
  const entries = parseSmsInput(rawInput);
  const transactions: ParsedTransaction[] = [];
  const unparsedMessages: string[] = [];

  for (const entry of entries) {
    let parsed: ParsedTransaction | null = null;

    // GLOBAL STRICT NEGATIVE FILTER
    // Blocks marketing, OTPs, and bill reminders from being processed by ANY parser.
    const lowerMessage = entry.body.toLowerCase();
    const isPromoOrOtp = (
      lowerMessage.includes('otp') ||
      lowerMessage.includes('one time password') ||
      lowerMessage.includes('verification code') ||
      lowerMessage.includes('offer') ||
      lowerMessage.includes('discount') ||
      lowerMessage.includes('win ') ||
      (lowerMessage.includes('cashback') && !lowerMessage.includes('credited')) ||
      lowerMessage.includes('has requested') ||
      lowerMessage.includes('payment request') ||
      lowerMessage.includes('collect request') ||
      lowerMessage.includes('requesting payment') ||
      lowerMessage.includes('requests rs') ||
      lowerMessage.includes('have received payment') ||
      lowerMessage.includes('is due') ||
      lowerMessage.includes('min amount due') ||
      lowerMessage.includes('minimum amount due') ||
      lowerMessage.includes('in arrears') ||
      lowerMessage.includes('is overdue') ||
      lowerMessage.includes('ignore if paid') ||
      lowerMessage.includes('ignore if already paid') ||
      (lowerMessage.includes('pls pay') && lowerMessage.includes('min of'))
    );

    if (isPromoOrOtp) {
      unparsedMessages.push(entry.body);
      continue;
    }

    // Try specific parser via sender first
    if (entry.sender !== 'UNKNOWN') {
      const parser = BankParserFactory.getParser(entry.sender);
      if (parser) {
        parsed = parser.parse(entry.body, entry.sender, entry.timestamp);
      }
    }

    // Fallback: try every parser (brute-force for unknown senders)
    if (!parsed) {
      const allParsers = BankParserFactory.getAllParsers();
      for (const p of allParsers) {
        parsed = p.parse(entry.body, entry.sender, entry.timestamp);
        if (parsed) break;
      }
    }

    if (parsed) {
      transactions.push(parsed);
    } else {
      unparsedMessages.push(entry.body);
    }
  }

  // Aggregate stats
  let totalIncome = 0;
  let totalExpense = 0;
  let totalInvestment = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let investmentCount = 0;

  const bankBreakdown: Record<string, BankStats> = {};
  const merchantBreakdown: Record<string, MerchantStats> = {};

  for (const txn of transactions) {
    const isIncome = txn.type === TransactionType.INCOME;
    const isExpense =
      txn.type === TransactionType.EXPENSE ||
      txn.type === TransactionType.CREDIT;
    const isInvestment = txn.type === TransactionType.INVESTMENT;

    if (isIncome) {
      totalIncome += txn.amount;
      incomeCount++;
    }
    if (isExpense) {
      totalExpense += txn.amount;
      expenseCount++;
    }
    if (isInvestment) {
      totalInvestment += txn.amount;
      investmentCount++;
    }

    // Bank breakdown
    if (!bankBreakdown[txn.bankName]) {
      bankBreakdown[txn.bankName] = { income: 0, expense: 0, count: 0 };
    }
    bankBreakdown[txn.bankName].count++;
    if (isIncome) bankBreakdown[txn.bankName].income += txn.amount;
    if (isExpense) bankBreakdown[txn.bankName].expense += txn.amount;

    // Merchant breakdown
    const merchant = txn.merchant || 'Unknown';
    if (!merchantBreakdown[merchant]) {
      merchantBreakdown[merchant] = { total: 0, count: 0, type: txn.type };
    }
    merchantBreakdown[merchant].total += txn.amount;
    merchantBreakdown[merchant].count++;
  }

  return {
    transactions,
    totalIncome,
    totalExpense,
    totalInvestment,
    netBalance: totalIncome - totalExpense,
    bankBreakdown,
    merchantBreakdown,
    unparsedCount: unparsedMessages.length,
    unparsedMessages,
    totalSmsCount: entries.length,
    incomeCount,
    expenseCount,
    investmentCount,
  };
}

/**
 * Format a number as currency with Indian locale or generic.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR'
): string {
  const abs = Math.abs(amount);
  if (currency === 'INR') {
    return (
      (amount < 0 ? '-' : '') +
      '₹' +
      abs.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return (
    (amount < 0 ? '-' : '') +
    currency +
    ' ' +
    abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatCompact(amount: number): string {
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(1) + 'Cr';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
  if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
  return '₹' + amount.toFixed(0);
}
