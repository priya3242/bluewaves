import { TransactionType, ParsedTransaction } from '../core/types';
import { UAEBankParser } from './UAEBankParser';

export class FABParser extends UAEBankParser {

    getBankName(): string {
        return "First Abu Dhabi Bank";
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        if (!this.isTransactionMessage(smsBody)) {
            return null;
        }

        const amount = this.extractAmount(smsBody);

        if (amount == null) {
            return null;
        }

        const type = this.extractTransactionType(smsBody);

        if (type == null) {
            return null;
        }

        const currency = this.extractCurrency(smsBody) || "AED";

        let availableLimit: number | null = null;

        if (type === TransactionType.CREDIT) {
            availableLimit = this.extractAvailableLimit(smsBody);
        }

        let fromAccount: string | null = null;
        let toAccount: string | null = null;

        if (type === TransactionType.TRANSFER) {
            const accounts = this.extractTransferAccounts(smsBody);

            fromAccount = accounts[0];
            toAccount = accounts[1];
        }

        return {
            amount,
            type,
            merchant: this.extractMerchant(smsBody, sender),
            reference: this.extractReference(smsBody),
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),
            creditLimit: availableLimit,
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.containsCardPurchase(smsBody),
            currency,
            fromAccount,
            toAccount
        };
    }

    canHandle(sender: string): boolean {

        const upperSender = sender.toUpperCase();

        return (
            upperSender === "FAB" ||
            upperSender.includes("FABBANK") ||
            upperSender.includes("ADFAB") ||
            /^[A-Z]{2}-FAB-[A-Z]$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {

        // Generic ISO currency pattern
        const currencyPattern = /([A-Z]{3})\s+\*?([0-9,]+(?:\.\d{2})?)/i;

        const patterns = [
            /funds transfer request of\s+[A-Z]{3}\s+\*?([0-9,]+(?:\.\d{2})?)/i,
            /for\s+[A-Z]{3}\s+\*?([0-9,]+(?:\.\d{2})?)/i,
            /Amount\s*[A-Z]{3}\s+\*?([0-9,]+(?:\.\d{2})?)/i,
            /payment.*?[A-Z]{3}\s+\*?([0-9,]+(?:\.\d{2})?)/i,
            currencyPattern
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {

                const amountStr = match[1]
                    .replace(/,/g, "")
                    .replace(/\*/g, "");

                const num = parseFloat(amountStr);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractAmount(message);
    }

    extractCurrency(message: string): string | null {

        const match = message.match(/([A-Z]{3})\s+\*?[0-9,]+(?:\.\d{2})?/i);

        if (match) {
            return match[1].toUpperCase();
        }

        return "AED";
    }

    extractTransactionType(message: string): TransactionType | null {

        const lower = message.toLowerCase();

        if (
            lower.includes("credit card purchase") ||
            lower.includes("debit card purchase") ||
            lower.includes("atm cash withdrawal")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("inward remittance") ||
            lower.includes("cheque credited") ||
            lower.includes("cash deposit")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lower.includes("outward remittance") ||
            lower.includes("funds transfer request")
        ) {
            return TransactionType.TRANSFER;
        }

        if (lower.includes("credited")) {
            return TransactionType.INCOME;
        }

        if (lower.includes("debited")) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        if (this.containsCardPurchase(message)) {

            const singleLinePattern =
                /(?:Credit|Debit)\s+Card\s+Purchase\s+Card\s+No\s+[X\d]+\s+[A-Z]{3}\s+[\d,.]+\s+([^0-9]+?)(?:\s+\d{2}\/\d{2}\/\d{2})/i;

            const match = message.match(singleLinePattern);

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        if (message.includes("funds transfer request")) {

            const accounts = this.extractTransferAccounts(message);

            if (accounts[0]) {
                return accounts[0];
            }
        }

        return this.extractStandardAccountLast4(message);
    }

    extractBalance(message: string): number | null {

        const balancePattern =
            /Available\s+Balance\s+(?:is\s+)?(?:[A-Z]{3})?\s*\*?([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(balancePattern);

        if (match) {

            const balanceStr = match[1]
                .replace(/,/g, "")
                .replace(/\*/g, "");

            const num = parseFloat(balanceStr);

            return Number.isNaN(num)
                ? null
                : num;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        const dateTimePattern =
            /(\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/i;

        const match = message.match(dateTimePattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    shouldParseTransactionMessage(message: string): boolean {
        return this.isTransactionMessage(message);
    }

    private extractStandardAccountLast4(
        message: string
    ): string | null {

        const patterns = [
            /Card\s+No\s+([X\d]+)/i,
            /Account\s+([X\d*]+)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    private extractTransferAccounts(
        message: string
    ): [string | null, string | null] {

        const fromMatch =
            message.match(/from\s+account\s+([X\d]{4,})/i);

        const toMatch =
            message.match(/to\s+account\s+([X\d]{4,})/i);

        const from = fromMatch
            ? this.extractLast4Digits(fromMatch[1])
            : null;

        const to = toMatch
            ? this.extractLast4Digits(toMatch[1])
            : null;

        return [from, to];
    }

    containsCardPurchase(message: string): boolean {

        const lower = message.toLowerCase();

        return (
            lower.includes("credit card purchase") ||
            lower.includes("debit card purchase")
        );
    }

    isTransactionMessage(message: string): boolean {

        const lower = message.toLowerCase();

        const keywords = [
            "credit card purchase",
            "debit card purchase",
            "inward remittance",
            "outward remittance",
            "atm cash withdrawal",
            "payment instructions",
            "has been processed",
            "cash deposit",
            "cheque credited",
            "cheque returned",
            "credited",
            "debited",
            "funds transfer request"
        ];

        return keywords.some(keyword =>
            lower.includes(keyword)
        );
    }
}