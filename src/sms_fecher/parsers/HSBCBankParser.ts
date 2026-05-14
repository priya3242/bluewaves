import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for HSBC Bank SMS messages
 */
export class HSBCBankParser extends BankParser {

    getBankName(): string {
        return "HSBC Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("HSBC") ||
            normalizedSender.includes("HSBCIN") ||
            /^[A-Z]{2}-HSBCIN-[A-Z]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-HSBC-[A-Z]$/i.test(normalizedSender)
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        if (!this.canHandle(sender)) return null;
        if (!this.isTransactionMessage(smsBody)) return null;

        const amount = this.extractAmount(smsBody);
        if (amount == null) return null;

        const transactionType = this.extractTransactionType(smsBody);
        if (transactionType == null) return null;

        const merchant =
            this.extractMerchant(smsBody, sender) || "Unknown";

        const currency = this.detectCurrency(smsBody);

        return {
            amount,
            type: transactionType,
            merchant,
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),
            creditLimit: this.extractAvailableLimit(smsBody),
            reference: this.extractReference(smsBody),
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.detectIsCard(smsBody),
            currency
        };
    }

    private detectCurrency(message: string): string {
        const currencyPattern =
            /(EGP|INR|USD|GBP|EUR|AED|SAR|OMR|BHD|KWD|QAR)\s+[\d,]+/i;

        const match = message.match(currencyPattern);

        return match?.[1]?.toUpperCase() || "INR";
    }

    extractAmount(message: string): number | null {

        const cur =
            '(?:INR|EGP|USD|GBP|EUR|AED|SAR|OMR|BHD|KWD|QAR)';

        const patterns = [
            new RegExp(
                `${cur}\\s+([\\d,]+(?:\\.\\d+)?)\\s+is\\s+(?:paid|credited|debited)`,
                'i'
            ),

            new RegExp(
                `for\\s+${cur}\\s+([\\d,]+(?:\\.\\d+)?)\\s+on`,
                'i'
            ),

            new RegExp(
                `used\\s+for\\s+${cur}\\s+([\\d,]+(?:\\.\\d+)?)\\s+on`,
                'i'
            ),

            new RegExp(
                `for\\s+${cur}\\s+([\\d,]+(?:\\.\\d+)?)(?:\\s|$|\\.)`,
                'i'
            )
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                const num = parseFloat(
                    match[1].replace(/,/g, '')
                );

                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // Outgoing NEFT/RTGS/IMPS
        const outgoingNeftPattern =
            /credited\s+to\s+the\s+\w+\s+A\/c\s+[X\d*]+\s+of\s+(.+?)\s+on\s+/i;

        let match = message.match(outgoingNeftPattern);

        if (match) {
            const beneficiary = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(beneficiary)) {
                return beneficiary;
            }
        }

        // NEFT/RTGS incoming
        const neftCreditPattern =
            /as\s+(?:NEFT|RTGS|IMPS)\s+from\s+(.+?)\s+\./i;

        match = message.match(neftCreditPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // at IKEA INDIA .
        const atMerchantPattern =
            /at\s+([^.]+?)\s*\./i;

        match = message.match(atMerchantPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // used at AMAZON for INR
        const creditCardPattern =
            /used\s+at\s+(.+?)\s+for\s+(?:INR|EGP|USD|GBP|EUR)/i;

        match = message.match(creditCardPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // to merchant on date
        const paymentPattern =
            /to\s+([^.]+?)\s+on\s+\d/i;

        match = message.match(paymentPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // from merchant
        const creditPattern =
            /from\s+([^.]+?)(?:\s+on\s+|\s+with\s+|$)/i;

        match = message.match(creditPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    cleanMerchantName(merchant: string): string {
        let cleaned = super.cleanMerchantName(merchant);

        cleaned = cleaned.replace(
            /\s+for\s+INR\s+[\d,]+(?:\.\d{2})?$/i,
            ''
        );

        return cleaned.trim();
    }

    extractAccountLast4(message: string): string | null {

        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const patterns = [
            /(?:Credit\s+Card|Debit\s+Card|Card)\s+ending\s+with\s+([*\dXx]+)/i,
            /A\/c\s+([\d\-*Xx]+)/i,
            /Debit\s+Card\s+([Xx*\d]+)/i,
            /credit\s*card\s+([Xx*\d]+)/i,
            /account\s+([Xx*\d]+)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractReference(message: string): string | null {

        const utrPattern =
            /with\s+UTR\s+(\w+)/i;

        let match = message.match(utrPattern);

        if (match) {
            return match[1];
        }

        const refPattern =
            /with\s+ref\s+(\w+)/i;

        match = message.match(refPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractBalance(message: string): number | null {

        const cur =
            '(?:INR|EGP|USD|GBP|EUR|AED|SAR|OMR|BHD|KWD|QAR)';

        const patterns = [
            new RegExp(
                `(?:Your\\s+)?Avl\\s+Bal\\s+is\\s+${cur}\\s+([\\d,]+(?:\\.\\d+)?)`,
                'i'
            ),

            new RegExp(
                `available\\s+bal\\s+is\\s+${cur}\\s+([\\d,]+(?:\\.\\d+)?)`,
                'i'
            )
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                const num = parseFloat(
                    match[1].replace(/,/g, '')
                );

                return isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    extractAvailableLimit(message: string): number | null {

        const limitPattern =
            /available\s+limit\s+is\s+(?:INR|EGP|USD|GBP|EUR|AED|SAR|OMR|BHD|KWD|QAR)\s+([\d,]+(?:\.\d+)?)/i;

        const match = message.match(limitPattern);

        if (match) {
            const num = parseFloat(
                match[1].replace(/,/g, '')
            );

            return isNaN(num) ? null : num;
        }

        return super.extractAvailableLimit(message);
    }

    extractTransactionType(message: string): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("debit card") &&
            lowerMessage.includes("thank you for using")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes("debit card") &&
            lowerMessage.includes("for inr")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes("creditcard") ||
            lowerMessage.includes("credit card")
        ) {
            return TransactionType.CREDIT;
        }

        if (this.isOutgoingNeftTransfer(message)) {
            return TransactionType.TRANSFER;
        }

        if (
            lowerMessage.includes("is paid from") ||
            lowerMessage.includes("is debited")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes("is credited to") ||
            lowerMessage.includes("is credited with") ||
            lowerMessage.includes("deposited")
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }

    /**
     * Detect outgoing NEFT/RTGS/IMPS transfer
     */
    private isOutgoingNeftTransfer(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        if (
            !lowerMessage.includes("neft") &&
            !lowerMessage.includes("rtgs") &&
            !lowerMessage.includes("imps")
        ) {
            return false;
        }

        const creditedToOtherBankPattern =
            /credited\s+to\s+the\s+(\w+)\s+A\/c/i;

        const match = message.match(
            creditedToOtherBankPattern
        );

        if (match) {
            const bankName = match[1].toUpperCase();

            if (bankName !== "HSBC") {
                return true;
            }
        }

        if (
            lowerMessage.includes("credited to") &&
            /A\/c\s+[X\d*]+\s+of\s+\w+/i.test(message)
        ) {
            return true;
        }

        return false;
    }

    isTransactionMessage(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        // Skip OTP
        if (
            lowerMessage.includes("otp is") ||
            lowerMessage.includes("otp valid for")
        ) {
            return false;
        }

        if (
            lowerMessage.includes("is paid from") ||
            lowerMessage.includes("is credited to") ||
            lowerMessage.includes("is debited") ||
            lowerMessage.includes("has been used for") ||
            (
                lowerMessage.includes("creditcard") &&
                lowerMessage.includes("used at")
            ) ||
            (
                lowerMessage.includes("credit card") &&
                lowerMessage.includes("used at")
            ) ||
            (
                lowerMessage.includes("credit card") &&
                lowerMessage.includes("used for")
            ) ||
            (
                lowerMessage.includes("thank you for using") &&
                lowerMessage.includes("card")
            ) ||
            (
                lowerMessage.includes("debit card") &&
                lowerMessage.includes("for inr")
            ) ||
            (
                lowerMessage.includes("inr") &&
                lowerMessage.includes("account")
            ) ||
            (
                lowerMessage.includes("egp") &&
                lowerMessage.includes("card")
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}