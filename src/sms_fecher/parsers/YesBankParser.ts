import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Yes Bank SMS messages
 *
 * Supported formats:
 * - Credit Card UPI:
 *   "INR XXX.XX spent on YES BANK Card XXXXX @UPI_MERCHANT DATE TIME. Avl Lmt INR XXX,XXX.XX"
 *
 * Common senders: CP-YESBNK-S, VM-YESBNK-S, JX-YESBNK-S
 */
export class YesBankParser extends BaseIndianBankParser {
    getBankName() {
        return "Yes Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            /^[A-Z]{2}-YESBNK-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-YESBNK$/i.test(normalizedSender) ||
            normalizedSender === "YESBNK" ||
            normalizedSender === "YESBANK"
        );
    }

    extractAmount(message: string): number | null {
        // "INR XXX.XX spent"
        const inrSpentPattern =
            /INR\s+([0-9,]+(?:\.\d{2})?)\s+spent/i;

        const match = message.match(inrSpentPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // "@UPI_MERCHANT NAME 12-12-2025"
        const upiMerchantPattern =
            /@UPI_([^0-9]+?)(?:\s+\d{2}-\d{2}-\d{4})/i;

        let match = message.match(upiMerchantPattern);

        if (match) {
            const cleanedMerchant = match[1]
                .replace(/\s+/g, " ")
                .trim();

            if (cleanedMerchant.length > 0) {
                return cleanedMerchant;
            }
        }

        // Alternative format
        const upiMerchantAltPattern =
            /@UPI_([A-Z\s]+)/i;

        match = message.match(upiMerchantAltPattern);

        if (match) {
            const cleanedMerchant = match[1]
                .replace(/\s+/g, " ")
                .trim();

            if (
                cleanedMerchant.length > 0 &&
                this.isValidMerchantName(cleanedMerchant)
            ) {
                return cleanedMerchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) return baseResult;

        // "YES BANK Card XXXXX1234"
        const cardPattern =
            /YES\s+BANK\s+Card\s+([X\d]+)/i;

        let match = message.match(cardPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // "SMS BLKCC 1234"
        const blkccPattern =
            /SMS\s+BLKCC\s+(\d{4})/i;

        match = message.match(blkccPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    extractAvailableLimit(message: string): number | null {
        // "Avl Lmt INR XXX,XXX.XX"
        const avlLmtPattern =
            /Avl\s+Lmt\s+INR\s+([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(avlLmtPattern);

        if (match) {
            const limitStr = match[1].replace(/,/g, "");
            const num = parseFloat(limitStr);

            return Number.isNaN(num) ? null : num;
        }

        return super.extractAvailableLimit(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        // Investment transactions
        if (this.isInvestmentTransaction(lowerMessage)) {
            return TransactionType.INVESTMENT;
        }

        // Credit card transaction
        if (
            lowerMessage.includes("spent") &&
            lowerMessage.includes("yes bank card") &&
            lowerMessage.includes("avl lmt")
        ) {
            return TransactionType.CREDIT;
        }

        if (lowerMessage.includes("debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("withdrawn")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("spent")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("charged")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("paid")) return TransactionType.EXPENSE;

        if (lowerMessage.includes("credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("deposited")) return TransactionType.INCOME;
        if (lowerMessage.includes("received")) return TransactionType.INCOME;
        if (lowerMessage.includes("refund")) return TransactionType.INCOME;

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // OTP / verification
        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("verification") ||
            lowerMessage.includes("one time password")
        ) {
            return false;
        }

        // Promotional
        if (
            lowerMessage.includes("offer") ||
            lowerMessage.includes("cashback offer") ||
            lowerMessage.includes("discount")
        ) {
            return false;
        }

        const yesBankKeywords = [
            "spent on yes bank card",
            "debited",
            "credited",
            "withdrawn",
            "deposited",
            "avl lmt"
        ];

        if (
            yesBankKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    detectIsCard(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("yes bank card")) {
            return true;
        }

        if (lowerMessage.includes("sms blkcc")) {
            return true;
        }

        return super.detectIsCard(message);
    }
}