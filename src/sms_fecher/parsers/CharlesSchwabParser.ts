import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Charles Schwab Bank
 * Handles USD debit card and ATM transactions
 */
export class CharlesSchwabParser extends BankParser {
    getBankName(): string {
        return 'Charles Schwab';
    }

    getCurrency(): string {
        return 'USD';
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            upperSender === 'SCHWAB' ||
            upperSender.includes('CHARLES SCHWAB') ||
            upperSender.includes('SCHWAB BANK') ||
            upperSender === '24465' ||
            /^[A-Z]{2}-SCHWAB-[A-Z]$/i.test(upperSender)
        );
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
        if (amount === null) {
            return null;
        }

        const type = this.extractTransactionType(smsBody);
        if (type === null) {
            return null;
        }

        return {
            amount,
            type,
            merchant: this.extractMerchant(smsBody, sender),
            reference: this.extractReference(smsBody),
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),
            creditLimit: null,
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.detectIsCard(smsBody),
            currency: this.detectCurrency(smsBody)
        };
    }

    detectCurrency(message: string): string {
        const symbolToCurrencyMap: Record<string, string> = {
            '€': 'EUR',
            '£': 'GBP',
            '₹': 'INR',
            '¥': 'JPY',
            '฿': 'THB',
            '₩': 'KRW',
            '$': 'USD',
            'C$': 'CAD',
            'A$': 'AUD',
            'S$': 'SGD',
            'ብር': 'ETB'
        };

        for (const symbol of Object.keys(symbolToCurrencyMap)) {
            if (message.includes(symbol)) {
                return symbolToCurrencyMap[symbol];
            }
        }

        const currencyCodePattern =
            /(?:A\s+)?([A-Z]{3})\s*[0-9,]+(?:\.[0-9]{2})?/i;

        const match = message.match(currencyCodePattern);

        if (match) {
            return match[1].toUpperCase();
        }

        return this.getCurrency();
    }

    extractAmount(message: string): number | null {
        const patterns: RegExp[] = [
            /A\s+\$([0-9,]+(?:\.[0-9]{2})?)\s+debit card transaction/i,
            /A\s+\$([0-9,]+(?:\.[0-9]{2})?)\s+ATM transaction/i,
            /A\s+\$([0-9,]+(?:\.[0-9]{2})?)\s+ACH transaction/i,
            /A\s+\$([0-9,]+(?:\.[0-9]{2})?)\s+ACH was debited/i,

            /A\s+[€£₹¥฿₩ብር]\s*([0-9,]+(?:\.[0-9]{2})?)\s+debit card transaction/i,
            /A\s+[€£₹¥฿₩ብር]\s*([0-9,]+(?:\.[0-9]{2})?)\s+ATM transaction/i,
            /A\s+[€£₹¥฿₩ብር]\s*([0-9,]+(?:\.[0-9]{2})?)\s+ACH transaction/i,

            /A\s+[A-Z]{3}\s*([0-9,]+(?:\.[0-9]{2})?)\s+debit card transaction/i,
            /A\s+[A-Z]{3}\s*([0-9,]+(?:\.[0-9]{2})?)\s+ATM transaction/i,
            /A\s+[A-Z]{3}\s*([0-9,]+(?:\.[0-9]{2})?)\s+ACH transaction/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                const amountStr = match[1].replace(/,/g, '');
                const amount = parseFloat(amountStr);

                return isNaN(amount) ? null : amount;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes('debit card transaction') ||
            lowerMessage.includes('atm transaction') ||
            lowerMessage.includes('ach transaction') ||
            lowerMessage.includes('ach was debited') ||
            lowerMessage.includes('was debited')
        ) {
            return TransactionType.EXPENSE;
        }

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        const patterns: RegExp[] = [
            /account ending (\d{4})/i,
            /account.*ending (\d{4})/i,
            /from account ending (\d{4})/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                return match[1];
            }
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('reply stop to end')) {
            if (
                !lowerMessage.includes('transaction') &&
                !lowerMessage.includes('debited')
            ) {
                return false;
            }
        }

        const schwabTransactionKeywords = [
            'debit card transaction was debited',
            'atm transaction was debited',
            'ach was debited',
            'transaction was debited from account'
        ];

        if (
            schwabTransactionKeywords.some(keyword =>
                lowerMessage.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    detectIsCard(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('debit card transaction')) {
            return true;
        }

        if (lowerMessage.includes('atm transaction')) {
            return true;
        }

        if (lowerMessage.includes('ach transaction')) {
            return false;
        }

        return super.detectIsCard(message);
    }
}