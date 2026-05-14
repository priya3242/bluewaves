import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Jammu & Kashmir Bank (JK Bank) specific parser.
 */
export class JKBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return "JK Bank";
    }

    canHandle(sender: string): boolean {

        const upperSender = sender.toUpperCase();

        const jkBankSenders = [
            "JKBANK",
            "JKB",
            "JKBANKL",
            "JKBNK"
        ];

        if (jkBankSenders.includes(upperSender)) {
            return true;
        }

        const dltPatterns = [
            /^[A-Z]{2}-JKBANK.*$/i,
            /^[A-Z]{2}-JKB.*$/i,
            /^[A-Z]{2}-JKBNK.*$/i,
            /^JKBANK-[A-Z]+$/i,
            /^JKB-[A-Z]+$/i
        ];

        return dltPatterns.some(pattern =>
            pattern.test(upperSender)
        );
    }

    extractMerchant(
        message: string,
        sender: string
    ): string | null {

        let match: RegExpMatchArray | null;

        // IMPS transfer
        if (message.includes("IMPS Fund transfer")) {

            const impsPattern =
                /Amt\s+received\s+from\s+(.+?)(?:\s+having\s+A\/C|$)/i;

            match = message.match(impsPattern);

            if (match?.[1]) {

                const merchant = match[1].trim();

                if (merchant.length > 0) {
                    return this.cleanMerchantName(merchant);
                }
            }

            return "IMPS Transfer";
        }

        // Tax info
        if (
            message.includes("TIN/Tax Information") ||
            message.includes("TIN/Tax Informat")
        ) {
            return "Tax Information Network";
        }

        // ATM recovery
        if (message.includes("ATM RECOVERY")) {
            return "ATM Recovery Charge";
        }

        // towards pattern
        const towardsPattern =
            /towards\s+([^.\n]+?)(?:\.|$)/i;

        match = message.match(towardsPattern);

        if (match?.[1]) {

            const merchant = match[1].trim();

            if (
                merchant.includes("TIN/Tax Informat")
            ) {
                return "Tax Information Network";
            }

            return this.cleanMerchantName(merchant);
        }

        // by pattern
        const transactionByPattern =
            /(?:Debited|Credited)\s+by\s+INR\s+[\d,]+(?:\.\d{2})?\s+at\s+[\d:]+\s+by\s+([^.\n]+?)(?:\.|$)/i;

        match = message.match(transactionByPattern);

        if (match?.[1]) {

            const merchant = match[1].trim();

            if (
                merchant.includes("CHRGS") ||
                merchant.includes("CHARGES")
            ) {
                return null;
            }

            if (
                merchant.includes(
                    "INDIAN CLEARING CORPO"
                )
            ) {
                return "Indian Clearing Corporation";
            }

            if (
                merchant.includes(
                    "CLEARING CORPO"
                )
            ) {
                return "Clearing Corporation";
            }

            if (
                merchant.includes(
                    "NSE CLEARING"
                )
            ) {
                return "NSE Clearing";
            }

            if (
                merchant.includes(
                    "BSE CLEARING"
                )
            ) {
                return "BSE Clearing";
            }

            if (
                merchant.includes("RTGS") &&
                !merchant.includes("CLEARING")
            ) {
                return "RTGS Transfer";
            }

            if (merchant.includes("NEFT")) {
                return "NEFT Transfer";
            }

            if (merchant.includes("IMPS")) {
                return "IMPS Transfer";
            }

            if (merchant.includes("eTFR")) {
                return "Transfer";
            }

            if (merchant.includes("TIN")) {
                return "Tax Information Network";
            }

            return this.cleanMerchantName(
                merchant.split("/")[0]
            );
        }

        // simple by pattern
        const simpleByPattern =
            /by\s+([^.\n]+?)(?:\.|$)/i;

        match = message.match(simpleByPattern);

        if (match?.[1]) {

            const merchant = match[1].trim();

            if (!merchant.startsWith("INR")) {
                return this.cleanMerchantName(
                    merchant
                );
            }
        }

        // via UPI from
        if (message.includes("via UPI from")) {

            const fromPattern =
                /via\s+UPI\s+from\s+([^.\n]+?)\s+on/i;

            match = message.match(fromPattern);

            if (match?.[1]) {

                const merchant =
                    match[1].trim();

                return this.cleanMerchantName(
                    merchant
                );
            }
        }

        // mTFR pattern
        const mtfrPattern =
            /mTFR\/\d+\/([^.\n]+?)(?:\.|A\/C|$)/i;

        match = message.match(mtfrPattern);

        if (match?.[1]) {

            const merchant =
                match[1].trim();

            return this.cleanMerchantName(
                merchant
            );
        }

        // UPI
        if (message.includes("via UPI")) {

            const vpaPattern =
                /to\s+([^@\s]+@[^\s]+)/i;

            match = message.match(vpaPattern);

            if (match?.[1]) {

                const vpa = match[1].trim();

                const merchantName =
                    vpa.split("@")[0];

                if (
                    merchantName.length > 0 &&
                    merchantName !== "upi"
                ) {
                    return this.cleanMerchantName(
                        merchantName
                    );
                }
            }

            return "UPI";
        }

        // ATM
        if (
            message.includes("ATM") ||
            message.includes("withdrawn")
        ) {
            return "ATM";
        }

        const merchantPatterns = [

            /to\s+([^.\n]+?)\s+via/i,

            /from\s+([^.\n]+?)(?:\s+on|\s+Ref|$)/i,

            /at\s+([^.\n]+?)(?:\s+on|\s+Ref|$)/i,

            /for\s+([^.\n]+?)(?:\s+on|\s+Ref|$)/i
        ];

        for (const pattern of merchantPatterns) {

            match = message.match(pattern);

            if (match?.[1]) {

                const merchant =
                    this.cleanMerchantName(
                        match[1].trim()
                    );

                if (merchant.length > 0) {
                    return merchant;
                }
            }
        }

        return super.extractMerchant(
            message,
            sender
        );
    }

    extractTransactionType(
        message: string
    ): TransactionType | null {

        const lowerMessage =
            message.toLowerCase();

        if (
            lowerMessage.includes(
                "clearing corpo"
            ) ||
            lowerMessage.includes(
                "indian clearing"
            ) ||
            lowerMessage.includes(
                "nse clearing"
            ) ||
            lowerMessage.includes(
                "bse clearing"
            )
        ) {
            return TransactionType.INVESTMENT;
        }

        if (
            lowerMessage.includes(
                "has been debited"
            ) ||
            lowerMessage.includes("debited") ||
            lowerMessage.includes(
                "withdrawn"
            ) ||
            lowerMessage.includes("spent") ||
            lowerMessage.includes(
                "charged"
            ) ||
            lowerMessage.includes("paid") ||
            lowerMessage.includes(
                "purchase"
            ) ||
            lowerMessage.includes(
                "transferred"
            )
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes(
                "has been credited"
            ) ||
            lowerMessage.includes(
                "credited"
            ) ||
            lowerMessage.includes(
                "deposited"
            ) ||
            lowerMessage.includes(
                "received"
            ) ||
            lowerMessage.includes("refund")
        ) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes(
                "cashback"
            ) &&
            !lowerMessage.includes(
                "earn cashback"
            )
        ) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractReference(
        message: string
    ): string | null {

        const patterns = [

            /RRN\s+No\.?\s*(\d+)/i,

            /UPI\s+Ref[:\s]+(\d+)/i,

            /txn\s+Ref[:\s]+([A-Z0-9]+)/i,

            /Reference[:\s]+([A-Z0-9]+)/i,

            /Ref\s+No[:\s]+([A-Z0-9]+)/i
        ];

        for (const pattern of patterns) {

            const match =
                message.match(pattern);

            if (match?.[1]) {
                return match[1].trim();
            }
        }

        return super.extractReference(
            message
        );
    }

    extractAccountLast4(
        message: string
    ): string | null {

        const baseResult =
            super.extractAccountLast4(
                message
            );

        if (baseResult) {
            return baseResult;
        }

        const patterns = [

            /A\/c\s+([X\d]+)/i,

            /JK\s+Bank\s+A\/c\s+no\.\s+([X\d]+)/i,

            /Account\s+([X\d]+)/i,

            /A\/c\s+ending\s+(\d{4})/i
        ];

        for (const pattern of patterns) {

            const match =
                message.match(pattern);

            if (match?.[1]) {

                return this.extractLast4Digits(
                    match[1]
                );
            }
        }

        return null;
    }

    extractBalance(
        message: string
    ): number | null {

        const patterns = [

            /Available\s+Bal\s+is\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,

            /A\/C\s+Bal\s+is\s+INR\s*([0-9,]+(?:\.\d{2})?)/i,

            /Avl\s+Bal[:\s]+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,

            /Balance[:\s]+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,

            /Bal\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {

            const match =
                message.match(pattern);

            if (match?.[1]) {

                const balanceStr =
                    match[1].replace(
                        /,/g,
                        ""
                    );

                const num =
                    parseFloat(balanceStr);

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return super.extractBalance(
            message
        );
    }

    isTransactionMessage(
        message: string
    ): boolean {

        const lowerMessage =
            message.toLowerCase();

        // ignore OTP
        if (
            lowerMessage.includes("otp") ||
            lowerMessage.includes(
                "one time password"
            ) ||
            lowerMessage.includes(
                "verification code"
            )
        ) {
            return false;
        }

        // ignore promos
        if (
            lowerMessage.includes("offer") ||
            lowerMessage.includes(
                "discount"
            ) ||
            lowerMessage.includes(
                "cashback offer"
            ) ||
            lowerMessage.includes("win ")
        ) {
            return false;
        }

        const keywords = [
            "has been debited",
            "has been credited",
            "debited",
            "credited",
            "withdrawn",
            "deposited",
            "spent",
            "received",
            "transferred",
            "paid"
        ];

        return keywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }
}