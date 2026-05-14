import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Priorbank (Belarus) SMS messages
 */
export class PriorbankParser extends BankParser {

    getBankName() {
        return "Priorbank";
    }

    getCurrency() {
        return "BYN";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();

        return (
            normalized.includes("PRIORBANK")
        );
    }

    extractAmount(message: string): number | null {
        const pattern = /Oplata\s+([0-9]+(?:\.\d{2})?)\s+BYN/i;

        const match = message.match(pattern);
        if (match) {
            const num = parseFloat(match[1]);
            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("oplata")) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("popolnenie") ||
            lower.includes("zachislenie")
        ) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractMerchant(message: string): string | null {

        // Pattern 1: quoted merchant "KFC Zavod"
        const quoted = /"([^"]+)"/i;
        let match = message.match(quoted);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        // Pattern 2: after BYN.
        const location = /BYN\.\s+([^.]+?)\.\s+Dostupno/i;
        match = message.match(location);

        if (match) {
            let merchant = match[1].trim();
            merchant = merchant.replace(/^BLR\s+/i, "");

            merchant = this.cleanMerchantName(merchant);

            if (this.isValidMerchantName(merchant)) return merchant;
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {

        const base = super.extractAccountLast4(message);
        if (base) return base;

        const pattern = /Karta\s+[6-9][\*]+(\d{4})/i;

        const match = message.match(pattern);
        if (match) {
            return match[1];
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const pattern = /Dostupno:\s+([0-9]+(?:\.\d{2})?)\s+BYN/i;

        const match = message.match(pattern);
        if (match) {
            const num = parseFloat(match[1]);
            return isNaN(num) ? null : num;
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (
            lower.includes("otp") ||
            lower.includes("kod") ||
            lower.includes("parol")
        ) {
            return false;
        }

        const keywords = [
            "oplata",
            "karta",
            "dostupno"
        ];

        if (keywords.some(k => lower.includes(k))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}