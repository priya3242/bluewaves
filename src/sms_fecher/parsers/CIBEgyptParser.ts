import { ParsedTransaction, TransactionType } from '../core/types';

/**
 * Base parser class for all banks
 */
export abstract class BankParser {

    /**
     * Must be implemented by every parser
     */
    abstract getBankName(): string;

    /**
     * Default currency
     */
    getCurrency(): string {
        return 'INR';
    }

    /**
     * Check if parser can handle sender
     */
    canHandle(sender: string): boolean {
        return false;
    }

    /**
     * Main parse function
     */
    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        // Check sender
        if (!this.canHandle(sender)) {
            return null;
        }

        // Check transaction message
        if (!this.isTransactionMessage(smsBody)) {
            return null;
        }

        // Extract amount
        const amount = this.extractAmount(smsBody);

        if (amount == null || Number.isNaN(amount)) {
            return null;
        }

        // Extract transaction type
        const type = this.extractTransactionType(smsBody);

        if (type == null) {
            return null;
        }

        // Build parsed transaction
        return {
            amount,
            type,
            merchant: this.extractMerchant(smsBody, sender),
            reference: this.extractReference(smsBody),
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),
            creditLimit: this.extractAvailableLimit(smsBody),
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.detectIsCard(smsBody),
            currency: this.extractCurrency(smsBody) ?? this.getCurrency()
        };
    }

    /**
     * Detect transaction message
     */
    isTransactionMessage(message: string): boolean {
        return false;
    }

    /**
     * Extract amount
     */
    extractAmount(message: string): number | null {
        return null;
    }

    /**
     * Extract transaction type
     */
    extractTransactionType(message: string): TransactionType | null {
        return null;
    }

    /**
     * Extract merchant
     */
    extractMerchant(
        message: string,
        sender: string
    ): string | null {
        return null;
    }

    /**
     * Extract last 4 digits
     */
    extractAccountLast4(message: string): string | null {
        return null;
    }

    /**
     * Extract balance
     */
    extractBalance(message: string): number | null {
        return null;
    }

    /**
     * Extract available credit limit
     */
    extractAvailableLimit(message: string): number | null {
        return null;
    }

    /**
     * Extract reference number
     */
    extractReference(message: string): string | null {
        return null;
    }

    /**
     * Extract currency
     */
    extractCurrency(message: string): string | null {
        return null;
    }

    /**
     * Detect card transaction
     */
    detectIsCard(message: string): boolean {
        return false;
    }

    /**
     * Clean merchant name
     */
    cleanMerchantName(merchant: string): string {
        return merchant
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s&@.\-/]/g, '')
            .trim();
    }

    /**
     * Validate merchant name
     */
    isValidMerchantName(merchant: string): boolean {

        if (!merchant) {
            return false;
        }

        if (merchant.length < 2) {
            return false;
        }

        if (/^\d+$/.test(merchant)) {
            return false;
        }

        return true;
    }

    /**
     * Extract last 4 digits from masked value
     */
    extractLast4Digits(value: string): string | null {

        if (!value) {
            return null;
        }

        const digits = value.replace(/\D/g, '');

        if (digits.length < 4) {
            return null;
        }

        return digits.slice(-4);
    }
}