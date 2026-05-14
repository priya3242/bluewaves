import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Indian Bank
 *
 * Common sender patterns:
 * - Service Implicit (transactions): XX-INDBNK-S
 * - OTP: XX-INDBNK-T
 * - Promotional: XX-INDBNK-P
 * - Direct: INDBNK, INDIAN
 */
export class IndianBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return 'Indian Bank';
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();

        return (
            normalized.includes('INDIAN BANK') ||
            normalized.includes('INDIANBANK') ||
            normalized.includes('INDIANBK') ||

            // DLT patterns
            /^[A-Z]{2}-INDBNK-S$/i.test(normalized) ||
            /^[A-Z]{2}-INDBNK-[TPG]$/i.test(normalized) ||
            /^[A-Z]{2}-INDBNK$/i.test(normalized) ||

            // Direct sender IDs
            normalized === 'INDBNK' ||
            normalized === 'INDIAN'
        );
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /debited\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /credited\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+credited\s+to/i,
            /withdrawn\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /UPI\s+payment\s+of\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                const amount = match[1].replace(/,/g, '');
                const num = parseFloat(amount);

                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        // Pattern: to Merchant Name
        const toPattern =
            /to\s+([^.\n]+?)(?:\.\s*UPI:|UPI:|$)/i;

        let match = message.match(toPattern);

        if (match) {
            const merchant = this.cleanMerchantName(
                match[1].trim()
            );

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern: from Sender Name
        const fromPattern =
            /from\s+([^.\n]+?)(?:\.\s*UPI:|UPI:|$)/i;

        match = message.match(fromPattern);

        if (match) {
            const merchant = this.cleanMerchantName(
                match[1].trim()
            );

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern: linked to VPA xyz@upi
        const vpaPattern =
            /VPA\s+([\w.-]+@[\w]+)/i;

        match = message.match(vpaPattern);

        if (match) {
            const vpa = match[1];
            const merchantFromVpa = vpa.split('@')[0];

            return this.cleanMerchantName(
                merchantFromVpa
            );
        }

        // ATM withdrawal
        const atmPattern =
            /ATM\s+(?:withdrawal\s+)?at\s+([^.\n]+?)(?:\s+on|$)/i;

        match = message.match(atmPattern);

        if (match) {
            const location = this.cleanMerchantName(
                match[1].trim()
            );

            if (this.isValidMerchantName(location)) {
                return `ATM - ${location}`;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult =
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // A/c *1234
        const pattern1 =
            /A\/c\s+([*X\d]+)/i;

        let match = message.match(pattern1);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Account XXXX1234
        const pattern2 =
            /Account\s+([X*\d]+)/i;

        match = message.match(pattern2);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // A/c ending 1234
        const pattern3 =
            /A\/c\s+ending\s+(\d{4})/i;

        match = message.match(pattern3);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractReference(message: string): string | null {

        // UPI:515314436916
        const upiRefPattern =
            /UPI:(\d+)/i;

        let match = message.match(upiRefPattern);

        if (match) {
            return match[1];
        }

        // UPI Ref no 917477824021
        const upiRefNoPattern =
            /UPI\s+Ref\s+no\s+(\d+)/i;

        match = message.match(upiRefNoPattern);

        if (match) {
            return match[1];
        }

        // Ref No. 123456
        const refNoPattern =
            /Ref\s+No\.?\s*([A-Za-z0-9]+)/i;

        match = message.match(refNoPattern);

        if (match) {
            return match[1];
        }

        // Transaction ID
        const txnIdPattern =
            /Transaction\s+ID:?\s*([A-Za-z0-9]+)/i;

        match = message.match(txnIdPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractBalance(message: string): number | null {

        // Bal Rs. 50000.00
        const balPattern1 =
            /Bal[:\s-]+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i;

        let match = message.match(balPattern1);

        if (match) {
            const balanceStr =
                match[1].replace(/,/g, '');

            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        // Available Balance: Rs. 25000
        const balPattern2 =
            /Available\s+Balance:?\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i;

        match = message.match(balPattern2);

        if (match) {
            const balanceStr =
                match[1].replace(/,/g, '');

            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage =
            message.toLowerCase();

        if (
            lowerMessage.includes('debited') ||
            lowerMessage.includes('withdrawn')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('upi payment') &&
            !lowerMessage.includes('received')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('credited') ||
            lowerMessage.includes('deposited') ||
            lowerMessage.includes('received')
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }

    /**
     * Checks if this is a mandate notification.
     */
    isMandateNotification(
        message: string
    ): boolean {

        return (
            this.isEMandateNotification(message) ||
            this.isFutureDebitNotification(message)
        );
    }

    /**
     * Parses mandate subscription information.
     */
    parseMandateSubscription(
        message: string
    ): IndianMandateInfo | null {

        const baseInfo =
            super.parseMandateSubscription(message);

        if (!baseInfo) {
            return null;
        }

        return new IndianMandateInfo(
            baseInfo.bankName,
            baseInfo.amount,
            baseInfo.merchant,
            baseInfo.nextDeductionDate,
            baseInfo.umn,
            baseInfo.dateFormat
        );
    }
}

/**
 * Mandate information for Indian Bank
 */
export class IndianMandateInfo {

    constructor(
        public bankName: string,
        public amount: number,
        public merchant: string,
        public nextDeductionDate: string | null,
        public umn: string | null,
        public dateFormat: string = 'dd-MMM-yy'
    ) { }
}