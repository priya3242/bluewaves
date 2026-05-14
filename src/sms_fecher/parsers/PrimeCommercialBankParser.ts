import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

export class PrimeCommercialBankParser extends BankParser {

    getBankName() {
        return "Prime Commercial Bank";
    }

    getCurrency() {
        return "NPR";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase().replace(/-/g, "_");

        return (
            normalized.includes("PCBLNPKA") ||
            normalized === "PRIME_ALERT" ||
            normalized.includes("PRIME")
        );
    }

    extractAmount(message: string): number | null {
        const pattern = /NPR\s+([0-9,]+\.\d{2})/i;

        const match = message.match(pattern);
        if (!match) return null;

        const num = parseFloat(match[1].replace(/,/g, ""));
        return isNaN(num) ? null : num;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("withdrawn")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("deposited")) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractMerchant(message: string): string | null {
        const pattern = /Rmk:\s*([^.\s]+)/i;

        const match = message.match(pattern);
        if (match) {
            return match[1].trim();
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {
        const pattern = /#(\d{4})/i;

        const match = message.match(pattern);
        if (match) {
            return match[1];
        }

        return null;
    }

    extractReference(message: string): string | null {
        // Example: on 12/05/2026 14:33
        const pattern = /on\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i;

        const match = message.match(pattern);
        if (match) {
            return match[1];
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        return (
            lower.includes("npr") &&
            (lower.includes("withdrawn") || lower.includes("deposited"))
        );
    }
}