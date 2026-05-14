import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * Parser for Bandhan Bank transaction SMS messages.
 *
 * Sample formats:
 * - "Dear Customer, your account XXXXXXXXXX1234 is credited with INR 3.00 on 01-OCT-2025 towards interest. Bandhan Bank"
 * - "INR 25,000.00 deposited to A/c XXXXXXXXXX1234 towards UPI/CR/C224513287910/JOHN DOE/u on 03-OCT-2025 . Clear Bal is INR 30,123.00 . Bandhan Bank."
 *
 * Senders generally follow DLT patterns like XY-BDNSMS-S.
 */
export class BandhanBankParser extends BaseIndianBankParser {
    getBankName() {
        return "Bandhan Bank";
    }

    canHandle(sender: string): boolean {
        const s = sender.toUpperCase();

        // Common short/long forms
        if (s.includes("BANDHAN")) return true;

        // DLT/route patterns frequently used in India
        if (/^[A-Z]{2}-BDNSMS(?:-S)?$/i.test(s)) return true;
        if (/^[A-Z]{2}-BANDHN(?:-S)?$/i.test(s)) return true;

        return false;
    }

    extractMerchant(message: string, sender: string): string | null {
        // Extract merchant from "towards" section
        const towardsPattern = /towards\s+([^\.\n]+?)(?:\s+Value|\s+on|\s+dt|\s+at|\.|$)/i;

        let match = message.match(towardsPattern);
        if (match) {
            let merchantRaw = match[1].trim();

            // For UPI transactions with "/" delimiters, extract the best meaningful segment
            if (merchantRaw.includes("/")) {
                const segments = merchantRaw
                    .split("/")
                    .map(segment => segment.trim())
                    .filter(segment => segment.length > 0);

                const candidate =
                    segments.find(
                        segment =>
                            segment.length >= 2 &&
                            /[A-Za-z]/.test(segment) &&
                            !/^UPI$/i.test(segment)
                    ) ?? segments[segments.length - 1];

                if (candidate) {
                    merchantRaw = candidate;
                }
            }

            const cleanedMerchant = this.cleanMerchantName(
                merchantRaw.replace(/\bu\b/i, "").trim()
            );

            const normalizedMerchant =
                /^interest$/i.test(cleanedMerchant)
                    ? "Interest"
                    : cleanedMerchant;

            if (this.isValidMerchantName(normalizedMerchant)) {
                return normalizedMerchant;
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractReference(message: string): string | null {
        const upiReferencePattern = /UPI\/[A-Z]{2}\/([A-Z0-9]+)/i;

        const match = message.match(upiReferencePattern);
        if (match) {
            return match[1];
        }

        return super.extractReference(message);
    }

    extractBalance(message: string): number | null {
        const clearBalancePattern =
            /Clear\s+Bal\s+(?:is\s+)?(?:INR\s*)?([0-9,]+(?:\.\d{2})?)/i;

        const match = message.match(clearBalancePattern);
        if (match) {
            const balanceStr = match[1].replace(/,/g, "");
            const num = parseFloat(balanceStr);
            return Number.isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }
}