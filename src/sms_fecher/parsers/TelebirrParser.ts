import { BankParser } from '../core/BankParser';
import { TransactionType } from '../core/types';

/**
 * Parser for Telebirr - handles ETB currency transactions
 */
export class TelebirrParser extends BankParser {
    getBankName() {
        return "Telebirr";
    }

    getCurrency() {
        return "ETB"; // Ethiopian Birr
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase().trim();
        return (
            upperSender === "127" ||
            upperSender.includes("127") ||
            /^[A-Z]{2}-127-[A-Z]$/i.test(upperSender) ||
            /^127-[A-Z0-9]+$/i.test(upperSender) ||
            /^[A-Z0-9]+-127$/i.test(upperSender)
        );
    }

    extractAmount(message: string): number | null {
        const patterns = [
            /ETB\s+([0-9,]+(?:\.[0-9]{2})?)\s/i,
            /ETB\s*([0-9,]+(?:\.[0-9]{2})?)(?:\s|$|\.)/i,
            /(?:Credited|debited|transfered)\s+(?:with\s+)?ETB\s+([0-9,]+(?:\.[0-9]{2})?)/i
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

        if (lowerMessage.includes("to your saving account")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("from your saving account")) return TransactionType.INCOME;
        if (lowerMessage.includes("you have received")) return TransactionType.INCOME;
        if (lowerMessage.includes("you have paid")) return TransactionType.EXPENSE;
        if (lowerMessage.includes("you have transferred")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 0: Savings deposit
        const savingsDepositPattern =
            /deposited\s+ETB\s+[0-9,]+(?:\.[0-9]{2})?\s+to\s+your\s+(.+?)\s+on\s+\d{2}\/\d{2}\/\d{4}/i;
        let match = message.match(savingsDepositPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) return merchant;
        }

        // Pattern 0b: Savings withdraw
        const savingsWithdrawPattern =
            /withdraw(?:n)?\s+ETB\s+[0-9,]+(?:\.[0-9]{2})?\s+from\s+your\s+(.+?)\s+on\s+\d{2}\/\d{2}\/\d{4}/i;
        match = message.match(savingsWithdrawPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) return merchant;
        }

        // Pattern 1: "from Zemen Bank to your telebirr Account"
        const bankFromPattern = /from\s+([A-Za-z\s]+Bank)\s+to\s+your/i;
        match = message.match(bankFromPattern);
        if (match) {
            const merchant = match[1].trim();
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 2: "paid ETB X to 519680 - City Government..."
        const paidToPattern =
            /paid\s+ETB\s+[0-9,]+(?:\.[0-9]{2})?\s+to\s+([^,\n]+?)(?=\s+on\s+\d{2}\/\d{2}\/\d{4}|\.\s+Your\s+transaction|$)/i;
        match = message.match(paidToPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return merchant;
            }
        }

        // Pattern 3a: fuel purchase
        const fuelPurchasedFromPattern =
            /(for\s+fuel\s+purchased\s+from\s+[^,\n]+?)(?=\s+on\s+\d{2}\/\d{2}\/\d{4}|\.\s+Your\s+transaction|$)/i;
        match = message.match(fuelPurchasedFromPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return merchant;
            }
        }

        // Pattern 3b: goods purchased from
        const purchasedFromPattern =
            /for\s+goods\s+purchased\s+from\s+([^,\n]+?)(?=\s+on\s+\d{2}\/\d{2}\/\d{4}|\.\s+Your\s+transaction|$)/i;
        match = message.match(purchasedFromPattern);
        if (match) {
            const merchant = match[1].trim();
            if (merchant.length > 0) {
                return merchant;
            }
        }

        // Pattern 4: package payments
        const packagePattern =
            /for\s+package\s+([^,\n]+?)(?=\s+purchase\s+made|\s+on\s+\d{2}\/\d{2}\/\d{4}|\.\s+Your\s+transaction|$)/i;
        match = message.match(packagePattern);
        if (match) {
            let merchant = match[1].trim();

            const purchaseMadePattern = /purchase\s+made\s+for\s+(\d+)/i;
            const purchaseMatch = message.match(purchaseMadePattern);
            if (purchaseMatch) {
                merchant += ` purchase made for ${purchaseMatch[1]}`;
            }

            if (merchant.length > 0) {
                return merchant;
            }
        }

        // Pattern 5: transferred to recipient
        const transferredToPattern =
            /transferred\s+[^,\n]+?\s+to\s+([^,\n]+?)(?=\s+on\s+\d{2}\/\d{2}\/\d{4}|\.|$)/i;
        match = message.match(transferredToPattern);
        if (match) {
            let merchant = match[1].trim();

            if (merchant.includes("(") && merchant.includes(")")) {
                return merchant;
            }

            merchant = this.cleanMerchantName(merchant);
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 6: from sender
        const fromPattern =
            /from\s+(?!your\s+account)([^,\n]+?)(?=\s+on\s+\d{2}\/\d{2}\/\d{4}|\s+to\s+your|\.|$)/i;
        match = message.match(fromPattern);
        if (match) {
            let merchant = match[1].trim();

            merchant = merchant.replace(/([A-Za-z\s]+)\((\d+\*+\d+)\)/i, "$1 ($2)");

            if (merchant.includes("(") && merchant.includes(")")) {
                return merchant;
            }

            merchant = this.cleanMerchantName(merchant);
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Pattern 7: simple to recipient
        const toPattern =
            /to\s+([^,\n]+?)(?=\s+on\s+\d{2}\/\d{2}\/\d{4}|\.|$)/i;
        match = message.match(toPattern);
        if (match) {
            let merchant = match[1].trim();

            if (merchant.includes("(")) {
                return merchant;
            }

            merchant = this.cleanMerchantName(merchant);
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        // Kept compatible with the original behavior
        const bracketedPattern = /Dear\s+\[([^\]]+)\]/i;
        let match = message.match(bracketedPattern);
        if (match) {
            return `[${match[1]}]`;
        }

        const tokenAfterDearPattern = /Dear\s+([^\r\n ]+)/i;
        match = message.match(tokenAfterDearPattern);
        if (match) {
            return match[1].trimEnd();
        }

        return null;
    }

    extractBalance(message: string): number | null {
        const patterns = [
            /E-Money Account\s+balance is ETB\s+([0-9,]+(?:\.[0-9]{2})?)/i,
            /current balance is ETB\s+([0-9,]+(?:\.[0-9]{2})?)/i,
            /telebirr account balance is\s+ETB\s+([0-9,]+(?:\.[0-9]{2})?)/i
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

    extractReference(message: string): string | null {
        const bankTransactionPattern = /bank transaction number is\s+([A-Z0-9]+)/i;
        let match = message.match(bankTransactionPattern);
        if (match) {
            return match[1];
        }

        const byTransactionPattern = /by transaction number\s+([A-Z0-9]+)/i;
        match = message.match(byTransactionPattern);
        if (match) {
            return match[1];
        }

        const transactionPattern = /(?:your\s+)?transaction number is\s+([A-Z0-9]+)/i;
        match = message.match(transactionPattern);
        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase();

        const telebirrTransactionKeywords = [
            "dear",
            "you have received",
            "you have paid",
            "you have transferred",
            "current balance",
            "e-money account balance",
            "telebirr account balance",
            "thank you for using telebirr",
            "etb",
            "transaction number"
        ];

        if (telebirrTransactionKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }

        return super.isTransactionMessage(message);
    }
}