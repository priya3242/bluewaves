import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Base class for Thai bank parsers to share common logic.
 * Handles both Thai and English language transaction patterns with THB currency.
 */
export abstract class BaseThailandBankParser extends BankParser {

    getCurrency() {
        return "THB";
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /THB\s*([0-9,]+(?:\.\d{2})?)/i,
            /Amount\s*([0-9,]+(?:\.\d{2})?)\s*THB/i,
            /จำนวนเงิน\s*([0-9,]+(?:\.\d{2})?)/i, // Thai: Amount
            /([0-9,]+(?:\.\d{2})?)\s*บาท/i,       // Thai: Baht
            /([0-9,]+(?:\.\d{2})?)\s*THB/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const amountStr = match[1].replace(/,/g, "");
                const num = parseFloat(amountStr);
                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (this.isInvestmentTransaction(lowerMessage)) {
            return TransactionType.INVESTMENT;
        }

        // Thai transaction keywords
        if (lowerMessage.includes("ถอน") || // Withdraw
            lowerMessage.includes("จ่าย") || // Pay
            lowerMessage.includes("หัก") || // Deduct
            lowerMessage.includes("โอนออก")) { // Transfer out
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("ฝาก") || // Deposit
            lowerMessage.includes("รับโอน") || // Receive transfer
            lowerMessage.includes("เงินเข้า")) { // Money in
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Thai standard merchant format: at [merchant]
        const atPattern = /(?:at|ที่)\s+([^.\n]+)/i;
        let match = message.match(atPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // To [merchant/account]
        const toPattern = /(?:to|ไปยัง)\s+([^.\n]+)/i;
        match = message.match(toPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // PromptPay transfer
        if (message.includes("PromptPay") || message.includes("พร้อมเพย์")) {
            return "PromptPay Transfer";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // Thai patterns
        const patterns = [
            /(?:A\/C|Account|บ\/ช)\s*[:.]?\s*[X*]+(\d{3,4})/i,
            /(?:Card|บัตร)\s*[:.]?\s*[X*]+(\d{3,4})/i,
            /[X*]+(\d{3,4})/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const patterns = [
            /(?:Balance|Avl Bal|ยอดคงเหลือ)\s*[:]?\s*([0-9,]+(?:\.\d{2})?)/i,
            /([0-9,]+(?:\.\d{2})?)\s*(?:THB|บาท)\s*(?:Balance|ยอดคงเหลือ)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match[1].replace(/,/g, "");
                const num = parseFloat(balanceStr);
                return isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // OTP/Verification in Thai or English
        if (lowerMessage.includes("otp") ||
            lowerMessage.includes("รหัสผ่าน") || // Password
            lowerMessage.includes("รหัสความปลอดภัย") || // Security code
            lowerMessage.includes("verification")) {
            return false;
        }

        // Promotional messages
        if (lowerMessage.includes("โปรโมชั่น") || // Promotion
            lowerMessage.includes("สิทธิพิเศษ") || // Privilege
            lowerMessage.includes("ฟรี") || // Free
            lowerMessage.includes("ลดราคา")) { // Discount
            return false;
        }

        // Need transaction keywords in either language
        const transactionKeywords = [
            "ถอน", "จ่าย", "หัก", "โอน", "ฝาก", // Thai verbs
            "จำนวนเงิน", "ยอดเงิน", "บาท", "thb", // Thai nouns/currency
            "debited", "credited", "payment", "transfer"
        ];

        return transactionKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    detectIsCard(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const cardKeywords = [
            "card", "credit", "debit",
            "บัตรเครดิต", // Credit card
            "บัตรเดบิต", // Debit card
            "บัตร" // Card
        ];

        return cardKeywords.some(keyword => lowerMessage.includes(keyword));
    }
}
