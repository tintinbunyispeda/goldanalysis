import type { OHLC, TechnicalIndicators, MACDResult, BollingerBands } from '@/types/gold';

// ─── Simple Moving Average ───────────────────────────────────────────────────
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

// ─── Exponential Moving Average (scalar) ─────────────────────────────────────
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return calculateSMA(prices, prices.length);
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

// ─── EMA Series (full array, O(n)) ────────────────────────────────────────────
// Returns one EMA value per price. Nulls for the warm-up period.
export function calculateEMASeries(prices: number[], period: number): (number | null)[] {
  if (prices.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result: (number | null)[] = new Array(prices.length).fill(null);

  // Seed with SMA of first `period` prices
  if (prices.length < period) {
    // Not enough data — return partial SMAs for what we have
    for (let i = 0; i < prices.length; i++) {
      result[i] = prices.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1);
    }
    return result;
  }

  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result[i] = ema;
  }
  return result;
}

// ─── RSI — Wilder's Smoothed Method (industry standard) ──────────────────────
// Matches TradingView / MetaTrader 4/5 output exactly.
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Seed: simple average of first `period` gains/losses
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder smoothing for the rest
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── RSI Series (Wilder-smoothed, full array) ─────────────────────────────────
export function calculateRSISeries(prices: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Seed
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiAt = (aG: number, aL: number) => aL === 0 ? 100 : 100 - 100 / (1 + aG / aL);
  result[period] = rsiAt(avgGain, avgLoss);  // index `period` = after first `period` changes

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i + 1] = rsiAt(avgGain, avgLoss);
  }
  return result;
}

// ─── MACD (scalar) ────────────────────────────────────────────────────────────
export function calculateMACD(prices: number[]): MACDResult {
  const ema12Series = calculateEMASeries(prices, 12);
  const ema26Series = calculateEMASeries(prices, 26);

  // Build MACD history from bar 26 onward
  const macdHistory: number[] = [];
  for (let i = 25; i < prices.length; i++) {
    const e12 = ema12Series[i];
    const e26 = ema26Series[i];
    if (e12 !== null && e26 !== null) macdHistory.push(e12 - e26);
  }

  const macd = macdHistory[macdHistory.length - 1] ?? 0;
  const signal = calculateEMA(macdHistory, 9);
  return { macd, signal, histogram: macd - signal };
}

// ─── MACD Series (full arrays) ────────────────────────────────────────────────
export function calculateMACDSeries(prices: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const n = prices.length;
  const macdArr: (number | null)[] = new Array(n).fill(null);
  const signalArr: (number | null)[] = new Array(n).fill(null);
  const histArr: (number | null)[] = new Array(n).fill(null);

  const ema12S = calculateEMASeries(prices, 12);
  const ema26S = calculateEMASeries(prices, 26);

  // Collect MACD values starting from index 25 (need 26-bar EMA)
  const macdValues: number[] = [];
  const macdIndexMap: number[] = []; // maps macdValues[i] → prices[j]

  for (let i = 25; i < n; i++) {
    const e12 = ema12S[i];
    const e26 = ema26S[i];
    if (e12 !== null && e26 !== null) {
      const val = e12 - e26;
      macdArr[i] = val;
      macdValues.push(val);
      macdIndexMap.push(i);
    }
  }

  // Build signal series (9-EMA of MACD values)
  if (macdValues.length >= 9) {
    const signalSeries = calculateEMASeries(macdValues, 9);
    for (let k = 0; k < macdValues.length; k++) {
      const j = macdIndexMap[k];
      const sig = signalSeries[k];
      if (sig !== null) {
        signalArr[j] = sig;
        histArr[j] = macdValues[k] - sig;
      }
    }
  }

  return { macd: macdArr, signal: signalArr, histogram: histArr };
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────
export function calculateBollingerBands(prices: number[], period: number = 20, stdDevMult: number = 2): BollingerBands {
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: sma + stdDevMult * std,
    middle: sma,
    lower: sma - stdDevMult * std
  };
}

// ─── Bollinger Band Series ────────────────────────────────────────────────────
export function calculateBollingerSeries(prices: number[], period: number = 20, stdDevMult: number = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const n = prices.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const middle: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, p) => s + Math.pow(p - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = sma + stdDevMult * std;
    middle[i] = sma;
    lower[i] = sma - stdDevMult * std;
  }
  return { upper, middle, lower };
}

