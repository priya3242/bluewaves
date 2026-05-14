import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for JioPay wallet transactions.
 * Handles messages from JA-JIOPAY-S and similar senders.
 *
 * Wallet transactions are marked as CREDIT
 * to avoid double-counting.
 */
export class JioPayParser extends BankParser {

    getBankName(): string {
        return "JioPay";
    }

    canHandle(sender: string): boolean {

        const normalizedSender =
            sender.toUpperCase();

        return (
            normalizedSender.includes(
                "JIOPAY"
            ) ||
            normalizedSender.endsWith(
                "-JIOPAY-S"
            ) ||
            normalizedSender.endsWith(
                "-JIOPAY-T"
            ) ||
            normalizedSender ===
            "JM-JIOPAY"
        );
    }

    extractAmount(
        message: string
    ): number | null {

        // Plan Name : 249.00
        const planPattern =
            /Plan\s+Name\s*:\s*([0-9,]+(?:\.\d{2})?)/i;

        let match =
            message.match(planPattern);

        if (match?.[1]) {

            const amount =
                match[1].replace(
                    /,/g,
                    ""
                );

            const num =
                parseFloat(amount);

            return Number.isNaN(num)
                ? null
                : num;
        }

        // Rs. 249.00
        const rsPattern =
            /Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        match = message.match(rsPattern);

        if (match?.[1]) {

            const amount =
                match[1].replace(
                    /,/g,
                    ""
                );

            const num =
                parseFloat(amount);

            return Number.isNaN(num)
                ? null
                : num;
        }

        return super.extractAmount(
            message
        );
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage =
            message.toLowerCase();

        // Jio recharge
        if (
            lowerMessage.includes(
                "recharge successful"
            ) &&
            lowerMessage.includes(
                "jio number"
            )
        ) {

            const numberPattern =
                /Jio\s+Number\s*:\s*(\d{10})/i;

            const match =
                message.match(numberPattern);

            if (match?.[1]) {

                const number =
                    match[1];

                return `Jio Recharge - ${number.substring(
                    0,
                    4
                )}****`;
            }

            return "Jio Recharge";
        }

        // Bill payments
        if (
            lowerMessage.includes(
                "bill payment"
            )
        ) {

            if (
                lowerMessage.includes(
                    "electricity"
                )
            ) {
                return "Electricity Bill";
            }

            if (
                lowerMessage.includes(
                    "water"
                )
            ) {
                return "Water Bill";
            }

            if (
                lowerMessage.includes(
                    "gas"
                )
            ) {
                return "Gas Bill";
            }

            if (
                lowerMessage.includes(
                    "broadband"
                )
            ) {
                return "Broadband Bill";
            }

            if (
                lowerMessage.includes(
                    "dth"
                )
            ) {
                return "DTH Recharge";
            }

            return "Bill Payment";
        }

        // Recharge
        if (
            lowerMessage.includes(
                "recharge"
            )
        ) {

            if (
                lowerMessage.includes(
                    "mobile"
                )
            ) {
                return "Mobile Recharge";
            }

            if (
                lowerMessage.includes(
                    "dth"
                )
            ) {
                return "DTH Recharge";
            }

            if (
                lowerMessage.includes(
                    "data"
                )
            ) {
                return "Data Recharge";
            }

            return "Recharge";
        }

        // Payment successful to merchant
        if (
            lowerMessage.includes(
                "payment successful to"
            )
        ) {

            const toPattern =
                /payment\s+successful\s+to\s+([^.\n]+)/i;

            const match =
                message.match(toPattern);

            if (match?.[1]) {

                return this.cleanMerchantName(
                    match[1].trim()
                );
            }

            return "JioPay Payment";
        }

        return (
            super.extractMerchant(
                message,
                sender
            ) || "JioPay Transaction"
        );
    }

    extractReference(
        message: string
    ): string | null {

        // Transaction ID : BR000CAUBYON
        const txnPattern =
            /Transaction\s+ID\s*:\s*([A-Z0-9]+)/i;

        const match =
            message.match(txnPattern);

        if (match?.[1]) {
            return match[1];
        }

        return super.extractReference(
            message
        );
    }

    extractTransactionType(
        message: string
    ): TransactionType {

        const lowerMessage =
            message.toLowerCase();

        // Bill payment confirmations
        if (
            lowerMessage.includes(
                "payment of"
            ) &&
            lowerMessage.includes(
                "has been received"
            )
        ) {
            return TransactionType.EXPENSE;
        }

        // Wallet usage
        return TransactionType.CREDIT;
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        // Ignore bill notifications
        if (
            lowerMessage.includes(
                "e-bill"
            ) ||
            lowerMessage.includes(
                "bill has been sent"
            ) ||
            lowerMessage.includes(
                "bill summary"
            ) ||
            lowerMessage.includes(
                "payment due date"
            ) ||
            lowerMessage.includes(
                "amount payable"
            )
        ) {
            return false;
        }

        return (
            lowerMessage.includes(
                "recharge successful"
            ) ||
            super.isTransactionMessage(
                message
            )
        );
    }
}