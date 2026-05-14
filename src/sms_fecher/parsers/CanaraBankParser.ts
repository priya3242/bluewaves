import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';






/**
 * Parser for Canara Bank SMS messages
 */
export class CanaraBankParser extends BaseIndianBankParser {

    getBankName() {
        return "Canara Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase()
        return normalizedSender.includes("CANBNK") ||
                normalizedSender.includes("CANARA")
    }

    extractAmount(message: string): number | null {
        // Pattern: Rs.23.00 paid thru
        const upiAmountPattern = /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+paid/i
        let match = message.match(upiAmountPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
        return isNaN(num) ? null : num;
        }

        // Pattern: INR 50.00 has been DEBITED
        const debitPattern = /INR\s+([\d,]+(?:\.\d{2})?)\s+has\s+been\s+DEBITED/i
        match = message.match(debitPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
        return isNaN(num) ? null : num;
        }

        // Fall back to base class patterns
        return super.extractAmount(message)
    }

    extractMerchant(message: string, sender: string): string | null {
        // Pattern 1: RTGS/NEFT incoming - "by Sender AXIS MUTUAL FUND REDEMPTION PO, IFSC..."
        // Extract the sender name before IFSC/comma
        const rtgsSenderPattern = /by\s+Sender\s+([^,]+?)(?:,\s*IFSC|,\s*Sender\s+A\/c|\s*$)/i
        let match = message.match(rtgsSenderPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Pattern 2: UPI - paid thru A/C XX1234 on 08-8-25 16:41:00 to BMTC BUS KA57F6
        const upiMerchantPattern = /\sto\s+([^,]+?)(?:,\s*UPI|\.|-Canara)/i
        match = message.match(upiMerchantPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Check if it's a generic debit
        if (message.includes("DEBITED")) {
            return "Canara Bank Debit"
        }

        // Fall back to base class patterns
        return super.extractMerchant(message, sender)
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;
        // Pattern: account XXX123 or A/C XX1234
        const accountPattern = /(?:account|A\/C)\s+([X*\d]+)/i
        let match = message.match(accountPattern);
        if (match) {
            return this.extractLast4Digits(match[1])
        }

        return null
    }

    extractBalance(message: string): number | null {
        // Pattern: Total Avail.bal INR 1,092.62
        const balancePattern = /(?:Total\s+)?Avail\.?bal\s+INR\s+([\d,]+(?:\.\d{2})?)/i
        let match = message.match(balancePattern);
        if (match) {
            const balanceStr = match[1].replace(",", "")
            const num = parseFloat(balanceStr);
        return isNaN(num) ? null : num;
        }

        return super.extractBalance(message)
    }

    extractReference(message: string): string | null {
        // Pattern: UPI Ref 123456789012
        const upiRefPattern = /UPI\s+Ref\s+(\d+)/i
        let match = message.match(upiRefPattern);
        if (match) {
            return match[1]
        }

        return super.extractReference(message)
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase()

        // Skip failed transactions
        if (lowerMessage.includes("failed due to")) {
            return false
        }

        // Check for Canara-specific transaction keywords
        if (lowerMessage.includes("paid thru") ||
            lowerMessage.includes("has been debited") ||
            lowerMessage.includes("has been credited")
        ) {
            return true
        }

        return super.isTransactionMessage(message)
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase()

        // Mutual fund REDEMPTION credited = INCOME (money coming in from selling investment)
        // This overrides the base class which would mark "mutual fund" as INVESTMENT
        if (lowerMessage.includes("redemption") && lowerMessage.includes("credited")) {
            return TransactionType.INCOME
        }

        // Fall back to base class
        return super.extractTransactionType(message)
    }
}