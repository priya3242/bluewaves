import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Commercial Bank of Ethiopia (CBE) - handles ETB currency transactions
 */
export class CBEBankParser extends BankParser {
    getBankName() {
        return "Commercial Bank of Ethiopia";
    }

    getCurrency() {
        return "ETB";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return (
            upperSender === "CBE" ||
            upperSender.includes("COMMERCIALBANK") ||
            upperSender.includes("CBEBANK") ||
            /^[A-Z]{2}-CBE-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {
        // Prefer total amount when present in fee/VAT summaries.
        const totalPattern = /with a total of\s+ETB\s*([0-9,]+(?:\.\d{2})?)/i;
        let match = message.match(totalPattern);
        if (match) {
            const amountStr = match[1].replace(/,/g, "");
            const num = parseFloat(amountStr);
            return Number.isNaN(num) ? null : num;
        }

        // For some older CBE debit alerts with receipt links, use current balance as amount.
        const debitedWithBalancePattern =
            /has\s+been\s+debited\s+with\s+ETB\s*[0-9,]+(?:\.\d{2})?\.\s*Your\s+Current\s+Balance\s+is\s+ETB\s*([0-9,]+(?:\.\d{2})?)/i;

        if (message.includes("?id=")) {
            match = message.match(debitedWithBalancePattern);
            if (match) {
                const amountStr = match[1].replace(/,/g, "");
                const num = parseFloat(amountStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        const patterns = [
            /(?:Credited|debited|transfered)\s+(?:with\s+)?ETB\s*([0-9,]+(?:\.\d{2})?)/i,
            /ETB\s+([0-9,]+(?:\.\d{2})?)\s/i,
            /ETB\s*([0-9,]+(?:\.\d{2})?)(?:\s|$|\.)/i
        ];

        for (const pattern of patterns) {
            match = message.match(pattern);
            if (match) {
                const amountStr = match[1].replace(/,/g, "");
                const num = parseFloat(amountStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("has been credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("credited with")) return TransactionType.INCOME;
        if (lowerMessage.includes("has been debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debited with")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("you have transfered")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("transferred")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // "has been credited by PERSON NAME with ETB ..."
        const creditedByPattern = /has\s+been\s+credited\s+by\s+(.+?)\s+with\s+ETB\b/i;
        let match = message.match(creditedByPattern);
        if (match) {
            const merchant = match[1].replace(/\s+/g, " ").trim();
            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        // "to Ali Mohamud on ... from your account"
        const toNamedPattern =
            /to\s+(.+?)\s+on\s+\d{2}\/\d{2}\/\d{4}\s+at\s+\d{2}:\d{2}:\d{2}\s+from\s+your\s+account/i;
        match = message.match(toNamedPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0 && !merchant.includes("*")) {
                return this.cleanMerchantName(merchant);
            }
        }

        // "from Salary Payment, on 15/09/2025"
        const fromCreditWithDatePattern =
            /from\s+(?!your\s+account\b)(.+?),\s+on\s+\d{2}\/\d{2}\/\d{4}/i;
        match = message.match(fromCreditWithDatePattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant.replace(/\*/g, ""));
            }
        }

        // "to Se*****"
        const toPattern = /to\s+([^,\s]+\*{0,5}[^,\s]*)/i;
        match = message.match(toPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant.replace(/\*/g, ""));
            }
        }

        // "has been debited for COMPANY NAME with ETB ..."
        const debitedForMerchantPattern =
            /has\s+been\s+debited\s+for\s+(.+?)\s+with\s+ETB\b/i;
        match = message.match(debitedForMerchantPattern);
        if (match) {
            const merchant = match[1].replace(/\s+/g, " ").trim();
            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const accountPatterns = [
            /Account\s+([\d*]+)/i,
            /your account\s+([\d*]+)/i
        ];

        for (const pattern of accountPatterns) {
            const match = message.match(pattern);
            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const balancePattern =
            /Current Balance is ETB\s+([0-9,]+(?:\.\d{2})?)/i;
        const match = message.match(balancePattern);
        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {
        const refPattern = /Ref No\s+(\*{0,9}[A-Z0-9]+)/i;
        let match = message.match(refPattern);
        if (match) {
            const ref = match[1].replace(/\*/g, "");
            if (ref.length > 0) {
                return ref;
            }
        }

        const urlIdPattern = /id=([A-Z0-9]+)/i;
        match = message.match(urlIdPattern);
        if (match) {
            return match[1];
        }

        const dateTimePattern =
            /on\s+(\d{2}\/\d{2}\/\d{4}\s+at\s+\d{2}:\d{2}:\d{2})/i;
        match = message.match(dateTimePattern);
        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const cbeTransactionKeywords = [
            "dear",
            "your account",
            "has been credited",
            "has been debited",
            "you have transfered",
            "current balance",
            "thank you for banking with cbe",
            "etb"
        ];

        if (cbeTransactionKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}