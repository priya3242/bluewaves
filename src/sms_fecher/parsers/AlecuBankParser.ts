import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

export class AlecuBankParser extends BankParser {

    getBankName() {
        return "ALECU";
    }

    getCurrency() {
        return "USD";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();
        return normalized === "39872" ||
                normalized.includes("ALECU") ||
                normalized.includes("ALEC");
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();
        if (lower.includes("otp") || lower.includes("verification code")) {
            return false;
        }
        return lower.includes("alec alert") && lower.includes("transaction from");
    }

    extractAmount(message: string): number | null {
        const amountPattern = /\$([0-9,]+(?:\.\d{2})?)/i;
        const match = message.match(amountPattern);
        if (match) {
            const amountStr = match[1].replace(/,/g, "");
            const num = parseFloat(amountStr);
            return isNaN(num) ? null : num;
        }
        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();
        if (lower.includes("a debit transaction")) return TransactionType.EXPENSE;
        if (lower.includes("a credit transaction")) return TransactionType.INCOME;
        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        const merchantPattern = /transaction\s+from\s+(.+?)\s+for\s+\$/i;
        const match = message.match(merchantPattern);
        if (match) {
            const raw = match[1].trim();
            const cleaned = raw.split(";")[0].trim();
            const merchant = this.cleanMerchantName(cleaned);
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }
        return null;
    }

    extractAccountLast4(message: string): string | null {
        const accountPattern = /account\s+\*(\d+=\d+)/i;
        const match = message.match(accountPattern);
        if (match) {
            const raw = match[1].replace("=", "");
            if (raw.length > 0) return raw;
        }
        return super.extractAccountLast4(message);
    }
}