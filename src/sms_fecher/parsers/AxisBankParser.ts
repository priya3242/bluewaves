import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';






/**
 * Parser for Axis Bank SMS messages
 */
export class AxisBankParser extends BaseIndianBankParser {

    getBankName() {
        return "Axis Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase()
        return normalizedSender.includes("AXIS BANK") ||
            normalizedSender.includes("AXISBANK") ||
            normalizedSender.includes("AXISBK") ||
            normalizedSender.includes("AXISB") ||
            // DLT patterns for transactions (-S suffix)
            /^[A-Z]{2}-AXISBK-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-AXISBANK-S$/i.test(normalizedSender) ||
            /^[A-Z]{2}-AXIS-S$/i.test(normalizedSender) ||
            // Legacy patterns
            /^[A-Z]{2}-AXISBK$/i.test(normalizedSender) ||
            /^[A-Z]{2}-AXIS$/i.test(normalizedSender) ||
            // Direct sender IDs
            normalizedSender == "AXISBK" ||
            normalizedSender == "AXISBANK" ||
            normalizedSender == "AXIS"
    }

    extractAmount(message: string): number | null {
        const inrDebitPattern = /INR\s+([0-9,]+(?:\.\d{2})?)\s+debited/i
        let match = message.match(inrDebitPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        const inrCreditPattern = /INR\s+([0-9,]+(?:\.\d{2})?)\s+credited/i
        match = message.match(inrCreditPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        const paymentPattern = /Payment\s+of\s+INR\s+([0-9,]+(?:\.\d{2})?)/i
        match = message.match(paymentPattern);
        if (match) {
            const amount = match[1].replace(",", "")
            const num = parseFloat(amount);
            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message)
    }

    extractMerchant(message: string, sender: string): string | null {
        // ATM withdrawal detection
        // Pattern: "debited from A/c no. XX589034 on AXIS BANK L" or similar
        const lowerMessage = message.toLowerCase()
        if (lowerMessage.includes("debited from a/c no.") &&
            lowerMessage.includes(" on axis bank")) {
            return "ATM"
        }

        // Also check for explicit ATM mentions
        if ((lowerMessage.includes("atm") || lowerMessage.includes("cash withdrawal")) &&
            lowerMessage.includes("debited")) {
            return "ATM"
        }

        // Debit card transaction pattern (Issue #120)
        // Pattern: "debited from A/c no. XXxxxxy on BURGRILL 04-12-2025 13:13:27 IST"
        // Extract merchant name between "on" and the date pattern
        const debitCardPattern = /debited from A\/c no\. [^\s]+ on ([^0-9]+?)(?:\d{2}-\d{2}-\d{4})/i
        let match = message.match(debitCardPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Credit card "Spent" transactions with merchant on separate line
        // Format 1: "Spent INR 131\nAxis Bank Card no. XX0818\n05-10-25 09:43:27 IST\nSwiggy Limi\nAvl Limit:"
        // Format 2: "Spent\nCard no. XX7441\nINR 562\n01-09-25 12:04:18\nAVENUE SUPE\nAvl Lmt"
        const spentPatternWithIST = /Spent[\s\S]*?IST\s*\n\s*([^\n]+?)(?:\s*\n|\s*Avl Limit:|\s*Avl Lmt|\s*Not you?)/i
        match = message.match(spentPatternWithIST);
        if (match) {
            let merchant = match[1].trim()

            // Clean up truncated merchant names by removing common truncation patterns
            merchant = merchant.replace(/\s+Limi$/i, "")  // "Swiggy Limi" : "Swiggy"
            merchant = merchant.replace(/\s+Pay$/i, "")   // "Amazon Pay" : "Amazon"
            merchant = merchant.replace(/\s+SUPE$/i, "")  // "AVENUE SUPE" : "AVENUE"

            merchant = this.cleanMerchantName(merchant)
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        // Alternative pattern without IST (for formats that use different time formats)
        const spentPatternWithTime = /Spent[\s\S]*?\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*\n\s*([^\n]+?)(?:\s*\n|\s*Avl Limit:|\s*Avl Lmt|\s*Not you?)/i
        match = message.match(spentPatternWithTime);
        if (match) {
            let merchant = match[1].trim()

            // Clean up truncated merchant names
            merchant = merchant.replace(/\s+Limi$/i, "")
            merchant = merchant.replace(/\s+Pay$/i, "")
            merchant = merchant.replace(/\s+SUPE$/i, "")

            merchant = this.cleanMerchantName(merchant)
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        const upiMerchantPattern = /UPI\/[^\/]+\/[^\/]+\/([^\n]+?)(?:\s*Not you|\s*$)/i
        match = message.match(upiMerchantPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        const upiPersonPattern = /UPI\/P2A\/[^\/]+\/([^\n]+?)(?:\s*Not you|\s*$)/i
        match = message.match(upiPersonPattern);
        if (match) {
            const merchant = this.cleanMerchantName(match[1].trim())
            if (this.isValidMerchantName(merchant)) {
                return merchant
            }
        }

        const infoPattern = /Info\s*[-–]\s*([^.\n]+?)(?:\.\s*Chk|\s*$)/i
        match = message.match(infoPattern);
        if (match) {
            const info = match[1].trim()
            return info.includes("SALARY") ? "Salary" : this.cleanMerchantName(info)
                ;
        }

        // Fall back to base class patterns
        return super.extractMerchant(message, sender)
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;
        // Pattern 1: "A/c no. XXNNNN" or "A/c no. XXxxxxy"
        const acNoPattern = /A\/c\s+no\.\s+([X*xX\d]+)/i
        let match = message.match(acNoPattern);
        if (match) {
            return this.extractLast4Digits(match[1])
        }

        // Pattern 2: "Card no. XXNNNN"
        const cardNoPattern = /Card\s+no\.\s+([X*\d]+)/i
        match = message.match(cardNoPattern);
        if (match) {
            return this.extractLast4Digits(match[1])
        }

        // Pattern 3: "Credit Card XXNNNN"
        const creditCardPattern = /Credit\s+Card\s+([X*\d]+)/i
        match = message.match(creditCardPattern);
        if (match) {
            return this.extractLast4Digits(match[1])
        }

        return null
    }

    extractReference(message: string): string | null {
        const upiRefPattern = /UPI\/[^\/]+\/([0-9]+)/i
        let match = message.match(upiRefPattern);
        if (match) {
            return match[1]
        }

        return super.extractReference(message)
    }

    isTransactionMessage(message: string): boolean {
        const lowerMessage = message.toLowerCase()

        // Skip Axis-specific payment confirmation messages (payment TO card, not spending)
        if (lowerMessage.includes("payment") &&
            lowerMessage.includes("has been received") &&
            lowerMessage.includes("towards your axis bank")
        ) {
            return false
        }

        // Base class handles common payment reminders and other non-transaction messages
        return super.isTransactionMessage(message)
    }

    extractTransactionType(message: string): TransactionType | null {
        const lowerMessage = message.toLowerCase()

        // Credit card transactions: if message contains "Avl Limit" or "Avl Lmt", it's a credit card
        if (lowerMessage.includes("avl limit") || lowerMessage.includes("avl lmt")) {
            return TransactionType.CREDIT
        }

        // Explicit credit card mention
        if ((lowerMessage.includes("credit card") || lowerMessage.includes(" cc ")) &&
            (lowerMessage.includes("debited") || lowerMessage.includes("spent"))
        ) {
            return TransactionType.CREDIT
        }

        // Fall back to base class for standard checks
        return super.extractTransactionType(message)
    }

    extractAvailableLimit(message: string): number | null {
        // Axis Bank specific patterns using "INR" instead of "Rs"
        const axisCreditLimitPatterns = [
            // "Avl Limit: INR 217162.72"
            /Avl\s+Limit:?\s*INR\s+([0-9,]+(?:\.\d{2})?)/i,

            // "Avl Lmt INR 4632.87"
            /Avl\s+Lmt\s+INR\s+([0-9,]+(?:\.\d{2})?)/i,

            // "Available limit INR 111,111.89"
            /Available\s+limit:?\s*INR\s+([0-9,]+(?:\.\d{2})?)/i
        ];

        for (const pattern of axisCreditLimitPatterns) {
            const match = message.match(pattern);

            if (match) {
                const amount = match[1].replace(/,/g, "");
                const num = parseFloat(amount);

                return Number.isNaN(num) ? null : num;
            }
        }
        // Fall back to base class patterns (for Rs-based formats)
        return super.extractAvailableLimit(message)
    }
}