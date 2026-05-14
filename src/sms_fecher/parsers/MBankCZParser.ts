import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for mBank CZ (Czech Republic) SMS messages
 *
 * Supported formats:
 * - Card payment: "Nová platba kartou\n100,00 CZK v obchodě MERCHANT."
 * - Incoming transfer: "Příchozí platba\n500,00 CZK od odesílatele SENDER."
 * - Outgoing transfer: "Odchozí platba\n250,00 CZK na účet ACCOUNT."
 *
 * Notes:
 * - Czech uses comma as decimal separator (100,00)
 * - Currency: CZK (Czech Koruna)
 */
export class MBankCZParser extends BankParser {

    getBankName() {
        return "mBank CZ";
    }

    getCurrency() {
        return "CZK";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();

        return (
            (normalized.includes("MBANK") && normalized.includes("CZ")) ||
            normalized === "MBANK"
        );
    }

    extractAmount(message: string): number | null {
        // Pattern: "100,00 CZK" or "1 500,00 CZK"
        const amountPattern = /(\d[\d\s]*(?:,\d{1,2})?)\s*CZK/i;

        const match = message.match(amountPattern);

        if (match) {
            const amountStr = match[1]
                .replace(/\s/g, "")
                .replace(",", ".");

            const num = parseFloat(amountStr);

            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("příchozí")) {
            return TransactionType.INCOME; // incoming
        }

        if (lower.includes("nová platba kartou")) {
            return TransactionType.EXPENSE; // card payment
        }

        if (lower.includes("odchozí")) {
            return TransactionType.EXPENSE; // outgoing
        }

        if (lower.includes("výběr")) {
            return TransactionType.EXPENSE; // withdrawal
        }

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: "v obchodě MERCHANT." (card payment - "at store")
        const storePattern = /v obchodě\s+(.+?)\./i;

        let match = message.match(storePattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 2: "od odesílatele SENDER." (incoming - "from sender")
        const fromPattern = /od odesílatele\s+(.+?)\./i;

        match = message.match(fromPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 3: "na účet ACCOUNT." (outgoing - "to account")
        const toPattern = /na účet\s+(.+?)\./i;

        match = message.match(toPattern);

        if (match) {
            const raw = match[1].trim();

            if (raw.length > 0) {
                return raw;
            }
        }

        return null;
    }

    detectIsCard(message: string): boolean {
        return message.toLowerCase().includes("platba kartou");
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (
            lower.includes("otp") ||
            lower.includes("heslo") ||
            lower.includes("kód")
        ) {
            return false;
        }

        const keywords = [
            "platba kartou",   // card payment
            "příchozí platba", // incoming payment
            "odchozí platba",  // outgoing payment
            "výběr"            // withdrawal
        ];

        return keywords.some(keyword => lower.includes(keyword));
    }
}