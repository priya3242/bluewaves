import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Bank Muscat (Oman) SMS messages
 *
 * Supported formats (Arabic):
 * - Debit: "تم خصم OMR 0.650 من حسابك رقم XXXXX بإستخدام بطاقة الخصم المباشر في MERCHANT بتاريخ DATE. رصيدك الحالي هو BALANCE OMR."
 * - Credit: "تم إيداع OMR X.XXX في حسابك رقم XXXXX بتاريخ DATE. رصيدك الحالي هو BALANCE OMR."
 *
 * Currency: OMR (Omani Rial)
 * Sender: BankMuscat, BKMUSCAT, bank muscat
 */
export class BankMuscatParser extends BankParser {
    getBankName() {
        return "Bank Muscat";
    }

    getCurrency() {
        return "OMR";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();
        return (
            normalized.includes("MUSCAT") ||
            normalized.includes("BKMUSCAT") ||
            normalized.includes("BANKMUSCAT") ||
            normalized.includes("BK MUSCAT") ||
            sender.includes("بنك مسقط")
        );
    }

    isTransactionMessage(message: string): boolean {
        return (
            message.includes("تم خصم") ||
            message.includes("تم إيداع") ||
            message.includes("تم تحويل") ||
            message.includes("تم سداد")
        );
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "OMR 0.650"
        const omrBeforePattern = /OMR\s+([\d,]+(?:\.\d+)?)/i;

        // Pattern 2: "0.650 OMR"
        const omrAfterPattern = /([\d,]+(?:\.\d+)?)\s+OMR/i;

        let match = message.match(omrBeforePattern);
        if (match) {
            return this.parseAmount(match[1]);
        }

        match = message.match(omrAfterPattern);
        if (match) {
            return this.parseAmount(match[1]);
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        if (message.includes("تم خصم")) return TransactionType.EXPENSE;
        if (message.includes("تم إيداع")) return TransactionType.INCOME;
        if (message.includes("تم تحويل")) return TransactionType.TRANSFER;
        if (message.includes("تم سداد")) return TransactionType.EXPENSE;
        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Merchant is between "في" (at) and "بتاريخ" (on date)
        const merchantPattern = /في\s+(.+?)\s+بتاريخ/i;
        const match = message.match(merchantPattern);

        if (!match) {
            return super.extractMerchant(message, sender);
        }

        const raw = match[1].trim();

        // Remove leading/trailing reference numbers like "757487-" or "-650068"
        const cleaned = raw
            .replace(/^\d{4,}-/i, "")
            .replace(/-\d{4,}$/i, "")
            .replace(/-\d{4,}\s/i, " ")
            .trim();

        if (cleaned.length > 0) {
            return this.cleanMerchantName(cleaned);
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        // "حسابك رقم XXXXXXXX1234" or "حسابك رقم XXXXX"
        const accountPattern = /حسابك رقم\s+([X*\d]+)/i;
        const match = message.match(accountPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return super.extractAccountLast4(message);
    }

    extractBalance(message: string): number | null {
        // "رصيدك الحالي هو 9999.740 OMR"
        const balancePattern = /رصيدك الحالي هو\s+([\d,]+(?:\.\d+)?)\s*OMR/i;
        let match = message.match(balancePattern);

        if (match) {
            return this.parseAmount(match[1]);
        }

        // "رصيدك الحالي هو OMR 9999.740"
        const balancePattern2 = /رصيدك الحالي هو\s+OMR\s*([\d,]+(?:\.\d+)?)/i;
        match = message.match(balancePattern2);

        if (match) {
            return this.parseAmount(match[1]);
        }

        return null;
    }

    detectIsCard(message: string): boolean {
        return (
            message.includes("بطاقة الخصم المباشر") ||
            message.includes("بطاقة الائتمان") ||
            message.includes("بطاقة")
        );
    }

    private parseAmount(raw: string): number | null {
        const num = parseFloat(raw.replace(/,/g, ""));
        return Number.isNaN(num) ? null : num;
    }
}