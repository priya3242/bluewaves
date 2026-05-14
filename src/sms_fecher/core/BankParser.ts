import { CompiledPatterns } from './patterns';
import { TransactionType, ParsedTransaction } from './types';

export abstract class BankParser {
  abstract getBankName(): string;
  abstract canHandle(sender: string): boolean;

  getCurrency(): string {
    return 'INR';
  }

  parse(smsBody: string, sender: string, timestamp: number): ParsedTransaction | null {
    const lowerMessage = smsBody.toLowerCase();

    // STRICT GLOBAL NEGATIVE FILTERS
    // Prevents poorly implemented subclass overrides (e.g. matching generic "UPI") from parsing ads/OTPs
    if (
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
    ) {
      return null;
    }

    if (!this.isTransactionMessage(smsBody)) {
      return null;
    }

    const amount = this.extractAmount(smsBody);
    if (amount === null) return null;

    const type = this.extractTransactionType(smsBody);
    if (type === null) return null;

    const availableLimit = type === TransactionType.CREDIT ? this.extractAvailableLimit(smsBody) : null;
    const rawAccountLast4 = this.extractAccountLast4(smsBody);
    const safeAccountLast4 = rawAccountLast4 ? this.extractLast4Digits(rawAccountLast4) : null;

    return {
      amount,
      type,
      merchant: this.extractMerchant(smsBody, sender),
      reference: this.extractReference(smsBody),
      accountLast4: safeAccountLast4 || rawAccountLast4,
      balance: this.extractBalance(smsBody),
      creditLimit: availableLimit,
      smsBody,
      sender,
      timestamp,
      bankName: this.getBankName(),
      isFromCard: this.detectIsCard(smsBody),
      currency: this.getCurrency(),
    };
  }

