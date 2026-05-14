import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Tigo Pesa / Mixx by Yas (Tanzania) mobile money SMS messages
 *
 * Handles formats like:
 * - "Cash-In of TSh 100,000 from Agent - LUCY SUKUM is successful. New balance is TSh 100,000"
 * - "You have sent TSh 25,000 with CashOut fee TSh 2,156 to 255713XXXXXX - BENEDICTA MREMA"
 * - "You have paid TSh 131,000 to DIAPERS AND WIPES SUPPLIERS. Charges TSh 2,000"
 * - "Transfer Successful. New balance is TSh 97,000. You have received TSh 97,000 from TIPS.Selcom_MFB"
 */
export class TigoPesaParser extends BankParser {
    getBankName() {
        return "Tigo Pesa";
    }

    getCurrency() {
        return "TZS"; // TSh is same as TZS (Tanzanian Shilling)
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return (
            normalizedSender.includes("TIGOPESA") ||
            normalizedSender.includes("TIGO PESA") ||
            normalizedSender.includes("MIXX BY YAS") ||
            normalizedSender.includes("MIXXBYYAS") ||
            normalizedSender === "TIGO" ||
            normalizedSender.startsWith("TIGOPESA")
        );
    }

    extractAmount(message: string): number | null {
        const tshPattern = /TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i;

        const transactionAmountPatterns = [
            /Cash-In of TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i,
            /sent TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i,
            /received TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i,
            /paid TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i,
            /You have sent TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i,
            /You have paid TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i
        ];

        for (const pattern of transactionAmountPatterns) {
            const match = message.match(pattern);
            if (match) {
                const amountStr = match[1].replace(/,/g, "");
                const num = parseFloat(amountStr);
                return Number.isNaN(num) ? null : num;
            }
        }

        const match = message.match(tshPattern);
        if (match) {
            const amountStr = match[1].replace(/,/g, "");
            const num = parseFloat(amountStr);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("cash-in")) return TransactionType.INCOME;
        if (lowerMessage.includes("you have received")) return TransactionType.INCOME;
        if (lowerMessage.includes("received tsh")) return TransactionType.INCOME;
        if (lowerMessage.includes("received")) return TransactionType.INCOME;
        if (lowerMessage.includes("you have sent")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("you have paid")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        const agentPattern = /from Agent\s*-?\s*([A-Z][A-Za-z\s]+?)\s+is\s+successful/i;
        let match = message.match(agentPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return `Agent - ${merchant}`;
            }
        }

        const toPhoneNamePattern = /to\s+[\dX]+\s*-\s*([A-Z][A-Za-z\s]+?)(?:\.|Total|$)/i;
        match = message.match(toPhoneNamePattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const paidToPattern =
            /paid\s+TSh\s*[0-9,]+(?:\.[0-9]{2})?\s+to\s+([A-Za-z0-9\s&]+?)(?:\.|Charges|$)/i;
        match = message.match(paidToPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        const tipsPattern = /from\s+(TIPS\.[A-Za-z0-9_.]+)/i;
        match = message.match(tipsPattern);
        if (match) {
            const tipsSource = match[1];
            if (tipsSource.includes("Selcom")) return "Selcom (TIPS Transfer)";
            if (tipsSource.includes("NMB")) return "NMB Bank (TIPS Transfer)";
            if (tipsSource.includes("CRDB")) return "CRDB Bank (TIPS Transfer)";
            return "TIPS Transfer";
        }

        const simpleToPattern = /to\s+([A-Z][A-Za-z\s]+?)(?:\.|,|Charges|Total|$)/i;
        match = message.match(simpleToPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractBalance(message: string): number | null {
        const newBalancePattern = /New balance is TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i;
        let match = message.match(newBalancePattern);
        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            return Number.isNaN(num) ? null : num;
        }

        const yourNewBalancePattern = /Your New balance is TSh\s*([0-9,]+(?:\.[0-9]{2})?)/i;
        match = message.match(yourNewBalancePattern);
        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    extractReference(message: string): string | null {
        const txnIdPattern = /TxnId:\s*(\d+)/i;
        let match = message.match(txnIdPattern);
        if (match) {
            return match[1];
        }

        const txnIDPattern = /TxnID:\s*(\d+)/i;
        match = message.match(txnIDPattern);
        if (match) {
            return match[1];
        }

        const trnxIdPattern = /Trnx ID:\s*(\d+)/i;
        match = message.match(trnxIdPattern);
        if (match) {
            return match[1];
        }

        const tipsRefPattern = /with TxnId:\s*\d+\.\s*([A-Z0-9_]+)/i;
        match = message.match(tipsRefPattern);
        if (match) {
            return match[1];
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (!lowerMessage.includes("tsh")) {
            return false;
        }

        const transactionKeywords = [
            "cash-in",
            "you have sent",
            "you have paid",
            "you have received",
            "transfer successful",
            "is successful",
            "new balance"
        ];

        return transactionKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    protected cleanMerchantName(merchant: string): string {
        return merchant
            .replace(/\s*\(.*?\)\s*$/i, "")
            .replace(/\s+on\s+\d{2}.*$/i, "")
            .replace(/\s*-\s*$/i, "")
            .replace(/^\s*-\s*/i, "")
            .replace(/\s+$/i, "")
            .trim();
    }

    protected isValidMerchantName(name: string): boolean {
        return (
            name.length >= 2 &&
            /[A-Za-z]/.test(name) &&
            !/^\d+$/.test(name) &&
            !name.includes("@")
        );
    }
}