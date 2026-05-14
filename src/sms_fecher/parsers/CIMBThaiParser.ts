import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * CIMB Thai Bank parser for Thai banking SMS messages.
 */
export class CIMBThaiParser extends BaseThailandBankParser {
    getBankName() {
        return "CIMB Thai";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return (
            upperSender === "CIMB" ||
            upperSender.includes("CIMB THAI") ||
            upperSender.includes("CIMBTHAI")
        );
    }
}