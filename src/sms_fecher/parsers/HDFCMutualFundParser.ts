import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * HDFC Mutual Fund parser for SIP purchase and redemption messages.
 * Handles senders like "AD-HDFCMF-AC", "VM-HDFCMF".
 */
export class HDFCMutualFundParser extends BaseIndianBankParser {

    getBankName(): string {
        return "HDFC Mutual Fund";
    }

    canHandle(sender: string): boolean {
        return sender.toUpperCase().includes("HDFCMF");
    }

    isTransactionMessage(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        const keywords = [
            "sip purchase",
            "has been processed",
            "folio",
            "nav",
            "redemption"
        ];

        return keywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }

    extractAmount(message: string): number | null {

        const pattern =
            /Rs\.?\s*([\d,]+(?:\.\d+)?)/i;

        const match = message.match(pattern);

        if (match) {
            const amountStr =
                match[1].replace(/,/g, '');

            const num = parseFloat(amountStr);

            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        // Example:
        // "under HDFC Flexi Cap Fund for Folio..."
        const pattern =
            /under\s+(.+?)\s+for/i;

        const match = message.match(pattern);

        if (match) {
            return this.cleanMerchantName(
                match[1].trim()
            );
        }

        return null;
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("sip purchase") ||
            lowerMessage.includes("purchase")
        ) {
            return TransactionType.INVESTMENT;
        }

        if (
            lowerMessage.includes("redemption")
        ) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractBalance(message: string): number | null {
        return null;
    }

    extractAccountLast4(message: string): string | null {
        return null;
    }
}