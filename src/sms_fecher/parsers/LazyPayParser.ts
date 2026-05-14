import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for LazyPay wallet transactions.
 * Handles messages from BP-LZYPAY-S, JM-LZYPAY-S, JD-LZYPAY-S and similar senders.
 * LazyPay is a Buy Now Pay Later (BNPL) wallet service.
 */
export class LazyPayParser extends BankParser {

    getBankName(): string {
        return "LazyPay";
    }

    canHandle(sender: string): boolean {

        const normalizedSender =
            sender.toUpperCase();

        return (
            normalizedSender.includes("LZYPAY") ||
            normalizedSender.includes("LAZYPAY")
        );
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        /**
         * Pattern:
         * "for txn TXN512924131 on MERCHANT was successful"
         */
        const onMerchantPattern =
            /on\s+([^.]+?)\s+was\s+successful/i;

        let match =
            message.match(onMerchantPattern);

        if (match?.[1]) {

            const rawMerchant =
                match[1].trim();

            let cleanedMerchant =
                rawMerchant;

            // Normalize known merchants
            if (
                rawMerchant.includes("Zepto Marketplace")
            ) {
                cleanedMerchant = "Zepto";
            }
            else if (
                rawMerchant.includes("Innovative Retail Concepts")
            ) {
                cleanedMerchant = "BigBasket";
            }
            else if (
                rawMerchant.includes("Swiggy")
            ) {
                cleanedMerchant = "Swiggy";
            }
            else if (
                rawMerchant.includes("Zomato")
            ) {
                cleanedMerchant = "Zomato";
            }
            else {

                cleanedMerchant =
                    rawMerchant
                        .replace(
                            /\s*(Private|Pvt\.?|Ltd\.?|Limited|Inc\.?|LLC|LLP).*$/i,
                            ""
                        )
                        .replace(/\s*\d+$/i, "")
                        .trim();
            }

            if (cleanedMerchant.length > 0) {
                return cleanedMerchant;
            }
        }

        // Repayment messages
        if (
            message.includes(
                "against your LazyPay statement"
            )
        ) {
            return "LazyPay Repayment";
        }

        return (
            super.extractMerchant(
                message,
                sender
            ) ?? "LazyPay"
        );
    }

    extractAmount(
        message: string
    ): number | null {

        const amountPatterns = [

            // Rs. 235.76
            /Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of amountPatterns) {

            const match =
                message.match(pattern);

            if (match?.[1]) {

                const amountStr =
                    match[1].replace(/,/g, "");

                const num =
                    parseFloat(amountStr);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractAmount(message);
    }

    extractReference(
        message: string
    ): string | null {

        // TXN512924131
        const txnPattern =
            /txn\s+([A-Z0-9]+)/i;

        const match =
            message.match(txnPattern);

        if (match?.[1]) {
            return match[1].trim();
        }

        return super.extractReference(message);
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        /**
         * LazyPay is BNPL credit service
         */
        return TransactionType.CREDIT;
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        // Failed transactions
        const failedKeywords = [
            "could not be processed",
            "due to a failure",
            "payment failed",
            "transaction failed",
            "unsuccessful"
        ];

        if (
            failedKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return false;
        }

        // Promotional messages
        const promoKeywords = [
            "offer",
            "get cashback",
            "explore more"
        ];

        if (
            promoKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {

            // Allow payment confirmations
            if (
                !lowerMessage.includes("payment of") &&
                !lowerMessage.includes("was successful")
            ) {
                return false;
            }
        }

        // Transaction indicators
        const transactionKeywords = [
            "payment of",
            "was successful",
            "against your lazypay statement",
            "thanks for your payment"
        ];

        return transactionKeywords.some(
            keyword =>
                lowerMessage.includes(keyword)
        );
    }
}