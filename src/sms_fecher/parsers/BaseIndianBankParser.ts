import { BankParser } from '../core/BankParser';

export interface MandateInfo {
    bankName: string;
    amount: number;
    merchant: string;
    nextDeductionDate: string | null;
    umn: string | null;
    dateFormat: string;
}

export interface BaseBalanceUpdateInfo {
    bankName: string;
    accountLast4: string | null;
    balance: number;
    asOfDate: string | null;
}

/**
 * Base abstract class for Indian bank parsers.
 * Handles common patterns across Indian banks (INR currency, UPI, etc.).
 */
export abstract class BaseIndianBankParser extends BankParser {
    getCurrency() {
        return "INR";
    }

    /**
     * Checks if the message is for an investment transaction.
     * Contains keywords specific to Indian investment platforms and terms.
     */
    protected isInvestmentTransaction(lowerMessage: string): boolean {
        const investmentKeywords = [
            "iccl",
            "indian clearing corporation",
            "nsccl",
            "nse clearing",
            "clearing corporation",

            "nach",
            "ach",
            "ecs",

            "groww",
            "zerodha",
            "upstox",
            "kite",
            "kuvera",
            "paytm money",
            "etmoney",
            "coin by zerodha",
            "smallcase",
            "angel one",
            "angel broking",
            "5paisa",
            "icici securities",
            "icici direct",
            "hdfc securities",
            "kotak securities",
            "motilal oswal",
            "sharekhan",
            "edelweiss",
            "axis direct",
            "sbi securities",

            "mutual fund",
            "sip",
            "elss",
            "ipo",
            "folio",
            "demat",
            "stockbroker",
            "digital gold",
            "sovereign gold",

            "nse",
            "bse",
            "cdsl",
            "nsdl"
        ];

        return investmentKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    // ==========================================
    // Unified Mandate / Subscription Logic
    // ==========================================

    /**
     * Checks if this is an E-Mandate notification (not a transaction).
     */
    public isEMandateNotification(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return (
            lowerMessage.includes("e-mandate") ||
            lowerMessage.includes("upi-mandate") ||
            (lowerMessage.includes("mandate") && lowerMessage.includes("successfully created"))
        );
    }

    /**
     * Checks if this is a future debit notification (subscription alert, not a current transaction).
     */
    public isFutureDebitNotification(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return (
            lowerMessage.includes("will be debited") ||
            lowerMessage.includes("mandate set for") ||
            (lowerMessage.includes("upcoming") && lowerMessage.includes("mandate"))
        );
    }

    /**
     * Parses combined Mandate / E-Mandate / UPI-Mandate subscription information.
     */
    public parseMandateSubscription(message: string): MandateInfo | null {
        if (!this.isEMandateNotification(message) && !this.isFutureDebitNotification(message)) {
            return null;
        }

        const amountPatterns = [
            /(?:INR|Rs\.?|Rs)\s*([0-9,]+(?:\.\d{2})?)/i,
            /([0-9,]+(?:\.\d{2})?)\s*(?:INR|Rs\.?|Rs)/i
        ];

        let amount: number | null = null;
        for (const pattern of amountPatterns) {
            const match = message.match(pattern);
            if (match) {
                const num = parseFloat(match[1].replace(/,/g, ""));
                if (!Number.isNaN(num)) {
                    amount = num;
                    break;
                }
            }
        }

        if (amount == null) {
            return null;
        }

        let merchant = "Unknown Subscription";
        const merchantPatterns = [
            /towards\s+([^.\n]+?)(?:\s+from|\s+A\/c|\s+UMRN|\s+ID:|\s+Alert:|\s*\.|$)/i,
            /for\s+([^.\n]+?)(?:\s+mandate|\s+will\s+be|\s+ID:|\s+Act:|\s*\.|$)/i,
            /Info:\s*([^.\n]+?)(?:\s*$)/i
        ];

        for (const pattern of merchantPatterns) {
            const match = message.match(pattern);
            if (match) {
                const cleaned = this.cleanMerchantName(match[1].trim());
                if (this.isValidMerchantName(cleaned)) {
                    merchant = cleaned;
                    break;
                }
            }
        }

        const datePatterns = [
            /(?:on|for)\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})/i,
            /(?:on|for)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
            /(\d{1,2}-[A-Za-z]{3}-\d{2,4})/i,
            /(\d{1,2}\/\d{1,2}\/\d{2,4})/i
        ];

