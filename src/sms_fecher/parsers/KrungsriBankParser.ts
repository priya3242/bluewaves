import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';
import { BaseThailandBankParser } from './BaseThailandBankParser';


/**
 * Krungsri (Bank of Ayudhya - BAY) parser for Thai banking SMS messages.
 */
export class KrungsriBankParser extends BaseThailandBankParser {

    getBankName() {
        return "Krungsri";
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase()
        return upperSender == "BAY" ||
            upperSender.includes("KRUNGSRI") ||
            upperSender.includes("AYUDHYA")
    }
}
