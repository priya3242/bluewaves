import { CompiledPatterns } from '../core/patterns';
import { TransactionType, ParsedTransaction } from '../core/types';

import {
    BaseIndianBankParser,
    BaseBalanceUpdateInfo
} from './BaseIndianBankParser';

/**
 * Parser for IndusInd Bank SMS messages (India)
 *
 * Notes:
 * - Defaults to INR via base class
 * - Relies on base patterns for amount, balance, merchant, account, reference
 * - canHandle() includes common DLT sender variants seen in India
 */
export class IndusIndBankParser extends BaseIndianBankParser {

    getBankName() {
        return "IndusInd Bank";
    }

    canHandle(sender: string): boolean {
        const s = sender.toUpperCase();

        // Common short/long forms
        if (
            s === "INDUSB" ||
            s === "INDUSIND" ||
            s.includes("INDUSIND BANK")
        ) {
            return true;
        }

        // DLT/route patterns frequently used in India
        // Allow -S, -T, or no suffix
        if (/^[A-Z]{2}-INDUSB(?:-[A-Z])?$/i.test(s)) {
            return true;
        }

        if (/^[A-Z]{2}-INDUSIND(?:-[A-Z])?$/i.test(s)) {
            return true;
        }

        // Some routes omit the trailing suffix or vary the middle part
        if (/^[A-Z]{2}-INDUS(?:[A-Z]{2,})?-[A-Z]$/i.test(s)) {
            return true;
        }

        return false;
    }

    extractTransactionType(message: string): TransactionType | null {
        const lower = message.toLowerCase();

        if (lower.includes("spent")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("debited")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("purchase")) {
            return TransactionType.EXPENSE;
        }

        if (lower.includes("deposit")) {
            return TransactionType.INVESTMENT;
        }

        if (lower.includes("fd")) {
            return TransactionType.INVESTMENT;
        }

        if (lower.includes("ach")) {
            return TransactionType.INVESTMENT;
        }

        return super.extractTransactionType(message);
    }

    /**
     * Force non-card detection for ACH/NACH messages
     */
    detectIsCard(message: string): boolean {
        const lower = message.toLowerCase();

        const isAchOrNach =
            lower.includes("ach db") ||
            lower.includes("ach cr") ||
            lower.includes("nach");

        if (isAchOrNach) {
            return false;
        }

        return super.detectIsCard(message);
    }

    /**
     * Detect balance-only notifications (not transactions)
     */
    isBalanceUpdateNotification(message: string): boolean {
        const lower = message.toLowerCase();

        const hasBalanceCue =
            lower.includes("avl bal") ||
            lower.includes("available bal") ||
            lower.includes("account balance") ||
            lower.includes("a/c balance");

        const txnVerbs = [
            "debited",
            "credited",
            "withdrawn",
            "spent",
            "transferred"
        ];

        const hasTxnVerb = txnVerbs.some(v =>
            lower.includes(v)
        );

        return (
            hasBalanceCue &&
            lower.includes("as on") &&
            !hasTxnVerb
        );
    }

    /**
     * Parse balance-only notifications
     */
    parseBalanceUpdate(message: string): BaseBalanceUpdateInfo | null {

        if (!this.isBalanceUpdateNotification(message)) {
            return null;
        }

        const accountLast4 =
            this.extractAccountLast4(message);

        let balance = 0;

        // Pattern 1: "Avl BAL of INR 1,234.56"
        const p1 =
            /Avl\s*BAL\s+of\s+INR\s*([0-9,]+(?:\.\d{2})?)/i;

        let match = message.match(p1);

        if (match) {
            balance = parseFloat(
                match[1].replace(/,/g, "")
            );
        }

        // Pattern 2
        if (balance === 0) {

            const p2 =
                /(?:Avl\s*BAL|Available\s+Balance(?:\s+is)?|Bal)[:\s]+INR\s*([0-9,]+(?:\.\d{2})?)/i;

            match = message.match(p2);

            if (match) {
                balance = parseFloat(
                    match[1].replace(/,/g, "")
                );
            }
        }

        // Extract optional "as on" date
        const datePattern =
            /as\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+(\d{1,2}:\d{2})\s*(AM|PM)/i;

        let asOfDate: string | null = null;

        match = message.match(datePattern);

        if (match) {
            asOfDate = `${match[1]} ${match[2]} ${match[3]}`;
        }

        return {
            bankName: this.getBankName(),
            accountLast4,
            balance,
            asOfDate
        };
    }

