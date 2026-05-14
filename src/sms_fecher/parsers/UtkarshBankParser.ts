import { BaseIndianBankParser } from './BaseIndianBankParser';
import { TransactionType } from '../core/types';

/**
 * Parser for Utkarsh Small Finance Bank (SFBL) SuperCard credit card transactions.
 * Handles messages from UTKSPR and similar senders.
 */
export class UtkarshBankParser extends BaseIndianBankParser {
    getBankName() {
        return "Utkarsh Bank";
    }

    canHandle(sender: string): boolean {
        const normalizedSender = sender.toUpperCase();
        return (
            normalizedSender.includes("UTKSPR") ||
            normalizedSender.includes("UTKARSH") ||
            normalizedSender.includes("UTKSFB")
        );
    }

    extractMerchant(message: string, sender: string): string | null {
        const lowerMessage = message.toLowerCase();

        // Pattern 1: "for UPI - merchant/reference"
        const upiPattern = /for\s+UPI\s*[-–]\s*([^\s.]+)/i;
        let match = message.match(upiPattern);
        if (match) {
            const merchant = match[1].trim();
            if (!/^[x\d]+$/i.test(merchant)) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Pattern 2: "for merchant on date"
        const forPattern = /for\s+([^0-9][^\s]+?)(?:\s+on\s+|\s+at\s+|$)/i;
        match = message.match(forPattern);
        if (match) {
            const merchant = match[1].trim();
            if (
                !merchant.toUpperCase().includes("UPI") &&
                !merchant.toUpperCase().includes("INR")
            ) {
                return this.cleanMerchantName(merchant);
            }
        }

        const superMerchant = super.extractMerchant(message, sender);

        if (lowerMessage.includes("supercard") && lowerMessage.includes("upi")) {
            return "UPI Payment";
        }

        return superMerchant || "Utkarsh SuperCard";
    }

    extractTransactionType(message: string): TransactionType {
        // Utkarsh SuperCard is a credit card product, all transactions are credit
        return TransactionType.CREDIT;
    }

    extractAccountLast4(message: string): string | null {
        const baseResult = super.extractAccountLast4(message);
        if (baseResult) return baseResult;

        // Pattern for SuperCard xxxx
        const cardPattern = /SuperCard\s+([xX*\d]+)/i;
        let match = message.match(cardPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Pattern for account XXXX
        const accountPattern = /(?:account|a\/c)\s+([xX*\d]+)/i;
        match = message.match(accountPattern);
        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }
}