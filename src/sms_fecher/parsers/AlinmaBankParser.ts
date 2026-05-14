import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Alinma Bank (Saudi Arabia) SMS messages
 *
 * Handles Arabic text formats:
 * - "شراء محلي من نقاط البيع" = Local purchase from POS
 * - "شراء عبر" = Purchase via
 * - "بمبلغ" / "مبلغ" = Amount
 * - "الرصيد" = Balance
 * - "من" = From (merchant)
 * - Currency: SAR (Saudi Riyal) / ريال سعودي
 */
export class AlinmaBankParser extends BankParser {
    getBankName() {
        return "Alinma Bank";
    }

    getCurrency() {
        return "SAR";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return (
            normalizedSender.includes("ALINMA") ||
            normalizedSender === "ALINMA" ||
            normalizedSender.includes("الإنماء")
        );
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "بمبلغ: XX SAR"
        const amountSARPattern = /بمبلغ:\s*([0-9]+(?:\.[0-9]{2})?)\s*SAR/i;
        let match = message.match(amountSARPattern);
        if (match) {
            const num = parseFloat(match[1]);
            return Number.isNaN(num) ? null : num;
        }

        // Pattern 2: "مبلغ: SAR XXX.XX"
        const amountPattern2 = /مبلغ:\s*SAR\s*([0-9]+(?:\.[0-9]{2})?)/i;
        match = message.match(amountPattern2);
        if (match) {
            const num = parseFloat(match[1]);
            return Number.isNaN(num) ? null : num;
        }

        // Pattern 3: "مبلغ: ريال سعودي XXX.XX"
        const amountArabicPattern = /مبلغ:\s*ريال\s*سعودي\s*([0-9]+(?:\.[0-9]{2})?)/i;
        match = message.match(amountArabicPattern);
        if (match) {
            const num = parseFloat(match[1]);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        // "شراء" means purchase in Arabic - expense
        if (message.includes("شراء") || message.includes("Purchase")) {
            return TransactionType.EXPENSE;
        }

        // "إيداع" typically means deposit/credit
        if (message.includes("إيداع") || message.includes("Deposit")) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: "من: Establishment Name"
        const fromPattern = /من:\s*([^\n]+?)(?:\n|في:)/i;
        let match = message.match(fromPattern);
        if (match) {
            let merchant = match[1].trim();
            merchant = this.cleanMerchantName(merchant);
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 2: "لدى: Commercial Name"
        const atPattern = /لدى:\s*([^\n]+?)(?:\n|في:)/i;
        match = message.match(atPattern);
        if (match) {
            let merchant = match[1].trim();
            merchant = this.cleanMerchantName(merchant);
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Default for POS transactions
        if (message.includes("POS") || message.includes("نقاط البيع")) {
            return "POS Transaction";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // Pattern 1: "حساب: **XXXX"
        const accountPattern = /حساب:\s*\*+(\d{4})/;
        let match = message.match(accountPattern);
        if (match) {
            return match[1];
        }

        // Pattern 2: "حساب: *XXXX"
        const accountPattern2 = /حساب:\s*\*(\d{4})/;
        match = message.match(accountPattern2);
        if (match) {
            return match[1];
        }

        // Pattern 3: "البطاقة: **XXXX"
        const cardPattern = /البطاقة:\s*\*+(\d{4})/;
        match = message.match(cardPattern);
        if (match) {
            return match[1];
        }

        // Pattern 4: "البطاقة الائتمانية: **XXXX"
        const creditCardPattern = /البطاقة الائتمانية:\s*\*+(\d{4})/;
        match = message.match(creditCardPattern);
        if (match) {
            return match[1];
        }

        // Pattern 5: "بطاقة مدى: XXXX*"
        const madaPattern = /بطاقة مدى:\s*(\d{4})\*/;
        match = message.match(madaPattern);
        if (match) {
            return match[1];
        }

        return null;
    }

    extractBalance(message: string): number | null {
        // Pattern 1: "الرصيد: XXX.XX SAR"
        const balanceSARPattern = /الرصيد:\s*([0-9]+(?:\.[0-9]{2})?)\s*SAR/i;
        let match = message.match(balanceSARPattern);
        if (match) {
            const num = parseFloat(match[1]);
            return Number.isNaN(num) ? null : num;
        }

        // Pattern 2: "الرصيد: XXX.XX ريال"
        const balanceRiyalPattern = /الرصيد:\s*([0-9]+(?:\.[0-9]{2})?)\s*ريال/i;
        match = message.match(balanceRiyalPattern);
        if (match) {
            const num = parseFloat(match[1]);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        // Skip OTP messages
        if (
            message.includes("OTP") ||
            message.includes("رمز") ||
            message.includes("كلمة المرور")
        ) {
            return false;
        }

        const transactionKeywords = [
            "شراء",
            "بمبلغ",
            "مبلغ",
            "الرصيد",
            "Purchase",
            "POS"
        ];

        return transactionKeywords.some(keyword => message.includes(keyword));
    }

    detectIsCard(message: string): boolean {
        return (
            message.includes("البطاقة") ||
            message.includes("بطاقة") ||
            message.includes("البطاقة الائتمانية") ||
            message.includes("بطاقة مدى") ||
            message.includes("POS") ||
            message.includes("نقاط البيع")
        );
    }
}