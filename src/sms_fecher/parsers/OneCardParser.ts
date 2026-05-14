import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for OneCard credit card SMS messages
 */
export class OneCardParser extends BankParser {

    getBankName() {
        return "OneCard";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("ONECRD") ||
            normalizedSender.includes("ONECARD") ||

            // DLT patterns for transactions (-S suffix)
            /^[A-Z]{2}-ONECRD-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ONECARD-S$/i.test(normalizedSender) ||

            // Other DLT patterns (OTP, Promotional, Govt)
            /^[A-Z]{2}-ONECRD-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ONECARD-[TPG]$/i.test(normalizedSender) ||

            // Legacy patterns without suffix
            /^[A-Z]{2}-ONECRD$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ONECARD$/i.test(normalizedSender) ||

            // Direct sender IDs
            normalizedSender === "ONECRD" ||
            normalizedSender === "ONECARD"
        );
    }

    parse(smsBody: string, sender: string, timestamp: number): ParsedTransaction | null {
        const parsed = super.parse(smsBody, sender, timestamp);
        if (!parsed) return null;

        return {
            ...parsed,
            type: TransactionType.CREDIT
        };
    }

    extractAmount(message: string): number | null {

        const forAmountPattern = /for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+at/i;
        let match = message.match(forAmountPattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        const ofAmountPattern = /of\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+on/i;
        match = message.match(ofAmountPattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        const spentPattern = /spent\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;
        match = message.match(spentPattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        const atMerchantOnCardPattern = /at\s+([^•\n]+?)\s+on\s+card/i;
        let match = message.match(atMerchantOnCardPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        const merchantPattern = /on\s+([^•\n]+?)\s+on\s+card/i;
        match = message.match(merchantPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        const atMerchantPattern = /at\s+([^•\n]+?)\s+on/i;
        match = message.match(atMerchantPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) return merchant;
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const cardPatterns = [
            /card\s+ending\s+([X\d]+)/i,
            /on\s+card\s+([X\d]+)/i
        ];

        for (const pattern of cardPatterns) {
            const match = message.match(pattern);
            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (
            lower.includes("offer") ||
            lower.includes("cashback offer") ||
            lower.includes("get reward") ||
            lower.includes("statement") ||
            lower.includes("due date") ||
            lower.includes("bill generated")
        ) {
            return false;
        }

        if (
            lower.startsWith("you've") &&
            lower.includes("on card ending")
        ) {
            return true;
        }

        if (
            lower.includes("spent") ||
            lower.includes("made a")
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}