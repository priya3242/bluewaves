import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * Siam Commercial Bank (SCB) parser for Thai banking SMS messages.
 */
export class SiamCommercialBankParser extends BaseThailandBankParser {

    getBankName(): string {
        return "Siam Commercial Bank";
    }

    canHandle(sender: string): boolean {
        const upper = sender.toUpperCase();

        return (
            upper === "SCB" ||
            upper.includes("SIAM COMMERCIAL") ||
            upper.includes("SIAMCOMMERCIAL")
        );
    }
}