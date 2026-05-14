import { BankParser } from '../core/BankParser';

import { HDFCMutualFundParser } from './HDFCMutualFundParser';
import { HDFCBankParser } from './HDFCBankParser';
import { SBIBankParser } from './SBIBankParser';
import { SaraswatBankParser } from './SaraswatBankParser';
import { DBSBankParser } from './DBSBankParser';
import { IndianBankParser } from './IndianBankParser';
import { FederalBankParser } from './FederalBankParser';
import { JuspayParser } from './JuspayParser';
import { SliceParser } from './SliceParser';
import { CredParser } from './CredParser';
import { LazyPayParser } from './LazyPayParser';
import { UtkarshBankParser } from './UtkarshBankParser';
import { ICICIBankParser } from './ICICIBankParser';
import { KarnatakaBankParser } from './KarnatakaBankParser';
import { KeralaGraminBankParser } from './KeralaGraminBankParser';
import { IDBIBankParser } from './IDBIBankParser';
import { JupiterBankParser } from './JupiterBankParser';
import { AxisBankParser } from './AxisBankParser';
import { PNBBankParser } from './PNBBankParser';
import { PunjabSindBankParser } from './PunjabSindBankParser';
import { CanaraBankParser } from './CanaraBankParser';
import { BankOfBarodaParser } from './BankOfBarodaParser';
import { BankOfIndiaParser } from './BankOfIndiaParser';
import { JioPaymentsBankParser } from './JioPaymentsBankParser';
import { KotakBankParser } from './KotakBankParser';
import { IDFCFirstBankParser } from './IDFCFirstBankParser';
import { UnionBankParser } from './UnionBankParser';
import { HSBCBankParser } from './HSBCBankParser';
import { CentralBankOfIndiaParser } from './CentralBankOfIndiaParser';
import { SouthIndianBankParser } from './SouthIndianBankParser';
import { JKBankParser } from './JKBankParser';
import { JioPayParser } from './JioPayParser';
import { IPPBParser } from './IPPBParser';
import { CityUnionBankParser } from './CityUnionBankParser';
import { IndianOverseasBankParser } from './IndianOverseasBankParser';
import { AirtelPaymentsBankParser } from './AirtelPaymentsBankParser';
import { IndusIndBankParser } from './IndusIndBankParser';
import { AMEXBankParser } from './AMEXBankParser';
import { OneCardParser } from './OneCardParser';
import { UCOBankParser } from './UCOBankParser';
import { AUBankParser } from './AUBankParser';
import { YesBankParser } from './YesBankParser';
import { BandhanBankParser } from './BandhanBankParser';
import { ADCBParser } from './ADCBParser';
import { FABParser } from './FABParser';
import { EmiratesNBDParser } from './EmiratesNBDParser';
import { LivBankParser } from './LivBankParser';
import { CitiBankParser } from './CitiBankParser';
import { DiscoverCardParser } from './DiscoverCardParser';
import { OldHickoryParser } from './OldHickoryParser';
import { LaxmiBankParser } from './LaxmiBankParser';
import { CBEBankParser } from './CBEBankParser';
import { EverestBankParser } from './EverestBankParser';
import { BancolombiaParser } from './BancolombiaParser';
import { MashreqBankParser } from './MashreqBankParser';
import { CharlesSchwabParser } from './CharlesSchwabParser';
import { NavyFederalParser } from './NavyFederalParser';
import { AdelFiParser } from './AdelFiParser';
import { AlecuBankParser } from './AlecuBankParser';
import { PriorbankParser } from './PriorbankParser';
import { AlinmaBankParser } from './AlinmaBankParser';
import { NMBBankParser } from './NMBBankParser';
import { SiddharthaBankParser } from './SiddharthaBankParser';
import { PrimeCommercialBankParser } from './PrimeCommercialBankParser';
import { MPesaTanzaniaParser } from './MPesaTanzaniaParser';
import { MPESAParser } from './MPESAParser';
import { SelcomPesaParser } from './SelcomPesaParser';
import { TigoPesaParser } from './TigoPesaParser';

// FIX: make sure this file exports CIBEgyptParser correctly
//import { CIBEgyptParser } from './CIBEgyptParser';

