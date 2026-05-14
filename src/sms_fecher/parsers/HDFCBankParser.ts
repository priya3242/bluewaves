import { CompiledPatterns } from '../core/patterns';
import { TransactionType } from '../core/types';
import { BaseIndianBankParser } from './BaseIndianBankParser';

/**
 * HDFC Bank specific parser.
 */
export class HDFCBankParser extends BaseIndianBankParser {

    getBankName(): string {
        return 'HDFC Bank';
    }

    canHandle(sender: string): boolean {
        const upperSender = sender.toUpperCase();

        const hdfcSenders = [
            'HDFCBK',
            'HDFCBANK',
            'HDFC',
            'HDFCB'
        ];

        if (hdfcSenders.includes(upperSender)) {
            return true;
        }

        return CompiledPatterns.HDFC.DLT_PATTERNS.some(
            (pattern: RegExp) => pattern.test(upperSender)
        );
    }

    extractMerchant(message: string, sender: string): string | null {

        // Debit card transactions
        if (
            message.includes('From HDFC Bank Card') &&
            message.includes(' At ') &&
            message.includes(' On ')
        ) {
            const atIndex = message.indexOf(' At ');
            const onIndex = message.indexOf(' On ');

            if (atIndex !== -1 && onIndex !== -1 && onIndex > atIndex) {
                const merchant = message
                    .substring(atIndex + 4, onIndex)
                    .trim();

                if (merchant.length > 0) {
                    return this.cleanMerchantName(merchant);
                }
            }
        }

        // Txn Rs.X On HDFC Bank Card At MERCHANT by UPI
        if (
            message.includes('Txn') &&
            message.includes('At ') &&
            message.includes('Card')
        ) {
            const txnAtPattern =
                /At\s+(.+?)\s*(?:by\s+UPI|on\s+\d|$)/i;

            const match = message.match(txnAtPattern);

            if (match) {
                const merchant = match[1].trim();

                if (merchant.length > 0) {
                    return this.cleanMerchantName(merchant);
                }
            }
        }

        // ATM withdrawal
        if (message.toLowerCase().includes('withdrawn')) {

            const atLocationPattern =
                /At\s+\+?(.+?)\s+On/i;

            const match = message.match(atLocationPattern);

            if (match) {
                const location = match[1].trim();

                if (location.length > 0) {
                    return `ATM at ${this.cleanMerchantName(location)}`;
                }
            }

            return 'ATM';
        }

        // Generic ATM
        if (message.includes('ATM')) {
            return 'ATM';
        }

        // Card + UPI merchant extraction
        if (
            message.toLowerCase().includes('card') &&
            message.toLowerCase().includes(' at ') &&
            (
                message.toLowerCase().includes('block cc') ||
                message.toLowerCase().includes('block pcc')
            )
        ) {

            const atPattern =
                /at\s+([^@\s]+(?:@[^\s]+)?(?:\s+[^\s]+)?)(?:\s+by\s+|\s+on\s+|$)/i;

            const match = message.match(atPattern);

            if (match) {
                const merchant = match[1].trim();

                let cleanedMerchant = merchant;

                if (merchant.includes('@')) {
                    const vpaName = merchant.split('@')[0].trim();

                    cleanedMerchant = vpaName.endsWith('qr')
                        ? vpaName.slice(0, -2)
                        : vpaName;
                }

                if (cleanedMerchant.length > 0) {
                    return this.cleanMerchantName(cleanedMerchant);
                }
            }
        }

        // NEFT / RTGS
        if (
            message.includes('NEFT') ||
            message.includes('RTGS')
        ) {
            const neftPattern =
                /(?:NEFT|RTGS)\s+Cr-[A-Z]{4}0[A-Z0-9]{6}-([^-]+)/i;

            const match = message.match(neftPattern);

            if (match) {
                const merchant = match[1].trim();

                if (
                    merchant.length > 0 &&
                    !/^\d+$/.test(merchant)
                ) {
                    return this.cleanMerchantName(merchant);
                }
            }
        }

        // Salary
        if (
            message.includes('SALARY') &&
            message.toLowerCase().includes('deposited')
        ) {

            let match = message.match(
                CompiledPatterns.HDFC.SALARY_PATTERN
            );

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }

            match = message.match(
                CompiledPatterns.HDFC.SIMPLE_SALARY_PATTERN
            );

            if (match) {
                const merchant = match[1].trim();

                if (
                    merchant.length > 0 &&
                    !/^\d+$/.test(merchant)
                ) {
                    return this.cleanMerchantName(merchant);
                }
            }
        }

