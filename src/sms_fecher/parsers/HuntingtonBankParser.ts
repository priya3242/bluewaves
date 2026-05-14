import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Huntington Bank SMS messages (USA)
 *
 * Supported formats:
 * - Debit card: "Huntington Heads Up. We processed a debit card withdrawal: $25.00 at Bob Inc. Acct CK0000 has a $10.12 bal (10/19/25 5:43 AM ET)."
 * - ATM: "Huntington Heads Up. We processed an ATM withdrawal: $162.45 at POS John Inc. Acct CK0000 has a $20.20 bal (9/03/25 12:12 PM ET)."
 * - ACH: "Huntington Heads Up. We processed an ACH withdrawal: $50.67 at GEICO. Acct CK0000 has a $6211.32 bal (8/09/25 3:23 PM ET)."
 *
 * Common senders: Huntington Bank, HUNTINGTON
 */
export class HuntingtonBankParser extends BankParser {

    getBankName(): string {
        return "Huntington Bank";
    }

    getCurrency(): string {
        return "USD";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            upperSender.includes("HUNTINGTON") ||
            upperSender === "HUNTINGTON BANK" ||
            /^[A-Z]{2}-HUNTINGTON-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {
        // Pattern: "withdrawal: $25.00 at"
        const withdrawalPattern =
            /withdrawal:\s+\$([0-9,]+(?:\.\d{2})?)\s+at/i;

        const match = message.match(withdrawalPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);

            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        // Huntington uses withdrawal wording for expenses
        if (
            lowerMessage.includes("withdrawal") ||
            lowerMessage.includes("debit card withdrawal") ||
            lowerMessage.includes("atm withdrawal") ||
            lowerMessage.includes("ach withdrawal")
        ) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Example:
        // "at Bob Inc. Acct"
        // "at BC *UBER CASH. Acct"
        // "at POS John Inc. Acct"

        const merchantPattern = /at\s+(.+?)\.\s+Acct/i;

        const match = message.match(merchantPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

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

        // Pattern: "Acct CK0000"
        const accountPattern = /Acct\s+CK(\d{4})/i;

        let match = message.match(accountPattern);

        if (match) {
            return match[1];
        }

        // Generic account ending pattern
        const endingPattern = /account\s+ending\s+(\d{4})/i;

        match = message.match(endingPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    extractBalance(message: string): number | null {
        // Pattern:
        // "has a $10.12 bal"
        // "has a -$15.01 bal"

        const balancePattern =
            /has\s+a\s+(-?\$[0-9,]+(?:\.\d{2})?)\s+bal/i;

        const match = message.match(balancePattern);

        if (match) {
            const balanceStr = match[1]
                .replace(/\$/g, "")
                .replace(/,/g, "");

            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Ignore generic alerts without transaction info
        if (
            lowerMessage.includes("heads up") &&
            !lowerMessage.includes("withdrawal")
        ) {
            return false;
        }

        const huntingtonTransactionKeywords = [
            "we processed a debit card withdrawal",
            "we processed an atm withdrawal",
            "we processed an ach withdrawal"
        ];

        if (
            huntingtonTransactionKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    detectIsCard(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("debit card withdrawal") ||
            lowerMessage.includes("atm withdrawal")
        ) {
            return true;
        }

        if (lowerMessage.includes("ach withdrawal")) {
            return false;
        }

        return super.detectIsCard(message);
    }
}