import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Kotak Bank specific parser.
 * Handles Kotak Bank's unique message formats including:
 * - UPI transactions with recipient details
 * - Standard debit/credit messages
 * - Card transactions
 */
export class KotakBankParser extends BankParser {
  getBankName() {
    return 'Kotak Bank';
  }

  canHandle(sender: string): boolean {
    const normalizedSender = sender.toUpperCase();
    // DLT patterns for Kotak Bank
    return /^[A-Z]{2}-KOTAKB-[ST]$/i.test(normalizedSender);
  }

  extractMerchant(message: string, sender: string): string | null {
    // IMPS credit from mobile: "linked to mobile xNNNN"
    const mobileLinkedPattern = /linked\s+to\s+mobile\s+([xX*]+\d{2,})/i;
    const mobileMatch = message.match(mobileLinkedPattern);
    if (mobileMatch && mobileMatch[1]) {
      return mobileMatch[1];
    }

    // Credit card merchant pattern: "on DD-MON-YYYY at MERCHANT. Avl limit"
    const cardMerchantPattern = /on\s+\d{1,2}-\w{3}-\d{2,4}\s+at\s+([^.]+?)(?:\.|\s+Avl|$)/i;
    const cardMatch = message.match(cardMerchantPattern);
    if (cardMatch && cardMatch[1]) {
      const rawMerchant = cardMatch[1].trim();
      const merchant = this.cleanKotakCardMerchant(rawMerchant);
      if (this.isValidMerchantName(merchant)) {
        return merchant;
      }
    }

    // Pattern 1: "Sent Rs.X from Kotak Bank AC XXXX to merchant@bank on"
    // Pattern 2: "Received Rs.X in your Kotak Bank AC XXXX from merchant@bank on"
    const toPattern = /to\s+([^\s]+@[^\s]+)\s+on/i;
    const fromPattern = /from\s+([^\s]+@[^\s]+)\s+on/i;

    const upiMatch = message.match(toPattern) || message.match(fromPattern);
    if (upiMatch && upiMatch[1]) {
      const upiId = upiMatch[1].trim();

      if (upiId.toLowerCase().startsWith('upi')) {
        const name = upiId.substring(3).split('@')[0];
        if (name.length > 0) return this.cleanMerchantName(name);
      } else {
        const name = upiId.split('@')[0] || '';
        const bankCode = upiId.split('@')[1] || '';

        if (this.isPaymentAppGeneratedId(name)) {
          return this.extractMerchantFromBankCode(bankCode) || this.cleanMerchantName(name);
        } else if (name.length > 0 && /^[\d\-_]+$/.test(name)) {
          return this.extractMerchantFromBankCode(bankCode) || upiId;
        } else if (name.length > 0) {
          return upiId; // Return the full UPI ID as requested
        }
      }
    }

    return super.extractMerchant(message, sender);
  }

  private cleanKotakCardMerchant(rawMerchant: string): string {
    const upiRefPattern = /^UPI-\d+-(.+)$/i;
    let match = rawMerchant.match(upiRefPattern);
    if (match && match[1]) {
      return this.cleanMerchantName(match[1].trim());
    }
    return this.cleanMerchantName(rawMerchant);
  }

  private isPaymentAppGeneratedId(name: string): boolean {
    const lowerName = name.toLowerCase();
    const generatedIdPrefixes = [
      'paytmqr', 'phonepeqr', 'phonepe.qr', 'gpay', 'amazonpayqr',
      'bhimqr', 'bharatpeqr', 'freechargeqr', 'mobikwikqr'
    ];

    if (generatedIdPrefixes.some(prefix => lowerName.startsWith(prefix))) {
      return true;
    }

    if (name.length > 20 && /[a-zA-Z]/.test(name) && /\d/.test(name)) {
      return true;
    }
    return false;
  }

