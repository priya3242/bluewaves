import { BaseIndianBankParser } from './BaseIndianBankParser';
import { TransactionType } from '../core/types';

/**
 * Parser for T-Bank (formerly Tinkoff) SMS messages (Russia)
 *
 * Supported formats:
 * - Deposit: "Пополнение, счет RUB. 5000 ₽. Банкомат. Доступно 10028,05 ₽"
 * - Purchase: "Покупка, счет карты *1023. 3267 ₽. AZS 09117. Доступно 30672,14 ₽"
 * - Transfer: "Перевод. Счет RUB. 250 ₽. Милана Н. Баланс 0 ₽"
 */
export class TBankParser extends BaseIndianBankParser {
    getBankName() {
        return "T-Bank";
    }

    getCurrency() {
        return "RUB";
    }

    canHandle(sender: string): boolean {
        const normalized = sender.toUpperCase();
        return (
            normalized.includes("TBANK") ||
            normalized.includes("T-BANK") ||
            normalized.includes("TINKOFF")
        );
    }

    extractAmount(message: string): number | null {
        // First ruble amount in the message
        const amountPattern = /(?:^|[.\s])(\d[\d\s]*(?:,\d{1,2})?)\s*₽/i;
        const match = message.match(amountPattern);

        if (match) {
            const amountStr = match[1].replace(/\s+/g, "").replace(",", ".");
            const num = parseFloat(amountStr);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("пополнение")) return TransactionType.INCOME;
        if (lower.includes("зачисление")) return TransactionType.INCOME;
        if (lower.includes("возврат")) return TransactionType.INCOME;
        if (lower.includes("кэшбэк")) return TransactionType.INCOME;
        if (lower.includes("входящий перевод")) return TransactionType.INCOME;

        if (lower.includes("покупка")) return TransactionType.EXPENSE;
        if (lower.includes("списание")) return TransactionType.EXPENSE;
        if (lower.includes("снятие")) return TransactionType.EXPENSE;
        if (lower.includes("перевод")) return TransactionType.EXPENSE;
        if (lower.includes("оплата")) return TransactionType.EXPENSE;
        if (lower.includes("платёж")) return TransactionType.EXPENSE;
        if (lower.includes("платеж")) return TransactionType.EXPENSE;

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Merchant between the amount and the balance keyword
        const merchantPattern = /₽\.\s+(.+?)\.\s+(?:Доступно|Баланс)/i;
        let match = message.match(merchantPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            if (this.isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Fallback merchant after amount
        const fallbackPattern = /₽\.\s+([^.]+)/i;
        match = message.match(fallbackPattern);

        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim());
            const lowerMerchant = merchant.toLowerCase();

            if (
                this.isValidMerchantName(merchant) &&
                !lowerMerchant.startsWith("доступно") &&
                !lowerMerchant.startsWith("баланс")
            ) {
                return merchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // "счет карты *1023" or just "*1023"
        const cardPattern = /\*(\d{4})/i;
        const match = message.match(cardPattern);

        if (match) {
            return match[1];
        }

        return null;
    }

    detectIsCard(message: string): boolean {
        const lower = message.toLowerCase();

        if (lower.includes("карты") || lower.includes("карта")) {
            return true;
        }

        return super.detectIsCard(message);
    }

    extractBalance(message: string): number | null {
        const balancePattern = /(?:Доступно|Баланс)\s+(\d[\d\s]*(?:,\d{1,2})?)\s*₽/i;
        const match = message.match(balancePattern);

        if (match) {
            const balanceStr = match[1].replace(/\s+/g, "").replace(",", ".");
            const num = parseFloat(balanceStr);
            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        if (lower.includes("код") || lower.includes("пароль") || lower.includes("otp")) {
            return false;
        }

        if (!message.includes("₽")) {
            return false;
        }

        const keywords = [
            "пополнение",
            "покупка",
            "перевод",
            "списание",
            "снятие",
            "оплата",
            "платёж",
            "платеж",
            "возврат",
            "зачисление",
            "кэшбэк"
        ];

        return keywords.some(keyword => lower.includes(keyword));
    }
}