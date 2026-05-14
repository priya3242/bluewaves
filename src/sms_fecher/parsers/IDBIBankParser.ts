import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BankParser } from '../core/BankParser';





/**
 * Parser for IDBI Bank SMS messages
 *
 * Supported formats:
 * - Debit: "Your account has been successfully debited with Rs 59.00"
 * - UPI: "IDBI Bank Acct XX1234 debited for Rs 1040.00"
 * - AutoPay/Mandate transactions
 * - Balance information
 *
 * Common senders: IDBIBK, IDBIBANK, variations with DLT patterns
 */
export class IDBIBankParser extends BankParser {

    getBankName() {
        return "IDBI Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase()
        return normalizedSender.includes("IDBIBK") ||
            normalizedSender.includes("IDBIBANK") ||
            normalizedSender.includes("IDBI") ||
            // DLT patterns for transactions (-S suffix)
            /^[A-Z]{2}-IDBIBK-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-IDBI-S$/i.test(normalizedSender) ||
            // Legacy patterns
            /^[A-Z]{2}-IDBIBK$/i.test(normalizedSender) ||
            /^[A-Z]{2}-IDBI$/i.test(normalizedSender) ||
            // Direct sender IDs
            normalizedSender == "IDBIBK" ||
            normalizedSender == "IDBIBANK"
    }

    extractAmount(message: string): number | null {
        // Pattern 1: "debited with Rs 59.00"
        const debitWithPattern = /debited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        let match = message.match(debitWithPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        // Pattern 2: "debited for Rs 1040.00"
        const debitForPattern = /debited\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        match = message.match(debitForPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        // Pattern 3: "credited with Rs XXX"
        const creditPattern = /credited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
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
        // Pattern 1: "towards <merchant> for"
        const towardsPattern = /towards\s+([^.\n]+?)\s+for/i
        let match = message.match(towardsPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Pattern 2: "; <merchant> credited."
        const creditedMerchantPattern = /;\s*([^.\n]+?)\s+credited\./i
        match = message.match(creditedMerchantPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Pattern 3: AutoPay/Mandate specific
        if (message.includes("AutoPay") ||
            message.includes("MANDATE")
        ) {
            // Extract merchant name before "for" if it's AutoPay
            const merchantPattern = /towards\s+([^.\n]+?)\s+for\s+\w*MANDATE/i
            match = message.match(merchantPattern);
            if (match) {
                return this.cleanMerchantName(match[1].trim())
            }
        }

        // Fall back to base class patterns
        return super.extractMerchant(message, sender)
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // Pattern 1: "Acct XX1234" or "IDBI Bank Acct XX1234"
        const acctPatterns = [
            /IDBI\s+Bank\s+Acct\s+([X*\d]+)/i,
            /Acct\s+([X*\d]+)/i
        ];



        for (const pattern of acctPatterns) {
            let match = message.match(pattern);
            if (match) {
                return this.extractLast4Digits(match[1])
            }
        }

        return null
    }

    extractReference(message: string): string | null {
        // Pattern 1: "RRN 519766155631"
        const rrnPattern = /RRN\s+([A-Za-z0-9]+)/i
        let match = message.match(rrnPattern);
        if (match) {
            return match[1]
        }

        // Pattern 2: "UPI:521687538121"
        const upiPattern = /UPI:([A-Za-z0-9]+)/i
        match = message.match(upiPattern);
        if (match) {
            return match[1]
        }

        // Fall back to base class
        return super.extractReference(message)
    }

    extractBalance(message: string): number | null {
        // Pattern: "Bal Rs 3694.38"
        const balancePattern = /Bal\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i
        let match = message.match(balancePattern);
        if (match) {
            const balanceStr = match[1].replace(",", "")
            const num = parseFloat(balanceStr);
            return isNaN(num) ? null : num;
        }

        // Fall back to base class
        return super.extractBalance(message)
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase()

        // Skip UPI block instructions (not a transaction)
        if (lowerMessage.includes("to block upi") && lowerMessage.includes("send sms")) {
            // This is just instruction text, don't skip the entire message
        }

        // Fall back to base class for standard checks
        return super.isTransactionMessage(message)
    }
}