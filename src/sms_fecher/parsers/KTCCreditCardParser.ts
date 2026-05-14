import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * KTC Credit Card parser for Thai banking SMS messages.
 * Handles credit card spending with available limit extraction.
 */
export class KTCCreditCardParser extends BaseThailandBankParser {

    getBankName(): string {
        return "KTC";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            upperSender === "KTC" ||
            upperSender.includes("KRUNGTHAI CARD")
        );
    }

    parse(
        smsBody: string,
        sender: string,
        timestamp: number
    ): ParsedTransaction | null {

        const parsed = super.parse(
            smsBody,
            sender,
            timestamp
        );

        if (!parsed) {
            return null;
        }

        const creditLimit =
            this.extractAvailableLimit(smsBody);

        return {
            ...parsed,
            type: parsed.type ?? TransactionType.CREDIT,
            isFromCard: true,
            creditLimit
        };
    }

    /**
     * Extract available credit limit
     */
    extractAvailableLimit(
        message: string
    ): number | null {

        const patterns = [

            // Available limit 50,000.00
            /available\s+limit\s+([0-9,]+(?:\.\d{2})?)/i,

            // Credit limit remaining 50,000
            /credit\s+limit\s+(?:remaining|available)\s+([0-9,]+(?:\.\d{2})?)/i,

            // วงเงินคงเหลือ 50000
            /วงเงินคงเหลือ\s+([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of patterns) {

            const match = message.match(pattern);

            if (match?.[1]) {

                const num = parseFloat(
                    match[1].replace(/,/g, "")
                );

                return Number.isNaN(num)
                    ? null
                    : num;
            }
        }

        return null;
    }
}