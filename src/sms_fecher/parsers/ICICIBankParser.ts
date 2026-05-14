import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for ICICI Bank SMS messages
 */
export class ICICIBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "ICICI Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("ICICI") ||
            normalizedSender.includes("ICICIB") ||
            /^[A-Z]{2}-ICICIB-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ICICI-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ICICIB-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ICICIB$/i.test(normalizedSender) ||
            /^[A-Z]{2}-ICICI$/i.test(normalizedSender) ||
            normalizedSender === "ICICIB" ||
            normalizedSender === "ICICIBANK"
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
        if (amount == null) {
            return null;
        }

        const type = this.extractTransactionType(smsBody);
        if (type == null) {
            return null;
        }

        const currency =
            this.extractCurrencyFromMessage(smsBody) || "INR";

        const availableLimit =
            type === TransactionType.CREDIT
                ? this.extractAvailableLimit?.(smsBody) || null
                : null;

        return {
            amount,
            type,
            merchant: this.extractMerchant(smsBody, sender),
            reference: this.extractReference(smsBody),
            accountLast4: this.extractAccountLast4(smsBody),
            balance: this.extractBalance(smsBody),
            creditLimit: availableLimit,
            smsBody,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: this.detectIsCard?.(smsBody) || false,
            currency
        } as ParsedTransaction;
    }

    private extractCurrencyFromMessage(
        message: string
    ): string | null {

        const currencySpentPattern =
            /([A-Z]{3})\s+[0-9,]+(?:\.\d{2})?\s+spent/i;

        const match = message.match(currencySpentPattern);

        if (match) {
            const currency = match[1].toUpperCase();

            if (
                currency.length === 3 &&
                !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(currency)
            ) {
                return currency;
            }
        }

        return null;
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /[A-Z]{3}\s+([0-9,]+(?:\.\d{2})?)\s+spent/i,
            /(?:Rs\.?|INR)\s+([0-9,]+(?:\.\d{2})?)\s+spent/i,
            /debited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /debited\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /credited:\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);

            if (match) {
                const amount = match[1].replace(/,/g, "");
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

        if (
            message.includes("credited to the beneficiary") ||
            message.includes("credited to beneficiary")
        ) {
            return "NEFT Transfer";
        }

        const salaryPattern =
            /Info\s+INF\*[^*]+\*[^*]*SAL[^.]*/i;

        if (salaryPattern.test(message)) {
            return "Salary";
        }

        if (
            message.includes("NFSCASH WDL") ||
            message.includes("NFS CASH WDL") ||
            message.includes("NFS*CASH WDL") ||
            message.includes("CASH WDL") ||
            message.includes("NFSCASH")
        ) {
            return "Cash Withdrawal";
        }

        const cardMerchantPattern =
            /on\s+\d{1,2}-\w{3}-\d{2}\s+(?:at|on)\s+([^.]+?)(?:\.|\s+Avl|$)/i;

        let match = message.match(cardMerchantPattern);

        if (match) {
            const merchant =
                this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const upiMerchantPattern =
            /for\s+UPI-\d+-([A-Za-z][\w\s]*?)(?:\.|$|\s+To\s)/i;

        match = message.match(upiMerchantPattern);

        if (match) {
            const merchant =
                this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const achNachPattern =
            /Info\s+(?:ACH|NACH)\*([^*]+)\*/i;

        match = message.match(achNachPattern);

        if (match) {
            const company =
                this.cleanMerchantName(match[1].trim());

            return `${company} Dividend`;
        }

        const towardsPattern =
            /towards\s+([^.\n]+?)\s+for/i;

        match = message.match(towardsPattern);

        if (match) {
            const merchant =
                this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const fromUpiPattern =
            /from\s+([^.\n]+?)\.\s*UPI/i;

        match = message.match(fromUpiPattern);

        if (match) {
            const merchant =
                this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        if (message.includes("Info BY CASH")) {
            return "Cash Deposit";
        }

        if (message.includes("AutoPay")) {

            const lower = message.toLowerCase();

            if (lower.includes("google play")) return "Google Play Store";
            if (lower.includes("netflix")) return "Netflix";
            if (lower.includes("spotify")) return "Spotify";
            if (lower.includes("amazon prime")) return "Amazon Prime";
            if (lower.includes("disney") || lower.includes("hotstar")) {
                return "Disney+ Hotstar";
            }
            if (lower.includes("youtube")) {
                return "YouTube Premium";
            }

            return "AutoPay Subscription";
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        const patterns = [
            /ICICI\s+Bank\s+Card\s+([X*\d]+)/i,
            /ICICI\s+Bank\s+Credit\s+Card\s+([X*\d]+)/i,
            /ICICI\s+Bank\s+Account\s+([X*\d]+)/i,
            /ICICI\s+Bank\s+Acct\s+([X*\d]+)/i,
            /ICICI\s+Bank\s+Acc\s+([X*\d]+)/i,
            /Acct\s+([X*\d]+)(?:\s|$|[,;.])/i,
            /Acc\s+([X*\d]+)(?:\s|$|[,;.])/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const patterns = [
            /Available\s+Balance\s+is\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Av[lb]\s+Bal\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Updated\s+Bal[:\s]+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {

                const balance =
                    match[1].replace(/,/g, "");

                const num = parseFloat(balance);

                return isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        const patterns = [
            /RRN\s+([A-Za-z0-9]+)/i,
            /UPI:([A-Za-z0-9]+)/i,
            /transaction\s+reference\s+no\.?\s*([A-Z0-9]+)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {
                return match[1];
            }
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {

        const lower = message.toLowerCase();

        if (
            lower.includes("cash deposit transaction") &&
            lower.includes("has been completed")
        ) {
            return false;
        }

        if (
            lower.includes("is due by") ||
            lower.includes("will be debited") ||
            lower.includes(
                "has been received on your icici bank credit card"
            )
        ) {
            return false;
        }

        const keywords = [
            "debited with",
            "debited for",
            "credited with",
            "credited:",
            "autopay",
            "your account has been",
            "inr",
            "spent using"
        ];

        return (
            keywords.some(keyword => lower.includes(keyword)) ||
            super.isTransactionMessage(message)
        );
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lower = message.toLowerCase();

        if (
            lower.includes("credited to the beneficiary") ||
            lower.includes("credited to beneficiary")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            (
                lower.includes("icici bank credit card") ||
                (
                    lower.includes("icici bank card") &&
                    lower.includes("spent")
                )
            ) &&
            (
                lower.includes("spent") ||
                lower.includes("debited")
            )
        ) {
            return TransactionType.CREDIT;
        }

        if (lower.includes("info by cash")) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }
}