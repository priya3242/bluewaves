import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Al Rajhi Bank (Saudi Arabia) SMS messages
 *
 * Supported formats (Arabic):
 * - Purchase: "شراء ... بـSAR 5.75 لـMERCHANT"
 * - Online purchase: "شراء انترنت ... بـSAR 140 لـMERCHANT"
 * - ATM withdrawal: "سحب:صراف آلي ... مبلغ:SAR 100 مكان السحب:LOCATION"
 * - Outgoing local transfer: "حوالة محلية صادرة ... مبلغ:SAR 100 الى:RECIPIENT"
 * - Incoming local transfer: "حوالة محلية واردة ... مبلغ:SAR 7714.80 من:SENDER"
 * - Outgoing internal transfer: "حوالة داخلية صادرة ... بـSAR 200"
 * - Incoming internal transfer: "حوالة داخلية واردة ... بـSAR 1170"
 * - Loan installment: "خصم: قسط تمويل ... القسط: 2304.58 SAR"
 * - Bill payment: "سداد فاتورة"
 *
 * Sender: AlRajhiBank
 */
export class AlRajhiBankParser extends BankParser {
    getBankName() {
        return "Al Rajhi Bank";
    }

    getCurrency() {
        return "SAR";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();
        return (
            normalized.includes("ALRAJHI") ||
            normalized.includes("RAJHI") ||
            sender.includes("الراجحي")
        );
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "بـSAR 5.75" or "بـSAR 140"
        const bPattern = /بـSAR\s+([0-9,]+(?:\.\d{1,2})?)/i;
        let match = message.match(bPattern);
        if (match) {
            return this.parseSarAmount(match[1]);
        }

        // Pattern 2: "مبلغ:SAR 100" or "مبلغ: SAR 100"
        const amountPattern = /مبلغ:\s*SAR\s+([0-9,]+(?:\.\d{1,2})?)/i;
        match = message.match(amountPattern);
        if (match) {
            return this.parseSarAmount(match[1]);
        }

        // Pattern 3: "القسط: 2304.58 SAR" (loan installment)
        const installmentPattern = /القسط:\s*([0-9,]+(?:\.\d{1,2})?)\s*SAR/i;
        match = message.match(installmentPattern);
        if (match) {
            return this.parseSarAmount(match[1]);
        }

        return null;
    }

    private parseSarAmount(raw: string): number | null {
        const cleaned = raw.replace(/,/g, "");
        const num = parseFloat(cleaned);
        return Number.isNaN(num) ? null : num;
    }

    extractTransactionType(message: string): TransactionType | null {
        if (message.includes("واردة")) return TransactionType.INCOME;
        if (message.includes("شراء")) return TransactionType.EXPENSE;
        if (message.includes("سحب")) return TransactionType.EXPENSE;
        if (message.includes("صادرة")) return TransactionType.EXPENSE;
        if (message.includes("خصم")) return TransactionType.EXPENSE;
        if (message.includes("سداد")) return TransactionType.EXPENSE;
        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: "لـMERCHANT"
        const toPattern = /لـ([^\n*]+?)(?:\n|\d{2}\/\d|$)/i;
        let match = message.match(toPattern);
        if (match) {
            const raw = match[1].trim();

            // Skip if it looks like an account/metadata blob
            const looksLikeMaskedData = /^[*\d;\s]+$/.test(raw);
            if (!looksLikeMaskedData) {
                const merchant = raw.includes(";")
                    ? this.cleanMerchantName(raw.substring(raw.indexOf(";") + 1).trim())
                    : this.cleanMerchantName(raw);

                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }
        }

        // Pattern 2: "الى:MERCHANT"
        const toColonPattern = /الى:([^\n]+?)(?:\n|الى:|الرسوم:|$)/;
        match = message.match(toColonPattern);
        if (match) {
            const raw = match[1].trim();
            const looksLikeMaskedData = /^[*\d\s]+$/.test(raw);
            if (!looksLikeMaskedData) {
                const merchant = this.cleanMerchantName(raw);
                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }
        }

        // Pattern 3: "مكان السحب:LOCATION"
        const atmPattern = /مكان السحب:([^\n]+?)(?:\n|$)/;
        match = message.match(atmPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 4: "من:SENDER"
        const fromPattern = /من:([^\n*]+?)(?:\n|\d{2}\/\d|$)/;
        match = message.match(fromPattern);
        if (match) {
            const raw = match[1].trim();
            const looksLikeMaskedData = /^[*\d\s]+$/.test(raw);
            if (!looksLikeMaskedData) {
                const merchant = this.cleanMerchantName(raw);
                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }
        }

        // Pattern 5: "من****;NAME"
        const fromInlinePattern = /من\*+;(.+?)(?:\n|\d{2}\/\d|$)/;
        match = message.match(fromInlinePattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // ATM fallback
        if (message.includes("صراف آلي")) {
            return "ATM Withdrawal";
        }

        return super.extractMerchant(message, sender);
    }

    extractBalance(message: string): number | null {
        // Pattern: "المبلغ المتبقي: SAR 13827.48"
        const remainingPattern = /المبلغ المتبقي:\s*SAR\s+([0-9,]+(?:\.\d{1,2})?)/i;
        const match = message.match(remainingPattern);
        if (match) {
            return this.parseSarAmount(match[1]);
        }

        return super.extractBalance(message);
    }

    detectIsCard(message: string): boolean {
        // مدى = Mada (Saudi debit card network)
        if (message.includes("مدى") || message.includes("بطاقة")) {
            return true;
        }
        return super.detectIsCard(message);
    }

    isTransactionMessage(message: string): boolean {
        // Skip OTP / verification
        if (
            message.includes("رمز") ||
            message.includes("OTP") ||
            message.includes("كلمة المرور")
        ) {
            return false;
        }

        const keywords = [
            "شراء",
            "سحب",
            "حوالة",
            "خصم",
            "سداد",
            "SAR"
        ];

        return keywords.some(keyword => message.includes(keyword));
    }
}