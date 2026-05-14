import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Old Hickory Credit Union (USA) - handles USD currency transactions
 */
export class OldHickoryParser extends BankParser {

    getBankName() {
        return "Old Hickory Credit Union";
    }

    getCurrency() {
        return "USD";
    }

    canHandle(sender: string): boolean {
        const cleanSender = sender.replace(/\D/g, "");

        if (cleanSender === "8775907589") return true;

        const upper = sender.toUpperCase();

        if (
            upper === "OLDHICKORY" ||
            upper === "OHCU" ||
            upper.includes("HICKORY") ||
            upper.includes("OLD HICKORY")
        ) return true;

        if (/^[A-Z]{2}-HICKORY-[A-Z]$/.test(upper)) return true;

        return false;
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /\$([0-9,]+(?:\.[0-9]{2})?)/i,
            /transaction for\s+\$([0-9,]+(?:\.[0-9]{2})?)/i,
            /posted.*?\$([0-9,]+(?:\.[0-9]{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ""));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (
            lower.includes("transaction") && lower.includes("posted")
        ) return TransactionType.EXPENSE;

        if (lower.includes("has posted")) return TransactionType.EXPENSE;
        if (lower.includes("transaction for")) return TransactionType.EXPENSE;

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        const accountPattern = /posted to\s+([^(]+)/i;
        const match = message.match(accountPattern);

        if (match) {
            const accountName = match[1].trim();
            return `Account: ${this.cleanMerchantName(accountName)}`;
        }

        return "Transaction Alert";
    }

    extractAccountLast4(message: string): string | null {

        const base = super.extractAccountLast4(message);
        if (base) return base;

        const match = message.match(/\(part of\s+([^)]+)\)/i);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractReference(message: string): string | null {

        const match = message.match(
            /above the\s+\$([0-9,]+(?:\.[0-9]{2})?)\s+value you set/i
        );

        if (match) {
            return `Alert threshold: $${match[1]}`;
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        const keywords = [
            "transaction",
            "has posted",
            "posted to",
            "above the",
            "value you set",
            "account name"
        ];

        return keywords.some(k => lower.includes(k))
            || super.isTransactionMessage(message);
    }
}