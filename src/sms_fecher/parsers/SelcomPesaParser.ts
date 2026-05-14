import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

export class SelcomPesaParser extends BankParser {

    getBankName(): string {
        return "Selcom Pesa";
    }

    getCurrency(): string {
        return "TZS";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();

        return (
            normalizedSender.includes("SELCOM") ||
            normalizedSender.includes("SELCOMPESA") ||
            normalizedSender === "SELCOM PESA" ||
            normalizedSender === "SELCOM"
        );
    }

    extractAmount(message: string): number | null {
        const tzsPattern = /TZS\s+([0-9,]+(?:\.[0-9]{2})?)/i;

        const match = message.match(tzsPattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("you have received")) return TransactionType.INCOME;
        if (lower.includes("you have sent")) return TransactionType.EXPENSE;
        if (lower.includes("you have paid")) return TransactionType.EXPENSE;
        if (lower.includes("you have withdrawn")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string): string | null {

        const fromPattern = /from\s+([A-Z][A-Za-z\s]+?)(?:\s+-\s+[^(]+)?\s*\([^)]+\)/i;
        let match = message.match(fromPattern);
        if (match) return this.cleanMerchantName(match[1]);

        const toPattern = /to\s+([A-Z][A-Za-z\s]+?)(?:\s+-\s+[^(]+)?\s*\([^)]+\)/i;
        match = message.match(toPattern);
        if (match) return this.cleanMerchantName(match[1]);

        const paidToPattern = /paid\s+TZS\s+[0-9,]+(?:\.[0-9]{2})?\s+to\s+([A-Za-z0-9\s]+?)(?:\s+using|\s+on)/i;
        match = message.match(paidToPattern);
        if (match) return this.cleanMerchantName(match[1]);

        // ATM
        if (message.includes("withdrawn") && message.includes("ATM")) {
            const atmPattern = /at\s+ATM\s*-?\s*([^u]+?)(?:\s+using|$)/i;
            match = message.match(atmPattern);

            if (match) {
                const location = match[1].trim();
                return location.length > 0
                    ? `ATM - ${location}`
                    : "ATM Withdrawal";
            }

            return "ATM Withdrawal";
        }

        const simpleToPattern = /to\s+([A-Z][A-Za-z\s]+?)(?:\s+on\s+|\s*$)/i;
        match = message.match(simpleToPattern);
        if (match) return this.cleanMerchantName(match[1]);

        return null;
    }

    extractBalance(message: string): number | null {
        const balancePattern = /Updated balance is TZS\s+([0-9,]+(?:\.[0-9]{2})?)/i;

        const match = message.match(balancePattern);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ""));
            return isNaN(num) ? null : num;
        }

        return null;
    }

    extractReference(message: string): string | null {
        const txnIdPattern = /^([A-Z0-9]{8,9})\s+(?:Confirmed|Accepted)/i;

        let match = message.match(txnIdPattern);
        if (match) return match[1];

        const tipsPattern = /TIPS\s+Reference[:\s]+([A-Z0-9]+)/i;
        match = message.match(tipsPattern);
        if (match) return match[1];

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (!lower.includes("confirmed") && !lower.includes("accepted")) {
            return false;
        }

        const keywords = [
            "you have received",
            "you have sent",
            "you have paid",
            "you have withdrawn",
            "updated balance"
        ];

        return keywords.some(k => lower.includes(k));
    }

    detectIsCard(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes("card ending") ||
            lower.includes("using your card");
    }
}