import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for IDFC First Bank SMS messages
 */
export class IDFCFirstBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "IDFC First Bank";
    }

    canHandle(sender: string): boolean {

        const normalizedSender =
            sender.toUpperCase();

        return (
            normalizedSender.includes("IDFCBK") ||
            normalizedSender.includes("IDFCFB") ||
            normalizedSender.includes("IDFC")
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        // Skip non-transaction messages
        if (!this.isTransactionMessage(smsBody)) {
            return null;
        }

        const parsed =
            super.parse(
                smsBody,
                sender,
                timestamp
            );

        if (!parsed) {
            return null;
        }

        // Multi-currency support
        const currency =
            this.extractCurrencyFromMessage(
                smsBody
            ) || "INR";

        return {
            ...parsed,
            currency
        };
    }

    /**
     * Extract currency from message
     */
    private extractCurrencyFromMessage(
        message: string
    ): string | null {

        // Example:
        // EUR 500.00 spent
        const pattern =
            /([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?\s+spent/i;

        const match =
            message.match(pattern);

        if (match?.[1]) {

            const currency =
                match[1].toUpperCase();

            // Ignore months
            if (
                !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currency)
            ) {
                return currency;
            }
        }

        return null;
    }

    extractAmount(
        message: string
    ): number | null {

        const amountPatterns = [

            // EUR 500.00 spent
            /[A-Z]{3}\s+([0-9,]+(?:\.\d{2})?)\s+spent/i,

            // Debit
            /Debit\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /debited\s+by\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /debited\s+by\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,

            // Credit
            /credited\s+by\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited\s+with\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited\s+by\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,

            // Interest
            /interest\s+of\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of amountPatterns) {

            const match =
                message.match(pattern);

            if (match?.[1]) {

                const amount =
                    match[1].replace(/,/g, "");

                const num =
                    parseFloat(amount);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractAmount(message);
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        // Ignore OTP
        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("one time password") ||
            lowerMessage.includes("verification code")
        ) {
            return false;
        }

        // Ignore promotions
        if (
            lowerMessage.includes("offer") ||
            lowerMessage.includes("discount") ||
            lowerMessage.includes("cashback offer") ||
            lowerMessage.includes("win ")
        ) {
            return false;
        }

        // Ignore bill reminders
        if (
            lowerMessage.includes("reminder") ||
            lowerMessage.includes("is due on") ||
            (
                lowerMessage.includes("bill of rs") &&
                lowerMessage.includes("due")
            )
        ) {
            return false;
        }

        // Ignore collect/payment requests
        if (
            lowerMessage.includes("has requested") ||
            lowerMessage.includes("payment request") ||
            lowerMessage.includes("collect request") ||
            lowerMessage.includes("requesting payment") ||
            lowerMessage.includes("requests rs") ||
            lowerMessage.includes("ignore if paid") ||
            lowerMessage.includes("ignore if already paid")
        ) {
            return false;
        }

        const transactionKeywords = [
            "debit",
            "debited",
            "credited",
            "withdrawn",
            "deposited",
            "spent",
            "received",
            "transferred",
            "paid",
            "interest"
        ];

        return transactionKeywords.some(
            keyword =>
                lowerMessage.includes(keyword)
        );
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage =
            message.toLowerCase();

        if (
            lowerMessage.includes("debit") ||
            lowerMessage.includes("debited") ||
            lowerMessage.includes("spent") ||
            lowerMessage.includes("withdrawn") ||
            lowerMessage.includes("withdrawal")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes("credited") ||
            lowerMessage.includes("deposited") ||
            lowerMessage.includes("deposit") ||
            lowerMessage.includes("cash deposit")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes("interest") &&
            (
                lowerMessage.includes("earned") ||
                lowerMessage.includes("monthly interest")
            )
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(
            message
        );
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage =
            message.toLowerCase();

        // Interest
        if (
            lowerMessage.includes(
                "monthly interest"
            )
        ) {
            return "Interest Credit";
        }

        // Cash deposit
        if (
            lowerMessage.includes(
                "cash deposit"
            )
        ) {

            const atmPattern =
                /ATM\s+(?:ID\s+)?([A-Z0-9]+)/i;

            const atmMatch =
                message.match(atmPattern);

            if (atmMatch?.[1]) {
                return `Cash Deposit - ATM ${atmMatch[1]}`;
            }

            return "Cash Deposit";
        }

        // Merchant credited
        const merchantCreditedPattern =
            /;\s*([A-Z][A-Z0-9\s]+?)\s+credited/i;

        let match =
            message.match(
                merchantCreditedPattern
            );

        if (match?.[1]) {

            const merchant =
                this.cleanMerchantName(
                    match[1]
                );

            if (
                this.isValidMerchantName(
                    merchant
                )
            ) {
                return merchant;
            }
        }

        // UPI
        if (
            message.includes("UPI")
        ) {

            const upiPattern =
                /(?:to|from|at)\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i;

            match =
                message.match(upiPattern);

            if (match?.[1]) {
                return `UPI - ${match[1]}`;
            }

            return "UPI Transaction";
        }

        // IMPS
        if (
            message.includes("IMPS")
        ) {

            const mobilePattern =
                /mobile\s+[X]*(\d{3,4})/i;

            match =
                message.match(mobilePattern);

            if (match?.[1]) {
                return `IMPS Transfer - Mobile XXX${match[1]}`;
            }

            return "IMPS Transfer";
        }

        // NEFT / RTGS
        if (
            message.includes("NEFT")
        ) {
            return "NEFT Transfer";
        }

        if (
            message.includes("RTGS")
        ) {
            return "RTGS Transfer";
        }

        // ATM
        if (
            message.includes("ATM")
        ) {

            const atmIdPattern =
                /ATM\s+([A-Z]{2}\d+)/i;

            match =
                message.match(
                    atmIdPattern
                );

            if (match?.[1]) {
                return `ATM - ${match[1]}`;
            }

            return "ATM Transaction";
        }

        // Card transactions
        const toPattern =
            /(?:to|at|for)\s+([A-Z][A-Z0-9\s&.-]+?)(?:\s+on|\s+New|\.|,|$)/i;

        match =
            message.match(toPattern);

        if (match?.[1]) {

            const merchant =
                this.cleanMerchantName(
                    match[1]
                );

            if (
                this.isValidMerchantName(
                    merchant
                )
            ) {
                return merchant;
            }
        }

        return super.extractMerchant(
            message,
            sender
        );
    }

    extractAccountLast4(
        message: string
    ): string | null {

        const baseResult =
            super.extractAccountLast4(
                message
            );

        if (baseResult) {
            return baseResult;
        }

        // Credit Card ending
        const cardPattern =
            /Credit\s+Card\s+ending\s+([X\d]+)/i;

        let match =
            message.match(cardPattern);

        if (match?.[1]) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        // A/C
        const acPattern =
            /A\/C\s+([X\d]+)/i;

        match =
            message.match(acPattern);

        if (match?.[1]) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        return null;
    }

    extractBalance(
        message: string
    ): number | null {

        const balancePatterns = [

            /New\s+Bal\s*:\s*(?:INR|Rs\.?)\s*([0-9,]+(?:\.\d{2})?)/i,

            /New\s+balance\s+is\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,

            /Updated\s+balance\s+is\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,

            /Available\s+balance\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of balancePatterns) {

            const match =
                message.match(pattern);

            if (match?.[1]) {

                const balance =
                    match[1].replace(/,/g, "");

                const num =
                    parseFloat(balance);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractBalance(message);
    }

    extractReference(
        message: string
    ): string | null {

        // RRN
        const rrnPattern =
            /RRN\s+(\d+)/i;

        let match =
            message.match(rrnPattern);

        if (match?.[1]) {
            return match[1];
        }

        // IMPS Ref
        const impsPattern =
            /IMPS\s+Ref\s+no\s+(\d+)/i;

        match =
            message.match(impsPattern);

        if (match?.[1]) {
            return match[1];
        }

        // UPI
        const upiPattern =
            /UPI[:/]\s*([0-9]+)/i;

        match =
            message.match(upiPattern);

        if (match?.[1]) {
            return match[1];
        }

        // Txn ID
        const txnPattern =
            /(?:txn|transaction)\s*(?:id|ref|no)[:\s]*([A-Z0-9]+)/i;

        match =
            message.match(txnPattern);

        if (match?.[1]) {
            return match[1];
        }

        return super.extractReference(message);
    }
}