import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Punjab National Bank (PNB) SMS messages
 */
export class PNBBankParser extends BaseIndianBankParser {

    getBankName() {
        return "Punjab National Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("PUNJAB NATIONAL BANK") ||
            normalizedSender.includes("PNBBNK") ||
            normalizedSender.includes("PUNBN") ||
            normalizedSender.includes("PNBSMS") ||
            /^[A-Z]{2}-PNBBNK-S$/.test(normalizedSender) ||
            /^[A-Z]{2}-PNB-S$/.test(normalizedSender) ||
            /^[A-Z]{2}-PNBBNK$/.test(normalizedSender) ||
            /^[A-Z]{2}-PNB$/.test(normalizedSender) ||
            normalizedSender === "PNBBNK" ||
            normalizedSender === "PNB"
        );
    }

    parse(smsBody: string, sender: string, timestamp: number) {
        const normalizedBody = this.normalizeUnicodeText(smsBody);
        return super.parse(normalizedBody, sender, timestamp);
    }

    private normalizeUnicodeText(text: string): string {
        return text
            .normalize("NFKD")
            .replace(/[^\x00-\x7F]/g, "");
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /debited\s+for\s+(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)/i,
            /initial\s+amount\s+of\s+(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)\s+has\s+been\s+debited/i,
            /debited\s+(?:with\s+)?(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited\s+(?:with\s+)?(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)/
        ];

        for (const regex of patterns) {
            const match = message.match(regex);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ""));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (this.isUPIMandateNotification(message)) return null;

        if (lower.includes("auto pay facility") && lower.includes("debited")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("debited")) return TransactionType.EXPENSE;
        if (lower.includes("credited")) return TransactionType.INCOME;

        return super.extractTransactionType(message);
    }

    private isUPIMandateNotification(message: string): boolean {
        const lower = message.toLowerCase();
        return (
            (lower.includes("upi-mandate") || lower.includes("upi mandate")) &&
            lower.includes("successfully created")
        );
    }

    parseUPIMandateSubscription(message: string) {

        if (!this.isUPIMandateNotification(message)) return null;

        const amountMatch = message.match(/for\s+(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)/i);
        const amount = amountMatch
            ? parseFloat(amountMatch[1].replace(/,/g, ""))
            : null;

        const merchantMatch = message.match(/towards\s+(.+?)\s+for/i);
        const merchantRaw = merchantMatch ? merchantMatch[1].trim() : null;

        const merchant =
            merchantRaw && this.isValidMerchantName(merchantRaw)
                ? this.cleanMerchantName(merchantRaw)
                : null;

        const umnMatch = message.match(/UMN:?\s*([^\s.]+)/i);
        const umn = umnMatch ? umnMatch[1] : null;

        return {
            amount,
            nextDeductionDate: null,
            merchant,
            umn
        };
    }

    extractMerchant(message: string, sender: string): string | null {

        if (message.includes("IMPS")) {
            return "IMPS Transfer";
        }

        const autoPay = /auto\s+pay.*?from\s+([^.]+?)(?:\s+An\s+initial|\.|$)/i;
        let match = message.match(autoPay);
        if (match) return match[1].trim();

        const upiMandate = /UPI-Mandate.*towards\s+(.+?)\s+for/i;
        match = message.match(upiMandate);
        if (match) return match[1].trim();

        const card = /thru\s+card\s+([X*]+\d{4})/i;
        match = message.match(card);
        if (match) {
            return `Card ${match[1]}`;
        }

        if (message.includes("PNB ATM")) {
            return "PNB ATM Withdrawal";
        }

        if (message.includes("NEFT")) {
            return "NEFT Transfer";
        }

        if (message.includes("UPI")) {
            return "UPI Transaction";
        }

        return super.extractMerchant(message, sender); // ✅ FIXED
    }

    extractAccountLast4(message: string): string | null {

        const acNo = /(?:a\/c\s+no|A\/c)\s+[X*]+(\d{2,4})/i;
        let match = message.match(acNo);
        if (match) return match[1];

        const acGeneric = /(?:A\/c(?:\s*No\.)?|Ac|Card)\s*(?:[X*]+)?(\d{4,16})/i;
        match = message.match(acGeneric);
        if (match) {
            return match[1].slice(-4);
        }

        return super.extractAccountLast4(message);
    }

    extractReference(message: string): string | null {

        if (message.includes("IMPS")) {

            const impsRef = message.match(/IMPS\s+\w*\s*Ref\s*(?:no\.?\s*)?(\d{6,})/i);
            if (impsRef) return impsRef[1];

            const fallback = message.match(/IMPS[^0-9]*(\d{12,})/i);
            if (fallback) return fallback[1];
        }

        const neft = message.match(/ref\s+no\.?\s*([A-Z0-9]+)/i);
        if (neft) return neft[1];

        const upi = message.match(/UPI\s+Ref\s+ID:?\s*(\d+)/i);
        if (upi) return upi[1];

        const base = super.extractReference(message);
        return base === "PNB" ? null : base;
    }

    extractBalance(message: string): number | null {

        const patterns = [
            /(?:Avl|Aval)\s+Bal\s*(?:INR|Rs\.?)?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Bal\s*([0-9,]+(?:\.\d{2})?)\s*(?:CR|DR)?/i
        ];

        for (const regex of patterns) {
            const match = message.match(regex);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ""));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (this.isUPIMandateNotification(message)) return false;

        // Standard robust negative filters and action keywords
        if (super.isTransactionMessage(message)) return true;

        // Only add PNB-specific ACTION keywords here, not generic terms like "upi"
        const pnbKeywords = [
            "auto pay facility",
            "auto pay"
        ];

        return pnbKeywords.some(k => lower.includes(k));
    }
}