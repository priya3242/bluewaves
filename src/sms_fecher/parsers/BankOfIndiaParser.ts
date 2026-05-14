import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Bank of India (BOI) SMS messages.
 *
 * Handles formats like:
 * - "Rs.200.00 debited A/cXX5468 and credited to SAI MISAL via UPI Ref No 315439383341 on 23Aug25. Call 18001031906, if not done by you. -BOI"
 * - Other BOI transaction formats
 */
export class BankOfIndiaParser extends BaseIndianBankParser {
    getBankName() {
        return "Bank of India";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        const boiSenders = [
            "BOIIND",
            "BOIBNK"
        ];

        if (boiSenders.includes(normalizedSender)) return true;

        return (
            /^[A-Z]{2}-BOIIND-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOIBNK-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOI-[ST]$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOIIND$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOIBNK$/i.test(normalizedSender) ||
            /^[A-Z]{2}-BOI$/i.test(normalizedSender) ||
            /^BK-BOIIND.*$/i.test(normalizedSender) ||
            /^JD-BOIIND.*$/i.test(normalizedSender)
        );
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:debited|credited)/i,
            /INR\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:debited|credited)/i,
            /withdrawn\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const amountStr = match[1].replace(/,/g, "");
                const num = parseFloat(amountStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("deposited in your account") ||
            (lowerMessage.includes("cash") && lowerMessage.includes("deposited"))
        ) {
            return TransactionType.INCOME;
        }

        if (isInvestmentTransaction(lowerMessage)) {
            return TransactionType.INVESTMENT;
        }

        if (
            lowerMessage.includes("mandate") &&
            (
                lowerMessage.includes("mutual fund") ||
                lowerMessage.includes("iccl") ||
                lowerMessage.includes("groww") ||
                lowerMessage.includes("zerodha") ||
                lowerMessage.includes("kuvera") ||
                lowerMessage.includes("paytm money")
            )
        ) {
            return TransactionType.INVESTMENT;
        }

        if (lowerMessage.includes("debited") && lowerMessage.includes("and credited to")) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes("credited") && lowerMessage.includes("and debited from")) {
            return TransactionType.INCOME;
        }

        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        // Cash deposit via Cash Acceptor Machine
        if (
            message.includes("Cash Acceptor Machine") ||
            (message.includes("cash") && message.includes("deposited"))
        ) {
            return "Cash Deposit";
        }

        // UPI Mandate execution: "towards MERCHANT for Mandate Created via PLATFORM"
        if (message.includes("Mandate") && message.includes("towards")) {
            const viaPattern = /via\s+([A-Za-z0-9]+)/i;
            let match = message.match(viaPattern);

            if (match) {
                const platform = this.cleanMerchantName(match[1].trim());
                if (this.isValidMerchantName(platform)) {
                    return platform;
                }
            }

            const towardsPattern = /towards\s+([^,\n]+?)(?:\s+for|\s*,|$)/i;
            match = message.match(towardsPattern);

            if (match) {
                const merchantInfo = match[1].trim();
                const cleanedMerchant = merchantInfo
                    .replace(/\s*-\s*Autopa.*$/i, "")
                    .trim();

                if (this.isValidMerchantName(cleanedMerchant)) {
                    return this.cleanMerchantName(cleanedMerchant);
                }
            }
        }

        const neftInwardPattern = /By\s+NEFTINWARD\s+[^\/]+\/(.+?)(?:\s*\.Avl|\s*\.|-BOI|$)/i;
        let match = message.match(neftInwardPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const creditedToPattern = /credited\s+to\s+([^.\n]+?)(?:\s+via|\s+Ref|\s+on|$)/i;
        match = message.match(creditedToPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const debitedFromPattern = /debited\s+from\s+([^.\n]+?)(?:\s+via|\s+Ref|\s+on|$)/i;
        match = message.match(debitedFromPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // ATM withdrawal
        if (message.includes("ATM") || message.includes("withdrawn")) {
            const atmPattern = /(?:ATM|withdrawn)\s+(?:at\s+)?([^.\n]+?)(?:\s+on|\s+Ref|$)/i;
            match = message.match(atmPattern);
            if (match) {
                const location = this.cleanMerchantName(match[1].trim());
                if (this.isValidMerchantName(location)) {
                    return `ATM - ${location}`;
                }
            }
            return "ATM";
        }

        // Generic "towards MERCHANT"
        if (!message.includes("Mandate")) {
            const towardsPattern = /towards\s+([^.\n]+?)(?:\s+via|\s+Ref|\s+on|$)/i;
            match = message.match(towardsPattern);
            if (match) {
                const merchant = this.cleanMerchantName(match[1].trim());
                if (this.isValidMerchantName(merchant)) {
                    return merchant;
                }
            }
        }

        // Generic "to MERCHANT"
        const toPattern = /to\s+([^.\n]+?)(?:\s+via|\s+Ref|\s+on|$)/i;
        match = message.match(toPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Generic "from MERCHANT"
        const fromPattern = /from\s+([^.\n]+?)(?:\s+via|\s+Ref|\s+on|$)/i;
        match = message.match(fromPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        const accountSlashPattern = /A\/c\s*([X*\d]+)/i;
        let match = message.match(accountSlashPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        const accountWordPattern = /account\s+([X*\d]+)/i;
        match = message.match(accountWordPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        const endingPattern = /(?:Account|A\/c)\s+ending\s+(\d{4})/i;
        match = message.match(endingPattern);
        if (match) {
            return match[1];
        }

        const accountNoPattern = /A\/c\s+No\.?\s*([X*\d]+)/i;
        match = message.match(accountNoPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractReference(message: string): string | null {
        const refNoPattern = /Ref\s+No\.?\s*(\d+)/i;
        let match = message.match(refNoPattern);
        if (match) {
            return match[1];
        }

        const referencePattern = /Reference[:\s]+(\w+)/i;
        match = message.match(referencePattern);
        if (match) {
            return match[1];
        }

        const txnPattern = /Txn\s*(?:ID|#)[:\s]*(\w+)/i;
        match = message.match(txnPattern);
        if (match) {
            return match[1];
        }

        const upiPattern = /UPI[:\s]+(\d+)/i;
        match = message.match(upiPattern);
        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractBalance(message: string): number | null {
        const patterns = [
            /Bal[:\s]+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /Available\s+Balance[:\s]+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            /Avl\s+Bal[:\s]+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                const balanceStr = match[1].replace(/,/g, "");
                const num = parseFloat(balanceStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        return super.extractBalance(message);
    }

    extractAvailableLimit(message: string): number | null {
        const creditLimitPattern = /Available\s+credit\s+limit\s+is\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)/i;
        const match = message.match(creditLimitPattern);
        if (match) {
            const limitStr = match[1].replace(/,/g, "");
            const num = parseFloat(limitStr);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractAvailableLimit(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("will be")) {
            return false;
        }

        if (lowerMessage.includes("call") && lowerMessage.includes("if not done by you")) {
            if (
                lowerMessage.includes("debited") ||
                lowerMessage.includes("credited") ||
                lowerMessage.includes("withdrawn") ||
                lowerMessage.includes("transferred")
            ) {
                return true;
            }
        }

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

        return super.isTransactionMessage(message);
    }
}

function isInvestmentTransaction(message: string): boolean {
    return (
        message.includes("mutual fund") ||
        message.includes("investment") ||
        message.includes("sip") ||
        message.includes("equity") ||
        message.includes("stock") ||
        message.includes("mf ")
    );
}