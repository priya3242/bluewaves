import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

export class AdelFiParser extends BankParser {

    getBankName() {
        return "AdelFi";
    }

    getCurrency() {
        return "USD";
    }

    canHandle(sender: string): boolean {
        return sender.includes("42141");
    }

    isTransactionMessage(message: string): boolean {
        return message.includes("Transaction Alert from AdelFi") &&
                message.includes("had a transaction of");
    }

    extractAmount(message: string): number | null {
        const amountPattern = /\(\$(\d+(?:\.\d{2})?)\)/i;
        const match = message.match(amountPattern);
        if (match) {
            const amount = parseFloat(match[1]);
            return isNaN(amount) ? null : amount;
        }
        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        const descriptionPattern = /Description:\s*(.+?)(?:\.\s*Date:|$)/i;
        const match = message.match(descriptionPattern);
        if (match) {
            const description = match[1].trim();
            if (description.length > 0) {
                const cleaned = description.replace(/^\d+\s+/i, "").trim();
                return this.cleanMerchantName(cleaned);
            }
        }
        return null;
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const accountPattern = /\*\*(\d{4})/i;
        const match = message.match(accountPattern);
        if (match) {
            return match[1];
        }
        return null;
    }

    extractTransactionType(message: string): TransactionType {
        return TransactionType.CREDIT;
    }
}
