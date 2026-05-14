import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for AU Small Finance Bank SMS messages
 *
 * Supported formats:
 * - Credit transactions: "Credited INR XXX to A/c XXXXX on DD-MM-YYYY Ref UPI/XX/XXXXXXXXXX/XXX XXX XX(name of the account). Bal INR XXX"
 * - Debit transactions: "Debited INR XXX from A/c XXXXX on DD-MM-YYYY..."
 * - ATM withdrawals and other transactions
 *
 * Sender patterns: XX-AUBANK-S/T, AUSFB, AU-BANK, etc.
 */
export class AUBankParser extends BaseIndianBankParser {
    getBankName() {
        return "AU Small Finance Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return normalizedSender.includes("AUBANK");
    }

    extractAmount(message: string): number | null {
        // Pattern 1: Credited INR XXX
        const creditedPattern = /Credited\s+INR\s+([0-9,]+(?:\.\d{2})?)\s+to/i;
        let match = message.match(creditedPattern);
        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        // Pattern 2: Debited INR XXX
        const debitedPattern = /Debited\s+INR\s+([0-9,]+(?:\.\d{2})?)\s+from/i;
        match = message.match(debitedPattern);
        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        // Pattern 3: INR XXX spent
        const spentPattern = /INR\s+([0-9,]+(?:\.\d{2})?)\s+spent/i;
        match = message.match(spentPattern);
        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        // Pattern 4: withdrawn INR XXX
        const withdrawnPattern = /withdrawn\s+INR\s+([0-9,]+(?:\.\d{2})?)/i;
        match = message.match(withdrawnPattern);
        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 0: Credit card format - "spent at MERCHANT on"
        const spentAtPattern = /spent\s+at\s+(.+?)\s+on\s+(?:AU\s+Bank|$)/i;
        let match = message.match(spentAtPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 1: UPI/DR or UPI/CR format without Ref prefix
        const upiDrCrPattern = /UPI\/(?:DR|CR)\/\d+\/([^\/]+)\/[A-Z]{4}\d*\/\d+/i;
        match = message.match(upiDrCrPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 2: UPI transactions with Ref UPI
        const upiPattern = /Ref\s+UPI\/[^\/]+\/[^\/]+\/[^\/]+\s+([^(]+)\([^)]+\)/i;
        match = message.match(upiPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 3: Alternative UPI format - name in parentheses
        const upiParenPattern = /UPI\/[^\/]+\/[^\/]+\/[^\/]+\s+[^(]*\(([^)]+)\)/i;
        match = message.match(upiParenPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 4: ATM transactions
        if (message.includes("ATM") || message.includes("withdrawn")) {
            return "ATM Withdrawal";
        }

        // Pattern 5: General "to/from" patterns
        const toPattern = /(?:to|from)\s+([^.\n]+?)(?:\.\s*|$)/i;
        match = message.match(toPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant) && !merchant.includes("A/c")) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("credit card")) return TransactionType.CREDIT;
        if (lowerMessage.includes("credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("received")) return TransactionType.INCOME;
        if (lowerMessage.includes("deposited")) return TransactionType.INCOME;
        if (lowerMessage.includes("refund")) return TransactionType.INCOME;
        if (lowerMessage.includes("debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("withdrawn")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("spent")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("paid")) return TransactionType.EXPENSE;

        return super.extractTransactionType(message);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // Pattern: "A/c XXXXX" or "A/c X7013"
        const accountPattern = /A\/c\s+[A-Za-z]*(\d+)/i;
        const match = message.match(accountPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractBalance(message: string): number | null {
        // Pattern: "Bal INR XXX"
        const balancePattern = /Bal\s+INR\s+([0-9,]+(?:\.\d{2})?)/i;
        const match = message.match(balancePattern);
        if (match) {
            const balance = match[1].replace(/,/g, "");
            const num = parseFloat(balance);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Skip OTP and promotional messages
        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("one time password") ||
            lowerMessage.includes("verification code")
        ) {
            return false;
        }

        // Check for AU Bank specific transaction keywords
        const auBankKeywords = [
            "credited inr",
            "debited inr",
            "withdrawn inr",
            "bal inr",
            "ref upi",
            "spent"
        ];

        // If any AU Bank specific pattern is found, it's likely a transaction
        if (auBankKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }

        // Fall back to base class for standard checks
        return super.isTransactionMessage(message);
    }
}