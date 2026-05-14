import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Kerala Gramin Bank (India) SMS messages
 *
 * Handles formats like:
 * - "Your a/c no. XXXX12345 is debited for Rs.160.00 on 28/7/25 05:06 PM and credited to a/c no. XXXXX00019 (UPI Ref no 170632692557)"
 * - "Dear Customer, Account XXXX123 is credited with INR 3000 on 20-10-2025 08:15:26 from 7025784485@upi. UPI Ref. no. 529807237409"
 *
 * Common senders:
 * - AD-KGBANK-S
 * - BX-KGBANK-S
 */
export class KeralaGraminBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "Kerala Gramin Bank";
    }

    getCurrency(): string {
        return "INR";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("KGBANK") ||
            normalizedSender.includes("KERALA GRAMIN") ||
            normalizedSender.includes("KERALAGR")
        );
    }

    extractAmount(message: string): number | null {

        // Examples:
        // "debited for Rs.160.00"
        // "credited with INR 3000"

        const debitCreditPattern =
            /(?:debited\s+for|credited\s+with)\s+(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;

        const match = message.match(debitCreditPattern);

        if (match?.[1]) {

            const amountStr = match[1].replace(/,/g, "");
            const amount = parseFloat(amountStr);

            return Number.isNaN(amount)
                ? null
                : amount;
        }

        return super.extractAmount(message);
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        // Expense
        if (
            lowerMessage.includes("debited for") ||
            lowerMessage.includes("is debited")
        ) {
            return TransactionType.EXPENSE;
        }

        // Income
        if (
            lowerMessage.includes("credited with") ||
            lowerMessage.includes("is credited")
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage = message.toLowerCase();

        // UPI outgoing transfer
        if (
            lowerMessage.includes("debited") &&
            lowerMessage.includes("credited to")
        ) {
            return "UPI Transfer";
        }

        // Example:
        // "from 7025784485@upi"
        // "from merchant@paytm"

        const upiFromPattern =
            /from\s+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i;

        const match = message.match(upiFromPattern);

        if (match?.[1]) {

            const upiId = match[1].trim();

            const namePart = upiId.split("@")[0];

            // Phone-number style UPI IDs
            if (/^\d+$/.test(namePart)) {
                return "UPI Payment";
            }

            if (namePart.length > 0) {
                return this.cleanMerchantName(namePart);
            }

            return "UPI Payment";
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

        // Examples:
        // "Your a/c no. XXXX12345"
        // "Account XXXX123"

        const accountPattern =
            /(?:a\/c\s*no\.?|account)\s+([Xx\d]+)/i;

        const match = message.match(accountPattern);

        if (match?.[1]) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractReference(
        message: string
    ): string | null {

        // Examples:
        // "UPI Ref no 170632692557"
        // "UPI Ref. no. 529807237409"

        const upiRefPattern =
            /UPI\s+Ref\.?\s*no\.?\s*(\d+)/i;

        const match = message.match(upiRefPattern);

        if (match?.[1]) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage = message.toLowerCase();

        // Ignore OTP / password messages
        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("password")
        ) {
            return false;
        }

        const transactionKeywords = [
            "debited for",
            "is debited",
            "credited with",
            "is credited"
        ];

        return transactionKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }
}