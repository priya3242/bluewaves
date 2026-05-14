import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for City Union Bank SMS messages
 *
 * Common senders: JK-CUBLTD-S, XX-CUBLTD-T, etc.
 *
 * SMS Formats:
 * - Your a/c no. XXXXXXXXXXXXXXX is debited for Rs.111.00 on 01-09-2025 and credited to a/c no. YYYYYYYYYYYYYYY (UPI Ref no 123456789012)
 * - Your a/c no. XXXXXXXXXXXXXXX is credited for Rs.111.00 on 01-09-2025 and debited from a/c no. YYYYYYYYYYYYYYY (UPI Ref no 123456789012)
 * - Savings No XXXXXXXXXXXXXXX credited with INR 111.00 towards BY NEFT TRF:AMBANI YYYYYYYYYYYYYYY: on 01-SEP-2025. Avl Bal 120.00
 */
export class CityUnionBankParser extends BaseIndianBankParser {

    getBankName() {
        return "City Union Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("CUBANK") ||
            normalizedSender.includes("CUBLTD") ||
            normalizedSender.includes("CUB")
        );
    }

    extractAmount(message: string): number | null {
        const amountPatterns = [
            /debited\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited\s+with\s+INR\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of amountPatterns) {
            const match = message.match(pattern);

            if (match) {
                const amount = match[1].replace(/,/g, "");
                const num = parseFloat(amount);

                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("is debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debited for")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debited from")) return TransactionType.EXPENSE;

        if (lowerMessage.includes("is credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("credited for")) return TransactionType.INCOME;
        if (lowerMessage.includes("credited with")) return TransactionType.INCOME;
        if (lowerMessage.includes("credited to")) return TransactionType.INCOME;
        if (lowerMessage.includes("neft trf")) return TransactionType.INCOME;

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        const lowerMessage = message.toLowerCase();

        // NEFT Transfer pattern
        if (lowerMessage.includes("neft trf")) {
            const neftPattern = /BY\s+NEFT\s+TRF:([^:]+)/i;
            const match = message.match(neftPattern);

            if (match) {
                const merchant = this.cleanMerchantName(match[1].trim());
                return `NEFT - ${merchant}`;
            }

            return "NEFT Transfer";
        }

        // UPI Transaction
        if (message.includes("UPI Ref")) {
            const toAccountPattern =
                /credited\s+to\s+a\/c\s+no\.\s+([A-Z0-9]+)/i;

            const fromAccountPattern =
                /debited\s+from\s+a\/c\s+no\.\s+([A-Z0-9]+)/i;

            let match = message.match(toAccountPattern);

            if (match) {
                const account = match[1];
                const accountLast4 =
                    account.length >= 4
                        ? account.slice(-4)
                        : account;

                return `UPI Transfer to A/C XX${accountLast4}`;
            }

            match = message.match(fromAccountPattern);

            if (match) {
                const account = match[1];
                const accountLast4 =
                    account.length >= 4
                        ? account.slice(-4)
                        : account;

                return `UPI Transfer from A/C XX${accountLast4}`;
            }

            return "UPI Transfer";
        }

        // Generic transfer
        if (
            lowerMessage.includes("credited to a/c") ||
            lowerMessage.includes("debited from a/c")
        ) {
            return "Account Transfer";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        const accountPatterns = [
            /Your\s+a\/c\s+no\.\s+([X\d]+)/i,
            /Savings\s+No\s+([X\d]+)/i
        ];

        for (const pattern of accountPatterns) {
            const match = message.match(pattern);

            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const balancePattern =
            /Avl\s+Bal\s+([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(balancePattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {
        // Pattern: "(UPI Ref no 123456789012)"
        const upiRefPattern =
            /\(UPI\s+Ref\s+no\s+(\d+)\)/i;

        let match = message.match(upiRefPattern);

        if (match) {
            return match[1];
        }

        // NEFT transaction ID if present
        const neftRefPattern =
            /NEFT[:\/]\s*([A-Z0-9]+)/i;

        match = message.match(neftRefPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Skip OTP and non-transaction messages
        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("verification") ||
            lowerMessage.includes("request")
        ) {
            return false;
        }

        // Check for transaction patterns
        if (
            lowerMessage.includes("is debited for") ||
            lowerMessage.includes("is credited for") ||
            lowerMessage.includes("credited with") ||
            lowerMessage.includes("neft trf")
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}