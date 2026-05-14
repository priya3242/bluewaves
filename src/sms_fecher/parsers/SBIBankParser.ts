import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

export class SBIBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "State Bank of India";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("SBI") ||
            normalizedSender.includes("SBIINB") ||
            normalizedSender.includes("SBIUPI") ||
            normalizedSender.includes("SBICRD") ||
            normalizedSender.includes("ATMSBI") ||
            normalizedSender === "SBIBK" ||
            normalizedSender === "SBIBNK" ||
            normalizedSender.includes("SBI CARDS") ||
            /^[A-Z]{2}-SBIBK-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-SBIBK-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-SBIBK$/i.test(normalizedSender) ||
            /^[A-Z]{2}-SBI$/i.test(normalizedSender)
        );
    }

    private isCreditCardMessage(sender: string, message: string): boolean {
        const upperSender = sender.toUpperCase();
        return upperSender.includes("SBICRD") ||
            upperSender.includes("SBI CARDS") ||
            message.includes("Credit Card");
    }

    private extractCreditCardLast4(message: string): string | null {
        const patterns = [
            /ending\s+with\s+(\d{4})/i,
            /ending\s+(\d{4})/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match) return match[1];
        }

        return null;
    }

    parse(smsBody: string, sender: string, timestamp: number) {
        const normalizedBody = this.normalizeUnicodeText(smsBody);
        const parsed = super.parse(normalizedBody, sender, timestamp);

        if (!parsed) return null;

        if (this.isCreditCardMessage(sender, normalizedBody)) {

            const cardLast4 =
                this.extractCreditCardLast4(normalizedBody) || parsed.accountLast4;

            const creditLimit =
                this.extractAvailableLimit(normalizedBody) ?? parsed.creditLimit;

            let type = parsed.type;

            if (
                normalizedBody.includes("credited to your SBI Credit Card")
            ) {
                type = TransactionType.INCOME;
            } else if (normalizedBody.includes("spent")) {
                type = TransactionType.EXPENSE;
            }

            let merchant = parsed.merchant;

            if (normalizedBody.includes("via BBPS")) {
                merchant = "BBPS Payment";
            }

            return {
                ...parsed,
                accountLast4: cardLast4,
                type,
                merchant,
                creditLimit,
                isFromCard: true
            };
        }

        return parsed;
    }

    private normalizeUnicodeText(text: string): string {
        return text
            .normalize('NFKD')
            .replace(/[^\x00-\x7F]/g, '');
    }

    extractAvailableLimit(message: string): number | null {
        const patterns = [
            /available\s+limit\s+is\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /available\s+limit.*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ''));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractAvailableLimit(message);
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+spent/i,
            /payment\s+of\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /debited\s+by\s+([0-9,]+(?:\.\d{1,2})?)/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ''));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("withdrawn")) return TransactionType.EXPENSE;
        if (lower.includes("transferred")) return TransactionType.EXPENSE;
        if (lower.includes("paid to")) return TransactionType.EXPENSE;
        if (lower.includes("atm withdrawal")) return TransactionType.EXPENSE;
        if (lower.includes("credit card")) return TransactionType.EXPENSE;

        return super.extractTransactionType(message);
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (lower.includes("e-statement")) return false;
        if (lower.includes("application")) return false;

        if (lower.includes("by sbi debit card")) return true;
        if (lower.includes("credit card") && lower.includes("spent")) return true;

        return super.isTransactionMessage(message);
    }
}