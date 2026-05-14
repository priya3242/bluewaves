import { TransactionType, ParsedTransaction } from '../core/types';
import { UAEBankParser } from './UAEBankParser';

/**
 * Parser for Mashreq Bank - UAE
 *
 * Example SMS:
 * "Thank you for using NEO VISA Debit Card Card ending XXXX
 * for AED 5.99 at CARREFOUR on 26-AUG-2025 10:25 PM.
 * Available Balance is AED X,480.15"
 */
export class MashreqBankParser extends UAEBankParser {

    getBankName(): string {
        return "Mashreq Bank";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            upperSender === "MASHREQ" ||
            upperSender.includes("MASHREQ") ||
            upperSender === "MSHREQ" ||

            /^[A-Z]{2}-MASHREQ-[A-Z]$/i.test(upperSender) ||
            /^[A-Z]{2}-MSHREQ-[A-Z]$/i.test(upperSender)
        );
    }

    /**
     * Custom parse override
     */
    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        if (!this.isTransactionMessage(smsBody)) {
            return null;
        }

        const amount = this.extractAmount(smsBody);

        if (amount == null) {
            return null;
        }

        const type = this.extractTransactionType(smsBody);

        if (type == null) {
            return null;
        }

        const currency =
            this.extractCurrency(smsBody) ?? "AED";

        const availableLimit =
            type === TransactionType.CREDIT
                ? this.extractAvailableLimit(smsBody)
                : null;

        return {
            amount,
            type,
            merchant: this.extractMerchant(smsBody, sender),
            reference: this.extractReference(smsBody),
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),
            creditLimit: availableLimit,
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.detectIsCard(smsBody),
            currency
        };
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lower = message.toLowerCase();

        // Card transaction:
        // "at CARREFOUR on 26-AUG-2025"
        if (
            lower.includes("debit card") ||
            lower.includes("credit card")
        ) {

            const merchantPattern =
                /at\s+([^,\n]+?)\s+on\s+\d{1,2}-[A-Z]{3}-\d{4}/i;

            const match = message.match(merchantPattern);

            if (match) {
                return this.cleanMerchantName(
                    match[1].trim()
                );
            }
        }

        // ATM withdrawal
        if (
            lower.includes("atm") &&
            lower.includes("withdrawn")
        ) {
            return "ATM Withdrawal";
        }

        // Transfer
        if (lower.includes("transfer")) {
            return "Transfer";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(
        message: string
    ): string | null {

        const baseResult =
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        const patterns = [

            // Card ending XXXX
            /Card ending\s+([X\d]+)/i,

            // card no. XXXX
            /card\s+(?:no\.|number)\s+([X\d]+)/i,

            // account XXXX
            /account\s+(?:no\.|number)?\s*([X\d]+)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(
        message: string
    ): number | null {

        const balancePatterns = [

            // Available Balance is AED X,480.15
            /Available Balance is\s+([A-Z]{3})\s+([X0-9,]+(?:\.\d{2})?)/i,

            // Avl Bal AED X,480.15
            /Avl\.?\s*Bal\.?\s+([A-Z]{3})\s+([X0-9,]+(?:\.\d{2})?)/i,

            // Balance AED X,480.15
            /Balance:?\s+([A-Z]{3})\s+([X0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of balancePatterns) {

            const match = message.match(pattern);

            if (match) {

                let balanceStr =
                    match[2].replace(/,/g, "");

                // Replace masking X with 0
                balanceStr =
                    balanceStr.replace(/X/g, "0");

                const num =
                    parseFloat(balanceStr);

                return isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractBalance(message);
    }

    extractReference(
        message: string
    ): string | null {

        const referencePatterns = [

            // on 26-AUG-2025 10:25 PM
            /on\s+(\d{1,2}-[A-Z]{3}-\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/i,

            // generic datetime
            /(\d{1,2}-[A-Z]{3}-\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/i
        ];

        for (const pattern of referencePatterns) {

            const match = message.match(pattern);

            if (match) {
                return match[1];
            }
        }

        return super.extractReference(message);
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lower =
            message.toLowerCase();

        // Debit card purchase
        if (
            lower.includes("debit card") &&
            /for\s+[A-Z]{3}\s+[0-9,]+/i.test(message)
        ) {
            return TransactionType.EXPENSE;
        }

        // Credit card purchase
        if (
            lower.includes("credit card") &&
            /for\s+[A-Z]{3}\s+[0-9,]+/i.test(message)
        ) {
            return TransactionType.CREDIT;
        }

        // ATM withdrawal
        if (
            lower.includes("atm") &&
            lower.includes("withdrawn")
        ) {
            return TransactionType.EXPENSE;
        }

        // ATM deposit
        if (
            lower.includes("atm") &&
            lower.includes("deposited")
        ) {
            return TransactionType.INCOME;
        }

        // Transfer
        if (lower.includes("transfer")) {
            return TransactionType.TRANSFER;
        }

        // Credited
        if (lower.includes("credited")) {
            return TransactionType.INCOME;
        }

        // Debited
        if (lower.includes("debited")) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    detectIsCard(
        message: string
    ): boolean {

        const lower =
            message.toLowerCase();

        const cardPatterns = [
            "neo visa debit card",
            "neo debit card",
            "debit card card ending",
            "credit card card ending",
            "card ending",
            "mashreq card"
        ];

        const hasCardPattern =
            cardPatterns.some(pattern =>
                lower.includes(pattern)
            );

        return (
            hasCardPattern ||
            super.detectIsCard(message)
        );
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lower =
            message.toLowerCase();

        const nonTransactionKeywords = [
            "otp",
            "one time password",
            "verification code",
            "do not share",
            "activation",
            "has been blocked",
            "has been activated",
            "card request",
            "card application",
            "limit change",
            "pin change",
            "failed transaction",
            "transaction declined",
            "insufficient balance"
        ];

        if (
            nonTransactionKeywords.some(keyword =>
                lower.includes(keyword)
            )
        ) {
            return false;
        }

        const transactionKeywords = [
            "thank you for using",
            "neo visa debit card",
            "neo debit card",
            "debit card card ending",
            "credit card card ending",
            "available balance is"
        ];

        if (
            transactionKeywords.some(keyword =>
                lower.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    extractCurrency(
        message: string
    ): string | null {

        const currencyPatterns = [

            // for AED 5.99
            /for\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,

            // of AED 5.99
            /of\s+([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i,

            // generic
            /\b([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?/i
        ];

        for (const pattern of currencyPatterns) {

            const match = message.match(pattern);

            if (match) {

                const currencyCode =
                    match[1].toUpperCase();

                // Exclude month names
                if (
                    /^[A-Z]{3}$/.test(currencyCode) &&
                    !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currencyCode)
                ) {
                    return currencyCode;
                }
            }
        }

        return "AED";
    }
}