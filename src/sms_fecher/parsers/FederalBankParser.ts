import { ParsedTransaction, TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

interface EMandateInfo {
    amount: number;
    nextDeductionDate: string | null;
    merchant: string;
    umn: string | null;
    dateFormat: string;
}

/**
 * Parser for Federal Bank SMS messages
 */
export class FederalBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "Federal Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("FEDBNK") ||
            normalizedSender.includes("FEDERAL") ||
            normalizedSender.includes("FEDFIB") ||
            normalizedSender.includes("FEDSCP") ||
            /^[A-Z]{2}-FEDBNK-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-FEDSCP-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-FEDFIB-[A-Z]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-FEDBNK-[TPG]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-FEDBNK$/i.test(normalizedSender)
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        if (this.isBalanceInquiryMessage(smsBody)) {
            return this.parseBalanceInquiry(
                smsBody,
                sender,
                timestamp
            );
        }

        return super.parse(
            smsBody,
            sender,
            timestamp
        );
    }

    private isBalanceInquiryMessage(message: string): boolean {
        return message.includes(
            "Your available balance for a/c"
        );
    }

    private parseBalanceInquiry(
        message: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        const balancePattern =
            /([A-Z]{2,3}\d{4})\s+is\s+INR\s+([0-9,]+(?:\.\d{1,2})?)(?=[,.]|\s+\.)/i;

        const match = message.match(balancePattern);

        if (!match) {
            return null;
        }

        const accountNumber = match[1];
        const balanceStr = match[2].replace(/,/g, "");

        const balanceAreaPattern =
            /([A-Z]{2,3}\d{4})\s+is\s+INR\s+[0-9x,.]+/i;

        const balanceArea =
            message.match(balanceAreaPattern)?.[0] ?? "";

        if (
            balanceArea.includes("x") ||
            balanceArea.includes("X")
        ) {
            return null;
        }

        const balance = parseFloat(balanceStr);

        if (Number.isNaN(balance)) {
            return null;
        }

        return {
            amount: 0,
            type: TransactionType.BALANCE_UPDATE,
            merchant: "Balance Inquiry",
            reference: null,
            accountLast4: accountNumber.slice(-4),
            balance,
            creditLimit: null,
            smsBody: message,
            sender,
            timestamp,
            bankName: this.getBankName(),
            isFromCard: false,
            currency: "INR"
        };
    }

    detectIsCreditCard(message: string): boolean {
        return message
            .toLowerCase()
            .includes("credit card");
    }

    detectIsCard(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("via upi")) return false;
        if (lowerMessage.includes("to vpa")) return false;
        if (lowerMessage.includes("via imps")) return false;
        if (lowerMessage.includes("via neft")) return false;
        if (lowerMessage.includes("via rtgs")) return false;
        if (lowerMessage.includes("atm")) return false;

        if (
            lowerMessage.includes("withdrawn") &&
            !lowerMessage.includes("card")
        ) {
            return false;
        }

        return (
            this.detectIsCreditCard(message) ||
            lowerMessage.includes("debit card") ||
            lowerMessage.includes("card xx**") ||
            lowerMessage.includes("card ending with") ||
            /.*inr\s+[\d,]+(?:\.\d{2})?\s+spent.*/i.test(lowerMessage) ||
            (
                lowerMessage.includes(" spent ") &&
                lowerMessage.includes(" at ") &&
                lowerMessage.includes(" on ")
            ) ||
            (
                (
                    lowerMessage.includes("e-mandate") ||
                    lowerMessage.includes("payment of")
                ) &&
                (
                    lowerMessage.includes("federal bank debit card") ||
                    lowerMessage.includes("federal bank credit card")
                )
            )
        );
    }

    extractAmount(message: string): number | null {

        const patterns = [
            /₹\s*([0-9,]+(?:\.\d{2})?)/i,
            /INR\s+([0-9,]+(?:\.\d{2})?)\s+spent/i,
            /you've received INR\s+([0-9,]+(?:\.\d{2})?)/i,
            /Rs\s+([0-9,]+(?:\.\d{2})?)\s+debited/i,
            /Rs\s+([0-9,]+(?:\.\d{2})?)\s+sent/i,
            /Rs\s+([0-9,]+(?:\.\d{2})?)\s+credited/i,
            /has\s+received\s+Rs\s+([0-9,]+(?:\.\d{2})?)\s+from/i,
            /withdrawn\s+Rs\s+([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match) {

                const amount = match[1].replace(/,/g, "");
                const num = parseFloat(amount);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractAmount(message);
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("withdrawn")) {
            return "Cash Withdrawal";
        }

        const hasReceivedPattern =
            /^([A-Z][A-Za-z0-9\s]+?)\s+has\s+received\s+Rs/i;

        let match = message.match(hasReceivedPattern);

        if (match) {

            const merchant =
                this.cleanMerchantName(match[1].trim());

            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult =
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        if (this.detectIsCard(message)) {

            const endingWithPattern =
                /(?:credit|debit)\s+card\s+ending\s+with\s+(\d{4})/i;

            let match = message.match(endingWithPattern);

            if (match) {
                return match[1];
            }

            const cardPattern =
                /card\s+XX\*\*?(\d{4})/i;

            match = message.match(cardPattern);

            if (match) {
                return match[1];
            }

            const emandateCardPattern =
                /(?:Federal\s+Bank\s+)?(?:Debit|Credit)\s+Card\s+(\d{4})/i;

            match = message.match(emandateCardPattern);

            if (match) {
                return match[1];
            }
        }

        const acPattern =
            /A\/c\s+([X*\d]+)/i;

        let match = message.match(acPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        const accountPattern =
            /Account\s+([X*\d]+)/i;

        match = message.match(accountPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("sent via upi") ||
            lowerMessage.includes("debited") ||
            lowerMessage.includes("withdrawn")
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes("credited") ||
            lowerMessage.includes("received") ||
            lowerMessage.includes("refund")
        ) {
            return TransactionType.INCOME;
        }

        if (
            this.detectIsCreditCard(message) &&
            (
                lowerMessage.includes("spent") ||
                lowerMessage.includes("was successful")
            )
        ) {
            return TransactionType.CREDIT;
        }

        return super.extractTransactionType(message);
    }

    isTransactionMessage(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes("one time password") ||
            lowerMessage.includes("verification code")
        ) {
            return false;
        }

        const federalKeywords = [
            "sent via upi",
            "debited via upi",
            "credited",
            "withdrawn",
            "received",
            "transferred",
            "spent on your credit card",
            "credit card was successful",
            "payment of",
            "payment via e-mandate"
        ];

        return federalKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }

    parseEMandateSubscription(
        message: string
    ): EMandateInfo | null {

        const amountPattern =
            /(?:for\s+a\s+)?maximum\s+amount\s+of\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i;

        const amountMatch = message.match(amountPattern);

        const amount = amountMatch
            ? parseFloat(
                amountMatch[1].replace(/,/g, "")
            )
            : null;

        if (
            amount == null ||
            Number.isNaN(amount)
        ) {
            return null;
        }

        return {
            amount,
            nextDeductionDate: null,
            merchant: "E-Mandate",
            umn: null,
            dateFormat: "dd-MM-yyyy"
        };
    }

    isTransactionMessageForTesting(
        message: string
    ): boolean {
        return this.isTransactionMessage(message);
    }
}