  protected isTransactionMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('otp') || lowerMessage.includes('one time password') || lowerMessage.includes('verification code')) return false;
    if (lowerMessage.includes('offer') || lowerMessage.includes('discount') || lowerMessage.includes('cashback offer') || lowerMessage.includes('win ')) return false;
    if (lowerMessage.includes('has requested') || lowerMessage.includes('payment request') || lowerMessage.includes('collect request') || lowerMessage.includes('requesting payment') || lowerMessage.includes('requests rs') || lowerMessage.includes('ignore if already paid')) return false;
    if (lowerMessage.includes('have received payment')) return false;
    if (lowerMessage.includes('is due') || lowerMessage.includes('min amount due') || lowerMessage.includes('minimum amount due') || lowerMessage.includes('in arrears') || lowerMessage.includes('is overdue') || lowerMessage.includes('ignore if paid') || (lowerMessage.includes('pls pay') && lowerMessage.includes('min of'))) return false;

    const transactionKeywords = ['debited', 'credited', 'withdrawn', 'deposited', 'spent', 'received', 'transferred', 'paid'];
    return transactionKeywords.some(kw => lowerMessage.includes(kw));
  }

  protected extractAmount(message: string): number | null {
    for (const pattern of CompiledPatterns.Amount.ALL_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const amountStr = match[1].replace(/,/g, '');
        const num = parseFloat(amountStr);
        if (!isNaN(num)) return num;
      }
    }
    return null;
  }

  protected extractTransactionType(message: string): TransactionType | null {
    const lowerMessage = message.toLowerCase();

    if (this.isInvestmentTransaction(lowerMessage)) return TransactionType.INVESTMENT;

    if (lowerMessage.includes('debited') || lowerMessage.includes('withdrawn') || lowerMessage.includes('spent') || lowerMessage.includes('charged') || lowerMessage.includes('paid') || lowerMessage.includes('purchase') || lowerMessage.includes('deducted')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('credited') || lowerMessage.includes('deposited') || lowerMessage.includes('received') || lowerMessage.includes('refund') || (lowerMessage.includes('cashback') && !lowerMessage.includes('earn cashback'))) return TransactionType.INCOME;

    return null;
  }

  protected isInvestmentTransaction(lowerMessage: string): boolean {
    const keywords = ['iccl', 'indian clearing corporation', 'nsccl', 'nse clearing', 'clearing corporation', 'nach', 'ach', 'ecs', 'groww', 'zerodha', 'upstox', 'kite', 'kuvera', 'paytm money', 'etmoney', 'coin by zerodha', 'smallcase', 'angel one', 'angel broking', '5paisa', 'icici securities', 'icici direct', 'hdfc securities', 'kotak securities', 'motilal oswal', 'sharekhan', 'edelweiss', 'axis direct', 'sbi securities', 'mutual fund', 'sip', 'elss', 'ipo', 'folio', 'demat', 'stockbroker', 'digital gold', 'sovereign gold', 'nse', 'bse', 'cdsl', 'nsdl'];
    return keywords.some(kw => lowerMessage.includes(kw));
  }

  protected extractMerchant(message: string, sender: string): string | null {
    for (const pattern of CompiledPatterns.Merchant.ALL_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const merchant = this.cleanMerchantName(match[1].trim());
        if (this.isValidMerchantName(merchant)) return merchant;
      }
    }
    return null;
  }

  protected extractReference(message: string): string | null {
    for (const pattern of CompiledPatterns.Reference.ALL_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return null;
  }

  protected extractLast4Digits(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return last4.length >= 3 ? last4 : null;
  }

  protected extractAccountLast4(message: string): string | null {
    for (const pattern of CompiledPatterns.Account.ALL_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const rawCapture = match[1];
        const last4 = this.extractLast4Digits(rawCapture);
        if (last4 && this.isValidAccountLast4(last4, match[0], message)) return last4;
      }
    }
    return null;
  }

  private isValidAccountLast4(last4: string, matchedText: string, fullMessage: string): boolean {
    const escapedLast4 = last4.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const datePatterns = [
      new RegExp(`\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`),
      new RegExp(`${escapedLast4}[/-]\\d{1,2}[/-]\\d{1,2}`),
      new RegExp(`\\bon\\s+\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, 'i'),
      new RegExp(`\\bdated\\s+\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, 'i')
    ];

    for (const datePattern of datePatterns) {
      if (datePattern.test(fullMessage)) return false;
    }

    const year = parseInt(last4, 10);
    if (year >= 2000 && year <= 2099) {
      const yearContextPatterns = [
        new RegExp(`\\bon\\s+\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, 'i'),
        new RegExp(`\\bdated\\s+.*?${escapedLast4}`, 'i'),
        new RegExp(`${escapedLast4}(?:\\s|$)`)
      ];

      for (const yearPattern of yearContextPatterns) {
        if (yearPattern.test(fullMessage)) {
          const accountBeforeYear = new RegExp(`(?:A/c|Account|Acct).{0,25}${escapedLast4}`, 'i');
          if (!accountBeforeYear.test(fullMessage)) return false;
        }
      }
    }
    return true;
  }

  protected extractBalance(message: string): number | null {
    for (const pattern of CompiledPatterns.Balance.ALL_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const balanceStr = match[1].replace(/,/g, '');
        const num = parseFloat(balanceStr);
        if (!isNaN(num)) return num;
      }
    }
    return null;
  }

  protected extractAvailableLimit(message: string): number | null {
    const creditLimitPatterns = [
      /Available\s+limit\s+Rs\.([0-9,]+(?:\.\d{2})?)/i,
      /Available\s+limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
      /Avl\s+Lmt:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
      /Avail\s+Limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
      /Available\s+Credit\s+Limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
      /(?:^|\s)Limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
    ];

    for (const pattern of creditLimitPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const limitStr = match[1].replace(/,/g, '');
        const num = parseFloat(limitStr);
        if (!isNaN(num)) return num;
      }
    }
    return null;
  }

  protected detectIsCard(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const accountPatterns = ['a/c', 'account', 'ac ', 'acc ', 'saving account', 'current account', 'savings a/c', 'current a/c'];

    for (const pattern of accountPatterns) {
      if (lowerMessage.includes(pattern)) return false;
    }

    const cardPatterns = ['card ending', 'card xx', 'debit card', 'credit card', 'card no.', 'card number', 'card *', 'card x'];
    for (const pattern of cardPatterns) {
      if (lowerMessage.includes(pattern)) return true;
    }

    const maskedCardRegex = /(?:xx|XX|\*{2,})?\d{4}/;
    if (lowerMessage.includes('ending') && maskedCardRegex.test(message)) return true;

    return false;
  }

  protected cleanMerchantName(merchant: string): string {
    return merchant
      .replace(CompiledPatterns.Cleaning.TRAILING_PARENTHESES, '')
      .replace(CompiledPatterns.Cleaning.REF_NUMBER_SUFFIX, '')
      .replace(CompiledPatterns.Cleaning.DATE_SUFFIX, '')
      .replace(CompiledPatterns.Cleaning.UPI_SUFFIX, '')
      .replace(CompiledPatterns.Cleaning.TIME_SUFFIX, '')
      .replace(CompiledPatterns.Cleaning.TRAILING_DASH, '')
      .replace(CompiledPatterns.Cleaning.PVT_LTD, '')
      .replace(CompiledPatterns.Cleaning.LTD, '')
      .trim();
  }

  protected isValidMerchantName(name: string): boolean {
    const commonWords = new Set(['USING', 'VIA', 'THROUGH', 'BY', 'WITH', 'FOR', 'TO', 'FROM', 'AT', 'THE']);
    const upperName = name.toUpperCase();

    return name.length >= 2 &&
      /[a-zA-Z]/.test(name) &&
      !commonWords.has(upperName) &&
      !/^\d+$/.test(name) &&
      !name.includes('@');
  }
}
