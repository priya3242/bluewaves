import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for STC Bank (Saudi Arabia).
 */
export class STCBankParser extends BankParser {

    getBankName(): string {
        return "STC Bank";
    }

    getCurrency(): string {
        return "SAR";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase().replace(/[\s\-_]/g, "");
        return (
            normalized.includes("STCBANK") ||
            normalized === "STC" ||
            normalized === "STCPAY"
        );
    }

    extractAmount(message: string): number | null {
        // "Amount: 3 SAR"
        const amountPattern = /Amount\s*:?\s*([0-9,]+(?:\.\d{1,2})?)\s*SAR/i;
        let match = message.match(amountPattern);

        if (match) {
            const value = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(value) ? null : value;
        }

        // "SAR 3.00"
        const sarFirstPattern = /SAR\s+([0-9,]+(?:\.\d{1,2})?)/i;
        match = message.match(sarFirstPattern);

        if (match) {
            const value = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(value) ? null : value;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("purchase")) return TransactionType.EXPENSE;
        if (lower.includes("withdrawal") || lower.includes("withdraw")) return TransactionType.EXPENSE;
        if (lower.includes("payment")) return TransactionType.EXPENSE;
        if (lower.includes("debit")) return TransactionType.EXPENSE;
        if (lower.includes("transfer out") || lower.includes("sent to")) return TransactionType.EXPENSE;

        if (lower.includes("refund")) return TransactionType.INCOME;
        if (lower.includes("deposit")) return TransactionType.INCOME;
        if (lower.includes("received")) return TransactionType.INCOME;
        if (lower.includes("credit") && !lower.includes("credit card")) return TransactionType.INCOME;

        return null;
    }

    extractMerchant(message: string): string | null {
        // From:
        const fromPattern = /From\s*:\s*([^\n]+?)(?:\n|At\s*:|$)/i;
        let match = message.match(fromPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        // To:
        const toPattern = /To\s*:\s*([^\n]+?)(?:\n|At\s*:|$)/i;
        match = message.match(toPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {
        // **4561 or *4561
        const starPattern = /\*+(\d{4})\b/i;
        let match = message.match(starPattern);
        if (match) return match[1];

        // Via:4561
        const viaPattern = /Via\s*:\s*(\d{4})/i;
        match = message.match(viaPattern);
        if (match) return match[1];

        return super.extractAccountLast4(message);
    }

    detectIsCard(message: string): boolean {
        if (/\*+\d{4}/i.test(message)) return true;
        if (/Via\s*:\s*\d{4}/i.test(message)) return true;

        return super.detectIsCard(message);
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (
            lower.includes("otp") ||
            lower.includes("verification code") ||
            lower.includes("one time password")
        ) {
            return false;
        }

        const keywords = [
            "purchase",
            "amount",
            "withdraw",
            "transfer",
            "payment",
            "refund",
            "deposit",
            "debit",
            "credit",
            "sar"
        ];

        return keywords.some(k => lower.includes(k));
    }
}