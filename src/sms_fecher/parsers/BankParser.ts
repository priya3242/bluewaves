import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';

/**
 * Base class for bank-specific message parsers.
 * Each bank should extend this class and implement its specific parsing logic.
 */
export abstract class BankParser {
    /**
     * Returns the name of the bank this parser handles.
     */
    abstract getBankName(): string;

    /**
     * Checks if this parser can handle messages from the given sender.
     */
    abstract canHandle(sender: string): boolean;

    /**
     * Returns the currency used by this bank.
     * Defaults to INR for Indian banks. International banks should override this.
     */
    getCurrency(): string {
        return "INR";
    }

    /**
     * Parses an SMS message and extracts transaction information.
     * Returns null if the message cannot be parsed.
     */
    parse(smsBody: string, sender: string, timestamp: number): ParsedTransaction | null {
        if (!this.isTransactionMessage(smsBody)) {
            return null;
        }

        const amount = this.extractAmount(smsBody);
        if (amount == null) {
            return null;
        }

        const type = this.extractTransactionType(smsBody);
        if (type == null) {
            return null;
        }

        const availableLimit =
            type === TransactionType.CREDIT
                ? this.extractAvailableLimit(smsBody)
                : null;

        const rawAccountLast4 = this.extractAccountLast4(smsBody);
        const safeAccountLast4 = rawAccountLast4
            ? this.extractLast4Digits(rawAccountLast4) ?? rawAccountLast4
            : null;

        return {
            amount,
            type,
            merchant: this.extractMerchant(smsBody, sender),
            reference: this.extractReference(smsBody),
            accountLast4: safeAccountLast4,
            balance: this.extractBalance(smsBody),
            creditLimit: availableLimit,
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.detectIsCard(smsBody),
            currency: this.extractCurrency(smsBody) ?? this.getCurrency()
        };
    }

