import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Dashen Bank - handles ETB currency transactions
 */
export class DashenBankParser extends BankParser {

    getBankName() {
        return "Dashen Bank";
    }

    getCurrency() {
        return "ETB"; // Ethiopian Birr
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase().trim();

        return normalized === "DASHENBANK";
    }

    /**
     * Extracts the transaction amount.
     * Always picks the first ETB amount, not the balance.
     */
    extractAmount(message: string): number | null {
        const amountPattern =
            /ETB\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        const match = message.match(amountPattern);

        if (match) {
            const raw = match[1].replace(/,/g, "");
            return this.parseScaledAmount(raw);
        }

        return super.extractAmount(message);
    }

    /**
     * Extracts transaction type from Dashen Bank messages.
     */
    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("has been credited")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("credited with")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("you have received")) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes("has been debited")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("debited with")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("debited from")) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // 1) Telebirr account (expense)
        // "credited to the Telebirr account +251922222222"

        const telebirrToPattern =
            /credited to the (Telebirr account [+\d]+)/i;

        let match = message.match(telebirrToPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return merchant;
            }
        }

        // 2) Transfer credit
        // "from PERSON NAME on on"

        const fromPersonPattern =
            /from\s+([A-Z][A-Z\s]*?)\s+on\s+on/i;

        match = message.match(fromPersonPattern);

        if (match) {
            const merchant = match[1].trim();

            if (
                merchant.length > 0 &&
                this.isValidMerchantName(merchant)
            ) {
                return merchant;
            }
        }

        // 3) Telebirr account (income)
        // "from telebirr account number 251922222222 Ref"

        const telebirrFromPattern =
            /from\s+(telebirr account number \d+)\s+Ref/i;

        match = message.match(telebirrFromPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Examples:
        // 5387********011
        // 5387*****9011

        const pattern = /(\d{4}\*+\d+)/i;

        const match = message.match(pattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractBalance(message: string): number | null {

        // "Your current balance is ETB 1,846.06"

        const currentBalancePattern =
            /Your\s+current\s+balance\s+is\s+ETB\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        let match = message.match(currentBalancePattern);

        if (match) {
            return this.parseScaledAmount(match[1]);
        }

        // "Your account balance is ETB 543.49"

        const accountBalancePattern =
            /Your\s+account\s+balance\s+is\s+ETB\s+([0-9,]+(?:\.[0-9]{1,2})?)/i;

        match = message.match(accountBalancePattern);

        if (match) {
            return this.parseScaledAmount(match[1]);
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        // Receipt URL

        const receiptUrlPattern =
            /(https:\/\/receipt\.dashensuperapp\.com\/receipt\/[^\s]+)/i;

        let match = message.match(receiptUrlPattern);

        if (match) {
            return match[1];
        }

        // Ref No:2209012000164277

        const refNoPattern =
            /Ref\s+No:(\d+)/i;

        match = message.match(refNoPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    private parseScaledAmount(rawAmount: string): number | null {
        try {
            const normalized = rawAmount.replace(/,/g, "");
            const parsed = parseFloat(normalized);

            if (isNaN(parsed)) {
                return null;
            }

            // Round to 2 decimal places
            return Math.round(parsed * 100) / 100;

        } catch {
            return null;
        }
    }
}