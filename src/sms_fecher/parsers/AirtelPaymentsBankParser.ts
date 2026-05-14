import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

export class AirtelPaymentsBankParser extends BankParser {

    getBankName() {
        return "Airtel Payments Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return normalizedSender.includes("AIRBNK");
    }

    extractAmount(message: string): number | null {
        const amountPatterns = [
            /credited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
            /Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+debited\s+from/i,
            /debited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of amountPatterns) {
            const match = message.match(pattern);
            if (match) {
                const amount = match[1].replace(/,/g, "");
                const num = parseFloat(amount);
                if (!isNaN(num)) return num;
            }
        }

        return super.extractAmount(message);
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes("credited with")) return TransactionType.INCOME;
        if (lowerMessage.includes("is credited")) return TransactionType.INCOME;
        if (lowerMessage.includes("credit")) return TransactionType.INCOME;
        if (lowerMessage.includes("debited from")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debited with")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("debit")) return TransactionType.EXPENSE;
        return super.extractTransactionType(message);
    }

    extractMerchant(message: string, sender: string): string | null {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes("airtel payments bank")) {
            return "Airtel Payments Bank Transaction";
        }
        const baseMerchant = super.extractMerchant(message, sender);
        return baseMerchant || "Airtel Payments Bank";
    }

    extractReference(message: string): string | null {
        const txnIdPattern = /Txn\s+ID[:\s]+([A-Z0-9]+)/i;
        let match = message.match(txnIdPattern);
        if (match) {
            const txnId = match[1];
            if (!txnId.includes("x") && !txnId.includes("X")) {
                return txnId;
            }
        }

        const altTxnPattern = /Transaction\s+ID[:\s]+([A-Z0-9]+)/i;
        match = message.match(altTxnPattern);
        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractBalance(message: string): number | null {
        const balancePattern = /Bal[:\s]+([0-9,]+(?:\.\d{2})?)/i;
        let match = message.match(balancePattern);
        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            if (!isNaN(num)) return num;
        }

        const altBalancePattern = /Balance[:\s]+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;
        match = message.match(altBalancePattern);
        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            if (!isNaN(num)) return num;
        }

        return super.extractBalance(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("otp") ||
            lowerMessage.includes("verification") ||
            lowerMessage.includes("request") ||
            lowerMessage.includes("failed")
        ) {
            return false;
        }

        if (lowerMessage.includes("credited with") ||
            lowerMessage.includes("debited from") ||
            (lowerMessage.includes("airtel payments bank") &&
            (lowerMessage.includes("credited") || lowerMessage.includes("debited")))
        ) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}