import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

export class SliceParser extends BankParser {

    getBankName(): string {
        return "Slice";
    }

    canHandle(sender: string): boolean {

        const normalized =
            sender.toUpperCase();

        return (
            normalized.includes("SLICE") ||
            normalized.includes("SLICEIT") ||
            normalized.includes("SLCEIT")
        );
    }

    private isSuccessMessage(
        message: string
    ): boolean {

        const lower =
            message.toLowerCase();

        return (
            /\bsuccessful\b/i.test(lower) ||
            /\bsuccess\b/i.test(lower) ||
            lower.includes("approved") ||
            lower.includes("confirmed")
        );
    }

    private isFailureMessage(
        message: string
    ): boolean {

        const lower =
            message.toLowerCase();

        return (
            lower.includes("declined") ||
            lower.includes("failed") ||
            lower.includes("rejected") ||
            lower.includes("error") ||
            lower.includes("denied") ||
            lower.includes("unsuccessful")
        );
    }

    private isDatePhrase(
        text: string
    ): boolean {

        const pattern =
            /\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\b/i;

        return pattern.test(text);
    }

    protected isTransactionMessage(
        message: string
    ): boolean {

        const lower =
            message.toLowerCase();

        if (lower.includes("sent")) {
            return true;
        }

        if (lower.includes("transaction")) {

            return (
                this.isSuccessMessage(message) &&
                !this.isFailureMessage(message)
            );
        }

        return super.isTransactionMessage(
            message
        );
    }

    protected extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const sentToPattern =
            /sent.*to\s+([A-Z][A-Z0-9\s./&-]+?)\s*\(/i;

        let match =
            message.match(
                sentToPattern
            );

        if (match?.[1]) {

            return this.cleanMerchantName(
                match[1].trim()
            );
        }

        const fromPattern =
            /from\s+([A-Z][A-Z0-9\s]+?)(?:\s+on|\s+\(|$)/i;

        match =
            message.match(
                fromPattern
            );

        if (match?.[1]) {

            const merchant =
                match[1].trim();

            if (
                merchant.toUpperCase() !==
                "NEFT"
            ) {

                return this.cleanMerchantName(
                    merchant
                );
            }
        }

        const onPattern =
            /\bon\s+([A-Za-z0-9\s./&-]+?)(?:\s+is|$)/i;

        match =
            message.match(
                onPattern
            );

        if (match?.[1]) {

            const merchant =
                match[1].trim();

            if (
                merchant.toLowerCase() !==
                "slice" &&
                merchant.toUpperCase() !==
                "RS" &&
                !this.isDatePhrase(
                    merchant
                )
            ) {

                return this.cleanMerchantName(
                    merchant
                );
            }
        }

        const lower =
            message.toLowerCase();

        if (lower.includes("paypal")) {
            return "PayPal";
        }

        if (
            lower.includes("slice") &&
            lower.includes("credited")
        ) {
            return "Slice Credit";
        }

        return (
            super.extractMerchant(
                message,
                sender
            ) ?? "Slice"
        );
    }

    protected extractTransactionType(
        message: string
    ): TransactionType | null {

        const lower =
            message.toLowerCase();

        if (
            lower.includes("credited")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lower.includes("received")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lower.includes("cashback")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lower.includes("refund")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lower.includes("debited")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("spent")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("paid")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("sent")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("payment") &&
            !lower.includes("received")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            this.isSuccessMessage(
                message
            ) &&
            !this.isFailureMessage(
                message
            )
        ) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(
            message
        );
    }
}