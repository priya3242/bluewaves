import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';





/**
 * Parser for Karnataka Bank SMS messages
 *
 * Supported formats:
 * - Debit: "Your Account x001234x has been DEBITED for Rs.6368/-"
 * - Credit: "Your a/c XX1234 is credited by Rs.6600.00"
 * - ACH, UPI, and other transaction types
 *
 * Common senders: Karnataka Bank, KTKBNK, variations with DLT patterns
 */
export class KarnatakaBankParser extends BankParser {

    getBankName() {
        return "Karnataka Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase()
        return normalizedSender.includes("KARNATAKA BANK") ||
                normalizedSender.includes("KARNATAKABANK") ||
                normalizedSender.includes("KBLBNK") ||
                normalizedSender.includes("KTKBANK") ||
                normalizedSender.includes("KARBANK") ||
                // DLT patterns for transactions (-S suffix)
                /^[A-Z]{2}-KBLBNK-S$/i.test(normalizedSender) ||
                /^[A-Z]{2}-KARBANK-S$/i.test(normalizedSender) ||
                // Legacy patterns
                /^[A-Z]{2}-KBLBNK$/i.test(normalizedSender) ||
                // Direct sender IDs
                normalizedSender == "KBLBNK" ||
                normalizedSender == "KARBANK"
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "DEBITED for Rs.6368/-"
        const debitPattern = /DEBITED\s+for\s+Rs\.?([0-9,]+(?:\.\d{2})?)\/?\-?/i
        let match = message.match(debitPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
        return isNaN(num) ? null : num;
        }

        // Pattern 2: "credited by Rs.6600.00"
        const creditPattern = /credited\s+by\s+Rs\.?([0-9,]+(?:\.\d{2})?)/i
        match = message.match(creditPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
        return isNaN(num) ? null : num;
        }

        // Fall back to base class patterns
        return super.extractAmount(message)
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: ACH transactions - "ACHInwDr-MERCHANT/date"
        const achPattern = /ACH[A-Za-z]*-([^\/]+)\//i
        let match = message.match(achPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Pattern 2: "from <merchant> on" for UPI
        const fromPattern = /from\s+([^\s]+)\s+on/i
        match = message.match(fromPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Pattern 3: Check for specific transaction types
        const lowerMessage = message.toLowerCase()
        if (lowerMessage.includes("lic of india")) return "LIC of India";
if (lowerMessage.includes("upi") && message.match(fromPattern) == null) return "UPI Transaction";
return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;
        // Pattern 1: "Account x001234x" or "Account XX1234X"
        // Capture everything after keyword, filter to digits, take last 4
        const accountPattern1 = /Account\s+([xX\d]+)/i
        let match = message.match(accountPattern1);
        if (match) {
            return this.extractLast4Digits(match[1])
        }

        // Pattern 2: "a/c XX1234"
        const accountPattern2 = /a\/c\s+([xX\d]+)/i
        match = message.match(accountPattern2);
        if (match) {
            return this.extractLast4Digits(match[1])
        }

        return null
    }

    extractReference(message: string): string | null {
        // Pattern 1: "UPI Ref no 441877242175"
        const upiRefPattern = /UPI\s+Ref\s+no\s+([0-9]+)/i
        let match = message.match(upiRefPattern);
        if (match) {
            return match[1]
        }

        // Fall back to base class
        return super.extractReference(message)
    }

    extractBalance(message: string): number | null {
        // Pattern: "Balance is Rs.705.92"
        const balancePattern = /Balance\s+is\s+Rs\.?([0-9,]+(?:\.\d{2})?)/i
        let match = message.match(balancePattern);
        if (match) {
            const balanceStr = match[1].replace(",", "")
            const num = parseFloat(balanceStr);
        return isNaN(num) ? null : num;
        }

        // Fall back to base class
        return super.extractBalance(message)
    }
}