  private extractMerchantFromBankCode(bankCode: string): string | null {
    const map: Record<string, string> = {
      'okaxis': 'Axis Bank',
      'okbizaxis': 'Axis Bank Business',
      'okhdfcbank': 'HDFC Bank',
      'okicici': 'ICICI Bank',
      'oksbi': 'State Bank of India',
      'paytm': 'Paytm',
      'ybl': 'PhonePe',
      'amazonpay': 'Amazon Pay',
      'googlepay': 'Google Pay',
      'airtel': 'Airtel Money',
      'freecharge': 'Freecharge',
      'mobikwik': 'MobiKwik',
      'jupiteraxis': 'Jupiter',
      'razorpay': 'Razorpay',
      'bharatpe': 'BharatPe'
    };
    return map[bankCode.toLowerCase()] || null;
  }

  extractTransactionType(message: string): TransactionType | null {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('avl limit') || lowerMessage.includes('avl lmt')) {
      return TransactionType.CREDIT;
    }

    if (lowerMessage.includes('credit card') && (lowerMessage.includes('spent') || lowerMessage.includes('debited'))) {
      return TransactionType.CREDIT;
    }

    if (lowerMessage.includes('sent') && lowerMessage.includes('from kotak')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('debited')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('withdrawn')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('spent')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('charged')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('paid')) return TransactionType.EXPENSE;
    if (lowerMessage.includes('purchase')) return TransactionType.EXPENSE;

    if (lowerMessage.includes('credited')) return TransactionType.INCOME;
    if (lowerMessage.includes('deposited')) return TransactionType.INCOME;
    if (lowerMessage.includes('received')) return TransactionType.INCOME;
    if (lowerMessage.includes('refund')) return TransactionType.INCOME;
    if (lowerMessage.includes('cashback') && !lowerMessage.includes('earn cashback')) return TransactionType.INCOME;

    return null;
  }

  extractReference(message: string): string | null {
    const upiRefPattern = /UPI\s+Ref\s+([0-9]+)/i;
    let match = message.match(upiRefPattern);
    if (match && match[1]) {
      return match[1].trim();
    }
    return super.extractReference(message);
  }

  extractAccountLast4(message: string): string | null {
    const sup = super.extractAccountLast4(message);
    if (sup) return sup;

    const kotakCardPattern = /Credit\s+Card\s+[xX*]*(\d{4})/i;
    const cardMatch = message.match(kotakCardPattern);
    if (cardMatch && cardMatch[1]) return cardMatch[1];

    const kotakAccountPattern = /AC\s+[X*]*([0-9]{4})(?:\s|,|\.)/i;
    const acctMatch = message.match(kotakAccountPattern);
    if (acctMatch && acctMatch[1]) return acctMatch[1];

    return null;
  }

  extractAvailableLimit(message: string): number | null {
    const patterns = [
      /Avl\s+limit:?\s*INR\s+([0-9,]+(?:\.\d{2})?)/i,
      /Avl\s+Lmt:?\s*INR\s+([0-9,]+(?:\.\d{2})?)/i,
      /Available\s+limit:?\s*INR\s+([0-9,]+(?:\.\d{2})?)/i
    ];

    for (const pattern of patterns) {
      let match = message.match(pattern);
      if (match && match[1]) {
        const limitStr = match[1].replace(/,/g, '');
        const num = parseFloat(limitStr);
        if (!isNaN(num)) return num;
      }
    }
    return super.extractAvailableLimit(message);
  }

  isTransactionMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('otp') ||
        lowerMessage.includes('one time password') ||
        lowerMessage.includes('verification code') ||
        lowerMessage.includes('offer') ||
        lowerMessage.includes('discount') ||
        lowerMessage.includes('cashback offer') ||
        lowerMessage.includes('win ')) {
      return false;
    }

    if (lowerMessage.includes('has requested') ||
        lowerMessage.includes('payment request') ||
        lowerMessage.includes('collect request') ||
        lowerMessage.includes('requesting payment') ||
        lowerMessage.includes('requests rs') ||
        lowerMessage.includes('ignore if already paid')) {
      return false;
    }

    const kotakTransactionKeywords = [
      'sent', 'debited', 'credited', 'withdrawn', 'deposited',
      'spent', 'received', 'transferred', 'paid'
    ];

    return kotakTransactionKeywords.some(kw => lowerMessage.includes(kw));
  }
}