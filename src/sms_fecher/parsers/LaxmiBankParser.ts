import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Laxmi Sunrise Bank (Nepal)
 * Handles NPR currency transactions.
 */
export class LaxmiBankParser extends BankParser {

    getBankName(): string {
        return "Laxmi Sunrise Bank";
    }

    getCurrency(): string {
        return "NPR"; // Nepalese Rupee
    }

    canHandle(sender: string): boolean {

        const upperSender =
            sender.toUpperCase();

        return (
            upperSender === "LAXMI_ALERT" ||
            upperSender.includes("LAXMI") ||
            upperSender.includes("LAXMISUNRISE") ||
            /^[A-Z]{2}-LAXMI-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(
        message: string
    ): number | null {

        const patterns = [

            // NPR 720.00
            /NPR\s+([0-9,]+(?:\.[0-9]{2})?)\s/i,

            // NPR 60,892.00
            /NPR\s+([0-9,]+(?:\.[0-9]{2})?)(?:\s|$)/i,

            // debited by NPR 500.00
            /(?:debited|credited)\s+by\s+NPR\s+([0-9,]+(?:\.[0-9]{2})?)/i
        ];

        for (const pattern of patterns) {

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

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage =
            message.toLowerCase();

        if (
            lowerMessage.includes("has been debited") ||
            lowerMessage.includes("debited by")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes("has been credited") ||
            lowerMessage.includes("credited by")
        ) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        /**
         * Examples:
         * Remarks:ESEWA LOAD/9763698550,127847587
         * Remarks:(STIPEND PMT DM/MCH-SHRAWAN82)
         */
        const remarksPattern =
            /Remarks:\s*\(?([^)]+)\)?/i;

        const match =
            message.match(remarksPattern);

        if (match?.[1]) {

            const remarks =
                match[1].trim();

            if (remarks.length > 0) {

                let cleanedRemarks =
                    remarks;

                if (
                    remarks.includes("ESEWA LOAD")
                ) {
                    cleanedRemarks = "ESEWA";
                }
                else if (
                    remarks.includes("STIPEND PMT")
                ) {
                    cleanedRemarks = "Stipend Payment";
                }
                else if (
                    remarks.includes("/")
                ) {
                    cleanedRemarks =
                        remarks
                            .split("/")[0]
                            .trim();
                }

                return this.cleanMerchantName(
                    cleanedRemarks
                );
            }
        }

        if (
            message.includes("ESEWA")
        ) {
            return "ESEWA";
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
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        /**
         * Your #12344560 has been...
         */
        const accountPattern =
            /Your\s+#(\d+)\s+has\s+been/i;

        const match =
            message.match(accountPattern);

        if (match?.[1]) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        return null;
    }

    extractReference(
        message: string
    ): string | null {

        /**
         * on 05/09/25
         */
        const datePattern =
            /on\s+(\d{2}\/\d{2}\/\d{2})/i;

        let match =
            message.match(datePattern);

        if (match?.[1]) {
            return match[1];
        }

        /**
         * Extract numeric reference
         */
        const remarksRefPattern =
            /Remarks:.*?([0-9]{6,})/i;

        match =
            message.match(remarksRefPattern);

        if (match?.[1]) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        const laxmiTransactionKeywords = [
            "dear customer",
            "has been debited",
            "has been credited",
            "laxmi sunrise",
            "remarks:",
            "npr"
        ];

        if (
            laxmiTransactionKeywords.some(
                keyword =>
                    lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(
            message
        );
    }
}