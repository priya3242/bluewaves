import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for DBS Bank (Development Bank of Singapore) SMS messages
 */
export class DBSBankParser extends BankParser {

    getBankName() {
        return "DBS Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("DBSBNK") ||
            normalizedSender.includes("DBS") ||
            normalizedSender === "DBSBANK" ||

            // DLT patterns
            /^[A-Z]{2}-DBSBNK-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-DBS-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-DBSBANK-[ST]$/i.test(normalizedSender)
        );
    }

    extractAmount(message: string): number | null {

        // Examples:
        // "debited with INR 11"
        // "credited with INR 100"

        const patterns = [
            /(?:debited|credited)\s+with\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,
            /INR\s*([0-9,]+(?:\.\d{2})?)\s+(?:debited|credited)/i
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

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Examples:
        // "account no ********1234"
        // "a/c ****1234"

        const patterns = [
            /account\s+no\s+\*+(\d{4})/i,
            /a\/c\s+\*+(\d{4})/i,
            /account\s+\*+(\d{4})/i
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

        // Examples:
        // "Current Balance is INR37888.45"
        // "Balance: INR 1000"

        const patterns = [
            /Current\s+Balance\s+is\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,
            /Balance[:\s]+INR\s*([0-9,]+(?:\.\d{2})?)/i,
            /Avl\s+Bal[:\s]+INR\s*([0-9,]+(?:\.\d{2})?)/i
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

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("debited")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("credited")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("withdrawn")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("deposited")) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }
}