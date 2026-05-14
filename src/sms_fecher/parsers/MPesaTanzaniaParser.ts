import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for M-Pesa Tanzania (Vodacom) mobile money SMS messages
 */
export class MPesaTanzaniaParser extends BankParser {

    getBankName() {
        return "M-Pesa Tanzania";
    }

    getCurrency() {
        return "TZS";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("MPESA") ||
            normalizedSender.includes("M-PESA") ||
            normalizedSender === "MPESA" ||
            normalizedSender === "M-PESA" ||
            normalizedSender.includes("VODACOM")
        );
    }

    parse(smsBody: string, sender: string, timestamp: number): ParsedTransaction | null {
        if (!smsBody.includes("TZS")) {
            return null;
        }

        return super.parse(smsBody, sender, timestamp);
    }

    extractAmount(message: string): number | null {

        const tzsSpacePattern = /TZS\s+([0-9,]+(?:\.[0-9]{2})?)/i;
        let match = message.match(tzsSpacePattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        const tzsNoSpacePattern = /TZS([0-9,]+(?:\.[0-9]{2})?)/i;
        match = message.match(tzsNoSpacePattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("received tzs")) return TransactionType.INCOME;
        if (lower.includes("sent to")) return TransactionType.EXPENSE;
        if (lower.includes("paid to")) return TransactionType.EXPENSE;
        if (lower.includes("withdrawn")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string): string | null {

        const fromPattern = /from\s+([A-Z][A-Za-z\s]+?)(?:\s*\(|$)/i;
        let match = message.match(fromPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        const sentToPattern = /sent to\s+([A-Z][A-Za-z\s]+?)(?:\s*\(|$)/i;
        match = message.match(sentToPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        const paidToMerchantPattern = /paid to\s+([A-Za-z0-9\s]+?)(?:\s*\(Merchant|\s+on|\s*$)/i;
        match = message.match(paidToMerchantPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        const utilityPattern = /paid to\s+(\w+)\s+for\s+account/i;
        match = message.match(utilityPattern);
        if (match) {
            return match[1].trim();
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const balancePattern = /New M-Pesa balance is TZS\s*([0-9,]+(?:\.[0-9]{2})?)/i;
        const match = message.match(balancePattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractReference(message: string): string | null {

        const txnIdPattern = /^([A-Z0-9]{10})\s+Confirmed/i;
        let match = message.match(txnIdPattern);
        if (match) return match[1];

        const txnIdAltPattern = /^([A-Z0-9]{10})\s+Confirmed\./i;
        match = message.match(txnIdAltPattern);
        if (match) return match[1];

        const tipsPattern = /TIPS\s+Reference[:\s]+([A-Z0-9]+)/i;
        match = message.match(tipsPattern);
        if (match) return match[1];

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (!lower.includes("confirmed")) return false;
        if (!lower.includes("tzs")) return false;

        const transactionKeywords = [
            "received",
            "sent to",
            "paid to",
            "withdrawn",
            "new m-pesa balance"
        ];

        return transactionKeywords.some(k => lower.includes(k));
    }

    // FIXED: proper method definition (your version was invalid TS)
    protected cleanMerchantName(merchant: string): string {
        return merchant
            .replace(/\s*\(.*?\)\s*$/i, "")
            .replace(/\s+on\s+\d{4}.*/i, "")
            .replace(/\s+at\s+\d{2}:\d{2}.*/i, "")
            .replace(/\s*-\s*$/i, "")
            .trim();
    }
}