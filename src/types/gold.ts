// Gold instrument types
export type GoldInstrument = 'XAU/USD' | 'XAG/USD';

export interface GoldPrice {
  instrument: GoldInstrument;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  timestamp: Date;
}

export interface OHLC {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Technical Indicators
export interface TechnicalIndicators {
  rsi: number;              // 0-100
  macd: MACDResult;
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  bollingerBands: BollingerBands;
  atr: number;              // Average True Range
  adx: number;              // Average Directional Index
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

// Fundamental Indicators
export interface FundamentalIndicators {
  usdIndex: number;         // DXY - inverse correlation with gold
  usdIndexChange: number;
  fedFundsRate: number;     // Higher rates = lower gold
  realYield: number;        // 10Y Treasury - Inflation
  inflation: number;        // CPI
  goldSilverRatio: number;  // Gold/Silver ratio
  vix: number;              // Fear index - higher = bullish gold
}

// Price Action Patterns
export type PricePattern = 
  | 'Double Top'
  | 'Double Bottom'
  | 'Head and Shoulders'
  | 'Inverse Head and Shoulders'
  | 'Ascending Triangle'
  | 'Descending Triangle'
  | 'Bull Flag'
  | 'Bear Flag'
  | 'Rising Wedge'
  | 'Falling Wedge'
  | 'Support Test'
  | 'Resistance Test'
  | 'Breakout'
  | 'Breakdown'
  | 'No Clear Pattern';

export interface PatternAnalysis {
  pattern: PricePattern;
  confidence: number;       // 0-100
  priceTarget?: number;
  description: string;
}

// Signal types
export type Signal = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
export type Trend = 'Bullish' | 'Bearish' | 'Sideways';
export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

// Correlated Commodities
export interface CorrelatedAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  correlation: number;       // -1 to 1
  lagDays: number;           // positive = lagging, negative = leading
  lagDescription: string;
  reasoning: string;
  recentPrices: number[];
}

// Scenario Analysis
export interface PredictionScenario {
  name: string;              // e.g. "Bullish Breakout", "Distribution Phase"
  probability: number;       // 0-100
  priceTarget: number;
  description: string;
  triggers: string[];        // What needs to happen for this scenario
  riskLevel: 'Low' | 'Medium' | 'High';
}

// Gap Analysis
export interface GapAnalysis {
  hasGap: boolean;
  gapType: 'Up' | 'Down' | 'None';
  gapSize: number;
  gapPercent: number;
  filled: boolean;
  reasoning: string;
}

// Prediction
export interface GoldPrediction {
  instrument: GoldInstrument;
  currentPrice: number;
  predictedPrice: number;
  predictedChange: number;
  predictedChangePercent: number;
  confidence: number;       // 0-100
  signal: Signal;
  trend: Trend;
  timeframe: Timeframe;
  technicalScore: number;   // 0-100
  fundamentalScore: number; // 0-100
  sentimentScore: number;   // 0-100
  reasoning: string[];
  indicatorReasoning?: {     // Per-indicator reasoning
    rsi: string;
    macd: string;
    movingAverages: string;
    fibonacci: string;
    bollinger: string;
    fundamental: string;
  };
  scenarios?: PredictionScenario[];  // Option A/B scenarios
  gapAnalysis?: GapAnalysis;
  keyLevels?: {
    support: number[];
    resistance: number[];
  };
  riskReward: number;
  generatedAt: Date;
}

// Expert Analysis
export interface ExpertAnalysis {
  id: string;
  expertName: string;
  expertTitle: string;
  avatarUrl?: string;
  instrument: GoldInstrument;
  signal: Signal;
  targetPrice: number;
  stopLoss?: number;
  timeframe: Timeframe;
  analysis: string;
  publishedAt: Date;
  accuracy: number;         // Historical accuracy %
}

// Economic Events
export type EventImpact = 'High' | 'Medium' | 'Low';
export type EventType = 'Fed Meeting' | 'CPI Release' | 'NFP' | 'GDP' | 'PMI' | 'Retail Sales' | 'Geopolitical' | 'Other' | 'Central Bank' | 'Inflation' | 'Employment' | 'Trade' | 'Economic' | 'Growth' | 'Consumer';

export interface EconomicEvent {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  time: string;
  country: string;
  impact: EventImpact;
  previous?: string;
  forecast?: string;
  actual?: string;
  description: string;
  sourceUrl?: string;
}

// Chart settings
export interface ChartSettings {
  showSMA: boolean;
  showEMA: boolean;
  showBollingerBands: boolean;
  showMACD: boolean;
  showRSI: boolean;
  showVolume: boolean;
  timeframe: '1H' | '4H' | '1D' | '1W';
}