// ─── Average True Range (ATR) ─────────────────────────────────────────────────
export function calculateATR(ohlc: OHLC[], period: number = 14): number {
  if (ohlc.length < 2) return 0;
  const trueRanges: number[] = [];
  for (let i = 1; i < ohlc.length; i++) {
    const cur = ohlc[i];
    const prev = ohlc[i - 1];
    trueRanges.push(Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    ));
  }
  return calculateSMA(trueRanges.slice(-period), period);
}

// ─── ADX — Wilder's proper calculation ───────────────────────────────────────
export function calculateADX(ohlc: OHLC[], period: number = 14): number {
  if (ohlc.length < period * 2) return 25;

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < ohlc.length; i++) {
    const cur = ohlc[i];
    const prev = ohlc[i - 1];

    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trueRanges.push(tr);

    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder-smoothed ATR, +DM, -DM
  let smoothATR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    smoothATR = smoothATR - smoothATR / period + trueRanges[i];
    smoothPlus = smoothPlus - smoothPlus / period + plusDMs[i];
    smoothMinus = smoothMinus - smoothMinus / period + minusDMs[i];

    const plusDI = smoothATR > 0 ? (smoothPlus / smoothATR) * 100 : 0;
    const minusDI = smoothATR > 0 ? (smoothMinus / smoothATR) * 100 : 0;
    const diSum = plusDI + minusDI;
    if (diSum > 0) {
      dxValues.push((Math.abs(plusDI - minusDI) / diSum) * 100);
    }
  }

  if (dxValues.length === 0) return 25;

  // ADX = smoothed average of DX
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  return Math.min(100, Math.max(0, adx));
}

// ─── Fibonacci Levels (anchored to fixed lookback swing) ─────────────────────
export function calculateFibonacciLevels(ohlc: OHLC[], lookbackBars: number = 60): {
  high: number;
  low: number;
  fib0: number;
  fib236: number;
  fib382: number;
  fib500: number;
  fib618: number;
  fib786: number;
  fib1000: number;
} {
  const bars = ohlc.slice(-Math.min(lookbackBars, ohlc.length));
  const high = Math.max(...bars.map(d => d.high));
  const low = Math.min(...bars.map(d => d.low));
  const range = high - low;
  return {
    high,
    low,
    fib0: high,
    fib236: high - range * 0.236,
    fib382: high - range * 0.382,
    fib500: high - range * 0.500,
    fib618: high - range * 0.618,
    fib786: high - range * 0.786,
    fib1000: low
  };
}

// ─── Calculate All Indicators ─────────────────────────────────────────────────
export function calculateAllIndicators(ohlc: OHLC[]): TechnicalIndicators {
  const closes = ohlc.map(d => d.close);
  return {
    rsi: calculateRSI(closes),
    macd: calculateMACD(closes),
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
    ema12: calculateEMA(closes, 12),
    ema26: calculateEMA(closes, 26),
    bollingerBands: calculateBollingerBands(closes),
    atr: calculateATR(ohlc),
    adx: calculateADX(ohlc)
  };
}

