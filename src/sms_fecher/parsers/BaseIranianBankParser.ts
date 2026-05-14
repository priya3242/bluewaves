import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Base class for Iranian bank parsers to share common logic.
 * Handles common Persian language transaction patterns and IRR currency.
 */
export abstract class BaseIranianBankParser extends BankParser {
    getCurrency() {
        return "IRR";
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "مبلغ 1,500,000 ریال" or "مبلغ 1,500,000 تومان"
        const patterns = [
            /مبلغ\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ریال|تومان)/i,
            // Pattern 2: amount followed directly by keyword
            /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ریال|تومان)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const cleanAmount = match[1].replace(/,/g, "");
                const amountValue = parseFloat(cleanAmount);

                if (!Number.isNaN(amountValue) && amountValue >= 1000) {
                    return amountValue;
                }
            }
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (this.isInvestmentTransaction(lowerMessage)) {
            return TransactionType.INVESTMENT;
        }

        if (lowerMessage.includes("مصرف")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("credited") && !lowerMessage.includes("block")) return TransactionType.INCOME;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        const cardPattern = /(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})/i;
        const match = message.match(cardPattern);

        if (match) {
            return `Card ${match[1]}`;
        }

        return super.extractMerchant(message, sender);
    }

    extractReference(message: string): string | null {
        return null;
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const cardPattern = /\d{4}[-\s]?(\d{4})/i;
        const match = message.match(cardPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const balancePattern = /مانده\s*:?\s*(\d{1,3}(?:,\d{3})*)/i;
        const match = message.match(balancePattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    detectIsCard(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const cardKeywords = [
            "کارت",
            "card",
            "debit card",
            "credit card",
            "کارت بدهی",
            "کارت اعتباری"
        ];

        return cardKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("رمز یکبار مصرف") ||
            lowerMessage.includes("کد تایید")
        ) {
            return false;
        }

        if (
            lowerMessage.includes("تبلیغ") ||
            lowerMessage.includes("پیشنهاد") ||
            lowerMessage.includes("تخفیف") ||
            lowerMessage.includes("cashback offer")
        ) {
            return false;
        }

        if (lowerMessage.includes("درخواست") && lowerMessage.includes("پرداخت")) {
            return false;
        }

        const transactionKeywords = [
            "مبلغ",
            "ریال",
            "تومان",
            "IRR",
            "TOMAN",
            "برداشت",
            "واریز",
            "پرداخت",
            "خرید",
            "انتقال",
            "debit",
            "credit",
            "spent",
            "received",
            "transferred",
            "paid"
        ];

        return transactionKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    protected cleanMerchantName(merchant: string): string {
        return merchant.trim();
    }

    protected isValidMerchantName(name: string): boolean {
        const commonWords = [
            "USING",
            "VIA",
            "THROUGH",
            "BY",
            "WITH",
            "FOR",
            "TO",
            "FROM",
            "AT",
            "THE",
            "استفاده",
            "از",
            "توسط",
            "از طریق",
            "برای",
            "به",
            "در",
            "و",
            "با"
        ];

        return (
            name.length >= 2 &&
            /[A-Za-zآ-ی]/.test(name) &&
            !commonWords.includes(name.toUpperCase()) &&
            !/^\d+$/.test(name) &&
            !name.includes("@")
        );
    }
}