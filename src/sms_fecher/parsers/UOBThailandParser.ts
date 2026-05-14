import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * UOB Thailand parser for Thai banking SMS messages.
 */
export class UOBThailandParser extends BaseThailandBankParser {
    getBankName() {
        return "UOB Thailand";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return (
            upperSender === "UOB" ||
            upperSender.includes("UOB THAILAND") ||
            upperSender.includes("UOBTHAILAND")
        );
    }
}