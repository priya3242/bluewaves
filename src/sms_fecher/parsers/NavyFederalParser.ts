import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Navy Federal Credit Union (NFCU)
 */
export class NavyFederalParser extends BankParser {

    getBankName() {
        return "Navy Federal Credit Union";
    }

    getCurrency() {
        return "USD";
    }

    canHandle(sender: string): boolean {
        const upper = sender.toUpperCase();

        return (
            upper === "NFCU" ||
            upper === "NAVYFED" ||
            upper.includes("NAVY FEDERAL") ||
            upper.includes("NAVYFEDERAL") ||
            /^[A-Z]{2}-NFCU-[A-Z]$/.test(upper)
        );
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /Transaction for \$([0-9,]+(?:\.[0-9]{2})?)\s+was approved/i,
            /Transaction for \$([0-9,]+(?:\.[0-9]{2})?)\s+was declined/i,
            /for \$([0-9,]+(?:\.[0-9]{2})?)\s+was approved/i,
            /for \$([0-9,]+(?:\.[0-9]{2})?)\s+was declined/i
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

    extractMerchant(message: string, sender: string): string | null {

        const merchantPattern =
            /on (?:debit|credit) card \d{4} at (.+?)\s+at \d{2}:\d{2}/i;

        let match = message.match(merchantPattern);
        if (match) return match[1].trim();

        const simplePattern =
            /on (?:debit|credit) card \d{4} at (.+?)(?:\.|$)/i;

        match = message.match(simplePattern);
        if (match) {
            const merchant = match[1]
                .trim()
                .replace(/Txt STOP.*/i, "")
                .trim();

            return merchant;
        }

        return super.extractMerchant(message, sender);
    }

    extractTransactionType(message: string): TransactionType | null {

        const lower = message.toLowerCase();

        if (lower.includes("was approved")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("was declined")) {
            return null;
        }

        if (lower.includes("payment received")) {
            return TransactionType.INCOME;
        }

        if (lower.includes("deposit")) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {

        const base = super.extractAccountLast4(message);
        if (base) return base;

        const patterns = [
            /on debit card (\d{4})/i,
            /on credit card (\d{4})/i,
            /(?:debit|credit) card (\d{4})/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) return match[1];
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {

        const lower = message.toLowerCase();

        const keywords = [
            "transaction for",
            "was approved on",
            "was declined on"
        ];

        if (keywords.some(k => lower.includes(k))) {
            if (lower.includes("was declined")) return false;
            return true;
        }

        return super.isTransactionMessage(message);
    }

    detectIsCard(message: string): boolean {

        const lower = message.toLowerCase();

        if (lower.includes("debit card")) return true;
        if (lower.includes("credit card")) return true;

        return super.detectIsCard(message);
    }
}