        // Info:
        if (message.includes('Info:')) {

            const match = message.match(
                CompiledPatterns.HDFC.INFO_PATTERN
            );

            if (match) {
                const merchant = match[1].trim();

                if (
                    merchant.length > 0 &&
                    merchant !== 'UPI'
                ) {
                    return this.cleanMerchantName(merchant);
                }
            }
        }

        // VPA
        if (message.includes('VPA')) {

            if (
                message.includes('from VPA') &&
                message.includes('credited')
            ) {

                const fromVpaPattern =
                    /from\s+VPA\s*([^@\s]+)@[^\s]+\s*\(UPI\s+\d+\)/i;

                const match = message.match(fromVpaPattern);

                if (match) {
                    return this.cleanMerchantName(match[1].trim());
                }
            }

            let match = message.match(
                CompiledPatterns.HDFC.VPA_WITH_NAME
            );

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }

            match = message.match(
                CompiledPatterns.HDFC.VPA_PATTERN
            );

            if (match) {
                const vpaName = match[1].trim();

                if (
                    vpaName.length > 3 &&
                    !/^\d+$/.test(vpaName)
                ) {
                    return this.cleanMerchantName(vpaName);
                }
            }
        }

        // spent on Card
        if (message.includes('spent on Card')) {

            const match = message.match(
                CompiledPatterns.HDFC.SPENT_PATTERN
            );

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        // debited for
        if (message.includes('debited for')) {

            const match = message.match(
                CompiledPatterns.HDFC.DEBIT_FOR_PATTERN
            );

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        // UPI mandate
        if (message.includes('UPI Mandate')) {

            const match = message.match(
                CompiledPatterns.HDFC.MANDATE_PATTERN
            );

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        // towards
        if (message.includes('towards')) {

            const towardsPattern =
                /towards\s+([^\n]+?)(?:\s+UMRN|\s+ID:|\s+Alert:|$)/i;

            const match = message.match(towardsPattern);

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        // For:
        if (message.includes('For:')) {

            const forColonPattern =
                /For:\s+([^\n]+?)(?:\s+From|\s+Via|$)/i;

            const match = message.match(forColonPattern);

            if (match) {
                return this.cleanMerchantName(match[1].trim());
            }
        }

        return super.extractMerchant(message, sender);
    }

    extractTransactionType(message: string): TransactionType | null {

        const lowerMessage = message.toLowerCase();

        if (this.isInvestmentMessage(lowerMessage)) {
            return TransactionType.INVESTMENT;
        }

        if (
            lowerMessage.includes('block cc') ||
            lowerMessage.includes('block pcc')
        ) {
            return TransactionType.CREDIT;
        }

        if (
            lowerMessage.includes('spent on card') &&
            !lowerMessage.includes('block dc')
        ) {
            return TransactionType.CREDIT;
        }

        if (
            lowerMessage.includes('payment') &&
            lowerMessage.includes('credit card')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('towards') &&
            lowerMessage.includes('credit card')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('sent') &&
            lowerMessage.includes('from hdfc')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('spent') &&
            lowerMessage.includes('from hdfc bank card')
        ) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes('debited')) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('withdrawn') &&
            !lowerMessage.includes('block cc')
        ) {
            return TransactionType.EXPENSE;
        }

        if (
            lowerMessage.includes('spent') &&
            !lowerMessage.includes('card')
        ) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes('charged')) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes('paid')) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes('purchase')) {
            return TransactionType.EXPENSE;
        }

        if (lowerMessage.includes('credited')) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes('deposited')) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes('received')) {
            return TransactionType.INCOME;
        }

        if (lowerMessage.includes('refund')) {
            return TransactionType.INCOME;
        }

        if (
            lowerMessage.includes('cashback') &&
            !lowerMessage.includes('earn cashback')
        ) {
            return TransactionType.INCOME;
        }

        return null;
    }

    extractReference(message: string): string | null {

        const hdfcPatterns = [
            CompiledPatterns.HDFC.REF_SIMPLE,
            CompiledPatterns.HDFC.UPI_REF_NO,
            CompiledPatterns.HDFC.REF_NO,
            CompiledPatterns.HDFC.REF_END
        ];

        for (const pattern of hdfcPatterns) {

            const match = message.match(pattern);

            if (match) {
                return match[1].trim();
            }
        }

        return super.extractReference(message);
    }

    extractAccountLast4(message: string): string | null {

        const baseResult = super.extractAccountLast4(message);

        if (baseResult) {
            return baseResult;
        }

        const cardPattern = /Card\s+x(\d{4})/i;

        let match = message.match(cardPattern);

        if (match) {
            return match[1];
        }

        const blockDCPattern = /BLOCK\s+DC\s+(\d{4})/i;

        match = message.match(blockDCPattern);

        if (match) {
            return match[1];
        }

        const hdfcBankPattern =
            /HDFC\s+Bank\s+([X*]+\d{3,6})/i;

        match = message.match(hdfcBankPattern);

        if (match) {
            return this.extractLast4Digits(match[1]);
        }

        const hdfcPatterns = [
            CompiledPatterns.HDFC.ACCOUNT_DEPOSITED,
            CompiledPatterns.HDFC.ACCOUNT_FROM,
            CompiledPatterns.HDFC.ACCOUNT_SIMPLE,
            CompiledPatterns.HDFC.ACCOUNT_GENERIC
        ];

        for (const pattern of hdfcPatterns) {

            match = message.match(pattern);

            if (match) {
                return this.extractLast4Digits(match[1]);
            }
        }

        return null;
    }

    extractBalance(message: string): number | null {

        const avlBalINRPattern =
            /Avl\s+bal:?\s*INR\s*([0-9,]+(?:\.\d{2})?)/i;

        let match = message.match(avlBalINRPattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, '');
            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        const availableBalINRPattern =
            /Available\s+Balance:?\s*INR\s*([0-9,]+(?:\.\d{2})?)/i;

        match = message.match(availableBalINRPattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, '');
            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        const balRsPattern =
            /Bal\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;

        match = message.match(balRsPattern);

        if (match) {
            const balanceStr = match[1].replace(/,/g, '');
            const num = parseFloat(balanceStr);

            return isNaN(num) ? null : num;
        }

        return super.extractBalance(message);
    }

    cleanMerchantName(merchant: string): string {
        return super.cleanMerchantName(merchant);
    }

    isTransactionMessage(message: string): boolean {

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes('nach mandate') &&
            lowerMessage.includes('received') &&
            lowerMessage.includes('for processing')
        ) {
            return false;
        }

        if (
            lowerMessage.includes('bill alert') ||
            (
                lowerMessage.includes('bill') &&
                lowerMessage.includes('is due on')
            )
        ) {
            return false;
        }

        if (
            lowerMessage.includes('payment alert') &&
            !lowerMessage.includes('will be')
        ) {
            return true;
        }

        if (
            lowerMessage.includes('has requested') ||
            lowerMessage.includes('payment request') ||
            lowerMessage.includes('to pay, download') ||
            lowerMessage.includes('collect request') ||
            lowerMessage.includes('ignore if already paid')
        ) {
            return false;
        }

        if (
            lowerMessage.includes('received towards your credit card')
        ) {
            return false;
        }

        if (
            lowerMessage.includes('payment') &&
            lowerMessage.includes('credited to your card')
        ) {
            return false;
        }

        if (
            lowerMessage.includes('otp') ||
            lowerMessage.includes('one time password') ||
            lowerMessage.includes('verification code') ||
            lowerMessage.includes('offer') ||
            lowerMessage.includes('discount') ||
            lowerMessage.includes('cashback offer') ||
            lowerMessage.includes('win ')
        ) {
            return false;
        }

        const hdfcTransactionKeywords = [
            'debited',
            'credited',
            'withdrawn',
            'deposited',
            'spent',
            'received',
            'transferred',
            'paid',
            'sent',
            'deducted',
            'txn'
        ];

        return hdfcTransactionKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );
    }

    /**
     * Renamed from isInvestmentTransaction
     * to avoid conflict with BaseIndianBankParser.
     */
    protected isInvestmentMessage(message: string): boolean {

        const investmentKeywords = [
            'mutual fund',
            'sip',
            'investment',
            'nav',
            'folio'
        ];

        return investmentKeywords.some(keyword =>
            message.includes(keyword)
        );
    }
}