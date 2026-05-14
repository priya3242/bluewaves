import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Saraswat Co-operative Bank
 */
export class SaraswatBankParser extends BaseIndianBankParser {

    getBankName() {
        return "Saraswat Co-operative Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        const saraswatSenders = [
            "SARBNK",
            "SARASWAT",
            "SARASWATBANK"
        ];

        if (saraswatSenders.includes(normalizedSender)) return true;

        return (
            /^[A-Z]{2}-SARBNK-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-SARASWAT-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-SARBNK$/i.test(normalizedSender) ||
            /^[A-Z]{2}-SARASWAT$/i.test(normalizedSender)
        );
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /INR\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
        ];

        for (const regex of patterns) {
            const match = message.match(regex);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ""));
                return isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {

        const lower = message.toLowerCase();

        if (
            lower.includes("is credited") ||
            lower.includes("credited with")
        ) return TransactionType.INCOME;

        if (
            lower.includes("is debited") ||
            lower.includes("debited with") ||
            lower.includes("withdrawn")
        ) return TransactionType.EXPENSE;

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // Pattern 1: towards ACH Credit
        const towardsPattern = /towards\s+(.+?)(?:\.\s*Current|Current|$)/i;
        let match = message.match(towardsPattern);

        if (match) {
            let merchant = match[1].trim()
                .replace(/^ACH\s+Credit:\s*/i, "")
                .replace(/^ACH\s+Debit:\s*/i, "");

            if (this.isValidMerchantName(merchant)) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Pattern 2: for SI / NEFT etc.
        const forPattern = /for\s+([A-Z.]+?)(?:\.\s+Current|Current|$)/i;
        match = message.match(forPattern);

        if (match) {
            let merchant = match[1].trim().replace(/\.$/, "");
            const key = merchant.toUpperCase();

            switch (key) {
                case "S.I":
                case "SI":
                    return "Standing Instruction";
                case "NEFT":
                    return "NEFT Transfer";
                case "RTGS":
                    return "RTGS Transfer";
                case "IMPS":
                    return "IMPS Transfer";
                default:
                    return merchant;
            }
        }

        // ATM detection
        if (
            message.includes("ATM") ||
            message.toLowerCase().includes("withdrawn")
        ) {
            return "ATM Withdrawal";
        }

        // ✅ FIXED: sender passed properly
        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const base = super.extractAccountLast4(message);
        if (base) return base;

        const patterns = [
            /A\/c\s+no\.\s+(?:ending\s+with\s+)?(\d{4,6})/i,
            /account\s+no\.\s+ending\s+with\s+(\d{4,6})/i,
            /A\/c\s+([*\d]+)/i
        ];

        for (const regex of patterns) {
            const match = message.match(regex);
            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const patterns = [
            /Current\s+Bal\s+is\s+INR\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /Bal[:\s]+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
        ];

        for (const regex of patterns) {
            const match = message.match(regex);
            if (match) {
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
            lower.includes("one time password") ||
            lower.includes("verification code")
        ) return false;

        const keywords = [
            "is credited with",
            "is debited with",
            "credited with inr",
            "debited with inr",
            "current bal is"
        ];

        if (keywords.some(k => lower.includes(k))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}