    isTransactionMessage(message: string): boolean {
        const lower = message.toLowerCase();

        // Skip interest payout on deposits
        if (
            lower.includes("net interest") &&
            lower.includes("deposit no")
        ) {
            return false;
        }

        return super.isTransactionMessage(message);
    }

    extractAmount(message: string): number | null {

        // Prefer transaction amount tied to action verbs
        const verbAmountPattern =
            /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{2})?)\s+(?:debited|credited|spent|withdrawn|paid|purchase)/i;

        const match = message.match(verbAmountPattern);

        if (match) {
            const amt = match[1].replace(/,/g, "");
            const num = parseFloat(amt);

            return isNaN(num) ? null : num;
        }

        return super.extractAmount(message);
    }

    extractMerchant(message: string, sender: string): string | null {

        // UPI-style: towards <vpa or merchant>
        const towardsPattern =
            /towards\s+(\S+)/i;

        let match = message.match(towardsPattern);

        if (match) {
            let m = match[1]
                .trim()
                .replace(/[.,;]+$/, "");

            if (m.includes("/")) {
                m = m.split("/")[0];
            }

            if (m.includes("@")) {
                m = m.split("@")[0].trim();
            }

            if (m.length > 0) {
                return this.cleanMerchantName(m);
            }
        }

        // Example:
        // "received from account XXXXXXX4321/MADMONEY"
        const fromAccountPattern =
            /from\s+account\s+[^\s/]+\/([^\s(]+)/i;

        match = message.match(fromAccountPattern);

        if (match) {
            const merchant = match[1]
                .trim()
                .replace(/[.,;)\s]+$/, "");

            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Credit: from <vpa or merchant>
        const fromPattern =
            /from\s+(\S+)/i;

        match = message.match(fromPattern);

        if (match) {
            let m = match[1]
                .trim()
                .replace(/[.,;]+$/, "");

            if (m.includes("/")) {
                m = m.split("/")[0];
            }

            if (m.includes("@")) {
                m = m.split("@")[0].trim();

                if (m.length > 0) {
                    return this.cleanMerchantName(m);
                }
            }
        }

        // Card/POS: at <merchant>
        const atPattern =
            /at\s+([^\n]+?)(?:\s+Ref|\s+on|$)/i;

        match = message.match(atPattern);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        // Capture merchant before ".Bal"
        const merchantBeforeBal =
            /([^\/.\s]+)\.\s*Bal/i;

        match = message.match(merchantBeforeBal);

        if (match) {
            const merchant = match[1].trim();

            if (merchant.length > 0) {
                return this.cleanMerchantName(merchant);
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult =
            super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        // Pattern 1
        const indusIndAccountPattern =
            /IndusInd\s+Account\s+([\dX]+)/i;

        let match = message.match(indusIndAccountPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Pattern 2
        const accountXPattern =
            /account\s+([X\d]+)/i;

        match = message.match(accountXPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Pattern 3
        const maskedPattern =
            /A\/?C\s+([\d*xX#]+)/i;

        match = message.match(maskedPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        // Pattern 4
        const starMaskPattern =
            /A\/?c\s+([*X\d]+)/i;

        match = message.match(starMaskPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        return null;
    }

    extractBalance(message: string): number | null {

        // Pattern 1
        const pattern1 =
            /Avl\s*BAL\s+of\s+INR\s*([0-9,]+(?:\.\d{2})?)/i;

        let match = message.match(pattern1);

        if (match) {
            const balanceStr =
                match[1].replace(/,/g, "");

            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        // Pattern 2
        const pattern2 =
            /(?:Avl\s*BAL|Available\s+Balance(?:\s+is)?|Bal)[:\s]+INR\s*([0-9,]+(?:\.\d{2})?)/i;

        match = message.match(pattern2);

        if (match) {
            const balanceStr =
                match[1].replace(/,/g, "");

            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    extractReference(message: string): string | null {

        // Capture RRN numbers
        const rrnPattern =
            /RRN[:\s]+([0-9]+)/i;

        let match = message.match(rrnPattern);

        if (match) {
            return match[1];
        }

        // IMPS / UPI Ref
        const refNoPattern =
            /(?:IMPS\s+)?Ref\s+no\.?\s*([0-9]+)/i;

        match = message.match(refNoPattern);

        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }
}