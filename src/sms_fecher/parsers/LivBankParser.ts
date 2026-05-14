import { TransactionType } from '../core/types';
import { UAEBankParser } from './UAEBankParser';

/**
 * Parser for Liv Bank (UAE)
 * Handles AED and multi-currency card/account transactions.
 */
export class LivBankParser extends UAEBankParser {

    getBankName(): string {
        return "Liv Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender
            .toUpperCase()
            .replace(/\s+/g, "");

        return (
            normalizedSender === "LIV" ||
            normalizedSender.includes("LIV") ||
            /^[A-Z]{2}-LIV-[A-Z]$/i.test(normalizedSender)
        );
    }

    public isTransactionMessage(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        const blockedKeywords = [
            "otp",
            "one time password",
            "verification code",
            "do not share",
            "activation",
            "has been blocked",
            "has been activated",
            "failed",
            "declined",
            "insufficient balance"
        ];

        if (
            blockedKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return false;
        }

        const livTransactionKeywords = [
            "has been credited",
            "purchase of",
            "debit card ending",
            "credit card ending"
        ];

        if (
            livTransactionKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    public extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("purchase of")) {

            const merchantPattern =
                /at\s+([^,]+?)(?:,|\s+Avl|\.\s|$)/i;

            let match = message.match(merchantPattern);

            if (match?.[1]) {

                const merchant = match[1].trim();

                if (
                    merchant.length > 0 &&
                    !merchant.includes("Avl Balance")
                ) {
                    return this.cleanMerchantName(merchant);
                }
            }

            const fallbackPattern =
                /at\s+([^.]+?)(?:\s+Avl|,|$)/i;

            match = message.match(fallbackPattern);

            if (match?.[1]) {

                const merchant = match[1].trim();

                if (merchant.length > 0) {
                    return this.cleanMerchantName(merchant);
                }
            }
        }

        if (lowerMessage.includes("has been credited")) {
            return "Account Credit";
        }

        return super.extractMerchant(message, sender);
    }

    public extractAccountLast4(
        message: string
    ): string | null {

        const baseResult =
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        const cardPattern =
            /(?:Debit|Credit)\s+Card ending\s+(\d{4})/i;

        let match = message.match(cardPattern);

        if (match?.[1]) {
            return match[1];
        }

        const accountPattern =
            /account\s+([0-9A-Z]+)/i;

        match = message.match(accountPattern);

        if (match?.[1]) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    public extractBalance(
        message: string
    ): number | null {

        const balancePatterns = [

            /Current balance is\s+([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i,

            /Avl Balance is\s+([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i,

            /Balance:?\s+([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of balancePatterns) {

            const match = message.match(pattern);

            if (match?.[2]) {

                const balanceStr =
                    match[2].replace(/,/g, "");

                const num = parseFloat(balanceStr);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractBalance(message);
    }

    public extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("has been credited") ||
            lowerMessage.includes("credited to account") ||
            lowerMessage.includes("refund") ||
            lowerMessage.includes("cashback")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes("purchase of") ||
            lowerMessage.includes("debited") ||
            lowerMessage.includes("withdrawn")
        ) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    public detectIsCard(
        message: string
    ): boolean {

        const lowerMessage = message.toLowerCase();

        return (
            lowerMessage.includes("debit card ending") ||
            lowerMessage.includes("credit card ending") ||
            (
                lowerMessage.includes("purchase of") &&
                lowerMessage.includes("card")
            ) ||
            super.detectIsCard(message)
        );
    }

    protected containsCardPurchase(
        message: string
    ): boolean {

        const lowerMessage = message.toLowerCase();

        return (
            lowerMessage.includes("purchase of") &&
            (
                lowerMessage.includes("debit card ending") ||
                lowerMessage.includes("credit card ending")
            )
        );
    }

    public extractCurrency(
        message: string
    ): string | null {

        const currencyPatterns = [

            /purchase of\s+([A-Z]{3})\s+[\d,]+(?:\.\d{2})?/i,

            /([A-Z]{3})\s+[\d,]+(?:\.\d{2})?\s+has been credited/i,

            /([A-Z]{3})\s+[\d,]+(?:\.\d{2})?/i
        ];

        for (const pattern of currencyPatterns) {

            const match = message.match(pattern);

            if (match?.[1]) {

                const currencyCode =
                    match[1].toUpperCase();

                if (
                    /^[A-Z]{3}$/.test(currencyCode) &&
                    !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currencyCode)
                ) {
                    return currencyCode;
                }
            }
        }

        return "AED";
    }
}