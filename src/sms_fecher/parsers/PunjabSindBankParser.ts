import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Punjab & Sind Bank (PSB)
 */
export class PunjabSindBankParser extends BaseIndianBankParser {

    getBankName() {
        return "Punjab & Sind Bank";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();

        return (
            normalized.includes("PSBANK") ||
            normalized.includes("PUNJAB&SIND") ||
            normalized.includes("PUNJAB & SIND")
        );
    }

    extractAmount(message: string): number | null {
        const pattern = /(?:Credited|Debited)\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(pattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractAccountLast4(message: string): string | null {
        const pattern = /A\/[Cc]\s+No\s+\*+(\d{2,})/i;

        const match = message.match(pattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return super.extractAccountLast4(message);
    }

    extractBalance(message: string): number | null {
        const pattern = /CLR\s+BAL\s+([0-9,]+(?:\.\d{2})?)\s*(?:CR|DR)?/i;

        const match = message.match(pattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        let match: RegExpMatchArray | null;

        const neftRef = /NEFT\/([A-Z0-9]+)/i;
        match = message.match(neftRef);
        if (match) return match[1];

        const upiRef = /UPI\/(?:CR|DR)\/(\d+)/i;
        match = message.match(upiRef);
        if (match) return match[1];

        const chequeRef = /(?:Credit|Debit)\s+of\s+(\d+)/i;
        match = message.match(chequeRef);
        if (match) return match[1];

        const psbRef = /\b(PSB\d{10,})\b/i;
        match = message.match(psbRef);
        if (match) return match[1];

        return super.extractReference(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // UPI merchant
        const upiMerchant = /UPI\/(?:CR|DR)\/\d+\/([^\/]+)\//i;
        let match = message.match(upiMerchant);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        // NEFT merchant
        const neftMerchant = /NEFT\/[A-Z0-9]+\/([^(\r\n]+?)(?=\s*\(|\s*$)/i;
        match = message.match(neftMerchant);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        // Cheque pattern
        const chequePattern = /(Credit|Debit)\s+of\s+\d+/i;
        match = message.match(chequePattern);

        if (match) {
            return match[1].toLowerCase() === "credit"
                ? "Cheque Credit"
                : "Cheque Debit";
        }

        // Generic description fallback
        const descPattern =
            /(?:Credited|Debited)\s+with\s+Rs\.?\s*[0-9,]+(?:\.\d{2})?\s*--\s*([^(\r\n]+?)\s*\(CLR\s+BAL/i;

        match = message.match(descPattern);

        if (match) {
            const desc = match[1]
                .trim()
                .replace(/-+$/, "");

            const merchant = this.cleanMerchantName(desc);

            if (this.isValidMerchantName(merchant)) return merchant;
        }

        // ✅ FIXED: sender passed
        return super.extractMerchant(message, sender);
    }
}