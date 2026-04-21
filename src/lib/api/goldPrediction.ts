import type { GoldPrediction, GoldInstrument, Timeframe, TechnicalIndicators, FundamentalIndicators } from '@/types/gold';

interface PredictionRequest {
  instrument: GoldInstrument;
  currentPrice: number;
  technicalData: TechnicalIndicators;
  fundamentalData: FundamentalIndicators;
  recentPrices: number[];
  timeframe: Timeframe;
}

/**
 * Realistic gold prediction engine.
 * Tries Claude AI first (via /api/predict).
 * Falls back to local quantitative model if Claude is unavailable.
 */
// ── Helper: call Gemini 2.0 Flash directly from the browser ─────────────────
async function callGemini(apiKey: string, req: PredictionRequest): Promise<GoldPrediction | null> {
  const { instrument, currentPrice, technicalData: td, fundamentalData: fd, recentPrices, timeframe } = req;

  const sorted = [...recentPrices].sort((a, b) => a - b);
  const priceMin = sorted[0] || currentPrice * 0.97;
  const priceMax = sorted[sorted.length - 1] || currentPrice * 1.03;
  const priceRange = priceMax - priceMin;
  const fib236 = priceMax - priceRange * 0.236;
  const fib382 = priceMax - priceRange * 0.382;
  const fib500 = priceMax - priceRange * 0.500;
  const fib618 = priceMax - priceRange * 0.618;
  const fib786 = priceMax - priceRange * 0.786;
  const retrace = priceRange > 0 ? ((priceMax - currentPrice) / priceRange * 100).toFixed(1) : '50.0';

  const atr = td.atr || currentPrice * 0.008;
  const atrPct = (atr / currentPrice * 100).toFixed(2);
  const tradingDays: Record<string, number> = { '1D': 1, '1W': 5, '1M': 22, '3M': 66, '6M': 130, '1Y': 252 };
  const T = tradingDays[timeframe] || 1;
  const maxMovePct: Record<string, number> = { '1D': 0.8, '1W': 2.0, '1M': 4.0, '3M': 6.0, '6M': 10.0, '1Y': 15.0 };
  const maxMove = currentPrice * (maxMovePct[timeframe] || 0.8) / 100;
  const expectedMove = Math.min(atr * Math.sqrt(T) * 0.7, maxMove);
  const expectedMovePct = (expectedMove / currentPrice * 100).toFixed(2);

  const last2 = recentPrices.slice(-2);
  const gapSize = last2.length === 2 ? Math.abs(last2[1] - last2[0]) : 0;
  const gapPct = last2.length === 2 && last2[0] > 0 ? (gapSize / last2[0] * 100) : 0;
  const hasGap = gapPct > 0.15;
  const gapDir = hasGap ? (last2[1] > last2[0] ? 'Up' : 'Down') : 'None';
  const roc10 = recentPrices.length > 10
    ? ((recentPrices[recentPrices.length - 1] - recentPrices[recentPrices.length - 11]) / recentPrices[recentPrices.length - 11] * 100).toFixed(2)
    : '0.00';

  const emaBull = td.ema12 > td.ema26;

  const prompt = `You are a professional quantitative gold analyst at Goldman Sachs.
Produce a precise JSON prediction based on the market data below.

STRICT RULES:
1. Return ONLY valid JSON. No markdown, no code fences, no text outside JSON.
2. confidence: integer 48–78. NOT a multiple of 5. Example valid values: 53, 58, 62, 67, 71, 74, 77.
3. predictedPrice: MUST be within ±$${expectedMove.toFixed(2)} (±${expectedMovePct}%) of $${currentPrice.toFixed(2)}. For 3M, max change is ±6%. For 1Y, max ±15%. Do NOT exceed these caps.
4. scenarios[0].probability + scenarios[1].probability MUST equal 100.
5. signal: one of "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"
6. trend: one of "Bullish" | "Bearish" | "Sideways"

JSON structure (exact keys):
{
  "predictedPrice":number, "predictedChange":number, "predictedChangePercent":number,
  "confidence":number, "signal":string, "trend":string,
  "technicalScore":number, "fundamentalScore":number, "sentimentScore":number,
  "reasoning":[string,string,string,string,string],
  "indicatorReasoning":{"rsi":string,"macd":string,"movingAverages":string,"fibonacci":string,"bollinger":string,"fundamental":string},
  "scenarios":[
    {"name":string,"probability":number,"priceTarget":number,"description":string,"triggers":[string,string],"riskLevel":"Low"|"Medium"|"High"},
    {"name":string,"probability":number,"priceTarget":number,"description":string,"triggers":[string,string],"riskLevel":"Low"|"Medium"|"High"}
  ],
  "gapAnalysis":{"hasGap":boolean,"gapType":"Up"|"Down"|"None","gapSize":number,"gapPercent":number,"filled":false,"reasoning":string},
  "riskReward":number,
  "keyLevels":{"support":[number,number,number],"resistance":[number,number,number]}
}

MARKET DATA — ${instrument} | ${timeframe}
Price: $${currentPrice.toFixed(2)} | ATR: $${atr.toFixed(2)} (${atrPct}%/day)
Max allowed move: ±$${expectedMove.toFixed(2)} (±${expectedMovePct}%) using ATR×√${T}
10-day ROC: ${parseFloat(roc10) > 0 ? '+' : ''}${roc10}%

TECHNICAL:
RSI(14) Wilder: ${td.rsi.toFixed(2)} ${td.rsi > 70 ? '⚠️ OVERBOUGHT' : td.rsi < 30 ? '⚠️ OVERSOLD' : td.rsi > 60 ? '(upper zone)' : td.rsi < 40 ? '(lower zone)' : '(neutral)'}
EMA12=$${td.ema12.toFixed(2)} vs EMA26=$${td.ema26.toFixed(2)} → ${emaBull ? 'BULLISH crossover ✅' : 'BEARISH crossover ❌'}
MACD: ${td.macd.macd.toFixed(4)} | Signal: ${td.macd.signal.toFixed(4)} | Hist: ${td.macd.histogram.toFixed(4)} ${td.macd.histogram > 0 ? '[↑bullish]' : '[↓bearish]'}
SMA20=$${td.sma20.toFixed(2)} | SMA50=$${td.sma50.toFixed(2)} | SMA200=$${td.sma200.toFixed(2)}
Price vs SMA20: ${((currentPrice - td.sma20) / td.sma20 * 100).toFixed(2)}% | vs SMA50: ${((currentPrice - td.sma50) / td.sma50 * 100).toFixed(2)}%
${td.sma50 > td.sma200 ? '✅ Golden Cross (SMA50>SMA200)' : '❌ Death Cross (SMA50<SMA200)'}
Bollinger: U=$${td.bollingerBands.upper.toFixed(2)} M=$${td.bollingerBands.middle.toFixed(2)} L=$${td.bollingerBands.lower.toFixed(2)} Width:${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100).toFixed(2)}%${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100) < 1.5 ? ' ←SQUEEZE' : ''}
ADX: ${td.adx.toFixed(2)} ${td.adx > 25 ? '(trending)' : '(ranging)'}

FIBONACCI (60-day swing H=$${priceMax.toFixed(2)} L=$${priceMin.toFixed(2)}):
23.6%=$${fib236.toFixed(2)} | 38.2%=$${fib382.toFixed(2)} | 50%=$${fib500.toFixed(2)} | 61.8%=$${fib618.toFixed(2)} | 78.6%=$${fib786.toFixed(2)}
Current retracement from high: ${retrace}%

GAP: ${hasGap ? `⚠️ ${gapDir} gap $${gapSize.toFixed(2)} (${gapPct.toFixed(3)}%)` : '✅ No gap detected'}

FUNDAMENTAL:
DXY: ${fd.usdIndex.toFixed(2)} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange.toFixed(2)}%) → ${fd.usdIndexChange < 0 ? 'USD weakening=BULLISH' : 'USD strong=BEARISH'}
Fed Rate: ${fd.fedFundsRate.toFixed(2)}% | Real Yield: ${fd.realYield.toFixed(2)}% | CPI: ${fd.inflation.toFixed(1)}% | VIX: ${fd.vix.toFixed(1)}

RECENT PRICES (last 10 days): ${recentPrices.slice(-10).map((p: number, i: number) => `D${i + 1}:$${p.toFixed(0)}`).join(' ')}

Return valid JSON only.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    }),
  });

  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);

  const geminiData = await resp.json();
  const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!raw) throw new Error('Empty Gemini response');

  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const prediction = JSON.parse(clean);

  if (!prediction.keyLevels) {
    prediction.keyLevels = {
      support:    [parseFloat(fib382.toFixed(2)), parseFloat(fib500.toFixed(2)), parseFloat(fib618.toFixed(2))],
      resistance: [parseFloat(fib236.toFixed(2)), parseFloat((currentPrice + atr).toFixed(2)), parseFloat(priceMax.toFixed(2))],
    };
  }

  return {
    ...prediction,
    instrument,
    currentPrice,
    timeframe,
    generatedAt: new Date(),
  } as GoldPrediction;
}

export async function getGoldPrediction(request: PredictionRequest): Promise<GoldPrediction> {

  // ── 1. Try Gemini AI directly from browser ───────────────────────────────
  const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (GEMINI_KEY) {
    try {
      const result = await callGemini(GEMINI_KEY, request);
      if (result) return result;
    } catch (err) {
      console.warn('Gemini AI call failed, falling back to local model:', err);
    }
  }

  // ── 2. Local quantitative fallback ───────────────────────────────────────
  await new Promise(resolve => setTimeout(resolve, 1200));

  const {
    instrument, currentPrice,
    technicalData: td, fundamentalData: fd,
    recentPrices, timeframe
  } = request;

  // ──────────────────────────────────────────────────────────────
  // 1. PRICE SWING CONTEXT (60-day window)
  // ──────────────────────────────────────────────────────────────
  const sortedPrices = [...recentPrices].sort((a, b) => a - b);
  const priceMin  = sortedPrices[0]    || currentPrice * 0.97;
  const priceMax  = sortedPrices[sortedPrices.length - 1] || currentPrice * 1.03;
  const priceRange = priceMax - priceMin;

  const fib236 = priceMax - priceRange * 0.236;
  const fib382 = priceMax - priceRange * 0.382;
  const fib500 = priceMax - priceRange * 0.500;
  const fib618 = priceMax - priceRange * 0.618;

  const retracePct = priceRange > 0
    ? ((priceMax - currentPrice) / priceRange) * 100
    : 50;

  // ──────────────────────────────────────────────────────────────
  // 2. TIMEFRAME-SPECIFIC SIGNAL LOGIC
  // ──────────────────────────────────────────────────────────────
  let bullishPoints = 0;     // raw bullish tally
  let possiblePoints = 0;    // total points possible
  let primaryDriver = '';

  const above = (price: number, ref: number) => price > ref;

  if (timeframe === '1D') {
    // day traders: care about momentum & fast EMAs
    possiblePoints = 10;
    primaryDriver = 'Short-term momentum (EMA12/26 crossover & MACD histogram)';
    bullishPoints += td.ema12 > td.ema26 ? 4 : 0;           // fast EMA crossover — heaviest weight
    bullishPoints += td.macd.histogram > 0 ? 3 : 0;          // MACD momentum
    bullishPoints += td.rsi >= 40 && td.rsi <= 60 ? 2 : td.rsi < 40 ? 3 : 0; // RSI: oversold = bullish, overbought = 0
    bullishPoints += above(currentPrice, td.sma20) ? 1 : 0;

  } else if (timeframe === '1W') {
    // swing traders: SMA20 trend + MACD + RSI
    possiblePoints = 10;
    primaryDriver = 'Short/medium-term trend (SMA20 position & MACD)';
    bullishPoints += above(currentPrice, td.sma20) ? 3 : 0;
    bullishPoints += td.macd.histogram > 0 ? 3 : 0;
    bullishPoints += td.ema12 > td.ema26 ? 2 : 0;
    bullishPoints += td.rsi < 60 ? 1 : 0;                    // not overbought
    bullishPoints += above(currentPrice, td.sma50) ? 1 : 0;

  } else if (timeframe === '1M') {
    // position traders: SMA50 trend + fundamentals
    possiblePoints = 10;
    primaryDriver = 'Medium-term structural trend (SMA50 & DXY fundamentals)';
    bullishPoints += above(currentPrice, td.sma50) ? 4 : 0;  // SMA50 is the key monthly indicator
    bullishPoints += above(currentPrice, td.sma20) ? 2 : 0;
    bullishPoints += fd.usdIndexChange < 0 ? 2 : 0;          // weakening USD = bullish gold
    bullishPoints += fd.realYield < 2.0 ? 1 : 0;             // low real yield = bullish
    bullishPoints += td.adx > 20 && td.ema12 > td.ema26 ? 1 : 0;

  } else {
    // 3M+ investors: SMA200, real yields, macro
    possiblePoints = 10;
    primaryDriver = 'Long-term investment thesis (SMA200, real yields, reserve demand)';
    bullishPoints += above(currentPrice, td.sma200) ? 4 : 0;  // secular bull market check
    bullishPoints += above(currentPrice, td.sma50) ? 2 : 0;
    bullishPoints += fd.realYield < 1.5 ? 2 : fd.realYield < 2.5 ? 1 : 0;
    bullishPoints += fd.usdIndexChange < 0 ? 1 : 0;
    bullishPoints += fd.inflation > fd.fedFundsRate * 0.6 ? 1 : 0; // inflation > 60% of fed rate
  }

  const alignment  = bullishPoints / possiblePoints;   // 0.0 → 1.0
  const isBullish  = alignment >= 0.5;

  // ──────────────────────────────────────────────────────────────
  // 3. CONFIDENCE — realistic range, never exceeds 80%
  //
  //    Base: 50% (coin-flip baseline — markets are efficient)
  //    Max additional: 28% → max total 78%
  //    Then clamp to [45, 80]
  // ──────────────────────────────────────────────────────────────
  const rawConf = 50 + alignment * 28;

  // Small timeframe-specific tweak so same-indicator markets give different %
  const tfBias: Record<Timeframe, number> = {
    '1D': 0, '1W': 1, '1M': -1, '3M': 2, '6M': -2, '1Y': 3
  };
  const confidence = Math.min(80, Math.max(45, Math.round(rawConf + (tfBias[timeframe] ?? 0))));

  // ──────────────────────────────────────────────────────────────
  // 4. PRICE TARGET — Square-Root-of-Time ATR scaling
  //
  //    Industry standard: σ(T) = σ_daily × √T
  //    ATR is a proxy for daily volatility.
  //    Also cap the expected move at realistic % for each timeframe.
  // ──────────────────────────────────────────────────────────────
  const tradingDays: Record<Timeframe, number> = {
    '1D': 1, '1W': 5, '1M': 22, '3M': 66, '6M': 130, '1Y': 252
  };
  const T = tradingDays[timeframe] ?? 1;

  // Expected daily range from ATR (already in $ terms)
  const dailyAtr = td.atr || (currentPrice * 0.008); // fallback: 0.8%/day for gold

  // Scaled expected range using √T
  const scaledRange = dailyAtr * Math.sqrt(T);

  // Realistic caps per timeframe (gold rarely moves more than these % in these periods)
  const maxMovePct: Record<Timeframe, number> = {
    '1D':  0.80,   // 0.8% max per day
    '1W':  2.0,    // 2% per week
    '1M':  4.0,    // 4% per month (realistic)
    '3M':  6.0,    // 6% per quarter (not 10%!)
    '6M': 10.0,    // 10% per half year
    '1Y': 15.0,    // 15% per year
  };
  const maxMove = currentPrice * (maxMovePct[timeframe] / 100);

  // Confidence-weighted multiplier (high confidence → larger projected move)
  const confMultiplier = 0.35 + (confidence - 45) / (80 - 45) * 0.3;  // 0.35 – 0.65 (more conservative)

  const rawMove    = Math.min(scaledRange * confMultiplier, maxMove);
  const targetPrice = isBullish
    ? currentPrice + rawMove
    : currentPrice - rawMove;
  const change     = targetPrice - currentPrice;
  const changePct  = (change / currentPrice) * 100;

  // ──────────────────────────────────────────────────────────────
  // 5. SCORES for UI probability bar
  //    These drive the Bullish% display in PredictionPanel.
  // ──────────────────────────────────────────────────────────────
  // Technical: pure indicator-based, 0–100
  const techBase   = Math.round(alignment * 100);
  const technicalScore = Math.min(90, Math.max(15, techBase + (td.adx > 25 ? 5 : 0)));

  // Fundamental: macro drivers, weighted by timeframe
  let fundScore = 50;
  if (fd.usdIndexChange < 0) fundScore += 10;
  if (fd.realYield < 1.5)   fundScore += 10;
  if (fd.realYield < 0)     fundScore += 10;
  if (fd.vix > 20)          fundScore += 8;      // fear → demand
  if (fd.inflation > 3)     fundScore += 7;
  if (fd.usdIndexChange > 0.5) fundScore -= 10;
  if (fd.realYield > 3)     fundScore -= 12;
  // Macro matters more for long timeframes
  const fundWeight = timeframe === '1D' ? 0.5 : timeframe === '1W' ? 0.7 : 1.0;
  const fundamentalScore = Math.min(88, Math.max(20, Math.round(50 + (fundScore - 50) * fundWeight)));

  // Sentiment: RSI + VIX driven
  let sentScore = 50;
  if (td.rsi < 30) sentScore += 18;         // heavily oversold = very bullish sentiment
  else if (td.rsi < 45) sentScore += 8;
  else if (td.rsi > 70) sentScore -= 15;    // overbought = bearish sentiment
  else if (td.rsi > 60) sentScore -= 5;
  if (fd.vix > 25) sentScore += 10;
  if (fd.vix < 15) sentScore -= 5;
  const sentimentScore = Math.min(88, Math.max(20, Math.round(sentScore)));

  // ──────────────────────────────────────────────────────────────
  // 6. SIGNAL + TREND + SCENARIO NAMES (realistic)
  // ──────────────────────────────────────────────────────────────
  let signal: GoldPrediction['signal'];
  if      (confidence >= 73 && isBullish)  signal = 'Strong Buy';
  else if (confidence >= 60 && isBullish)  signal = 'Buy';
  else if (confidence >= 73 && !isBullish) signal = 'Strong Sell';
  else if (confidence >= 60 && !isBullish) signal = 'Sell';
  else                                      signal = 'Neutral';

  const trend: GoldPrediction['trend'] =
    alignment >= 0.65 ? 'Bullish' :
    alignment <= 0.35 ? 'Bearish' : 'Sideways';

  // ──────────────────────────────────────────────────────────────
  // 7. GAP ANALYSIS
  // ──────────────────────────────────────────────────────────────
  const last2 = recentPrices.slice(-2);
  let gapSize = 0, gapPercent = 0, hasGap = false;
  if (last2.length === 2) {
    gapSize    = Math.abs(last2[1] - last2[0]);
    gapPercent = last2[0] > 0 ? (gapSize / last2[0]) * 100 : 0;
    hasGap     = gapPercent > 0.15;
  }
  const gapDir = hasGap ? (last2[1] > last2[0] ? 'Up' : 'Down') : 'None';

  // ──────────────────────────────────────────────────────────────
  // 8. SCENARIO TARGETS (A better + B worse)
  //    Use fib levels as natural targets — these are what real traders watch
  // ──────────────────────────────────────────────────────────────
  const nearFibBull = currentPrice < fib236 ? fib236 : currentPrice < fib382 ? fib382 : fib236;
  const nearFibBear = currentPrice > fib618 ? fib618 : currentPrice > fib500 ? fib500 : fib618;

  const bullProbability = Math.round(alignment * 100);
  const bearProbability = 100 - bullProbability;

  // ──────────────────────────────────────────────────────────────
  // 9. EMA CROSSOVER LABEL
  // ──────────────────────────────────────────────────────────────
  const emaCrossover = td.ema12 > td.ema26
    ? `EMA12 ($${td.ema12.toFixed(2)}) > EMA26 ($${td.ema26.toFixed(2)}) — BULLISH crossover`
    : `EMA12 ($${td.ema12.toFixed(2)}) < EMA26 ($${td.ema26.toFixed(2)}) — BEARISH crossover`;

  return {
    instrument,
    currentPrice,
    timeframe,

    predictedPrice:          parseFloat(targetPrice.toFixed(2)),
    predictedChange:         parseFloat(change.toFixed(2)),
    predictedChangePercent:  parseFloat(changePct.toFixed(3)),
    confidence,
    signal,
    trend,

    technicalScore,
    fundamentalScore,
    sentimentScore,

    reasoning: [
      `Timeframe Focus: ${primaryDriver}`,
      `Indicator alignment: ${bullishPoints}/${possiblePoints} points (${(alignment * 100).toFixed(0)}%) — ${isBullish ? 'net bullish' : alignment === 0.5 ? 'neutral' : 'net bearish'}`,
      `RSI(14): ${td.rsi.toFixed(1)} — ${td.rsi < 30 ? '⚠️ Oversold (potential bounce)' : td.rsi > 70 ? '⚠️ Overbought (risk of pullback)' : td.rsi < 45 ? 'lower neutral zone' : td.rsi > 60 ? 'upper neutral zone' : 'balanced neutral'}`,
      `${emaCrossover}`,
      `MACD histogram: ${td.macd.histogram.toFixed(4)} (${td.macd.histogram > 0 ? 'positive momentum building' : 'negative momentum / sellers in control'})`,
      `DXY: ${fd.usdIndex.toFixed(2)} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange.toFixed(2)}%) — ${fd.usdIndexChange < 0 ? 'USD weakening → bullish for gold' : 'USD strengthening → headwind for gold'}`,
      `Expected move (${timeframe}): ~$${rawMove.toFixed(0)} (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%) using ATR×√${T}`,
    ],

    indicatorReasoning: {
      rsi: `RSI at ${td.rsi.toFixed(1)} (Wilder-smoothed). ${
        td.rsi < 30 ? 'Deep oversold — statistically high reversal probability. Smart money often buys into these extremes.'
        : td.rsi > 70 ? 'Overbought — momentum stretched, risk of mean reversion. Consider waiting for a pullback entry.'
        : td.rsi < 45 ? 'In the lower neutral zone — no strong signal, slight bearish lean.'
        : td.rsi > 60 ? 'In the upper neutral zone — bulls maintain marginal control.'
        : 'Balanced neutral zone (45–60). Indicator provides no directional edge.'
      }`,
      macd: `MACD histogram: ${td.macd.histogram.toFixed(4)}. Line: ${td.macd.macd.toFixed(4)} vs Signal: ${td.macd.signal.toFixed(4)}. ${
        td.macd.histogram > 0
          ? 'Positive histogram → momentum is accelerating to the upside. A widening histogram strengthens the bullish case.'
          : 'Negative histogram → sellers are in control. Watch for a histogram convergence toward zero as early reversal signal.'
      }`,
      movingAverages: `${emaCrossover}. Price is ${currentPrice > td.sma50 ? 'above' : 'below'} SMA50 ($${td.sma50.toFixed(2)}) — ${currentPrice > td.sma50 ? 'medium-term bull market structure intact' : 'medium-term bear pressure'}. ${currentPrice > td.sma200 ? 'Above SMA200: secular uptrend confirmed.' : 'Below SMA200: long-term trend is bearish.'}`,
      fibonacci: `Price at ${retracePct.toFixed(1)}% retracement from 60-day high of $${priceMax.toFixed(2)}. Key levels: 38.2% = $${fib382.toFixed(2)}, 50% = $${fib500.toFixed(2)}, 61.8% = $${fib618.toFixed(2)}. ${
        currentPrice > fib236 ? 'Price above 23.6% — holding near highs. Bulls in control.'
        : currentPrice > fib382 ? 'Price between 23.6% and 38.2% — healthy pullback, potential buy zone.'
        : currentPrice > fib500 ? 'At 50% retracement — pivotal zone. Bounce here = bull continuation.'
        : 'Deep retracement (>50%) — momentum has shifted to sellers.'
      }`,
      bollinger: `Bollinger Band width: ${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100).toFixed(2)}%. Upper: $${td.bollingerBands.upper.toFixed(2)} | Mid (SMA20): $${td.bollingerBands.middle.toFixed(2)} | Lower: $${td.bollingerBands.lower.toFixed(2)}. ${
        currentPrice > td.bollingerBands.upper ? 'Price above upper band — strong momentum but overextension risk.'
        : currentPrice < td.bollingerBands.lower ? 'Price below lower band — oversold, mean reversion likely.'
        : currentPrice > td.bollingerBands.middle ? 'Price above mid-band — bullish bias within the channel.'
        : 'Price below mid-band — bearish short-term bias.'
      } ${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100) < 1.5 ? '⚡ Bandwidth SQUEEZE — breakout likely imminent.' : ''}`,
      fundamental: `DXY ${fd.usdIndex.toFixed(2)} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange.toFixed(2)}%) — gold's #1 macro driver. Real yield (10Y - CPI): ${fd.realYield.toFixed(2)}% — ${fd.realYield < 0 ? '🟢 Negative real yield: strongest fundamental case for gold'  : fd.realYield < 1.5 ? '🟡 Low real yield — supportive of gold' : fd.realYield < 2.5 ? '🟡 Moderate real yield — neutral macro backdrop' : '🔴 High real yield — compressed gold opportunity cost reduced'}. VIX at ${fd.vix.toFixed(1)} — ${fd.vix > 25 ? 'elevated fear — strong safe-haven demand' : fd.vix < 15 ? 'complacency — low safe-haven premium' : 'moderate uncertainty'}. Fed rate: ${fd.fedFundsRate.toFixed(2)}%.`,
    },

    scenarios: [
      {
        name: isBullish ? 'Bullish Continuation' : 'Technical Recovery',
        probability: bullProbability,
        priceTarget: parseFloat((isBullish ? Math.min(nearFibBull, currentPrice + rawMove * 1.3) : currentPrice + rawMove * 0.5).toFixed(2)),
        description: isBullish
          ? `Momentum sustains if price holds above EMA26 ($${td.ema26.toFixed(2)}) and SMA20 ($${td.sma20.toFixed(2)}). Target the ${retracePct < 23.6 ? '0%' : retracePct < 38.2 ? '23.6%' : '38.2%'} fib level.`
          : `Bears remain in control. A recovery above EMA12 ($${td.ema12.toFixed(2)}) would signal a short-term relief bounce only.`,
        triggers: [
          isBullish ? 'Price holds above SMA20 on any pullback' : 'Oversold RSI bounce off support',
          'DXY weakens below key level',
        ],
        riskLevel: confidence < 60 ? 'High' : confidence < 70 ? 'Medium' : 'Low',
      },
      {
        name: isBullish ? 'Bearish Pullback' : 'Bearish Continuation',
        probability: bearProbability,
        priceTarget: parseFloat((isBullish ? currentPrice - rawMove * 0.6 : Math.max(nearFibBear, currentPrice - rawMove * 1.3)).toFixed(2)),
        description: isBullish
          ? `A break below SMA20 ($${td.sma20.toFixed(2)}) opens a correction toward $${fib382.toFixed(2)} (38.2% fib). Invalidates if EMA12 stays above EMA26.`
          : `Selling pressure persists below EMA26 ($${td.ema26.toFixed(2)}). Next support at $${fib618.toFixed(2)} (61.8% fib).`,
        triggers: [
          isBullish ? 'Dollar Index (DXY) surges above resistance' : 'Break below key support with volume',
          isBullish ? 'MACD histogram turns negative' : 'Fed hawkish surprise or strong NFP',
        ],
        riskLevel: confidence < 60 ? 'Medium' : 'High',
      },
    ],

    gapAnalysis: {
      hasGap,
      gapType: gapDir as 'Up' | 'Down' | 'None',
      gapSize:    parseFloat(gapSize.toFixed(2)),
      gapPercent: parseFloat(gapPercent.toFixed(3)),
      filled:     false,
      reasoning:  hasGap
        ? `${gapDir} gap of $${gapSize.toFixed(2)} (${gapPercent.toFixed(3)}%). ~75% of commodity gaps fill within 1–5 sessions. Institutional players often fade opening gaps.`
        : 'No significant price gap (>0.15%) detected. Price action is continuous — no structural imbalance to fill.',
    },

    riskReward: parseFloat((rawMove / (dailyAtr * 1.5)).toFixed(2)),

    keyLevels: {
      support: [
        parseFloat(fib382.toFixed(2)),
        parseFloat(fib500.toFixed(2)),
        parseFloat(fib618.toFixed(2)),
      ],
      resistance: [
        parseFloat(fib236.toFixed(2)),
        parseFloat((currentPrice + dailyAtr).toFixed(2)),
        parseFloat(priceMax.toFixed(2)),
      ],
    },

    generatedAt: new Date(),
  };
}