// ─── Signal Generator ─────────────────────────────────────────────────────────
export function generateSignal(indicators: TechnicalIndicators, currentPrice: number): {
  signal: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  score: number;
  reasons: string[];
} {
  let score = 50;
  const reasons: string[] = [];

  // RSI — Wilder-smoothed, so these thresholds are meaningful
  if (indicators.rsi < 30) {
    score += 15;
    reasons.push(`RSI oversold (${indicators.rsi.toFixed(1)}) — bullish reversal potential`);
  } else if (indicators.rsi > 70) {
    score -= 15;
    reasons.push(`RSI overbought (${indicators.rsi.toFixed(1)}) — bearish reversal potential`);
  } else if (indicators.rsi < 45) {
    score += 5;
    reasons.push(`RSI ${indicators.rsi.toFixed(1)} in lower range — mild bullish`);
  } else if (indicators.rsi > 55) {
    score -= 5;
    reasons.push(`RSI ${indicators.rsi.toFixed(1)} in upper range — mild bearish`);
  }

  // MACD
  if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
    score += 10;
    reasons.push('MACD bullish crossover — momentum accelerating up');
  } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
    score -= 10;
    reasons.push('MACD bearish crossover — momentum accelerating down');
  }

  // EMA crossover (12 vs 26)
  if (indicators.ema12 > indicators.ema26) {
    score += 8;
    reasons.push('EMA12 > EMA26 — short-term bullish momentum');
  } else if (indicators.ema12 < indicators.ema26) {
    score -= 8;
    reasons.push('EMA12 < EMA26 — short-term bearish momentum');
  }

  // Price vs SMA20/50
  if (currentPrice > indicators.sma20 && currentPrice > indicators.sma50) {
    score += 8;
    reasons.push('Price above SMA20 & SMA50 — uptrend confirmed');
  } else if (currentPrice < indicators.sma20 && currentPrice < indicators.sma50) {
    score -= 8;
    reasons.push('Price below SMA20 & SMA50 — downtrend confirmed');
  }

  // Golden/Death Cross
  if (indicators.sma50 > indicators.sma200) {
    score += 5;
    reasons.push('Golden cross (SMA50 > SMA200) — long-term bullish');
  } else if (indicators.sma50 < indicators.sma200) {
    score -= 5;
    reasons.push('Death cross (SMA50 < SMA200) — long-term bearish');
  }

  // Bollinger Bands
  if (currentPrice <= indicators.bollingerBands.lower) {
    score += 10;
    reasons.push('Price at lower Bollinger Band — oversold / mean-reversion opportunity');
  } else if (currentPrice >= indicators.bollingerBands.upper) {
    score -= 10;
    reasons.push('Price at upper Bollinger Band — overbought / overextended');
  }

  // ADX trend strength (context only)
  if (indicators.adx > 30) {
    reasons.push(`Strong trend (ADX: ${indicators.adx.toFixed(1)}) — signals are more reliable`);
  } else if (indicators.adx < 20) {
    reasons.push(`Weak/ranging market (ADX: ${indicators.adx.toFixed(1)}) — signals less reliable`);
  }

  score = Math.max(0, Math.min(100, score));

  let signal: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  if (score >= 70) signal = 'Strong Buy';
  else if (score >= 57) signal = 'Buy';
  else if (score >= 43) signal = 'Neutral';
  else if (score >= 30) signal = 'Sell';
  else signal = 'Strong Sell';

  return { signal, score, reasons };
}

// ─── Support & Resistance Levels ─────────────────────────────────────────────
export function calculateKeyLevels(ohlc: OHLC[]): { support: number[]; resistance: number[] } {
  if (ohlc.length < 10) {
    const current = ohlc[ohlc.length - 1]?.close || 2000;
    return {
      support: [current * 0.98, current * 0.95],
      resistance: [current * 1.02, current * 1.05]
    };
  }

  const highs = ohlc.map(d => d.high);
  const lows = ohlc.map(d => d.low);
  const closes = ohlc.map(d => d.close);

  const resistanceLevels: number[] = [];
  const supportLevels: number[] = [];

  // Pivot swing detection with a lookback window of 3 bars each side
  for (let i = 3; i < ohlc.length - 3; i++) {
    if (
      highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i - 3] &&
      highs[i] > highs[i + 1] && highs[i] > highs[i + 2] && highs[i] > highs[i + 3]
    ) {
      resistanceLevels.push(highs[i]);
    }
    if (
      lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i - 3] &&
      lows[i] < lows[i + 1] && lows[i] < lows[i + 2] && lows[i] < lows[i + 3]
    ) {
      supportLevels.push(lows[i]);
    }
  }

  const currentPrice = closes[closes.length - 1];

  const uniqueResistance = [...new Set(resistanceLevels)]
    .filter(r => r > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 3);

  const uniqueSupport = [...new Set(supportLevels)]
    .filter(s => s < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 3);

  if (uniqueResistance.length < 2) {
    uniqueResistance.push(currentPrice * 1.015, currentPrice * 1.03);
  }
  if (uniqueSupport.length < 2) {
    uniqueSupport.push(currentPrice * 0.985, currentPrice * 0.97);
  }

  return {
    support: uniqueSupport.slice(0, 3),
    resistance: uniqueResistance.slice(0, 3)
  };
}
