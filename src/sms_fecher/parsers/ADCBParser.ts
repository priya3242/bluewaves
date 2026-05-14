import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { FABParser } from './FABParser';

export class ADCBParser extends FABParser {

    getBankName() {
        return "Abu Dhabi Commercial Bank";
    }

    getCurrency() {
        return "AED";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return upperSender === "ADCBALERT" ||
            upperSender.includes("ADCB") ||
            upperSender.includes("ADCBANK") ||
            /^[A-Z]{2}-ADCB-[A-Z]$/i.test(upperSender);
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /was used for\s+([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i,
            /used for\s+([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i,
            /\b([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)\s+withdrawn from/i,
            /\b([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)\s+has been deposited via ATM/i,
            /\b([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)\s+transferred via/i,
            /Cr\. transaction of\s+([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i,
            /Dr\.?\s*transaction of\s+([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i,
            /Transaction of\s+([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i,
            /Amount Paid:\s*([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match != null) {
                const currencyCode = match[1].trim();
                const amountStr = match[2].trim();

                if (currencyCode.length === 3 &&
                    /[A-Z]{3}/i.test(currencyCode) &&
                    !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currencyCode)
                ) {
                    const amount = parseFloat(amountStr.replace(/,/g, ""));
                    if (!isNaN(amount) && amount > 0.01) {
                        return amount;
                    }
                }
            }
        }

        if (this.containsCardPurchase(message)) {
            const currencyAmountPattern = /([A-Z]{3})\s*([0-9,]+(?:\.\d{2})?)/i;
            const match = message.match(currencyAmountPattern);
            if (match) {
                const currencyCode = match[1].trim();
                const amountStr = match[2].trim();

                if (currencyCode.length === 3 &&
                    /[A-Z]{3}/i.test(currencyCode) &&
                    !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currencyCode)
                ) {
                    const amount = parseFloat(amountStr.replace(/,/g, ""));
                    if (!isNaN(amount) && amount > 0.01) {
                        return amount;
                    }
                }
            }
        }

        return null;
    }

    containsCardPurchase(message: string): boolean {
        return message.includes("was used for") || message.includes("used for");
    }

    extractMerchant(message: string, sender: string): string | null {
        if (this.containsCardPurchase(message)) {
            const merchantPattern = /at\s+([^,\n]+),\s*[A-Z]{2}/i;
            const match = message.match(merchantPattern);
            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        if (message.includes("TouchPoints Redemption")) {
            return "TouchPoints Redemption";
        }

        if (message.includes("withdrawn from")) {
            const afterAtMatch = message.match(/at\s+(.*?)(?:\s+Avl\.Bal|\s+Available balance)/i);
            if (afterAtMatch) {
                const atmInfo = afterAtMatch[1].trim().replace(/\s+/g, " ");
                if (atmInfo.length > 0 && (atmInfo.startsWith("ATM-") || atmInfo.startsWith("ATM "))) {
                    let cleanAtmName = atmInfo;
                    if (atmInfo.startsWith("ATM-") || atmInfo.startsWith("ATM ")) {
                        cleanAtmName = atmInfo.substring(4).trim();
                    }
                    const finalAtmName = cleanAtmName.replace(/^\d+/i, "").replace(".", "").trim();
                    if (finalAtmName.length > 0) {
                        return `ATM Withdrawal: ${finalAtmName}`;
                    }
                }
            }
        }

        if (message.includes("deposited via ATM")) {
            const depositPattern = /at\s+([^.\n]+)/i;
            const match = message.match(depositPattern);
            if (match) {
                return `ATM Deposit: ${match[1].trim()}`;
            }
        }

        if (message.includes("transferred via")) {
            return "Transfer via ADCB Banking";
        }

        if (message.includes("Cr. transaction")) {
            return "Account Credit";
        }

        if (message.includes("Dr. transaction")) {
            return "Account Debit";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const adcbPatterns = [
            /debit card\s+([X*\d]+)\s+linked to acc\.?\s*([X*\d]+)/i,
            /linked to acc\.?\s*([X*\d]+)/i,
            /withdrawn from acc\.?\s*([X*\d]+)/i,
            /in your account\s+([X*\d]+)/i,
            /from acc\.?\s*no\.?\s*([X*\d]+)/i,
            /account (?:number\s*)?([X*\d]+)/i,
            /on your account number\s+([X*\d]+)/i,
            /Card\s+([X*\d]+)/i
        ];

        for (const pattern of adcbPatterns) {
            const match = message.match(pattern);
            if (match) {
                const raw = match.length > 2 && match[2] ? match[2] : match[1];
                const result = this.extractLast4Digits(raw);
                if (result != null) return result;
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const adcbBalancePatterns = [
            /Avl\.Bal\s+([A-Z]{3})\s+([0-9,]+(?:\.\d{2})?)/i,
            /Available balance is\s+([A-Z]{3})?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Avl\.?\s*bal\.?\s+([A-Z]{3})\s+([0-9,]+(?:\.\d{2})?)/i,
            /Avl\.Bal\.?([A-Z]{3})([0-9,]+(?:\.\d{2})?)/i,
            /Available Balance is\s+([A-Z]{3})([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of adcbBalancePatterns) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match.length > 2 && match[2] ? match[2] : match[1];
                const amount = parseFloat(balanceStr.replace(/,/g, ""));
                return isNaN(amount) ? null : amount;
            }
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {
        const adcbReferencePatterns = [
            /on\s+(\w{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}[AP]M)/i,
            /(\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/i
        ];

        for (const pattern of adcbReferencePatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return super.extractReference(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (this.containsCardPurchase(message)) return TransactionType.EXPENSE;
        if (lowerMessage.includes("withdrawn from") && lowerMessage.includes("atm")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("deposited via atm")) return TransactionType.INCOME;
        if (lowerMessage.includes("transferred via")) return TransactionType.TRANSFER;
        if (lowerMessage.includes("cr. transaction")) return TransactionType.INCOME;
        if (lowerMessage.includes("dr. transaction")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("touchpoints redemption")) return TransactionType.EXPENSE;

        return super.extractTransactionType(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const adcbNonTransactionKeywords = [
            "could not be completed",
            "insufficient funds",
            "transaction.*could not be completed",
            "do not share your otp",
            "otp for transaction",
            "activation key",
            "do not share with anyone",
            "has been de-activated",
            "has been activated",
            "congratulations on the first usage",
            "digital card assigned to",
            "pin change/setup was successful",
            "request for pin change/setup",
            "we have updated your emirates id",
            "confirmation recd. from",
            "sr no.",
            "for clarifications please call",
            "for assistance please call"
        ];

        if (adcbNonTransactionKeywords.some(keyword => new RegExp(keyword, "i").test(lowerMessage))) {
            return false;
        }

        const adcbTransactionKeywords = [
            "your debit card",
            "your credit card",
            "was used for",
            "used for",
            "withdrawn from",
            "deposited via atm",
            "transferred via",
            "cr. transaction",
            "dr. transaction",
            "cr.transaction",
            "dr.transaction",
            "transaction.*was successful",
            "touchpoints redemption",
            "debit card.*used for",
            "touchpoints redemption request",
            "account number XXX.*was successful"
        ];

        if (adcbTransactionKeywords.some(it => lowerMessage.includes(it))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    extractCurrency(message: string): string {
        const transactionCurrencyPatterns = [
            /was used for\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /used for\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /\b([A-Z]{3})\s*[0-9,]+(?:\.\d{2})?\s+withdrawn from/i,
            /\b([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?\s+has been deposited via ATM/i,
            /\b([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?\s+transferred via/i,
            /Cr\.?\s*transaction of\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /Dr\.?\s*transaction of\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /Transaction of\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,
            /Amount Paid:\s*([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i
        ];

        for (const pattern of transactionCurrencyPatterns) {
            const match = message.match(pattern);
            if (match) {
                const currencyCode = match[1].toUpperCase();
                if (/[A-Z]{3}/i.test(currencyCode) &&
                    !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currencyCode)
                ) {
                    return currencyCode;
                }
            }
        }

        if (this.containsCardPurchase(message)) {
            const currencyPattern = /([A-Z]{3})\s*[0-9,]+(?:\.\d{2})?/i;
            const match = message.match(currencyPattern);
            if (match) {
                const currencyCode = match[1].toUpperCase();
                if (/[A-Z]{3}/i.test(currencyCode) &&
                    !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currencyCode)
                ) {
                    return currencyCode;
                }
            }
        }

        return "AED";
    }
}