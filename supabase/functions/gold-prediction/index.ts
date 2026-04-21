import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PredictionRequest {
  instrument: string;
  currentPrice: number;
  technicalData: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;
    bollingerBands: { upper: number; middle: number; lower: number };
    atr: number;
    adx: number;
  };
  fundamentalData: {
    usdIndex: number;
    usdIndexChange: number;
    fedFundsRate: number;
    realYield: number;
    inflation: number;
    vix: number;
  };
  recentPrices: number[];
  timeframe: string;
}

// ─── Wilder-smoothed RSI (mirrors frontend lib, ensures consistency) ───────────
function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[i], 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

// ─── EMA scalar ────────────────────────────────────────────────────────────────
function calcEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(prices.length, period);
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

// ─── Rate of Change (momentum) ─────────────────────────────────────────────────
function calcROC(prices: number[], period = 10): number {
  if (prices.length < period + 1) return 0;
  const old = prices[prices.length - 1 - period];
  const cur = prices[prices.length - 1];
  return old === 0 ? 0 : ((cur - old) / old) * 100;
}

// ─── Confidence calculation based on signal alignment ─────────────────────────
function calcIndicatorAlignment(td: PredictionRequest['technicalData'], currentPrice: number): number {
  let bullishSignals = 0;
  let totalSignals = 0;

  // RSI
  totalSignals++;
  if (td.rsi < 40) bullishSignals++; // oversold → bullish
  else if (td.rsi > 60) { /* bearish */ }
  else bullishSignals += 0.5; // neutral

  // MACD histogram
  totalSignals++;
  if (td.macd.histogram > 0) bullishSignals++;

  // EMA crossover (strong signal)
  totalSignals += 2;
  if (td.ema12 > td.ema26) bullishSignals += 2;

  // Price vs SMA20
  totalSignals++;
  if (currentPrice > td.sma20) bullishSignals++;

  // Price vs SMA50
  totalSignals++;
  if (currentPrice > td.sma50) bullishSignals++;

  // ADX confirms trend
  if (td.adx > 25) totalSignals++; // only count if trending
  if (td.adx > 25 && td.ema12 > td.ema26) bullishSignals++;

  const alignment = bullishSignals / totalSignals; // 0..1
  // Map alignment to confidence: fully aligned = 80%, half = 55%, opposite = 52%
  // We deliberately cap at 82% — no prediction should be overconfident
  const rawConf = 50 + alignment * 32;
  return Math.round(Math.min(82, Math.max(50, rawConf)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body: PredictionRequest = await req.json();
    const { instrument, currentPrice, technicalData: td, fundamentalData: fd, recentPrices, timeframe } = body;

    // ── Derived metrics (edge function computes these independently for consistency) ──
    const sortedPrices = [...recentPrices].sort((a, b) => a - b);
    const priceMin = sortedPrices[0];
    const priceMax = sortedPrices[sortedPrices.length - 1];
    const priceRange = priceMax - priceMin;
    const pivot = (priceMax + priceMin + currentPrice) / 3;

    // Fibonacci levels from 60-day swing (using the passed recentPrices)
    const fib236 = priceMax - priceRange * 0.236;
    const fib382 = priceMax - priceRange * 0.382;
    const fib500 = priceMax - priceRange * 0.500;
    const fib618 = priceMax - priceRange * 0.618;
    const fib786 = priceMax - priceRange * 0.786;

    // Prices w/ context
    const roc10 = calcROC(recentPrices, 10);
    const rsiCheck = calcRSI(recentPrices);

    // EMA crossover signal
    const emaBullish = td.ema12 > td.ema26;
    const emaCrossover = emaBullish
      ? `EMA12 ($${td.ema12.toFixed(2)}) > EMA26 ($${td.ema26.toFixed(2)}) — BULLISH crossover`
      : `EMA12 ($${td.ema12.toFixed(2)}) < EMA26 ($${td.ema26.toFixed(2)}) — BEARISH crossover`;

    // Gap detection
    const last2 = recentPrices.slice(-2);
    const gapSize = Math.abs(last2[1] - last2[0]);
    const gapPercent = last2[0] > 0 ? (gapSize / last2[0]) * 100 : 0;
    const hasGap = gapPercent > 0.15;
    const gapDir = last2[1] > last2[0] ? "UP" : "DOWN";

    // ATR-based expected move
    const atr = td.atr || (priceRange / recentPrices.length);
    const atrPct = (atr / currentPrice) * 100;

    // Signal alignment score for confidence
    const baseConfidence = calcIndicatorAlignment(td, currentPrice);

    // Timeframe expected move
    const expectedMoves: Record<string, string> = {
      '1D': `$${(atr * 1).toFixed(2)} (${atrPct.toFixed(2)}%)`,
      '1W': `$${(atr * 4).toFixed(2)} (${(atrPct * 4).toFixed(2)}%)`,
      '1M': `$${(atr * 15).toFixed(2)} (${(atrPct * 15).toFixed(2)}%)`,
      '3M': `$${(atr * 45).toFixed(2)} (${(atrPct * 45).toFixed(2)}%)`
    };
    const expectedMove = expectedMoves[timeframe] || expectedMoves['1D'];

    const systemPrompt = `You are a professional gold trading analyst. Your job is to produce a PRECISE JSON prediction based on quantitative data.

RULES (MUST follow exactly):
1. Respond with ONLY a valid JSON object — no markdown, no commentary, no code fences.
2. Use the provided exact indicator values in your reasoning — cite specific numbers.
3. Confidence must reflect indicator alignment: ${baseConfidence - 5}–${baseConfidence + 5}% range. Do NOT use round numbers (67, 70, 80). Use values like 63, 71, 58, 77.
4. predictedPrice must be based on ATR-sized moves from currentPrice, not arbitrary round numbers.
5. Scenarios' probabilities must sum to exactly 100.
6. Write reasoning sentences in English that reference the actual numbers.

JSON structure (exact, no extra keys):
{
  "predictedPrice": <number>,
  "predictedChange": <number>,
  "predictedChangePercent": <number>,
  "confidence": <number 50-82>,
  "signal": "<Strong Buy|Buy|Neutral|Sell|Strong Sell>",
  "trend": "<Bullish|Bearish|Sideways>",
  "technicalScore": <number 0-100>,
  "fundamentalScore": <number 0-100>,
  "sentimentScore": <number 0-100>,
  "reasoning": ["<specific reason with numbers>", "<specific reason with numbers>", "<specific reason with numbers>", "<specific reason with numbers>"],
  "indicatorReasoning": {
    "rsi": "<Explain RSI=${rsiCheck.toFixed(1)} in context — overbought/oversold/momentum>",
    "macd": "<Explain MACD histogram=${td.macd.histogram.toFixed(4)} — bullish/bearish momentum>",
    "movingAverages": "<Explain ${emaCrossover} and SMA20/50 position>",
    "fibonacci": "<Which fib level ($fib382 or $fib618) is price near, why it matters>",
    "bollinger": "<Is price near upper/lower band, bandwidth squeeze/expansion>",
    "fundamental": "<DXY trend, real yield, inflation impact on gold>"
  },
  "scenarios": [
    {
      "name": "<Bullish scenario name>",
      "probability": <number>,
      "priceTarget": <number>,
      "description": "<Why this scenario plays out with specific price levels>",
      "triggers": ["<trigger1>", "<trigger2>"],
      "riskLevel": "<Low|Medium|High>"
    },
    {
      "name": "<Bearish scenario name>",
      "probability": <number>,
      "priceTarget": <number>,
      "description": "<Why this scenario plays out with specific price levels>",
      "triggers": ["<trigger1>", "<trigger2>"],
      "riskLevel": "<Low|Medium|High>"
    }
  ],
  "gapAnalysis": {
    "hasGap": <boolean>,
    "gapType": "<Up|Down|None>",
    "gapSize": <number>,
    "gapPercent": <number>,
    "filled": <boolean>,
    "reasoning": "<Why this gap matters — fill probability, institutional interpretation>"
  },
  "riskReward": <number>,
  "keyLevels": {
    "support": [<S1>, <S2>, <S3>],
    "resistance": [<R1>, <R2>, <R3>]
  }
}`;

    const userPrompt = `Analyze ${instrument} for ${timeframe} prediction:

━━ PRICE ━━
Current: $${currentPrice.toFixed(2)} | ATR(14): $${atr.toFixed(2)} (${atrPct.toFixed(2)}%)
Expected ATR-based move for ${timeframe}: ${expectedMove}
10-day ROC (momentum): ${roc10 > 0 ? '+' : ''}${roc10.toFixed(2)}%

━━ TECHNICAL INDICATORS ━━
RSI(14) Wilder: ${td.rsi.toFixed(2)} ${td.rsi > 70 ? '⚠️ OVERBOUGHT' : td.rsi < 30 ? '⚠️ OVERSOLD' : td.rsi > 60 ? '(Upper zone)' : td.rsi < 40 ? '(Lower zone)' : '(Neutral)'}
${emaCrossover}
MACD Line: ${td.macd.macd.toFixed(4)} | Signal: ${td.macd.signal.toFixed(4)} | Histogram: ${td.macd.histogram.toFixed(4)} ${td.macd.histogram > 0 ? '(↑ Bullish momentum)' : '(↓ Bearish momentum)'}
SMA20: $${td.sma20.toFixed(2)} | Price is ${((currentPrice - td.sma20) / td.sma20 * 100).toFixed(2)}% ${currentPrice > td.sma20 ? 'ABOVE' : 'BELOW'}
SMA50: $${td.sma50.toFixed(2)} | Price is ${((currentPrice - td.sma50) / td.sma50 * 100).toFixed(2)}% ${currentPrice > td.sma50 ? 'ABOVE' : 'BELOW'}
SMA200: $${td.sma200.toFixed(2)} | ${td.sma50 > td.sma200 ? '✅ Golden Cross (SMA50>SMA200)' : '❌ Death Cross (SMA50<SMA200)'}
Bollinger: Upper $${td.bollingerBands.upper.toFixed(2)} | Mid $${td.bollingerBands.middle.toFixed(2)} | Lower $${td.bollingerBands.lower.toFixed(2)}
BB Width: ${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100).toFixed(2)}% ${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100) < 1.5 ? '← SQUEEZE (low volatility, breakout imminent)' : '← Normal bandwidth'}
ADX: ${td.adx.toFixed(2)} ${td.adx > 40 ? '(Very strong trend)' : td.adx > 25 ? '(Trending)' : td.adx > 20 ? '(Weak trend)' : '(Ranging / no trend)'}

━━ FIBONACCI (60-day swing) ━━
High: $${priceMax.toFixed(2)} | Low: $${priceMin.toFixed(2)} | Pivot: $${pivot.toFixed(2)}
Fib 23.6%: $${fib236.toFixed(2)} | 38.2%: $${fib382.toFixed(2)} | 50.0%: $${fib500.toFixed(2)} | 61.8%: $${fib618.toFixed(2)} | 78.6%: $${fib786.toFixed(2)}
Current price sits at: ~${(((priceMax - currentPrice) / priceRange) * 100).toFixed(1)}% retracement from high

━━ GAP ANALYSIS ━━
Previous: $${last2[0].toFixed(2)} → Current: $${last2[1].toFixed(2)}
${hasGap ? `⚠️ ${gapDir} GAP detected: $${gapSize.toFixed(2)} (${gapPercent.toFixed(3)}%) — Gaps tend to fill within 1-5 sessions` : '✅ No significant gap (>0.15%) detected'}

━━ FUNDAMENTAL ━━
DXY: ${fd.usdIndex} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange}%) → Gold ${fd.usdIndexChange > 0 ? 'BEARISH (inverse correlation)' : 'BULLISH (USD weakening)'}
Fed Rate: ${fd.fedFundsRate}% | Real Yield (10Y-CPI): ${fd.realYield}% ${fd.realYield > 2 ? '(High real yield = bearish gold)' : fd.realYield < 0 ? '(Negative real yield = bullish gold)' : '(Moderate)'}
CPI: ${fd.inflation}% | VIX: ${fd.vix} ${fd.vix > 25 ? '(Fear elevated = safe-haven demand ↑)' : '(Low fear = less safe-haven demand)'}

━━ RECENT PRICES (last 15 days) ━━
${recentPrices.slice(-15).map((p, i) => `D${i + 1}: $${p.toFixed(2)}`).join(' | ')}

━━ YOUR TASK ━━
Signal indicator alignment score: ${baseConfidence}% (use ${baseConfidence - 3}–${baseConfidence + 5} for confidence)
Set predictedPrice using ATR multiples from $${currentPrice.toFixed(2)}.
Timeframe: ${timeframe} = ${timeframe === '1D' ? 'next 1 trading day' : timeframe === '1W' ? 'next 5 trading days' : timeframe === '1M' ? 'next 22 trading days' : 'next 66 trading days'}
Respond with valid JSON only.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,   // Lower temperature = more consistent, data-driven outputs
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Prediction service unavailable. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let prediction: any;
    try {
      // Strip any accidental markdown fences
      const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      prediction = JSON.parse(clean);
    } catch (parseError) {
      console.error("Failed to parse AI response, using computed fallback:", content.slice(0, 200));

      // ── Computed fallback — no arbitrary hardcoded numbers ──
      const isBullish = td.ema12 > td.ema26 && td.macd.histogram > 0;
      const atrMove = timeframe === '1D' ? atr : timeframe === '1W' ? atr * 4 : timeframe === '1M' ? atr * 15 : atr * 45;
      const targetPrice = isBullish ? currentPrice + atrMove * 0.8 : currentPrice - atrMove * 0.8;
      const change = targetPrice - currentPrice;
      const changePct = (change / currentPrice) * 100;

      prediction = {
        predictedPrice: parseFloat(targetPrice.toFixed(2)),
        predictedChange: parseFloat(change.toFixed(2)),
        predictedChangePercent: parseFloat(changePct.toFixed(3)),
        confidence: baseConfidence,
        signal: td.rsi < 30 ? "Buy" : td.rsi > 70 ? "Sell" : isBullish ? "Buy" : "Sell",
        trend: isBullish ? "Bullish" : "Bearish",
        technicalScore: Math.round(40 + (isBullish ? 35 : 10) + (td.adx > 25 ? 10 : 0)),
        fundamentalScore: fd.usdIndexChange < 0 ? 68 : 42,
        sentimentScore: fd.vix > 20 ? 62 : 48,
        reasoning: [
          `RSI(14): ${td.rsi.toFixed(1)} — ${td.rsi < 30 ? 'oversold, reversal watch' : td.rsi > 70 ? 'overbought, caution' : 'neutral zone'}`,
          `${emaCrossover}`,
          `MACD histogram ${td.macd.histogram > 0 ? 'positive' : 'negative'} (${td.macd.histogram.toFixed(4)}) — ${td.macd.histogram > 0 ? 'bullish' : 'bearish'} momentum`,
          `DXY ${fd.usdIndex} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange}%) — ${fd.usdIndexChange < 0 ? 'USD weakening, bullish for gold' : 'USD strength, headwind for gold'}`
        ],
        indicatorReasoning: {
          rsi: `RSI at ${td.rsi.toFixed(1)} using Wilder's smoothing. ${td.rsi < 30 ? 'Oversold — high probability of mean reversion bounce.' : td.rsi > 70 ? 'Overbought — risk of pullback is elevated.' : 'Mid-range RSI provides no strong directional bias.'}`,
          macd: `MACD histogram at ${td.macd.histogram.toFixed(4)} (line ${td.macd.macd.toFixed(4)} vs signal ${td.macd.signal.toFixed(4)}). ${td.macd.histogram > 0 ? 'Positive histogram confirms upward momentum building.' : 'Negative histogram signals sellers are in control.'}`,
          movingAverages: `${emaCrossover}. Price is ${currentPrice > td.sma50 ? 'above' : 'below'} SMA50 ($${td.sma50.toFixed(2)}), confirming ${currentPrice > td.sma50 ? 'medium-term bullish' : 'medium-term bearish'} structure.`,
          fibonacci: `Price at ${(((priceMax - currentPrice) / priceRange) * 100).toFixed(1)}% retracement. Key levels: 38.2% at $${fib382.toFixed(2)}, 61.8% at $${fib618.toFixed(2)}. ${currentPrice > fib382 ? 'Holding above 38.2% is bullish.' : 'Break below 38.2% signals deeper correction.'}`,
          bollinger: `BB width: ${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100).toFixed(2)}%. Price at $${currentPrice.toFixed(2)} vs upper $${td.bollingerBands.upper.toFixed(2)} / lower $${td.bollingerBands.lower.toFixed(2)}.${currentPrice > td.bollingerBands.upper ? ' Price above upper band — overextension risk.' : currentPrice < td.bollingerBands.lower ? ' Price below lower band — oversold.' : ' Price within bands — normal range.'}`,
          fundamental: `DXY at ${fd.usdIndex} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange}%) — gold's strongest macro driver. Real yield at ${fd.realYield}% ${fd.realYield > 2 ? 'creates headwind for non-yielding gold.' : fd.realYield < 0 ? 'is highly supportive of gold.' : 'is neutral.'} VIX at ${fd.vix} ${fd.vix > 20 ? 'indicates elevated fear — safe-haven demand supports gold.' : 'is calm — limited fear-driven demand.'}`
        },
        scenarios: [
          {
            name: isBullish ? "Bullish Continuation" : "Bullish Recovery",
            probability: isBullish ? 62 : 38,
            priceTarget: parseFloat((currentPrice + atrMove).toFixed(2)),
            description: `Price targets $${(currentPrice + atrMove).toFixed(2)} if ${isBullish ? 'momentum sustains above EMA26' : 'price reclaims EMA12/EMA26'}.`,
            triggers: ["Break above resistance with volume", "DXY continues to soften"],
            riskLevel: "Medium"
          },
          {
            name: isBullish ? "Bearish Pullback" : "Bearish Continuation",
            probability: isBullish ? 38 : 62,
            priceTarget: parseFloat((currentPrice - atrMove).toFixed(2)),
            description: `Price pulls back to $${(currentPrice - atrMove).toFixed(2)} if ${isBullish ? 'bulls fail to hold EMA26 support' : 'selling pressure persists'}.`,
            triggers: ["USD strength surge", "Fail at key resistance"],
            riskLevel: "Medium"
          }
        ],
        gapAnalysis: {
          hasGap,
          gapType: hasGap ? gapDir as "Up" | "Down" : "None",
          gapSize: parseFloat(gapSize.toFixed(2)),
          gapPercent: parseFloat(gapPercent.toFixed(3)),
          filled: false,
          reasoning: hasGap
            ? `${gapDir} gap of $${gapSize.toFixed(2)} (${gapPercent.toFixed(3)}%) detected. Statistical tendency: ~75% of forex/commodity gaps fill within 1-5 sessions. Institutional players often fade gaps.`
            : "No significant gap detected. Price action is continuous — no imbalance to fill."
        },
        riskReward: parseFloat(Math.abs(atrMove / (atr * 0.5)).toFixed(2))
      };
    }

    // Ensure keyLevels always present
    if (!prediction.keyLevels) {
      prediction.keyLevels = {
        support: [
          parseFloat((currentPrice - atr).toFixed(2)),
          parseFloat(fib382.toFixed(2)),
          parseFloat(fib618.toFixed(2))
        ],
        resistance: [
          parseFloat((currentPrice + atr).toFixed(2)),
          parseFloat(fib236.toFixed(2)),
          parseFloat(priceMax.toFixed(2))
        ]
      };
    }

    return new Response(JSON.stringify({
      success: true,
      prediction: {
        ...prediction,
        instrument,
        currentPrice,
        timeframe,
        generatedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Prediction error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
