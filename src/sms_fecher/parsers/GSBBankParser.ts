

import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * Government Savings Bank (GSB) parser for Thai banking SMS messages.
 */
export class GSBBankParser extends BaseThailandBankParser {

    getBankName() {
        return "Government Savings Bank";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase()
        return upperSender == "GSB" ||
            upperSender.includes("GOVERNMENT SAVINGS") ||
            upperSender.includes("GOVT SAVINGS")
    }
}
