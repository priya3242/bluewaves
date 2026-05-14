import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

export class SouthIndianBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "South Indian Bank";
    }

    canHandle(sender: string): boolean {
        const upper = sender.toUpperCase();

        const sibSenders = [
            "SIBSMS",
            "AD-SIBSMS",
            "CP-SIBSMS",
            "SIBSMS-S",
            "AD-SIBSMS-S",
            "CP-SIBSMS-S",
            "SOUTHINDIANBANK",
            "SIBBANK"
        ];

        if (sibSenders.includes(upper)) return true;

        if (upper.includes("SIBSMS")) return true;
        if (upper.includes("SIBBANK")) return true;

        return (
            upper.startsWith("AD-SIB") ||
            upper.startsWith("CP-SIB") ||
            upper.startsWith("VM-SIB")
        );
    }

    parse(smsBody: string, sender: string, timestamp: number): ParsedTransaction | null {

        if (!this.isTransactionMessage(smsBody)) return null;

        const amount = this.extractAmount(smsBody);
        if (amount === null) return null;

        const type = this.extractTransactionType(smsBody);
        if (type === null) return null;

        const merchant = this.extractMerchant(smsBody, sender) ?? "Unknown";
        const reference = this.extractReference(smsBody);
        const accountLast4 = this.extractAccountLast4(smsBody);
        const balance = this.extractBalance(smsBody);

        return {
            amount,
            type,
            merchant,
            reference,
            accountLast4,
            balance,
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            currency: this.getCurrency?.() ?? "INR",

            // ✅ REQUIRED FIELDS
            creditLimit: null,
            isFromCard: this.detectIsCard?.(smsBody) ?? false,
        };
    }

    extractAmount(message: string): number | null {
        const pattern = /(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(pattern);
        if (!match) return null;

        const num = parseFloat(match[1].replace(/,/g, ""));
        return isNaN(num) ? null : num;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("debit")) return TransactionType.EXPENSE;
        if (lower.includes("withdrawn")) return TransactionType.EXPENSE;
        if (lower.includes("spent")) return TransactionType.EXPENSE;
        if (lower.includes("purchase")) return TransactionType.EXPENSE;
        if (lower.includes("paid")) return TransactionType.EXPENSE;
        if (lower.includes("transfer to")) return TransactionType.EXPENSE;

        if (lower.includes("credit")) return TransactionType.INCOME;
        if (lower.includes("deposited")) return TransactionType.INCOME;
        if (lower.includes("received")) return TransactionType.INCOME;
        if (lower.includes("refund")) return TransactionType.INCOME;
        if (lower.includes("transfer from")) return TransactionType.INCOME;
        if (lower.includes("cashback")) return TransactionType.INCOME;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {

        if (message.includes("ATM") || message.includes("withdrawn")) {
            return "ATM";
        }

        if (message.includes("UPI")) {
            const upiPattern = /to\s+([^,\s]+@[^\s,]+)/i;
            const match = message.match(upiPattern);

            if (match?.[1]) {
                return this.cleanMerchantName(match[1]);
            }

            return "UPI Transaction";
        }

        if (message.includes("IMPS")) {
            const impsPattern = /Info:\s*IMPS\/[^/]+\/[^/]+\/([A-Za-z\s]+?)(?:\.|Bal|Balance|$)/i;
            const match = message.match(impsPattern);

            if (match?.[1]) {
                return this.cleanMerchantName(match[1]);
            }

            return "IMPS Transfer";
        }

        const debitCreditPattern =
            /(?:DEBIT|CREDIT)[:\s]*Rs\.?\s*[0-9,]+(?:\.\d{2})?\s+([A-Z\s]+?)\s+(?:Bal|Available)/i;

        const match = message.match(debitCreditPattern);
        if (match?.[1]) {
            return this.cleanMerchantName(match[1]);
        }

        return super.extractMerchant(message, sender);
    }

    extractReference(message: string): string | null {

        const rrn = message.match(/RRN[:\s]*(\d{10,12})/i);
        if (rrn?.[1]) return rrn[1];

        const ref = message.match(/Ref(?:erence)?[:\s]*([A-Z0-9]+)/i);
        if (ref?.[1]) return ref[1];

        return super.extractReference(message);
    }

    extractAccountLast4(message: string): string | null {

        const patterns = [
            /A\/c\s+[X*]*(\d{4})/i,
            /Account\s+[X*]*(\d{4})/i,
            /from\s+[X*]*(\d{4})/i,
            /to\s+[X*]*(\d{4})/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match?.[1]) return match[1];
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const patterns = [
            /Bal(?:ance)?[:\s]*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Available\s+Bal(?:ance)?[:\s]*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Final\s+balance\s+is\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const p of patterns) {
            const match = message.match(p);
            if (match?.[1]) {
                const num = parseFloat(match[1].replace(/,/g, ""));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    isTransactionMessage(message: string): boolean {

        const lower = message.toLowerCase();

        if (
            lower.includes("otp") ||
            lower.includes("verification") ||
            lower.includes("offer") ||
            lower.includes("discount")
        ) {
            return false;
        }

        if (super.isTransactionMessage(message)) return true;

        const keywords = [
            "debit",
            "credit",
            "withdrawn",
            "deposited",
            "spent",
            "received",
            "transfer",
            "paid"
        ];

        return keywords.some(k => lower.includes(k));
    }
}