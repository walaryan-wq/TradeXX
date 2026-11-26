/**
 * Demo universe. Symbols are readable NSE-style sample tickers chosen for realism;
 * they are NOT transcribed from the reference video. Sector and tier assignments are
 * demo groupings, and every price attached to them in demo mode is simulated.
 */
import type { Instrument, Tier } from './types';

const SECTORS: Record<string, string[]> = {
  LOGISTICS: ['CONCOR', 'DELHIVERY', 'BLUEDART', 'ADANIPORTS'],
  POWER: ['NTPC', 'POWERGRID', 'TATAPOWER', 'ADANIPOWER', 'ADANIGREEN', 'JSWENERGY', 'NHPC', 'TORNTPOWER', 'CESC', 'SJVN'],
  FMCG: ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'GODREJCP', 'COLPAL', 'TATACONSUM', 'VBL', 'UBL'],
  'NEW-AGE': ['ETERNAL', 'NYKAA', 'PAYTM', 'POLICYBZR', 'SWIGGY'],
  'CAP MKTS': ['BSE', 'MCX', 'CDSL', 'ANGELONE', 'HDFCAMC', 'CAMS', 'KFINTECH', 'NUVAMA'],
  TELECOM: ['BHARTIARTL', 'IDEA', 'INDUSTOWER', 'TATACOMM'],
  'PSU BANK': ['SBIN', 'BANKBARODA', 'PNB', 'CANBK', 'UNIONBANK', 'INDIANB', 'BANKINDIA', 'MAHABANK'],
  CHEM: ['PIDILITIND', 'SRF', 'UPL', 'DEEPAKNTR', 'AARTIIND', 'PIIND', 'NAVINFLUOR', 'TATACHEM'],
  REALTY: ['DLF', 'GODREJPROP', 'LODHA', 'OBEROIRLTY', 'PRESTIGE', 'PHOENIXLTD'],
  METAL: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'COALINDIA', 'SAIL', 'JINDALSTEL', 'NMDC', 'NATIONALUM', 'HINDZINC'],
  NBFC: ['BAJFINANCE', 'BAJAJFINSV', 'CHOLAFIN', 'SHRIRAMFIN', 'PFC', 'RECLTD', 'MUTHOOTFIN', 'LICHSGFIN', 'IRFC', 'MANAPPURAM', 'POONAWALLA', 'M&MFIN'],
  IT: ['TCS', 'INFY', 'HCLTECH', 'WIPRO', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS', 'KPITTECH', 'TATAELXSI', 'OFSS', 'CYIENT'],
  BANK: ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'IDFCFIRSTB', 'FEDERALBNK', 'AUBANK', 'BANDHANBNK', 'RBLBANK', 'YESBANK'],
  PHARMA: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'APOLLOHOSP', 'LUPIN', 'AUROPHARMA', 'ZYDUSLIFE', 'TORNTPHARM', 'ALKEM', 'MAXHEALTH', 'BIOCON', 'GLENMARK', 'MANKIND'],
  OTHERS: ['IRCTC', 'INDIGO', 'INDHOTEL', 'NAUKRI', 'ASTRAL'],
  INSURANCE: ['SBILIFE', 'HDFCLIFE', 'LICI', 'ICICIGI', 'ICICIPRULI', 'STARHEALTH'],
  'OIL & GAS': ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'GAIL', 'HINDPETRO', 'PETRONET', 'OIL', 'IGL', 'MGL'],
  CEMENT: ['ULTRACEMCO', 'SHREECEM', 'AMBUJACEM', 'ACC', 'DALBHARAT', 'JKCEMENT'],
  DEFENCE: ['HAL', 'BEL', 'BDL', 'MAZDOCK', 'COCHINSHIP', 'BEML', 'DATAPATTNS'],
  CONSUMER: ['TITAN', 'ASIANPAINT', 'TRENT', 'DMART', 'HAVELLS', 'DIXON', 'VOLTAS', 'BERGEPAINT', 'PAGEIND', 'JUBLFOOD', 'KALYANKJIL'],
  'CAP GOODS': ['LT', 'SIEMENS', 'ABB', 'CUMMINSIND', 'BHEL', 'CGPOWER', 'POLYCAB', 'KEI', 'SUZLON', 'THERMAX'],
  AUTO: ['MARUTI', 'M&M', 'TATAMOTORS', 'BAJAJ-AUTO', 'EICHERMOT', 'TVSMOTOR', 'HEROMOTOCO', 'ASHOKLEY', 'BHARATFORG', 'MOTHERSON', 'BOSCHLTD', 'EXIDEIND', 'SONACOMS', 'TIINDIA'],
};

export const SECTOR_NAMES = Object.keys(SECTORS);

export function buildDemoUniverse(): Instrument[] {
  const out: Instrument[] = [];
  for (const [sector, symbols] of Object.entries(SECTORS)) {
    symbols.forEach((symbol, i) => {
      // Demo tiering: leading names per sector are "large", then "mid", then "small".
      const tier: Tier = i < Math.max(2, Math.ceil(symbols.length * 0.3)) ? 'LARGE' : i < Math.ceil(symbols.length * 0.65) ? 'MID' : 'SMALL';
      out.push({ id: `NSE:${symbol}`, symbol, sector, tier });
    });
  }
  return out;
}
