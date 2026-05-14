import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Standard Chartered Bank SMS messages
 * (India and Pakistan)
 */
export class StandardCharteredBankParser extends BankParser {

    getBankName(): string {
        return "Standard Chartered Bank";
    }

    canHandle(sender: string): boolean {

        const upperSender =
            sender.toUpperCase();

        return (
            upperSender.includes("SCBANK") ||
            upperSender.includes("STANCHART") ||
            upperSender.includes("STANDARDCHARTERED") ||
            upperSender.includes("STANDARD CHARTERED") ||
            upperSender === "9220" ||
            /^[A-Z]{2}-SCBANK-[A-Z]$/i.test(sender)
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        const parsed =
            super.parse(
                smsBody,
                sender,
                timestamp
            );

        if (!parsed) {
            return null;
        }

        let currency = parsed.currency;

        if (smsBody.includes("PKR")) {
            currency = "PKR";
        } else if (smsBody.includes("USD")) {
            currency = "USD";
        } else if (smsBody.includes("INR")) {
            currency = "INR";
        }

        return {
            ...parsed,
            currency
        };
    }

    protected extractAmount(
        message: string
    ): number | null {

        const patterns: RegExp[] = [

            /PKR\s+([0-9,]+(?:\.\d{2})?)/i,

            /\bUSD\s+([0-9,]+(?:\.\d{2})?)/i,

            /is debited for Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,

            /NEFT\s+(?:credit|debit)\s+of\s+INR\s+([0-9,]+(?:\.\d{2})?)/i,

            /is credited for Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {

            const match =
                message.match(pattern);

            if (match) {

                const num = parseFloat(
                    match[1].replace(/,/g, "")
                );

                return isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractAmount(message);
    }

    protected extractTransactionType(
        message: string
    ): TransactionType | null {

        const lower =
            message.toLowerCase();

        if (lower.includes("is debited for")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("is credited for")) {
            return TransactionType.INCOME;
        }

        if (lower.includes("neft credit")) {
            return TransactionType.INCOME;
        }

        if (lower.includes("rtgs credit")) {
            return TransactionType.INCOME;
        }

        if (lower.includes("imps credit")) {
            return TransactionType.INCOME;
        }

        if (lower.includes("withdrawn from account")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("cash withdrawal")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("sent to scb pk")) {
            return TransactionType.INCOME;
        }

        if (
            lower.includes("payment of") &&
            lower.includes("financing")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("transaction of pkr") &&
            lower.includes("using online banking")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lower.includes("transaction of pkr") &&
            lower.includes("to")
        ) {
            return TransactionType.TRANSFER;
        }

        if (
            lower.includes("electronic funds transfer")
        ) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(
            message
        );
    }

    protected extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lower =
            message.toLowerCase();

        if (lower.includes("sent to scb pk")) {
            return "RAAST Transfer";
        }

        if (
            lower.includes("financing facility")
        ) {
            return "Financing Payment";
        }

        if (
            lower.includes("withdrawn") ||
            lower.includes("cash withdrawal")
        ) {
            return "ATM Cash Withdrawal";
        }

        const upiTransferPattern =
            /credited to a\/c\s+([X\*]+\d+)/i;

        let match =
            message.match(
                upiTransferPattern
            );

        if (match) {
            return `UPI Transfer to ${match[1]}`;
        }

        const paidAtPattern =
            /paid at\s+([A-Za-z0-9\s.\-]+?)\s+on/i;

        match =
            message.match(
                paidAtPattern
            );

        if (match) {
            return this.cleanMerchantName(
                match[1]
            );
        }

        const transferToPattern =
            /to\s+([A-Za-z0-9*]+)/i;

        match =
            message.match(
                transferToPattern
            );

        if (match) {

            const dest =
                match[1].trim();

            if (
                [
                    "your",
                    "account",
                    "iban",
                    "acct"
                ].includes(
                    dest.toLowerCase()
                )
            ) {
                return null;
            }

            if (/^\*+$/.test(dest)) {
                return "Transfer";
            }

            if (
                dest.startsWith("****")
            ) {
                return `Transfer to ${dest.slice(-4)}`;
            }

            if (/[a-z]/i.test(dest)) {
                return this.cleanMerchantName(
                    dest
                );
            }

            return `Transfer to ${dest}`;
        }

        const fromAccountPattern =
            /from account\s+[A-Za-z0-9\-*xX]+(?:\s+([A-Z][A-Za-z0-9\s]+?))?/i;

        match =
            message.match(
                fromAccountPattern
            );

        if (match?.[1]) {

            return this.cleanMerchantName(
                match[1].trim()
            );
        }

        if (message.includes("RAAST")) {
            return "RAAST Transfer";
        }

        if (
            message.includes("IBFT") ||
            message.includes(
                "electronic funds transfer"
            )
        ) {
            return "IBFT Transfer";
        }

        return super.extractMerchant(
            message,
            sender
        );
    }

    protected extractAccountLast4(
        message: string
    ): string | null {

        let match =
            message.match(
                /Your a\/c\s+([X*\d]+)/i
            );

        if (match) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        match =
            message.match(
                /in your account\s+([0-9xX*]+)/i
            );

        if (match) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        match =
            message.match(
                /(?:A\/C|Account No\.)\s*([0-9Xx*]+)/i
            );

        if (match) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        match =
            message.match(
                /card no\.?\s*([0-9Xx*\s-]+)/i
            );

        if (match) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        match =
            message.match(
                /your account\s+([0-9\-*xX]+)/i
            );

        if (match) {
            return this.extractLast4Digits(
                match[1]
            );
        }

        return null;
    }

    protected extractReference(
        message: string
    ): string | null {

        let match =
            message.match(
                /UPI Ref no\s+(\d+)/i
            );

        if (match) {
            return match[1];
        }

        match =
            message.match(
                /TX ID\s+([A-Z0-9]+)/i
            );

        if (match) {
            return match[1];
        }

        match =
            message.match(
                /Transaction ID:([A-Z0-9\-]+)/i
            );

        if (match) {
            return match[1];
        }

        return super.extractReference(
            message
        );
    }

    protected extractBalance(
        message: string
    ): number | null {

        let match =
            message.match(
                /Available Balance:\s*INR\s+([0-9,]+(?:\.\d{2})?)/i
            );

        if (match) {

            const num = parseFloat(
                match[1].replace(/,/g, "")
            );

            return isNaN(num)
                ? null
                : num;
        }

        match =
            message.match(
                /Avail Limit\s*PKR\s*([0-9,]+(?:\.\d{2})?)/i
            );

        if (match) {

            const num = parseFloat(
                match[1].replace(/,/g, "")
            );

            return isNaN(num)
                ? null
                : num;
        }

        return super.extractBalance(
            message
        );
    }

    protected isTransactionMessage(
        message: string
    ): boolean {

        const lower =
            message.toLowerCase();

        const keywords = [

            "is debited for",

            "is credited for",

            "neft credit",

            "rtgs credit",

            "imps credit",

            "withdrawn from account",

            "cash withdrawal",

            "paid at",

            "payment of",

            "transaction of pkr",

            "sent to scb pk",

            "electronic funds transfer",

            "has been credited"
        ];

        if (
            keywords.some(
                keyword =>
                    lower.includes(keyword)
            )
        ) {
            return true;
        }

        return super.isTransactionMessage(
            message
        );
    }
}