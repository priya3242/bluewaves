import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Base abstract class for UAE bank parsers.
 * Handles common patterns across UAE banks (AED currency, specific transaction types, etc.).
 */
export abstract class UAEBankParser extends BankParser {
    /**
     * Checks if the message contains a credit/debit card purchase pattern.
     * Common across UAE banks.
     */
    protected containsCardPurchase(message: string): boolean {
        return (
            message.includes("Credit Card Purchase") ||
            message.includes("Debit Card Purchase")
        );
    }

    parse(smsBody: string, sender: string, timestamp: number): ParsedTransaction | null {
        const transaction = super.parse(smsBody, sender, timestamp);
        if (!transaction) {
            return null;
        }

        const extractedCurrency = this.extractCurrency(smsBody);

        return extractedCurrency
            ? { ...transaction, currency: extractedCurrency }
            : transaction;
    }

    extractCurrency(message: string): string | null {
        const currencyPatterns = [
            /Amount\s+([A-Z]{3})/i,
            /\b([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /for\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /of\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /\b([A-Z]{3})\b/i
        ];

        for (const pattern of currencyPatterns) {
            const found = message.match(pattern);
            if (!found) {
                continue;
            }

            const code = found[1]?.toUpperCase();
            if (code && code.length === 3 && /^[A-Z]{3}$/.test(code) && !this.isMonthAbbreviation(code)) {
                return code;
            }
        }

        return null;
    }

    getCurrency() {
        return "AED";
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /(?:purchase of|transfer of|amount|for|of)\s+([A-Z]{3})\s+([0-9,]+(?:\.\d{2})?)/i,
            /\b([A-Z]{3})\s+([0-9,]+(?:\.\d{2})?)/i,
            /\b([A-Z]{3})\s+\*+([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const currencyCode = match[1].toUpperCase();

                if (this.isMonthAbbreviation(currencyCode)) {
                    continue;
                }

                let amountStr = match[2].replace(/,/g, "");

                if (amountStr.includes("*")) {
                    amountStr = amountStr.replace(/\*/g, "");
                    if (!amountStr || amountStr === ".") {
                        continue;
                    }
                }

                const num = parseFloat(amountStr);
                if (!Number.isNaN(num)) {
                    return num;
                }
            }
        }

        return super.extractAmount(message);
    }

    private isMonthAbbreviation(code: string): boolean {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        return months.includes(code);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("credit card purchase")) return TransactionType.CREDIT;
        if (this.containsCardPurchase(message)) return TransactionType.EXPENSE;
        if (lowerMessage.includes("cheque credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("cheque returned")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("atm") && lowerMessage.includes("withdrawn")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("inward remittance")) return TransactionType.INCOME;
        if (lowerMessage.includes("cash deposit")) return TransactionType.INCOME;
        if (lowerMessage.includes("has been credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("is credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("outward remittance")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("payment instructions")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("funds transfer request")) return TransactionType.TRANSFER;
        if (lowerMessage.includes("has been processed")) return TransactionType.EXPENSE;
        if (!lowerMessage.includes("payment")) return TransactionType.INCOME;
        if (lowerMessage.includes("debit") && !lowerMessage.includes("credit")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("purchase")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("payment")) return TransactionType.EXPENSE;

        return super.extractTransactionType(message);
    }
}