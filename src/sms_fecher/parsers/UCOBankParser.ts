import { BankParser } from '../core/BankParser';
import { TransactionType } from '../core/types';

/**
 * Parser for UCO Bank SMS messages
 *
 * Supported formats:
 * - Debit: "A/c XX1111 Debited with Rs.2000.00 on 21-09-2025 by UCO-UPI. Avl Bal Rs.11111.11. Report Dispute https://spgrs.ucoonline.in/Home_Page.jsp"
 * - Credit: "A/c XX1111 Credited with Rs.2,000.00 on 21-09-2025 by UCO-UPI. Avl Bal Rs.11111.11. Report Dispute https://spgrs.ucoonline.in/Home_Page.jsp -UCO Bank"
 *
 * Sender patterns: XX-UCOBNK-S (where XX can be any two letters)
 */
export class UCOBankParser extends BankParser {
    getBankName() {
        return "UCO Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return (
            normalizedSender.includes("UCOBNK") ||
            normalizedSender.includes("UCOBANK") ||
            normalizedSender.includes("UCO BANK") ||
            /^[A-Z]{2}-UCOBNK-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-UCOBNK$/i.test(normalizedSender) ||
            /^[A-Z]{2}-UCOBANK$/i.test(normalizedSender)
        );
    }

    extractAmount(message: string): number | null {
        const amountPattern = /Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;
        const match = message.match(amountPattern);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("debited with")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("credited with")) return TransactionType.INCOME;

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // UCO Bank format: "by UCO-UPI" or "by <merchant>"
        const merchantPattern = /by\s+([^.]+?)(?:\.Avl|$)/i;
        const match = message.match(merchantPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.includes("UCO-UPI")) {
                return "UPI Transfer";
            }

            return this.cleanMerchantName(merchant);
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const accountPatterns = [
            /A\/c\s+([X*\d]+)/i,
            /Account\s+([X*\d]+)/i,
            /Acc\s+([X*\d]+)/i
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
        const balancePatterns = [
            /Avl\s+Bal\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Available\s+Balance\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Balance[:.]?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of balancePatterns) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match[1].replace(/,/g, "");
                const num = parseFloat(balanceStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {
        const refPatterns = [
            /ref[:#]?\s*([\w]+)/i,
            /txn[:#]?\s*([\w]+)/i,
            /transaction\s+id[:#]?\s*([\w]+)/i
        ];

        for (const pattern of refPatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return super.extractReference(message);
    }
}