        let nextDeductionDate: string | null = null;
        for (const pattern of datePatterns) {
            const match = message.match(pattern);
            if (match) {
                nextDeductionDate = match[1];
                break;
            }
        }

        const umnPattern = /UMN[:\s]+([^.\s]+)/i;
        const umnMatch = message.match(umnPattern);
        const umn = umnMatch ? umnMatch[1] : null;

        return {
            bankName: this.getBankName(),
            amount,
            merchant,
            nextDeductionDate,
            umn,
            dateFormat: "dd-MMM-yy"
        };
    }

    // ==========================================
    // Unified Balance Update Logic
    // ==========================================

    /**
     * Checks if this is a balance update notification (not a transaction).
     */
    public isBalanceUpdateNotification(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const hasBalanceKeyword =
            lowerMessage.includes("available bal") ||
            lowerMessage.includes("avl bal") ||
            lowerMessage.includes("account balance") ||
            lowerMessage.includes("a/c balance") ||
            lowerMessage.includes("updated balance");

        const hasTxnKeyword =
            lowerMessage.includes("debited") ||
            lowerMessage.includes("credited") ||
            lowerMessage.includes("withdrawn") ||
            lowerMessage.includes("deposited") ||
            lowerMessage.includes("spent") ||
            lowerMessage.includes("transferred") ||
            lowerMessage.includes("payment of");

        return hasBalanceKeyword && !hasTxnKeyword;
    }

    /**
     * Parses generic balance update notification.
     */
    public parseBalanceUpdate(message: string): BaseBalanceUpdateInfo | null {
        if (!this.isBalanceUpdateNotification(message)) {
            return null;
        }

        const accountLast4 = this.extractAccountLast4(message);
        const balance = this.extractBalance(message);

        if (balance == null) {
            return null;
        }

        return {
            bankName: this.getBankName(),
            accountLast4,
            balance,
            asOfDate: null
        };
    }

    // ==========================================
    // Common Helper Methods
    // ==========================================

    /**
     * Helper function to convert month abbreviation to number.
     */
    protected getMonthNumber(monthAbbr: string): number {
        switch (monthAbbr.toUpperCase()) {
            case "JAN": return 1;
            case "FEB": return 2;
            case "MAR": return 3;
            case "APR": return 4;
            case "MAY": return 5;
            case "JUN": return 6;
            case "JUL": return 7;
            case "AUG": return 8;
            case "SEP": return 9;
            case "OCT": return 10;
            case "NOV": return 11;
            case "DEC": return 12;
            default: return 1;
        }
    }

    protected override isTransactionMessage(message: string): boolean {
        if (
            this.isEMandateNotification(message) ||
            this.isFutureDebitNotification(message) ||
            this.isBalanceUpdateNotification(message)
        ) {
            return false;
        }

        return super.isTransactionMessage(message);
    }

    protected cleanMerchantName(merchant: string): string {
        return merchant
            .replace(/\([^)]*\)\s*$/, "")
            .replace(/\b(?:ref|rrn|txn|txn id|transaction id)[:\s].*$/i, "")
            .replace(/\b(?:on|at)\s+\d{1,2}[-/][A-Za-z0-9]{2,9}[-/]\d{2,4}.*$/i, "")
            .replace(/\b(?:on|at)\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$/i, "")
            .replace(/\b(?:upi|imps|neft|rtgs)\b.*$/i, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    protected isValidMerchantName(name: string): boolean {
        const commonWords = [
            "USING",
            "VIA",
            "THROUGH",
            "BY",
            "WITH",
            "FOR",
            "TO",
            "FROM",
            "AT",
            "THE"
        ];

        return (
            name.length >= 2 &&
            /[A-Za-z]/.test(name) &&
            !commonWords.includes(name.toUpperCase()) &&
            !/^\d+$/.test(name) &&
            !name.includes("@")
        );
    }
}