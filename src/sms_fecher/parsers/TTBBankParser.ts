import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * TTB (TMBThanachart Bank) parser for Thai banking SMS messages.
 */
export class TTBBankParser extends BaseThailandBankParser {
    getBankName() {
        return "TTB";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return (
            upperSender === "TTB" ||
            upperSender.includes("TMBTHANACHART") ||
            upperSender.includes("TMB")
        );
    }
}