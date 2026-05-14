import { BankParser } from '../core/BankParser';
import { TransactionType } from '../core/types';

/**
 * Parser for Citi Bank (USA) - handles USD credit card transactions
 */
export class CitiBankParser extends BankParser {
    getBankName() {
        return "Citi Bank";
    }

    getCurrency() {
        return "USD";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return (
            upperSender === "CITI" ||
            upperSender.includes("CITIBANK") ||
            upperSender === "692484" ||
            /^[A-Z]{2}-CITI-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {
        // Citi patterns: "A $3.01 transaction", "$506.39 transaction"
        const patterns = [
            /\$([0-9,]+(?:\.[0-9]{2})?)\s+transaction/i,
            /transaction.*?\$([0-9,]+(?:\.[0-9]{2})?)/i,
            /A\s+\$([0-9,]+(?:\.[0-9]{2})?)\s+transaction/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
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

        if (lowerMessage.includes("transaction was made")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("card ending")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("was not present")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("transaction")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: "transaction was made at BP#1234E"
        const atPattern = /transaction was made at\s+([^.]+?)(?:\s+on|$)/i;
        let match = message.match(atPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Pattern 2: "transaction at WWW Google C"
        const transactionAtPattern = /transaction at\s+([^.]+?)(?:\s+View|\.|$)/i;
        match = message.match(transactionAtPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // Pattern: "card ending in 1234"
        const cardPattern = /card ending in\s+(\d{4})/i;
        const match = message.match(cardPattern);
        if (match) {
            return match[1];
        }

        return null;
    }

    extractReference(message: string): string | null {
        // If the message includes a date, return it as a reference only when useful
        const datePatterns = [
            /\bon\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
            /\bon\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i
        ];

        for (const pattern of datePatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Citi specific transaction keywords
        const citiTransactionKeywords = [
            "citi alert:",
            "transaction was made",
            "card ending",
            "was not present for",
            "view details at citi.com"
        ];

        if (citiTransactionKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}