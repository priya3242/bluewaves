import { BaseIranianBankParser } from './BaseIranianBankParser';

/**
 * Bank Melli parser for Iranian banking SMS messages.
 */
export class MelliBankParser extends BaseIranianBankParser {

    getBankName(): string {
        return "Melli Bank";
    }

    canHandle(sender: string): boolean {

        const upperSender =
            sender.toUpperCase();

        const melliSenders = [
            "+98700717",
            "MELLI",
            "MELLIBANK",
            "MELLI BANK",
            "BANK MELLI",
            "BANKMELLI"
        ];

        return melliSenders.includes(
            upperSender
        );
    }
}