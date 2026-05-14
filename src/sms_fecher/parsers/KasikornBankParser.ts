import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';
import { BaseThailandBankParser } from './BaseThailandBankParser';


/**
 * Kasikorn Bank (KBank) parser for Thai banking SMS messages.
 */
export class KasikornBankParser extends BaseThailandBankParser {

    getBankName() {
        return "Kasikorn Bank";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase()
        return upperSender == "KBANK" ||
            upperSender.includes("KASIKORN") ||
            upperSender.includes("KASIKORNBANK")
    }
}
