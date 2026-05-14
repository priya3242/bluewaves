import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Zemen Bank - handles ETB currency transactions
 */
export class ZemenBankParser extends BankParser {
    getBankName() {
        return "Zemen Bank";
    }

    getCurrency() {
        return "ETB"; // Ethiopian Birr
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase().trim();

        return (
            normalized === "ZEMEN BANK" ||
            normalized.replace(/\s+/g, "") === "ZEMENBANK" ||
            /^[A-Z]{2}-ZEMENBANK-[A-Z]$/i.test(normalized)
        );
    }

    /**
     * Zemen Bank messages use both "ETB" and "Birr".
     */
    extractAmount(message: string): number | null {
        const amountPattern =
            /(?:ETB|Birr)\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        const match = message.match(amountPattern);

        if (match) {
            const raw = match[1].replace(/,/g, "");
            return this.parseScaledAmount(raw);
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("has been credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("credited with")) return TransactionType.INCOME;

        if (lowerMessage.includes("has been debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debited with")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("fund transfer has been made from")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("pos transaction has been made from")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("atm cash withdrawal has been made from")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("you have transfered")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("you have transferred")) return TransactionType.EXPENSE;
        if (
            lowerMessage.includes("transferred") &&
            lowerMessage.includes("from a/c")
        ) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Telebirr wallet transfers
        const telebirrFromPattern =
            /from\s+(telebirr wallet\s+\d+)\s+with reference/i;

        let match = message.match(telebirrFromPattern);

        if (match) {
            return match[1];
        }

        const telebirrToPattern =
            /to\s+(telebirr wallet\s+\d+)\s+with reference/i;

        match = message.match(telebirrToPattern);

        if (match) {
            return match[1];
        }

        // External transfer to account
        const toAccountPattern = /to\s+A\/c\s+of\s+(\d{6,})/i;

        match = message.match(toAccountPattern);

        if (match) {
            return match[1].trim();
        }

        // From other bank
        const fromOtherBankPattern =
            /from\s+([^,.]+?)\s+with reference/i;

        match = message.match(fromOtherBankPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1]).trim();

            if (
                merchant.length > 0 &&
                this.isValidMerchantName(merchant)
            ) {
                return merchant;
            }
        }

        // POS purchase
        const posPurchasePattern =
            /pos purchase transaction at\s+(.+?)\s+on\s+\d{1,2}-[A-Za-z]{3}-\d{4}/i;

        match = message.match(posPurchasePattern);

        if (match) {
            return this.cleanMerchantName(match[1]).trim();
        }

        // POS location
        const posLocationPattern =
            /transaction POS location is\s+(.+?)\s*\./i;

        match = message.match(posLocationPattern);

        if (match) {
            return match[1].trim();
        }

        // External beneficiary
        const externalBeneficiaryPattern =
            /to\s+(.+?)\s+with reference/i;

        match = message.match(externalBeneficiaryPattern);

        if (match) {
            return match[1].trim();
        }

        // ATM location
        const atmLocationPattern =
            /transaction ATM location is\s+(.+?)\s*\./i;

        match = message.match(atmLocationPattern);

        if (match) {
            return match[1].trim();
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) return baseResult;

        const patterns = [
            /\b\d{3}x+(\d{4})\b/i,
            /\(\d{3}x+(\d{4})\)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                return match[1];
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        // Current balance
        const currentBalancePattern =
            /Your\s+Current\s+Balance\s+is\s+(?:ETB|Birr)\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        let match = message.match(currentBalancePattern);

        if (match) {
            return this.parseScaledAmount(match[1]);
        }

        // Available balance
        const availableBalancePattern =
            /A\/c\s+Available\s+Bal\.\s+is\s+(?:ETB|Birr)\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        match = message.match(availableBalancePattern);

        if (match) {
            return this.parseScaledAmount(match[1]);
        }

        // Your available balance
        const yourAvailableBalancePattern =
            /Your\s+available\s+balance\s+is\s+(?:ETB|Birr)\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        match = message.match(yourAvailableBalancePattern);

        if (match) {
            return this.parseScaledAmount(match[1]);
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {
        // Transaction reference number
        const txnRefPattern =
            /transaction reference number is\s+([A-Z0-9]+)/i;

        let match = message.match(txnRefPattern);

        if (match) {
            return match[1];
        }

        // With reference
        const withReferencePattern =
            /with reference\s+([A-Z0-9]+)/i;

        match = message.match(withReferencePattern);

        if (match) {
            return match[1];
        }

        // PDF receipt link
        const linkPattern =
            /(https:\/\/share\.zemenbank\.com\/[^\s]+?\/pdf)/i;

        match = message.match(linkPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const zemenKeywords = [
            "dear customer",
            "your account",
            "has been credited",
            "has been debited",
            "fund transfer has been made from",
            "pos transaction has been made from",
            "atm cash withdrawal has been made from",
            "current balance",
            "available bal.",
            "thank you for banking with zemen bank",
            "etb",
            "birr"
        ];

        if (
            zemenKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    private parseScaledAmount(rawAmount: string): number | null {
        const normalized = rawAmount.replace(/,/g, "");

        const num = parseFloat(normalized);

        if (Number.isNaN(num)) {
            return null;
        }

        // keep 2 decimal precision
        return Math.round(num * 100) / 100;
    }
}