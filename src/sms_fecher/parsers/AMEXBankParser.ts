import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for American Express (AMEX) card SMS messages
 *
 * Supported formats:
 * - Spending:
 *   "Alert: You've spent INR 1,017.70 on your AMEX card ** 91000 at VOUCHER PLAT on 20 August 2025"
 *
 * Common senders:
 * - TX-AMEXIN-S
 * - AMEXIN
 * - AMEX
 */
export class AMEXBankParser extends BankParser {
    getBankName() {
        return "American Express";
    }

    getCurrency() {
        return "INR";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("AMEX") ||
            normalizedSender.includes("AMEXIN") ||

            // DLT patterns for transactions
            /^[A-Z]{2}-AMEXIN-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-AMEX-S$/i.test(normalizedSender) ||

            // OTP / Promotional / Govt
            /^[A-Z]{2}-AMEXIN-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-AMEX-[TPG]$/i.test(normalizedSender) ||

            // Legacy patterns
            /^[A-Z]{2}-AMEXIN$/i.test(normalizedSender) ||
            /^[A-Z]{2}-AMEX$/i.test(normalizedSender) ||

            normalizedSender === "AMEXIN" ||
            normalizedSender === "AMEX"
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {
        const parsed = super.parse(smsBody, sender, timestamp);

        if (!parsed) {
            return null;
        }

        // AMEX transactions are credit card transactions
        return {
            ...parsed,
            type: TransactionType.CREDIT
        };
    }

    extractAmount(message: string): number | null {
        // Pattern: "You've spent INR 1,017.70"
        const spentPattern =
            /spent\s+INR\s+([0-9,]+(?:\.\d{2})?)\s+on/i;

        let match = message.match(spentPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);

            return Number.isNaN(num) ? null : num;
        }

        // Pattern: "INR 1,017.70 spent"
        const altSpentPattern =
            /INR\s+([0-9,]+(?:\.\d{2})?)\s+spent/i;

        match = message.match(altSpentPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);

            return Number.isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern:
        // "at VOUCHER PLAT on 20 August"
        const merchantPattern =
            /at\s+([^•\n]+?)\s+on\s+\d{1,2}\s+\w+/i;

        const match = message.match(merchantPattern);

        if (match) {
            const merchant = this.cleanMerchantName(
                match[1].trim()
            );

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Pattern:
        // "AMEX card ** 91000"
        const cardPattern =
            /AMEX\s+card\s+\*+\s*(\d+)/i;

        let match = message.match(cardPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Pattern:
        // "card ending 1234"
        const endingPattern =
            /card\s+ending\s+(\d{4})/i;

        match = message.match(endingPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Ignore non-transaction/promotional messages
        if (
            lowerMessage.includes("offer") ||
            lowerMessage.includes("reward") ||
            lowerMessage.includes("membership") ||
            lowerMessage.includes("statement") ||
            lowerMessage.includes("due date")
        ) {
            return false;
        }

        // Explicit AMEX spending detection
        if (
            lowerMessage.includes("spent inr") ||
            lowerMessage.includes("you've spent")
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}