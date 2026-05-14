import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';
import { BaseThailandBankParser } from './BaseThailandBankParser';

/**
 * Krungthai Bank (KTB) parser for Thai banking SMS messages.
 */
export class KrungThaiBankParser extends BaseThailandBankParser {

    getBankName() {
        return "Krungthai Bank";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase()
        return upperSender == "KTB" ||
            upperSender.includes("KRUNGTHAI") ||
            upperSender.includes("KRUNG THAI")
    }
}
