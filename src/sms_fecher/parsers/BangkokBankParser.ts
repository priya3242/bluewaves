import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * Bangkok Bank (BBL) parser for Thai banking SMS messages.
 */
export class BangkokBankParser extends BaseThailandBankParser {
    getBankName() {
        return "Bangkok Bank";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        return (
            upperSender === "BBL" ||
            upperSender.includes("BANGKOK BANK") ||
            upperSender.includes("BANGKOKBANK")
        );
    }
}