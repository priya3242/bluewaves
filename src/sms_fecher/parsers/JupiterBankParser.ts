import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';






/**
 * Parser for Jupiter Bank (CSB Bank partner) SMS messages
 *
 * Jupiter is a digital banking app powered by CSB Bank.
 *
 * Supported formats:
 * - Credit card transactions: "Rs.130.00 debited to your Edge CSB Bank RuPay Credit Card"
 * - UPI transactions
 * - Account debits/credits
 *
 * Common senders: JTEDGE, JUPITER, variations with DLT patterns
 */
export class JupiterBankParser extends BankParser {

    getBankName() {
        return "Jupiter";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase()
        return /^[A-Z]{2}-JTEDGE-S$/i.test(normalizedSender) ||
                /^[A-Z]{2}-JTEDGE-T$/i.test(normalizedSender) ||
                // Legacy patterns
                /^[A-Z]{2}-JTEDGE$/i.test(normalizedSender)
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "Rs.130.00 debited"
        const debitPattern = /Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+debited/i
        let match = message.match(debitPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
        return isNaN(num) ? null : num;
        }

        // Pattern 2: "Rs.XXX credited"
        const creditPattern = /Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+credited/i
        match = message.match(creditPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
        return isNaN(num) ? null : num;
        }

        // Fall back to base class patterns
        return super.extractAmount(message)
    }

    extractMerchant(message: string, sender: string): string | null {
        return super.extractMerchant(message, sender)
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase()

        if (lowerMessage.includes("credit card") &&
            (lowerMessage.includes("debited") || lowerMessage.includes("spent") || lowerMessage.includes("charged"))) {
            return TransactionType.CREDIT
        }

        return super.extractTransactionType(message)
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;
        // Pattern 1: "ending 6852"
        const endingPattern = /ending\s+(\d{4})/i
        let match = message.match(endingPattern);
        if (match) {
            return match[1]
        }

        // Pattern 2: "Card ending 6852"
        const cardEndingPattern = /Card\s+ending\s+(\d{4})/i
        match = message.match(cardEndingPattern);
        if (match) {
            return match[1]
        }

        return null
    }

    extractReference(message: string): string | null {
        // Pattern: "UPI Ref no.281751568470"
        const upiRefPattern = /UPI\s+Ref\s+no\.?\s*([A-Za-z0-9]+)/i
        let match = message.match(upiRefPattern);
        if (match) {
            return match[1]
        }

        // Fall back to base class
        return super.extractReference(message)
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase()

        // Skip dispute instructions (not a transaction)
        if (lowerMessage.includes("to dispute") && lowerMessage.includes("call")) {
            // This is just instruction text, don't skip the entire message
        }

        // Check for Jupiter-specific transaction keywords
        if (lowerMessage.includes("jupiter") || lowerMessage.includes("csb")) {
            // If it's from Jupiter/CSB and has transaction keywords, it's likely valid
            return super.isTransactionMessage(message)
        }

        // Fall back to base class for standard checks
        return super.isTransactionMessage(message)
    }
}
