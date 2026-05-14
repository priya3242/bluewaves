import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

export class SNBAlAhliBankParser extends BankParser {

    getBankName(): string {
        return "Saudi National Bank";
    }

    getCurrency(): string {
        return "SAR";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();

        return (
            normalized.includes("SNB") ||
            normalized.includes("ALAHLI") ||
            normalized.includes("AL-AHLI") ||
            normalized.includes("AL AHLI") ||
            sender.includes("الأهلي")
        );
    }

    extractAmount(message: string): number | null {

        const patterns: RegExp[] = [
            /بـ\s*SAR\s*([0-9,]+(?:\.\d{1,2})?)/i,
            /مبلغ\s*:?\s*SAR\s*([0-9,]+(?:\.\d{1,2})?)/i,
            /SAR\s+([0-9,]+(?:\.\d{1,2})?)/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match?.[1]) {
                return this.parseSarAmount(match[1]);
            }
        }

        return null;
    }

    private parseSarAmount(raw: string): number | null {
        const num = parseFloat(raw.replace(/,/g, ""));
        return isNaN(num) ? null : num;
    }

    extractTransactionType(message: string): TransactionType | null {

        if (message.includes("واردة")) return TransactionType.INCOME;
        if (message.includes("إيداع")) return TransactionType.INCOME;
        if (message.includes("شراء")) return TransactionType.EXPENSE;
        if (message.includes("سحب")) return TransactionType.EXPENSE;
        if (message.includes("صادرة")) return TransactionType.EXPENSE;
        if (message.includes("خصم")) return TransactionType.EXPENSE;
        if (message.includes("سداد")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string): string | null {

        const fromPattern = /من\s+([^\n]+?)(?:\n|$)/i;
        let match = message.match(fromPattern);

        if (match?.[1]) {
            const raw = match[1].trim();

            if (raw && !/^[\d*]+$/.test(raw)) {
                const merchant = this.cleanMerchantName(raw);
                if (this.isValidMerchantName(merchant)) return merchant;
            }
        }

        const toPattern = /الى\s*:?\s*([^\n]+?)(?:\n|$)/i;
        match = message.match(toPattern);

        if (match?.[1]) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        if (message.includes("صراف")) {
            return "ATM Withdrawal";
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {

        const patterns = [
            /مدى\s*\*+\s*(\d{3,4})/i,
            /بطاقة\s*\*+\s*(\d{3,4})/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match?.[1]) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const pattern = /الرصيد(?:\s*المتاح)?\s*:?\s*SAR\s*([0-9,]+(?:\.\d{1,2})?)/i;
        const match = message.match(pattern);

        if (match?.[1]) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return null;
    }

    detectIsCard(message: string): boolean {

        if (
            message.includes("مدى") ||
            message.includes("بطاقة") ||
            message.includes("نقاط بيع") ||
            message.includes("SamsungPay") ||
            message.includes("ApplePay")
        ) {
            return true;
        }

        return super.detectIsCard(message);
    }

    isTransactionMessage(message: string): boolean {

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
            "إيداع",
            "SAR"
        ];

        return keywords.some(k => message.includes(k));
    }
}