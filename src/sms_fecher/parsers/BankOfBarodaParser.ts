import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Bank of Baroda (BOB) SMS messages
 */
export class BankOfBarodaParser extends BaseIndianBankParser {
    getBankName() {
        return "Bank of Baroda";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return (
            normalizedSender.includes("BOB") ||
            normalizedSender.includes("BARODA") ||
            normalizedSender.includes("BOBSMS") ||
            normalizedSender.includes("BOBTXN") ||
            normalizedSender.includes("BOBCRD") ||
            /^[A-Z]{2}-BOBSMS-[A-Z]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOBTXN-[A-Z]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOB-[A-Z]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOBCRD-[A-Z]$/i.test(normalizedSender) ||
            normalizedSender === "BOB" ||
            normalizedSender === "BANKOFBARODA"
        );
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /ALERT:\s*INR\s*([\d,]+(?:\.\d{2})?)\s+is\s+spent/i,
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+transferred\s+from/i,
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+Dr\.?\s+from/i,
            /credited\s+with\s+INR\s+([\d,]+(?:\.\d{2})?)/i,
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+Credited\s+to/i,
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+.*?Cr\.?\s+to/i,
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+deposited\s+in\s+cash/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const amount = match[1].replace(/,/g, "");
                const num = parseFloat(amount);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        const transferToPattern = /transferred\s+from\s+A\/c\s+[^\s]+\s+to:\s*([^.]+?)(?:\.|$)/i;
        let match = message.match(transferToPattern);
        if (match) {
            const merchantRaw = match[1].trim();
            const merchant = merchantRaw.split(/\s+Total\s+Bal/i)[0].trim();
            if (this.isValidMerchantName(merchant)) {
                return this.cleanMerchantName(merchant);
            }
        }

        const upiPattern = /Cr\.?\s+to\s+([^\s]+@[^\s.]+)/i;
        match = message.match(upiPattern);
        if (match) {
            const vpa = match[1];
            const name = vpa.split("@")[0];
            return name.toLowerCase() === "redacted"
                ? "UPI Payment"
                : this.cleanMerchantName(name);
        }

        const impsPattern = /IMPS\/[\d]+\s+by\s+([^.]+?)(?:\s*\.|$)/i;
        match = message.match(impsPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        if (message.includes("UPI")) {
            if (message.includes("credited")) {
                return "UPI Credit";
            }
            if (message.includes("Dr.")) {
                return "UPI Payment";
            }
        }

        if (message.includes("IMPS")) {
            return "IMPS Transfer";
        }

        if (message.includes("deposited in cash")) {
            return "Cash Deposit";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const bobCardPattern = /BOBCARD\s+ending\s+(\d{4})/i;
        let match = message.match(bobCardPattern);
        if (match) {
            return match[1];
        }

        const acPattern = /A\/[Cc]\s+([X.*\d]+)/i;
        match = message.match(acPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const patterns = [
            /AvlBal:\s*Rs\.?\s*([\d,]+(?:\.\d{2})?)/i,
            /Total\s+Bal:\s*Rs\.?\s*([\d,]+(?:\.\d{2})?)/i,
            /Avlbl\s+Amt:\s*Rs\.?\s*([\d,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match[1].replace(/,/g, "");
                const num = parseFloat(balanceStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {
        const refPattern1 = /Ref:\s*(\d+)/i;
        let match = message.match(refPattern1);
        if (match) {
            return match[1];
        }

        const upiRefPattern = /UPI\s+Ref\s+No\s+(\d+)/i;
        match = message.match(upiRefPattern);
        if (match) {
            return match[1];
        }

        const impsRefPattern = /IMPS\/(\d+)/i;
        match = message.match(impsRefPattern);
        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("spent on your bobcard")) return TransactionType.CREDIT;
        if (lowerMessage.includes("bobcard") && lowerMessage.includes("spent")) return TransactionType.CREDIT;
        if (lowerMessage.includes("bobcard") && lowerMessage.includes("is spent")) return TransactionType.CREDIT;
        if (lowerMessage.includes("transferred from")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("dr.") || lowerMessage.includes("debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("cr.") || lowerMessage.includes("credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("deposited")) return TransactionType.INCOME;

        return super.extractTransactionType(message);
    }

    extractAvailableLimit(message: string): number | null {
        const creditLimitPattern = /Available\s+credit\s+limit\s+is\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)/i;
        const match = message.match(creditLimitPattern);
        if (match) {
            const limitStr = match[1].replace(/,/g, "");
            const num = parseFloat(limitStr);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractAvailableLimit(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("dr. from") ||
            lowerMessage.includes("cr. to") ||
            lowerMessage.includes("credited to a/c") ||
            lowerMessage.includes("credited with inr") ||
            lowerMessage.includes("deposited in cash") ||
            lowerMessage.includes("transferred from") ||
            lowerMessage.includes("is spent")
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}