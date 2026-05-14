import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Everest Bank (Nepal) - NPR transactions
 */
export class EverestBankParser extends BankParser {

    getBankName() {
        return "Everest Bank";
    }

    getCurrency() {
        return "NPR";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            /^\d{7,10}$/i.test(sender) ||
            upperSender === "EVEREST" ||
            upperSender.includes("EVERESTBANK") ||
            upperSender.includes("EBL") ||
            upperSender === "UJJ SH" ||
            upperSender === "CWRD" ||
            /^[A-Z]{2}-EVEREST-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /NPR\s+([0-9,]+(?:\.\d{2})?)/i,
            /NPR\s+([0-9,]+(?:\.\d{2})?)(?:\s|$)/i,
            /(?:debited|credited)\s+by\s+NPR\s+([0-9,]+(?:\.\d{2})?)/i
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

        if (lowerMessage.includes("is debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debited by")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("is credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("credited by")) return TransactionType.INCOME;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {

        const forPattern = /For:\s*([^.]+?)(?:\.\s|$)/i;
        const match = message.match(forPattern);

        if (!match) {
            return super.extractMerchant(message, sender);
        }

        const forContent = match[1].trim();

        // ATM Withdrawal
        if (forContent.startsWith("CWDR/")) {
            return "ATM Withdrawal";
        }

        // Fonepay / IBFT
        if (forContent.startsWith("FPY:")) {
            const parts = forContent.split(":");
            const type = parts[1]?.toUpperCase() || "TRANSFER";
            return `Fonepay ${type}`;
        }

        // Complex transfer formats
        if (forContent.includes("/") && forContent.includes(",")) {
            const parts = forContent.split(",");

            const beforeComma = parts[0]?.trim();
            const afterComma = parts[1]?.trim();

            if (beforeComma?.includes("/")) {
                const slashParts = beforeComma.split("/");
                const paymentType = slashParts[1]?.trim();

                if (paymentType && !/\d+/.test(paymentType)) {
                    return this.cleanMerchantName(paymentType);
                }
            }

            if (afterComma && afterComma !== "UJJ SH") {
                return this.cleanMerchantName(afterComma);
            }

            for (const part of forContent.replace(",", "/").split("/")) {
                const cleanPart = part.trim();

                if (
                    cleanPart &&
                    !/\d+/.test(cleanPart) &&
                    cleanPart !== "UJJ SH"
                ) {
                    return this.cleanMerchantName(cleanPart);
                }
            }

            return null;
        }

        if (forContent.length > 0) {
            return this.cleanMerchantName(forContent);
        }

        return null;
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const accountPattern = /A\/c\s+([^\s]+)/i;
        const match = message.match(accountPattern);

        if (match) {
            const account = match[1].trim();

            if (account !== "{Account}") {
                return this.extractLast4Digits(account);
            }
        }

        return null;
    }

    extractReference(message: string): string | null {
        const forPattern = /For:\s*([^.]+?)(?:\.\s|$)/i;
        const match = message.match(forPattern);

        if (!match) {
            return super.extractReference(message);
        }

        const forContent = match[1];

        if (forContent.includes("CWDR/")) {
            const parts = forContent.split("/");

            if (parts.length >= 3) {
                return `${parts[1]}/${parts[2]}`;
            }
        }

        const refMatch = forContent.match(/(\d{6,})/);

        if (refMatch) {
            return refMatch[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const keywords = [
            "dear customer",
            "your a/c",
            "is debited",
            "is credited",
            "debited by",
            "credited by",
            "for:",
            "never share password",
            "npr"
        ];

        return keywords.some(k => lowerMessage.includes(k));
    }
}