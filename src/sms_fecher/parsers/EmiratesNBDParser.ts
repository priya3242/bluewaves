import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { UAEBankParser } from './UAEBankParser';

/**
 * Parser for Emirates NBD Bank (UAE) transactions.
 * Handles credit card and account transactions
 * in AED and other currencies.
 */
export class EmiratesNBDParser extends UAEBankParser {

    getBankName() {
        return "Emirates NBD";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender
            .toUpperCase()
            .replace(/\s+/g, "");

        return (
            normalizedSender.includes("EMIRATESNBD") ||
            normalizedSender.includes("ENBD") ||
            normalizedSender.includes("EMIRATESNB")
        );
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        return (
            lowerMessage.includes("purchase of") ||
            lowerMessage.includes("debited") ||
            lowerMessage.includes("credited") ||
            lowerMessage.includes("withdrawn") ||
            lowerMessage.includes("deposited") ||
            lowerMessage.includes("transfer")
        );
    }

    // extractAmount handled by UAEBankParser

    extractMerchant(message: string, sender: string): string | null {
        const lowerMessage = message.toLowerCase();

        // Pattern:
        // "at MERCHANT_NAME. Avl"

        const atPattern =
            /at\s+(.+?)(?:\.\s*Avl|$)/i;

        let match = message.match(atPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Pattern:
        // "to MERCHANT"

        const toPattern =
            /to\s+([A-Z][A-Z0-9\s]+?)(?:\s+on|\s+\(|$)/i;

        match = message.match(toPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Pattern:
        // "ending 9074"

        const endingPattern =
            /ending\s+(\d{4})/i;

        let match = message.match(endingPattern);

        if (match) {
            return match[1];
        }

        // Pattern:
        // "xxxx9074"

        const accountPattern =
            /[xX]{4}(\d{4})/i;

        match = message.match(accountPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const balancePatterns = [

            // "Avl Bal is AED 1,234.56"

            /(?:Avl\s+Bal|Available\s+Balance)(?:\s+is)?\s*([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i,

            // "Available Balance: AED 1,234.56"

            /Available\s+Balance:\s*([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of balancePatterns) {
            const match = message.match(pattern);

            if (match) {
                const balanceStr =
                    match[2].replace(/,/g, "");

                const num = parseFloat(balanceStr);

                return isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    extractAvailableLimit(message: string): number | null {

        const limitPatterns = [

            // "Avl Cr. Limit is AED 30,978.13"

            /Avl\s+Cr\.?\s+Limit(?:\s+is)?\s*([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i,

            // "Available Credit Limit: AED 30,978.13"

            /Available\s+Credit\s+Limit:\s*([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of limitPatterns) {
            const match = message.match(pattern);

            if (match) {
                const limitStr =
                    match[2].replace(/,/g, "");

                const num = parseFloat(limitStr);

                return isNaN(num) ? null : num;
            }
        }

        return super.extractAvailableLimit(message);
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("credited")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("deposited")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("refund")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("cashback")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("received")) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes("purchase of") &&
            lowerMessage.includes("credit card")
        ) {
            return TransactionType.CREDIT;
        }

        if (lowerMessage.includes("debited")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("withdrawn")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("transfer")) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }
}