import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Union Bank of India SMS messages
 *
 * Supported formats:
 * - Debit: "A/c *1234 Debited for Rs:100.00 on 11-08-2025 18:28:02 by Mob Bk ref no 123456789000 Avl Bal Rs:12345.67"
 * - Credit transactions
 * - ATM withdrawals
 * - UPI transactions
 *
 * Sender patterns: XX-UNIONB-S/T, UNIONB, UNIONBANK, etc.
 */
export class UnionBankParser extends BaseIndianBankParser {
    getBankName() {
        return "Union Bank of India";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return (
            normalizedSender.includes("UNIONB") ||
            normalizedSender.includes("UNIONBANK") ||
            normalizedSender.includes("UBOI") ||
            /^[A-Z]{2}-UNIONB-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-UNIONB-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-UNIONB$/i.test(normalizedSender) ||
            /^[A-Z]{2}-UNIONBANK$/i.test(normalizedSender)
        );
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        // Union Bank includes OTP warnings inside transaction SMS.
        const transactionKeywords = [
            "debited",
            "credited",
            "withdrawn",
            "deposited",
            "spent",
            "received",
            "transferred",
            "paid"
        ];

        if (transactionKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }

    extractAmount(message: string): number | null {
        const amountPattern1 = /Rs[:.]?\s*([0-9,]+(?:\.\d{2})?)/i;
        let match = message.match(amountPattern1);
        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        const amountPattern2 = /INR\s+([0-9,]+(?:\.\d{2})?)/i;
        match = message.match(amountPattern2);
        if (match) {
            const amount = match[1].replace(/,/g, "");
            const num = parseFloat(amount);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: Mobile Banking - "by Mob Bk"
        if (message.includes("Mob Bk")) {
            return "Mobile Banking Transfer";
        }

        // Pattern 2: ATM transactions
        if (message.includes("ATM")) {
            const atmPattern = /at\s+([^.\s]+(?:\s+[^.\s]+)*)(?:\s+on|\s+Avl|$)/i;
            const match = message.match(atmPattern);
            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
            return "ATM Withdrawal";
        }

        // Pattern 3: UPI transactions - "UPI/merchant" or "VPA merchant@bank"
        if (message.includes("UPI")) {
            const upiPattern = /UPI[/:]?\s*([^,.\s]+)/i;
            const match = message.match(upiPattern);
            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        if (message.includes("VPA")) {
            const vpaPattern = /VPA\s+([^\s]+)/i;
            const match = message.match(vpaPattern);
            if (match) {
                const vpaName = match[1].trim();
                return this.parseUPIMerchant(vpaName);
            }
        }

        // Pattern 4: "to <merchant>" for transfers
        const toPattern = /to\s+([^.\n]+?)(?:\s+on|\s+Avl|$)/i;
        let match = message.match(toPattern);
        if (match) {
            const merchant = match[1].trim();
            if (!merchant.includes("Avl")) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Pattern 5: "from <sender>" for credits
        const fromPattern = /from\s+([^.\n]+?)(?:\s+on|\s+Avl|$)/i;
        match = message.match(fromPattern);
        if (match) {
            const merchant = match[1].trim();
            if (!merchant.includes("Avl")) {
                return this.cleanMerchantName(merchant);
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractReference(message: string): string | null {
        const refPatterns = [
            /ref\s+no\s+([\w]+)/i,
            /ref[:#]?\s*([\w]+)/i,
            /reference[:#]?\s*([\w]+)/i,
            /txn[:#]?\s*([\w]+)/i
        ];

        for (const pattern of refPatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return super.extractReference(message);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const accountPatterns = [
            /A\/[Cc]\s*[*X](\d{4})/i,
            /Account\s*[*X](\d{4})/i,
            /Acc\s*[*X](\d{4})/i,
            /A\/[Cc]\s+(\d{4})/i
        ];

        for (const pattern of accountPatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const balancePatterns = [
            /Avl\s+Bal\s+Rs[:.]?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Available\s+Balance[:.]?\s*Rs[:.]?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Balance[:.]?\s*Rs[:.]?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Bal[:.]?\s*Rs[:.]?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of balancePatterns) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match[1].replace(/,/g, "");
                const num = parseFloat(balanceStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    private parseUPIMerchant(vpa: string): string {
        const cleanVPA = vpa.toLowerCase();

        if (cleanVPA.includes("paytm")) return "Paytm";
        if (cleanVPA.includes("phonepe")) return "PhonePe";
        if (cleanVPA.includes("googlepay") || cleanVPA.includes("gpay")) return "Google Pay";
        if (cleanVPA.includes("bharatpe")) return "BharatPe";
        if (cleanVPA.includes("amazon")) return "Amazon";
        if (cleanVPA.includes("flipkart")) return "Flipkart";
        if (cleanVPA.includes("swiggy")) return "Swiggy";
        if (cleanVPA.includes("zomato")) return "Zomato";
        if (cleanVPA.includes("uber")) return "Uber";
        if (cleanVPA.includes("ola")) return "Ola";

        if (/\d+/.test(cleanVPA)) return "Individual";

        const parts = cleanVPA.split(/[.\-_]/).filter(Boolean);
        const candidate = parts.find(
            part => part.length > 3 && !/^\d+$/.test(part)
        );

        if (candidate) {
            return candidate.charAt(0).toUpperCase() + candidate.slice(1);
        }

        return "Merchant";
    }
}