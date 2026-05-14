import { CompiledPatterns } from '../core/patterns';
import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Greater Bank SMS messages.
 *
 * Supported formats:
 * - Debit alert:
 *   "Your Account XXXX5207 had a DEBIT transaction of RS. 100.00..."
 *
 * - UPI/IMPS transfer:
 *   "Your a/c no. XXXXXXXX5207 is debited for Rs.500..."
 */
export class GreaterBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return 'Greater Bank';
    }

    canHandle(sender: string): boolean {

        const upper = sender.toUpperCase();

        return (
            upper.includes('GRTRBN') ||
            upper.includes('GREATRBN') ||
            upper.includes('GREATERBNK') ||
            upper.includes('GREATERBANK') ||
            upper.includes('GREATER')
        );
    }

    extractAmount(message: string): number | null {

        const rsUpperPattern =
            /RS\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(rsUpperPattern);

        if (match) {

            const amountStr =
                match[1].replace(/,/g, '');

            const num = parseFloat(amountStr);

            return Number.isNaN(num)
                ? null
                : num;
        }

        return super.extractAmount(message);
    }

    extractAccountLast4(message: string): string | null {

        // Account XXXX5207
        const accountPattern =
            /Account\s+[X*]+(\d{4})/i;

        let match = message.match(accountPattern);

        if (match) {
            return match[1];
        }

        // a/c no. XXXXXXXX5207
        const acNoPattern =
            /a\/c\s+no\.?\s+[X*]+(\d{4})/i;

        match = message.match(acNoPattern);

        if (match) {
            return match[1];
        }

        return super.extractAccountLast4(message);
    }

    extractBalance(message: string): number | null {

        const balPattern =
            /available\s+balance\s+is\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(balPattern);

        if (match) {

            const balStr =
                match[1].replace(/,/g, '');

            const num = parseFloat(balStr);

            return Number.isNaN(num)
                ? null
                : num;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        const upiRefPattern =
            /UPI\s+Ref\s+no\s+(\d+)/i;

        const match = message.match(upiRefPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lower = message.toLowerCase();

        // UPI / IMPS transfer
        if (lower.includes('upi ref')) {
            return 'Bank Transfer';
        }

        // Generic debit alert
        if (lower.includes('debit transaction')) {
            return 'Debit Transaction';
        }

        // Generic credit alert
        if (lower.includes('credit transaction')) {
            return 'Credit Transaction';
        }

        return super.extractMerchant(message, sender);
    }

    isTransactionMessage(message: string): boolean {

        const lower = message.toLowerCase();

        if (
            lower.includes('debit transaction') ||
            lower.includes('credit transaction') ||
            lower.includes('is debited') ||
            lower.includes('is credited')
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lower = message.toLowerCase();

        if (
            lower.includes('debit transaction') ||
            lower.includes('is debited')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes('credit transaction') ||
            lower.includes('is credited')
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }
}