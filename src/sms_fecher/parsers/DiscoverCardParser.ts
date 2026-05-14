import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Discover Card - handles USD credit card transactions
 */
export class DiscoverCardParser extends BankParser {

    getBankName() {
        return "Discover Card";
    }

    getCurrency() {
        return "USD";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            upperSender === "DISCOVER" ||
            upperSender.includes("DISCOVERCARD") ||
            upperSender === "347268" || // DLT sender ID
            /^[A-Z]{2}-DISCOVER-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {

        // Examples:
        // "A transaction of $25.00"
        // "transaction of $5.36"

        const patterns = [
            /transaction of\s+\$([0-9,]+(?:\.[0-9]{2})?)/i,
            /A transaction of\s+\$([0-9,]+(?:\.[0-9]{2})?)/i,
            /\$([0-9,]+(?:\.[0-9]{2})?)\s+at/i
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

        if (lowerMessage.includes("discover card alert")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("transaction of")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("transaction")) {
            return TransactionType.EXPENSE;
        }

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {

        // Pattern:
        // "transaction of $25.00 at WWW.XXX.ORG"

        const atPattern =
            /at\s+([^\s]+(?:\s+[^\s]*)*?)(?:\s+on|\s+Text|$)/i;

        let match = message.match(atPattern);

        if (match) {
            const merchant = match[1].trim();

            if (
                merchant.length > 0 &&
                !/\w+\s+\d{1,2},\s+\d{4}/i.test(merchant)
            ) {
                return this.cleanMerchantName(merchant);
            }
        }

        // PAYPAL merchant format
        // "at PAYPAL *SParkXXX"

        const paypalPattern =
            /at\s+(PAYPAL\s+\*[^\s]+)/i;

        match = message.match(paypalPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractReference(message: string): string | null {

        // Example:
        // "on February 21, 2025"

        const datePattern =
            /on\s+(\w+\s+\d{1,2},\s+\d{4})/i;

        const match = message.match(datePattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Skip STOP messages unless transaction exists

        if (lowerMessage.includes("text stop to end")) {
            if (!lowerMessage.includes("transaction of")) {
                return false;
            }
        }

        const discoverTransactionKeywords = [
            "discover card alert:",
            "transaction of",
            "no action needed",
            "see it at https://app.discover.com"
        ];

        if (
            discoverTransactionKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}