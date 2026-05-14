import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for M-PESA (Kenya) mobile money SMS messages
 *
 * Handles formats like:
 * - "Ksh70.00 paid to Person Name on 20/10/24"
 * - "Ksh1000.00 sent to Equity Paybill Account for account 123123"
 * - "You have received Ksh300.00 from Person Name"
 * - "Ksh50.00 sent to Person Name 0711 111 111"
 *
 * Common patterns:
 * - Transaction ID: 10-character alphanumeric (e.g., TJK6H7T3GA)
 * - "Confirmed." at start
 * - "New M-PESA balance is Ksh..."
 * Currency: KES (Kenyan Shilling)
 */
export class MPESAParser extends BankParser {

    getBankName() {
        return "M-PESA";
    }

    getCurrency() {
        return "KES";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("MPESA") ||
            normalizedSender.includes("M-PESA") ||
            normalizedSender === "MPESA" ||
            normalizedSender === "M-PESA"
        );
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "Ksh70.00 paid" or "Ksh1,120.00 paid" or "Ksh1000.00 sent"
        const amountPattern = /Ksh([0-9,]+(?:\.[0-9]{2})?)\s+(?:paid|sent|received)/i;

        let match = message.match(amountPattern);

        if (match) {
            const amountStr = match[1].replace(/,/g, "");
            const num = parseFloat(amountStr);

            return isNaN(num) ? null : num;
        }

        // Pattern 2: "received Ksh300.00 from"
        const receivedPattern = /received\s+Ksh([0-9,]+(?:\.[0-9]{2})?)/i;

        match = message.match(receivedPattern);

        if (match) {
            const amountStr = match[1].replace(/,/g, "");
            const num = parseFloat(amountStr);

            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        // "You have received" = income
        if (
            lowerMessage.includes("you have received") ||
            lowerMessage.includes("received ksh")
        ) {
            return TransactionType.INCOME;
        }

        // "paid to" or "sent to" = expense
        if (
            lowerMessage.includes("paid to") ||
            lowerMessage.includes("sent to")
        ) {
            return TransactionType.EXPENSE;
        }

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: "paid to Person Name. on DATE" or "paid to Person 4 1. on DATE"
        // Capture everything before " number. on" pattern
        const paidToPattern = /paid to\s+(.+?)\s+\d+\.\s+on/i;

        let match = message.match(paidToPattern);

        if (match) {
            let merchant = match[1].trim();

            merchant = this.cleanMerchantName(merchant);

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 2: "sent to Person 2 0711 111 111" (with phone number - spaced format)
        const sentToPhonePattern = /sent to\s+(.+?)\s+0\d{3}\s+\d{3}\s+\d{3}/i;

        match = message.match(sentToPhonePattern);

        if (match) {
            let merchant = match[1].trim();

            merchant = this.cleanMerchantName(merchant);

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 3: "sent to PAYBILL_NAME for account NUMBER"
        const sentToAccountPattern = /sent to\s+(.+?)\s+for account/i;

        match = message.match(sentToAccountPattern);

        if (match) {
            let merchant = match[1].trim();

            merchant = this.cleanMerchantName(merchant);

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 4: "received from Person 3 0712121212"
        // or "from BANK OF BARODA KENYA LIMITED 123123"
        const receivedFromPattern =
            /received\s+(?:Ksh[0-9,]+(?:\.[0-9]{2})?\s+)?from\s+(.+?)\s+on/i;

        match = message.match(receivedFromPattern);

        if (match) {
            let merchant = match[1].trim();

            // Remove trailing period (for "LOOP B2C.")
            merchant = merchant.replace(/\.$/, "").trim();

            // Remove phone numbers at the end (10 digits without country code)
            merchant = merchant.replace(/\s+0\d{10}$/i, "");

            // Remove account numbers at the end (6+ digits)
            merchant = merchant.replace(/\s+\d{6,}$/i, "").trim();

            merchant = this.cleanMerchantName(merchant);

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 5: "from COMPANY NAME. on DATE"
        const fromPattern = /from\s+([^.]+)\.\s+on/i;

        match = message.match(fromPattern);

        if (match) {
            let merchant = match[1].trim();

            // Remove phone numbers at the end
            merchant = merchant.replace(/\s+0\d{10}$/i, "");

            merchant = this.cleanMerchantName(merchant);

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        // Pattern: "New M-PESA balance is Ksh123.12"
        const balancePattern =
            /New M-PESA balance is Ksh([0-9,]+(?:\.[0-9]{2})?)/i;

        const match = message.match(balancePattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractReference(message: string): string | null {
        // Pattern 1: Transaction ID at the start
        const txnIdPattern = /^([A-Z0-9]{10})\s+Confirmed/i;

        let match = message.match(txnIdPattern);

        if (match) {
            return match[1];
        }

        // Pattern 2: Alternative pattern
        const txnIdAltPattern = /^([A-Z0-9]{10})\s+Confirmed\./i;

        match = message.match(txnIdAltPattern);

        if (match) {
            return match[1];
        }

        // Pattern 3: After "Congratulations! "
        const congratsPattern =
            /Congratulations!\s+([A-Z0-9]{10})\s+confirmed/i;

        match = message.match(congratsPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Skip promotional messages that don't have "Confirmed"
        if (!lowerMessage.includes("confirmed")) {
            return false;
        }

        // Must contain transaction keywords
        const transactionKeywords = [
            "paid to",
            "sent to",
            "received",
            "new m-pesa balance"
        ];

        return transactionKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }

    cleanMerchantName(merchant: string): string {
        // For M-PESA, keep "LIMITED" in company names
        return merchant
            .replace(/\s*\(.*?\)\s*$/i, "") // Remove trailing parentheses
            .replace(/\s+Ref\s+No.*/i, "") // Remove ref numbers
            .replace(/\s+on\s+\d{2}.*/i, "") // Remove date suffixes
            .replace(/\s+UPI.*/i, "") // Remove UPI suffixes
            .replace(/\s+at\s+\d{2}:\d{2}.*/i, "") // Remove time suffixes
            .replace(/\s*-\s*$/i, "") // Remove trailing dash
            .trim();
    }
}