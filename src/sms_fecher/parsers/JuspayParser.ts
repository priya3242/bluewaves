import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Juspay / Amazon Pay wallet transactions.
 * Handles messages from XX-JUSPAY-X, APAY, and similar senders.
 */
export class JuspayParser extends BaseIndianBankParser {

    getBankName(): string {
        return "Amazon Pay";
    }

    getCurrency(): string {
        return "INR";
    }

    canHandle(sender: string): boolean {

        const normalizedSender =
            sender.toUpperCase();

        return (
            normalizedSender.includes("JUSPAY") ||
            normalizedSender.includes("APAY") ||
            normalizedSender === "AMAZON PAY"
        );
    }

    extractAmount(
        message: string
    ): number | null {

        const patterns = [

            // "debited for INR 120.50"
            /debited\s+for\s+INR\s+([0-9,]+(?:\.[0-9]{1,2})?)/i,

            // "Payment of Rs 100"
            /Payment\s+of\s+Rs\.?\s+([0-9,]+(?:\.[0-9]{1,2})?)/i,

            // Generic Rs pattern
            /Rs\.?\s+([0-9,]+(?:\.[0-9]{1,2})?)/i,

            // Generic INR pattern
            /INR\s+([0-9,]+(?:\.[0-9]{1,2})?)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match?.[1]) {

                const amount = parseFloat(
                    match[1].replace(/,/g, "")
                );

                if (!Number.isNaN(amount)) {
                    return amount;
                }
            }
        }

        return super.extractAmount(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage =
            message.toLowerCase();

        /**
         * Example:
         * "successful at Swiggy. Updated Balance..."
         */
        const merchantPattern =
            /successful\s+at\s+(.+?)(?:\.\s*Updated|\.(?:\s|$))/i;

        const match = message.match(merchantPattern);

        if (match?.[1]) {

            const merchant =
                match[1].trim();

            if (merchant.length > 0) {
                return this.cleanMerchantName(
                    merchant
                );
            }
        }

        // Common merchants
        if (lowerMessage.includes("amazon")) {
            return "Amazon";
        }

        if (lowerMessage.includes("flipkart")) {
            return "Flipkart";
        }

        if (lowerMessage.includes("swiggy")) {
            return "Swiggy";
        }

        if (lowerMessage.includes("zomato")) {
            return "Zomato";
        }

        if (lowerMessage.includes("ola")) {
            return "Ola";
        }

        if (lowerMessage.includes("uber")) {
            return "Uber";
        }

        if (lowerMessage.includes("zepto")) {
            return "Zepto";
        }

        if (lowerMessage.includes("blinkit")) {
            return "Blinkit";
        }

        if (
            lowerMessage.includes("apay wallet") ||
            lowerMessage.includes("wallet")
        ) {
            return "Amazon Pay Transaction";
        }

        return (
            super.extractMerchant(
                message,
                sender
            ) || "Amazon Pay"
        );
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage =
            message.toLowerCase();

        // Expense
        if (
            lowerMessage.includes("debited") ||
            lowerMessage.includes("payment") ||
            lowerMessage.includes("charged")
        ) {
            return TransactionType.EXPENSE;
        }

        // Credit / Refund
        if (
            lowerMessage.includes("credited") ||
            lowerMessage.includes("refunded") ||
            lowerMessage.includes("received")
        ) {
            return TransactionType.CREDIT;
        }

        return super.extractTransactionType(
            message
        );
    }

    extractReference(
        message: string
    ): string | null {

        // "Transaction Reference Number is 123456789012"
        const refPattern =
            /Transaction\s+Reference\s+Number\s+is\s+(\d{12})/i;

        let match =
            message.match(refPattern);

        if (match?.[1]) {
            return match[1];
        }

        // "Reference Number: 123456789012"
        const altRefPattern =
            /Reference\s+(?:Number|No\.?)[:\s]+(\d{12})/i;

        match = message.match(
            altRefPattern
        );

        if (match?.[1]) {
            return match[1];
        }

        return super.extractReference(
            message
        );
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        const transactionKeywords = [
            "debited for",
            "payment of rs",
            "using apay balance",
            "transaction reference number",
            "updated balance is"
        ];

        return (
            transactionKeywords.some(
                keyword =>
                    lowerMessage.includes(
                        keyword
                    )
            ) ||
            super.isTransactionMessage(
                message
            )
        );
    }
}