import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for CRED credit card payment SMS messages.
 *
 * Example:
 * "Payment of Rs.XX,XXX has been successfully credited towards your
 * ICICI Bank Credit Card. Your payment was settled in 3 seconds - CRED"
 *
 * Sender:
 * JK-CREDIN-S, AX-CREDIN-S, etc.
 *
 * These messages represent credit card bill payments,
 * which should be treated as transfers.
 */
export class CredParser extends BankParser {

    getBankName() {
        return "CRED";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            /^[A-Z]{2}-CREDIN-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-CRED-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-CRED-S$/i.test(normalizedSender) ||
            normalizedSender === "CRED" ||
            normalizedSender === "CREDIN"
        );
    }

    extractAmount(message: string): number | null {
        // Matches:
        // Rs.12,345
        // Rs 12,345.67
        const amountPattern =
            /Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(amountPattern);

        if (match) {
            const amountStr = match[1].replace(/,/g, "");
            const num = parseFloat(amountStr);

            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Example:
        // "credited towards your ICICI Bank Credit Card"

        const towardsPattern =
            /towards\s+your\s+(.+?)\s+Credit\s+Card/i;

        const match = message.match(towardsPattern);

        if (match) {
            const cardName = match[1].trim();

            if (cardName.length > 0) {
                return `${cardName} Credit Card`;
            }
        }

        // Default fallback
        return super.extractMerchant(message, sender) || "CRED";
    }

    extractTransactionType(message: string): TransactionType {
        // Credit card bill payments are transfers
        return TransactionType.TRANSFER;
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        return (
            lowerMessage.includes("payment of") &&
            lowerMessage.includes("credited towards your")
        );
    }
}