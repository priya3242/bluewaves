import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for NMB Bank (Nepal)
 */
export class NMBBankParser extends BankParser {

    getBankName() {
        return "NMB Bank";
    }

    getCurrency() {
        return "NPR";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();

        return (
            normalized.includes("NMB") ||
            normalized === "NMB_ALERT" ||
            normalized === "NMBBANK" ||
            normalized.includes("NABIL")
        );
    }

    extractAmount(message: string): number | null {

        const nprPattern = /NPR\s+([0-9,]+(?:\.\d{2})?)/i;
        let match = message.match(nprPattern);

        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        const ofPattern = /of\s+([0-9,]+(?:\.\d{2})?)\s+is successful/i;
        match = message.match(ofPattern);

        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {

        const lower = message.toLowerCase();

        if (
            lower.includes("fund transfer") ||
            (lower.includes("transfer") && lower.includes("to a/c"))
        ) return TransactionType.EXPENSE;

        if (lower.includes("withdrawn")) return TransactionType.EXPENSE;

        if (
            lower.includes("wallet load") ||
            lower.includes("esewa wallet")
        ) return TransactionType.EXPENSE;

        if (
            lower.includes("deposited") ||
            lower.includes("credited")
        ) return TransactionType.INCOME;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {

        if (message.includes("Fund transfer") || message.includes("transfer")) {
            return "Fund Transfer";
        }

        if (message.includes("withdrawn")) {

            const atmPattern = /at\s+([^.\n]+?)(?:\s+on|\.)/i;
            const match = message.match(atmPattern);

            if (match) {
                const location = this.cleanMerchantName(match[1].trim());
                if (this.isValidMerchantName(location)) {
                    return `ATM - ${location}`;
                }
            }

            return "ATM Withdrawal";
        }

        const esewaPattern = /Esewa Wallet Load for\s+(\d+)/i;
        let match = message.match(esewaPattern);

        if (match) {
            return "Esewa Wallet Load";
        }

        if (message.includes("Wallet Load")) {
            return "Wallet Load";
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {

        const base = super.extractAccountLast4(message);
        if (base) return base;

        const longPattern = /A\/C\s+(\d{4,})/i;
        let match = message.match(longPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        const hashPattern = /A\/C\s+(\d+)#(\d+)/i;
        match = message.match(hashPattern);

        if (match) {
            return this.extractLast4Digits(match[1] + match[2]);
        }

        const toPattern = /to A\/C\s+(\d+)/i;
        match = message.match(toPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractReference(message: string): string | null {

        const fbsPattern = /\(FBS:D:FPQR:(\d+)\)/i;
        let match = message.match(fbsPattern);

        if (match) return match[1];

        const refPattern = /Ref(?:erence)?[:\s]+([A-Z0-9]+)/i;
        match = message.match(refPattern);

        if (match) return match[1];

        return null;
    }

    isTransactionMessage(message: string): boolean {

        const lower = message.toLowerCase();

        if (
            lower.includes("otp") ||
            lower.includes("password") ||
            (lower.includes("click here to learn more") && !lower.includes("withdrawn"))
        ) {
            if (!lower.includes("withdrawn")) return false;
        }

        const keywords = [
            "fund transfer",
            "withdrawn",
            "deposited",
            "wallet load",
            "successful",
            "credited"
        ];

        return keywords.some(k => lower.includes(k))
            || super.isTransactionMessage(message);
    }
}