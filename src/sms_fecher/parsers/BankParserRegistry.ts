import { BankParser } from '../core/BankParser';

export class BankParserRegistry {

    private parsers: BankParser[];

    constructor(parsers: BankParser[]) {
        this.parsers = parsers;
    }

    getParser(sender: string): BankParser | null {

        const parser = this.parsers.find(parser =>
            parser.canHandle(sender)
        );

        return parser || null;
    }

    all(): BankParser[] {
        return this.parsers;
    }
}