    /**
     * Checks if the message is a transaction message (not OTP, promotional, etc.)
     */
    protected isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("one time password") ||
            lowerMessage.includes("verification code")
        ) {
            return false;
        }

        if (
            lowerMessage.includes("offer") ||
            lowerMessage.includes("discount") ||
            lowerMessage.includes("cashback offer") ||
            lowerMessage.includes("win ")
        ) {
            return false;
        }

        if (
            lowerMessage.includes("has requested") ||
            lowerMessage.includes("payment request") ||
            lowerMessage.includes("collect request") ||
            lowerMessage.includes("requesting payment") ||
            lowerMessage.includes("requests rs") ||
            lowerMessage.includes("ignore if already paid")
        ) {
            return false;
        }

        if (lowerMessage.includes("have received payment")) {
            return false;
        }

        if (
            lowerMessage.includes("is due") ||
            lowerMessage.includes("min amount due") ||
            lowerMessage.includes("minimum amount due") ||
            lowerMessage.includes("in arrears") ||
            lowerMessage.includes("is overdue") ||
            lowerMessage.includes("ignore if paid") ||
            (lowerMessage.includes("pls pay") && lowerMessage.includes("min of"))
        ) {
            return false;
        }

        const transactionKeywords = [
            "debited", "credited", "withdrawn", "deposited",
            "spent", "received", "transferred", "paid"
        ];

        return transactionKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Extracts the transaction currency from the message.
     * Can be overridden by specific bank parsers for custom logic.
     */
    protected extractCurrency(message: string): string | null {
        const currencyPattern = /([A-Z]{3})\s*[0-9,]+(?:\.\d{2})?/i;
        const match = message.match(currencyPattern);
        if (match) {
            return match[1].toUpperCase();
        }
        return null;
    }

    /**
     * Extracts the transaction amount from the message.
     */
    protected extractAmount(message: string): number | null {
        for (const pattern of CompiledPatterns.Amount.ALL_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                const amountStr = match[1].replace(/,/g, "");
                const num = parseFloat(amountStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return null;
    }

    /**
     * Extracts the transaction type (INCOME/EXPENSE/INVESTMENT).
     */
    protected extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (this.isInvestmentTransaction(lowerMessage)) {
            return TransactionType.INVESTMENT;
        }

        if (lowerMessage.includes("debited")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("withdrawn")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("spent")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("charged")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("paid")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("purchase")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("deducted")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("deposited")) return TransactionType.INCOME;
        if (lowerMessage.includes("received")) return TransactionType.INCOME;
        if (lowerMessage.includes("refund")) return TransactionType.INCOME;
        if (lowerMessage.includes("cashback") && !lowerMessage.includes("earn cashback")) return TransactionType.INCOME;

        return null;
    }

    /**
     * Checks if the message is for an investment transaction.
     * Can be overridden by specific bank parsers for custom logic.
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

    /**
     * Extracts merchant/payee information.
     */
    protected extractMerchant(message: string, sender: string): string | null {
        for (const pattern of CompiledPatterns.Merchant.ALL_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                const merchant = this.cleanMerchantName(match[1].trim());
                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }
        }

        return null;
    }

    /**
     * Extracts transaction reference number.
     */
    protected extractReference(message: string): string | null {
        for (const pattern of CompiledPatterns.Reference.ALL_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Extracts last 4 digits from a raw captured string.
     * Filters to digits only, takes last 4. Returns null if fewer than 3 digits.
     */
    protected extractLast4Digits(raw: string): string | null {
        const digits = raw.replace(/\D/g, "");
        if (digits.length < 3) {
            return null;
        }
        return digits.slice(-4);
    }

    /**
     * Extracts last 4 digits of account number.
     */
    protected extractAccountLast4(message: string): string | null {
        for (const pattern of CompiledPatterns.Account.ALL_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                const rawCapture = match[1];
                const last4 = this.extractLast4Digits(rawCapture);

                if (last4 != null && this.isValidAccountLast4(last4, match[0], message)) {
                    return last4;
                }
            }
        }

        return null;
    }

    /**
     * Validates that the extracted 4 digits are actually part of an account number,
     * not a date, RRN, or other numeric field.
     */
    private isValidAccountLast4(last4: string, matchedText: string, fullMessage: string): boolean {
        const escapedLast4 = last4.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const datePatterns = [
            new RegExp(`\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, "i"),
            new RegExp(`${escapedLast4}[/-]\\d{1,2}[/-]\\d{1,2}`, "i"),
            new RegExp(`\\bon\\s+\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, "i"),
            new RegExp(`\\bdated\\s+\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, "i")
        ];

        for (const datePattern of datePatterns) {
            if (datePattern.test(fullMessage)) {
                return false;
            }
        }

        const year = parseInt(last4, 10);
        if (year >= 2000 && year <= 2099) {
            const yearContextPatterns = [
                new RegExp(`\\bon\\s+\\d{1,2}[/-]\\d{1,2}[/-]${escapedLast4}`, "i"),
                new RegExp(`\\bdated\\s+.*?${escapedLast4}`, "i"),
                new RegExp(`${escapedLast4}(?:\\s|$)`, "i")
            ];

            for (const yearPattern of yearContextPatterns) {
                if (yearPattern.test(fullMessage)) {
                    const accountBeforeYear = new RegExp(`(?:A\\/c|Account|Acct).{0,25}${escapedLast4}`, "i");
                    if (!accountBeforeYear.test(fullMessage)) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Extracts balance after transaction.
     */
    protected extractBalance(message: string): number | null {
        for (const pattern of CompiledPatterns.Balance.ALL_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match[1].replace(/,/g, "");
                const num = parseFloat(balanceStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return null;
    }

    /**
     * Extracts credit card available limit from the message.
     * This is the remaining credit available to spend, NOT the total credit limit.
     */
    protected extractAvailableLimit(message: string): number | null {
        const creditLimitPatterns = [
            /Available\s+limit\s+Rs\.([0-9,]+(?:\.\d{2})?)/i,
            /Available\s+limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Avl\s+Lmt:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Avail\s+Limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Available\s+Credit\s+Limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /(?:^|\s)Limit:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of creditLimitPatterns) {
            const match = message.match(pattern);
            if (match) {
                const limitStr = match[1].replace(/,/g, "");
                const limit = parseFloat(limitStr);
                return Number.isNaN(limit) ? null : limit;
            }
        }

        return null;
    }

    /**
     * Detects if the transaction is from a card (credit/debit) based on message patterns.
     * First excludes account-related patterns, then checks for actual card patterns.
     */
    protected detectIsCard(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const accountPatterns = [
            "a/c",
            "account",
            "ac ",
            "acc ",
            "saving account",
            "current account",
            "savings a/c",
            "current a/c"
        ];

        for (const pattern of accountPatterns) {
            if (lowerMessage.includes(pattern)) {
                return false;
            }
        }

        const cardPatterns = [
            "card ending",
            "card xx",
            "debit card",
            "credit card",
            "card no.",
            "card number",
            "card *",
            "card x"
        ];

        for (const pattern of cardPatterns) {
            if (lowerMessage.includes(pattern)) {
                return true;
            }
        }

        const maskedCardRegex = /(?:xx|XX|\*{2,})?\d{4}/i;
        if (lowerMessage.includes("ending") && maskedCardRegex.test(message)) {
            return true;
        }

        return false;
    }

    /**
     * Cleans merchant name by removing common suffixes and noise.
     */
    protected cleanMerchantName(merchant: string): string {
        return merchant
            .replace(CompiledPatterns.Cleaning.TRAILING_PARENTHESES, "")
            .replace(CompiledPatterns.Cleaning.REF_NUMBER_SUFFIX, "")
            .replace(CompiledPatterns.Cleaning.DATE_SUFFIX, "")
            .replace(CompiledPatterns.Cleaning.UPI_SUFFIX, "")
            .replace(CompiledPatterns.Cleaning.TIME_SUFFIX, "")
            .replace(CompiledPatterns.Cleaning.TRAILING_DASH, "")
            .replace(CompiledPatterns.Cleaning.PVT_LTD, "")
            .replace(CompiledPatterns.Cleaning.LTD, "")
            .trim();
    }

    /**
     * Validates if the extracted merchant name is valid.
     */
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