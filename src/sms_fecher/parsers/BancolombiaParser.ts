import { TransactionType } from '../core/types';
import { BankParser } from '../core/BankParser';

/**
 * Parser for Bancolombia (Colombian bank) SMS messages
 *
 * Sender IDs: 87400, 85540
 * Language: Spanish
 * Currency: COP (Colombian Peso)
 *
 * Transaction types:
 * - Transferiste: Transfer (EXPENSE)
 * - Compraste: Purchase (EXPENSE)
 * - Pagaste: Payment (EXPENSE)
 * - Recibiste: Received (INCOME)
 */
export class BancolombiaParser extends BankParser {
    getBankName() {
        return "Bancolombia";
    }

    canHandle(sender: string): boolean {
        return sender === "87400" || sender === "85540";
    }

    getCurrency() {
        return "COP";
    }

    isTransactionMessage(message: string): boolean {
        // Handle Spanish transaction keywords
        const lowerMessage = message.toLowerCase();

        const spanishKeywords = [
            "transferiste",
            "compraste",
            "pagaste",
            "recibiste"
        ];

        return spanishKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }

    extractAmount(message: string): number | null {
        /**
         * Colombian number format:
         * $1.000.000,50
         * = 1000000.50
         */
        const pattern =
            /(Transferiste|Compraste|Pagaste|Recibiste)\s+\$?([0-9.,]+)/i;

        const match = message.match(pattern);

        if (match) {
            const amount = match[2]
                .replace(/\./g, "") // Remove thousand separators
                .replace(",", ".") // Decimal separator
                .replace(/\$/g, "")
                .trim();

            const num = parseFloat(amount);

            return Number.isNaN(num) ? null : num;
        }

        return null;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("transferiste")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("compraste")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("pagaste")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("recibiste")) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractMerchant(message: string, sender: string): string | null {
        const lower = message.toLowerCase();

        if (lower.includes("transferiste")) {
            return "Transferencia";
        }

        if (lower.includes("compraste")) {
            return "Compra";
        }

        if (lower.includes("pagaste")) {
            return "Pago";
        }

        if (lower.includes("recibiste")) {
            return "Dinero recibido";
        }

        return "Bancolombia";
    }
}