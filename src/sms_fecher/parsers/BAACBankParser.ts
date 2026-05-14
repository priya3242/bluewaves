import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * Bank for Agriculture and Agricultural Cooperatives (BAAC) parser for Thai banking SMS messages.
 */
export class BAACBankParser extends BaseThailandBankParser {
    getBankName() {
        return "BAAC";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return (
            upperSender === "BAAC" ||
            upperSender.includes("AGRICULTURE")
        );
    }
}