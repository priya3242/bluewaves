import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Dhanlaxmi Bank SMS messages
 *
 * Supported formats:
 * - UPI debits:
 *   "INR 20.00 is debited from A/c XXXX1234 on 28-NOV-2025..."
 *
 * - UPI credits:
 *   "INR 10.00 is credited to A/c XXXX1234 on 24-APR-2025..."
 *
 * - Internal transfers:
 *   "Your a/c no. XXXXXXXX1234 is credited for Rs.10.00..."
 *
 * Sender patterns:
 * TL-DHANBK-S, VM-DHANBK, etc.
 */
export class DhanlaxmiBankParser extends BaseIndianBankParser {

    getBankName() {
        return "Dhanlaxmi Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("DHANBK") ||
            normalizedSender.includes("DHANLAXMI") ||
            /^[A-Z]{2}-DHANBK-?[A-Z]?$/i.test(normalizedSender) ||
            /^[A-Z]{2}-DHANBK$/i.test(normalizedSender)
        );
    }

    extractAmount(message: string): number | null {

        // Pattern:
        // "INR 20.00 is debited"
        // "INR 10.00 is credited"

        const inrPattern =
            /INR\s+([0-9,]+(?:\.\d{2})?)\s+is\s+(?:debited|credited)/i;

        let match = message.match(inrPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);

            return isNaN(num) ? null : num;
        }

        // Pattern:
        // "credited for Rs.10.00"
        // "debited for Rs.10.00"

        const rsPattern =
            /(?:credited|debited)\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        match = message.match(rsPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);

            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("is debited")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("is credited")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("debited from")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("credited to")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("credited for")) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Pattern:
        // "A/c XXXX1234"
        // "A/c XX1234"

        const acPattern = /A\/c\s+([X\d]+)/i;

        let match = message.match(acPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Pattern:
        // "a/c no. XXXXXXXX1234"

        const acNoPattern =
            /a\/c\s+no\.\s*([X\d]+)/i;

        match = message.match(acNoPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractBalance(message: string): number | null {

        // Pattern:
        // "Aval Bal is INR 26,578.49"

        const balancePattern =
            /Aval\s+Bal\s+is\s+INR\s+([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(balancePattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // UPI transactions

        if (message.includes("UPI TXN")) {

            // Example:
            // "Payment from PhonePe"

            const paymentFromPattern =
                /Payment\s+from\s+([^\/"]+)/i;

            let match = message.match(paymentFromPattern);

            if (match) {
                const merchant =
                    this.cleanMerchantName(match[1].trim());

                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }

            // Example:
            // "payment on Amazon"

            const paymentOnPattern =
                /payment\s+on\s+(\w+)/i;

            match = message.match(paymentOnPattern);

            if (match) {
                const merchant =
                    this.cleanMerchantName(match[1].trim());

                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }

            return "UPI Payment";
        }

        // Internal transfer

        if (
            message.includes("debited from a/c") &&
            message.includes("credited")
        ) {
            return "Internal Transfer";
        }

        return super.extractMerchant(message, sender);
    }

    extractReference(message: string): string | null {

        // UPI Ref no

        const upiRefPattern =
            /UPI\s+Ref\s+no\s+(\d+)/i;

        let match = message.match(upiRefPattern);

        if (match) {
            return match[1];
        }

        // Example:
        // "/675325120952-MR"

        const txnRefPattern =
            /UPI\s+TXN:\s*\/(\d+)/i;

        match = message.match(txnRefPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Skip OTP/promotional messages

        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("one time password") ||
            lowerMessage.includes("verification code")
        ) {
            return false;
        }

        const dhanlaxmiKeywords = [
            "is debited from",
            "is credited to",
            "credited for",
            "debited from a/c"
        ];

        if (
            dhanlaxmiKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}