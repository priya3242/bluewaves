import { BaseIranianBankParser } from './BaseIranianBankParser';

/**
 * Parsian Bank parser for Iranian banking SMS messages.
 * Handles Persian language transaction messages with amounts in Rials and Tomans.
 */
export class ParsianBankParser extends BaseIranianBankParser {

    getBankName() {
        return "Parsian Bank";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        const parsianSenders = [
            "PARSIANBANK",
            "PARSIAN",
            "PARSIAN BANK",
            "PERSIANBANK",
            "PERSIAN"
        ];

        // ✅ FIX: use includes instead of "in"
        return parsianSenders.includes(upperSender);
    }
}