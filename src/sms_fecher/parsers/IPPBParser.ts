import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for India Post Payments Bank (IPPB) SMS messages
 */
export class IPPBParser extends BankParser {

    getBankName(): string {
        return "India Post Payments Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        // Pattern: XX-IPBMSG-S or XX-IPBMSG-T
        return /^[A-Z]{2}-IPBMSG-[ST]$/i.test(normalizedSender);
    }

    extractAmount(message: string): number | null {

        // Pattern: Rs.1.00 or Rs. 1.00
        const amountPattern =
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)/i;

        const match = message.match(amountPattern);

        if (match?.[1]) {

            const amount =
                match[1].replace(/,/g, "");

            const num = parseFloat(amount);

            return Number.isNaN(num)
                ? null
                : num;
        }

        return super.extractAmount(message);
    }

    extractAccountLast4(
        message: string
    ): string | null {

        const baseResult =
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Pattern: A/C X1234
        const accountPattern =
            /[Aa]\/[Cc]\s+([X\d]+)/i;

        const match =
            message.match(accountPattern);

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

        // Pattern: Avl Bal Rs.436.91
        const balancePattern =
            /Avl\s+Bal\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)/i;

        const match =
            message.match(balancePattern);

        if (match?.[1]) {

            const balanceStr =
                match[1].replace(/,/g, "");

            const num =
                parseFloat(balanceStr);

            return Number.isNaN(num)
                ? null
                : num;
        }

        return super.extractBalance(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage =
            message.toLowerCase();

        // Debit transaction
        if (lowerMessage.includes("debit")) {

            const toPattern =
                /to\s+([^\s]+(?:@[^\s]+)?)/i;

            const match =
                message.match(toPattern);

            if (match?.[1]) {

                const merchant =
                    match[1].trim();

                // Handle UPI IDs
                if (merchant.includes("@")) {

                    const name =
                        merchant.split("@")[0];

                    return this.cleanMerchantName(
                        name
                    );
                }

                return this.cleanMerchantName(
                    merchant
                );
            }

            if (
                lowerMessage.includes("for upi")
            ) {
                return "UPI Payment";
            }
        }

        // Credit transaction
        if (
            lowerMessage.includes(
                "received a payment"
            )
        ) {

            const fromPattern =
                /from\s+(.+?)\s+thru/i;

            const match =
                message.match(fromPattern);

            if (match?.[1]) {

                const payer =
                    match[1].trim();

                return this.cleanMerchantName(
                    payer
                );
            }
        }

        return super.extractMerchant(
            message,
            sender
        );
    }

    extractReference(
        message: string
    ): string | null {

        // Pattern: Ref 560002638161
        const refPattern =
            /Ref\s+(\d+)/i;

        let match =
            message.match(refPattern);

        if (match?.[1]) {
            return match[1];
        }

        // Pattern:
        // Info: UPI/CREDIT/523498793035
        const infoPattern =
            /Info:\s*UPI\/[^\/]+\/(\d+)/i;

        match =
            message.match(infoPattern);

        if (match?.[1]) {
            return match[1];
        }

        return super.extractReference(
            message
        );
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage =
            message.toLowerCase();

        if (
            lowerMessage.includes("debit")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes(
                "received a payment"
            )
        ) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes("info: upi") &&
            lowerMessage.includes("credit")
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(
            message
        );
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        // IPPB-specific transaction keywords
        if (
            lowerMessage.includes("debit rs") ||
            lowerMessage.includes(
                "received a payment"
            ) ||
            (
                lowerMessage.includes(
                    "info: upi"
                ) &&
                lowerMessage.includes("credit")
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(
            message
        );
    }
}