import { DhanlaxmiBankParser } from './DhanlaxmiBankParser';
import { DOPBankParser } from './DOPBankParser';
import { HuntingtonBankParser } from './HuntingtonBankParser';
import { StandardCharteredBankParser } from './StandardCharteredBankParser';
import { EquitasBankParser } from './EquitasBankParser';
import { TelebirrParser } from './TelebirrParser';
import { ZemenBankParser } from './ZemenBankParser';
import { DashenBankParser } from './DashenBankParser';
import { FaysalBankParser } from './FaysalBankParser';
import { MelliBankParser } from './MelliBankParser';
import { ParsianBankParser } from './ParsianBankParser';
import { BangkokBankParser } from './BangkokBankParser';
import { KasikornBankParser } from './KasikornBankParser';
import { SiamCommercialBankParser } from './SiamCommercialBankParser';
import { KrungThaiBankParser } from './KrungThaiBankParser';
import { KrungsriBankParser } from './KrungsriBankParser';
import { TTBBankParser } from './TTBBankParser';
import { GSBBankParser } from './GSBBankParser';
import { BAACBankParser } from './BAACBankParser';
import { UOBThailandParser } from './UOBThailandParser';
import { CIMBThaiParser } from './CIMBThaiParser';
import { KTCCreditCardParser } from './KTCCreditCardParser';
import { TBankParser } from './TBankParser';
import { ChaseBankParser } from './ChaseBankParser';
import { AlRajhiBankParser } from './AlRajhiBankParser';
import { SNBAlAhliBankParser } from './SNBAlAhliBankParser';
import { STCBankParser } from './STCBankParser';
import { MBankCZParser } from './MBankCZParser';
import { BankMuscatParser } from './BankMuscatParser';
import { GreaterBankParser } from './GreaterBankParser';

const parsers: BankParser[] = [
    new HDFCMutualFundParser(),
    new HDFCBankParser(),
    new SBIBankParser(),
    new SaraswatBankParser(),
    new DBSBankParser(),
    new IndianBankParser(),
    new FederalBankParser(),
    new JuspayParser(),
    new SliceParser(),
    new CredParser(),
    new LazyPayParser(),
    new UtkarshBankParser(),
    new ICICIBankParser(),
    new KarnatakaBankParser(),
    new KeralaGraminBankParser(),
    new IDBIBankParser(),
    new JupiterBankParser(),
    new AxisBankParser(),
    new PNBBankParser(),
    new PunjabSindBankParser(),
    new CanaraBankParser(),
    new BankOfBarodaParser(),
    new BankOfIndiaParser(),
    new JioPaymentsBankParser(),
    new KotakBankParser(),
    new IDFCFirstBankParser(),
    new UnionBankParser(),
    new HSBCBankParser(),
    new CentralBankOfIndiaParser(),
    new SouthIndianBankParser(),
    new JKBankParser(),
    new JioPayParser(),
    new IPPBParser(),
    new CityUnionBankParser(),
    new IndianOverseasBankParser(),
    new AirtelPaymentsBankParser(),
    new IndusIndBankParser(),
    new AMEXBankParser(),
    new OneCardParser(),
    new UCOBankParser(),
    new AUBankParser(),
    new YesBankParser(),
    new BandhanBankParser(),
    new ADCBParser(),
    new FABParser(),
    new EmiratesNBDParser(),
    new LivBankParser(),
    new CitiBankParser(),
    new DiscoverCardParser(),
    new OldHickoryParser(),
    new LaxmiBankParser(),
    new CBEBankParser(),
    new EverestBankParser(),
    new BancolombiaParser(),
    new MashreqBankParser(),
    new CharlesSchwabParser(),
    new NavyFederalParser(),
    new AdelFiParser(),
    new AlecuBankParser(),
    new PriorbankParser(),
    new AlinmaBankParser(),
    new NMBBankParser(),
    new SiddharthaBankParser(),
    new PrimeCommercialBankParser(),
    new MPesaTanzaniaParser(),
    new MPESAParser(),
    new SelcomPesaParser(),
    new TigoPesaParser(),
    //new CIBEgyptParser(),
    new DhanlaxmiBankParser(),
    new DOPBankParser(),
    new HuntingtonBankParser(),
    new StandardCharteredBankParser(),
    new EquitasBankParser(),
    new TelebirrParser(),
    new ZemenBankParser(),
    new DashenBankParser(),
    new FaysalBankParser(),
    new MelliBankParser(),
    new ParsianBankParser(),
    new BangkokBankParser(),
    new KasikornBankParser(),
    new SiamCommercialBankParser(),
    new KrungThaiBankParser(),
    new KrungsriBankParser(),
    new TTBBankParser(),
    new GSBBankParser(),
    new BAACBankParser(),
    new UOBThailandParser(),
    new CIMBThaiParser(),
    new KTCCreditCardParser(),
    new TBankParser(),
    new ChaseBankParser(),
    new AlRajhiBankParser(),
    new SNBAlAhliBankParser(),
    new STCBankParser(),
    new MBankCZParser(),
    new BankMuscatParser(),
    new GreaterBankParser()
];

export class BankParserFactory {

    static getParser(sender: string): BankParser | null {
        return parsers.find(parser => parser.canHandle(sender)) || null;
    }

    static getParserByName(bankName: string): BankParser | null {
        return (
            parsers.find(parser => parser.getBankName() === bankName) || null
        );
    }

    static getAllParsers(): BankParser[] {
        return parsers;
    }

    static isKnownBankSender(sender: string): boolean {
        return parsers.some(parser => parser.canHandle(sender));
    }
}