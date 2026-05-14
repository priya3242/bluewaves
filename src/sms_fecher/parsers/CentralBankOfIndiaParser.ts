import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Central Bank of India (CBoI) SMS messages
 */
export class CentralBankOfIndiaParser extends BankParser {

    getBankName(): string {
        return "Central Bank of India";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("CENTBK") ||
            normalizedSender.includes("CBOI") ||
            normalizedSender.includes("CENTRALBANK") ||
            normalizedSender.includes("CENTRAL") ||
            /^[A-Z]{2}-CENTBK-[A-Z]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-CBOI-[A-Z]$/i.test(normalizedSender)
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        if (!this.canHandle(sender)) {
            return null;
        }

        if (!this.isTransactionMessage(smsBody)) {
            return null;
        }

        const amount = this.extractAmount(smsBody);
        const transactionType = this.extractTransactionType(smsBody);

        if (amount === null || transactionType === null) {
            return null;
        }

        const merchant =
            this.extractMerchant(smsBody, sender) || "Unknown";

        return {
            amount,
            type: transactionType,
            merchant,
            reference: this.extractReference(smsBody),
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),

            // Required ParsedTransaction fields
            creditLimit: null,
            isFromCard: false,
            currency: "INR",

            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName()
        };
    }

    extractAmount(message: string): number | null {

        // Pattern 1: Credited by Rs.50.00
        const pattern1 =
            /(?:Credited|Debited)\s+by\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)/i;

        let match = message.match(pattern1);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        // Pattern 2: Rs.XXX credited/debited
        const pattern2 =
            /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+(?:credited|debited)/i;

        match = message.match(pattern2);

        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // Pattern 1: By.NAME
        const byPattern =
            /By[.\s]+(.+?)(?:-CBoI|-CBOI|-CENTBK|$)/i;

        let match = message.match(byPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 2: from NAME
        const fromPattern =
            /from\s+([A-Z0-9@._-]+)(?:\s+via|\s+Ref|\s+\.|$)/i;

        match = message.match(fromPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.includes("X")) {
                return "UPI Transfer";
            }

            return this.cleanMerchantName(merchant);
        }

        // Pattern 3: to NAME
        const toPattern =
            /to\s+([A-Z0-9@._-]+)(?:\s+via|\s+Ref|\s+\.|$)/i;

        match = message.match(toPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 4: via UPI
        if (message.includes("via UPI")) {

            if (message.includes("Credited")) {
                return "UPI Credit";
            }

            if (message.includes("Debited")) {
                return "UPI Payment";
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // A/c xxxxxx1234
        const acSlashPattern = /A\/c\s+([xX*\d]+)/i;

        let match = message.match(acSlashPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // account XX3113
        const pattern1 = /account\s+([xX*\d]+)/i;

        match = message.match(pattern1);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // A/C ending XXXX
        const pattern2 = /A\/C\s+ending\s+([xX*\d]+)/i;

        match = message.match(pattern2);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractBalance(message: string): number | null {

        // Total Bal Rs.0000.99 CR
        const totalBalPattern =
            /Total\s+Bal\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+(CR|DR)/i;

        let match = message.match(totalBalPattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const type = match[2].toUpperCase();

            const balance = parseFloat(balanceStr);

            if (isNaN(balance)) {
                return null;
            }

            return type === "DR" ? -balance : balance;
        }

        // Clear Bal Rs.XXX CR
        const clearBalPattern =
            /Clear\s+Bal\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+(CR|DR)/i;

        match = message.match(clearBalPattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const type = match[2].toUpperCase();

            const balance = parseFloat(balanceStr);

            if (isNaN(balance)) {
                return null;
            }

            return type === "DR" ? -balance : balance;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        const pattern = /Ref\s+No\.?\s*(\w+)/i;

        const match = message.match(pattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractTransactionType(message: string): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("credited") ||
            lowerMessage.includes("deposited") ||
            lowerMessage.includes("received")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes("debited") ||
            lowerMessage.includes("withdrawn") ||
            lowerMessage.includes("paid")
        ) {
            return TransactionType.EXPENSE;
        }

        return super.extractTransactionType(message);
    }

    isTransactionMessage(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        if (
            (
                lowerMessage.includes("credited by") ||
                lowerMessage.includes("debited by")
            ) &&
            lowerMessage.includes("bal")
        ) {
            return true;
        }

        if (lowerMessage.includes("-cboi")) {
            return (
                lowerMessage.includes("credited") ||
                lowerMessage.includes("debited")
            );
        }

        return super.isTransactionMessage(message);
    }
}