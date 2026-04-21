import type { VercelRequest, VercelResponse } from '@vercel/node';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function calcROC(prices: number[], period = 10): number {
  if (prices.length < period + 1) return 0;
  const old = prices[prices.length - 1 - period];
  const cur = prices[prices.length - 1];
  return old === 0 ? 0 : ((cur - old) / old) * 100;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { instrument, currentPrice, technicalData: td, fundamentalData: fd, recentPrices, timeframe } = req.body;

    // ── Derived context ──────────────────────────────────────────────────────
    const sorted = [...recentPrices].sort((a: number, b: number) => a - b);
    const priceMin   = sorted[0];
    const priceMax   = sorted[sorted.length - 1];
    const priceRange = priceMax - priceMin;
    const fib236 = priceMax - priceRange * 0.236;
    const fib382 = priceMax - priceRange * 0.382;
    const fib500 = priceMax - priceRange * 0.500;
    const fib618 = priceMax - priceRange * 0.618;
    const fib786 = priceMax - priceRange * 0.786;

    const roc10 = calcROC(recentPrices, 10);
    const atr = td.atr || currentPrice * 0.008;
    const atrPct = (atr / currentPrice) * 100;
    const tradingDays: Record<string, number> = { '1D': 1, '1W': 5, '1M': 22, '3M': 66, '6M': 130, '1Y': 252 };
    const T = tradingDays[timeframe] || 1;
    const maxMovePct: Record<string, number> = { '1D': 0.8, '1W': 2.0, '1M': 5.0, '3M': 10.0, '6M': 14.0, '1Y': 20.0 };
    const maxMove = currentPrice * (maxMovePct[timeframe] || 0.8) / 100;
    const scaledRange = atr * Math.sqrt(T);
    const expectedMove = Math.min(scaledRange * 0.7, maxMove);
    const expectedMovePct = (expectedMove / currentPrice) * 100;

    const last2 = recentPrices.slice(-2);
    const gapSize = last2.length === 2 ? Math.abs(last2[1] - last2[0]) : 0;
    const gapPct  = last2.length === 2 && last2[0] > 0 ? (gapSize / last2[0]) * 100 : 0;
    const hasGap  = gapPct > 0.15;
    const gapDir  = hasGap ? (last2[1] > last2[0] ? 'Up' : 'Down') : 'None';
    const retracePct = priceRange > 0 ? ((priceMax - currentPrice) / priceRange) * 100 : 50;
    const emaBullish = td.ema12 > td.ema26;

    // ── Full prompt ──────────────────────────────────────────────────────────
    const prompt = `You are a professional quantitative gold analyst. Produce a precise JSON prediction.

RULES (follow exactly):
1. Return ONLY valid JSON, no markdown fences, no extra text.
2. confidence: integer 48–80, NOT a multiple of 5.
3. predictedPrice: must be within ±$${expectedMove.toFixed(2)} (±${expectedMovePct.toFixed(2)}%) of $${currentPrice.toFixed(2)}.
4. scenarios[0].probability + scenarios[1].probability = 100 exactly.
5. signal: "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"
6. trend: "Bullish" | "Bearish" | "Sideways"
7. All numbers reference the actual values given below.

JSON structure:
{
  "predictedPrice": number,
  "predictedChange": number,
  "predictedChangePercent": number,
  "confidence": number,
  "signal": string,
  "trend": string,
  "technicalScore": number,
  "fundamentalScore": number,
  "sentimentScore": number,
  "reasoning": [string x5],
  "indicatorReasoning": {
    "rsi": string, "macd": string, "movingAverages": string,
    "fibonacci": string, "bollinger": string, "fundamental": string
  },
  "scenarios": [
    { "name": string, "probability": number, "priceTarget": number, "description": string, "triggers": [string, string], "riskLevel": "Low"|"Medium"|"High" },
    { "name": string, "probability": number, "priceTarget": number, "description": string, "triggers": [string, string], "riskLevel": "Low"|"Medium"|"High" }
  ],
  "gapAnalysis": { "hasGap": boolean, "gapType": "Up"|"Down"|"None", "gapSize": number, "gapPercent": number, "filled": false, "reasoning": string },
  "riskReward": number,
  "keyLevels": { "support": [number,number,number], "resistance": [number,number,number] }
}

MARKET DATA for ${instrument} — Timeframe: ${timeframe}

PRICE:
Current: $${currentPrice.toFixed(2)} | ATR(14): $${atr.toFixed(2)} (${atrPct.toFixed(2)}%/day)
Max allowed move (ATR×√${T} capped): ±$${expectedMove.toFixed(2)} (±${expectedMovePct.toFixed(2)}%)
10-day ROC: ${roc10 > 0 ? '+' : ''}${roc10.toFixed(2)}%

TECHNICAL:
RSI(14) Wilder: ${td.rsi.toFixed(2)} ${td.rsi > 70 ? '⚠️ OVERBOUGHT' : td.rsi < 30 ? '⚠️ OVERSOLD' : td.rsi > 60 ? '(upper zone)' : td.rsi < 40 ? '(lower zone)' : '(neutral)'}
EMA12: $${td.ema12.toFixed(2)} vs EMA26: $${td.ema26.toFixed(2)} → ${emaBullish ? 'BULLISH crossover ✅' : 'BEARISH crossover ❌'}
MACD: ${td.macd.macd.toFixed(4)} | Signal: ${td.macd.signal.toFixed(4)} | Histogram: ${td.macd.histogram.toFixed(4)} ${td.macd.histogram > 0 ? '[↑ bullish]' : '[↓ bearish]'}
SMA20: $${td.sma20.toFixed(2)} (${((currentPrice - td.sma20) / td.sma20 * 100).toFixed(2)}% ${currentPrice > td.sma20 ? 'above' : 'below'})
SMA50: $${td.sma50.toFixed(2)} (${((currentPrice - td.sma50) / td.sma50 * 100).toFixed(2)}% ${currentPrice > td.sma50 ? 'above' : 'below'})
SMA200: $${td.sma200.toFixed(2)} → ${td.sma50 > td.sma200 ? '✅ Golden Cross' : '❌ Death Cross'}
Bollinger: Upper $${td.bollingerBands.upper.toFixed(2)} | Mid $${td.bollingerBands.middle.toFixed(2)} | Lower $${td.bollingerBands.lower.toFixed(2)} | Width: ${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100).toFixed(2)}%${((td.bollingerBands.upper - td.bollingerBands.lower) / td.bollingerBands.middle * 100) < 1.5 ? ' ← SQUEEZE' : ''}
ADX: ${td.adx.toFixed(2)} ${td.adx > 25 ? '(trending)' : '(ranging)'}

FIBONACCI (60-day swing):
High: $${priceMax.toFixed(2)} | Low: $${priceMin.toFixed(2)} | Range: $${priceRange.toFixed(2)}
23.6%=$${fib236.toFixed(2)} | 38.2%=$${fib382.toFixed(2)} | 50%=$${fib500.toFixed(2)} | 61.8%=$${fib618.toFixed(2)} | 78.6%=$${fib786.toFixed(2)}
Current retracement: ${retracePct.toFixed(1)}% from high

GAP: ${hasGap ? `⚠️ ${gapDir} gap $${gapSize.toFixed(2)} (${gapPct.toFixed(3)}%) — 75% of commodity gaps fill within 5 sessions` : '✅ No significant gap detected'}

FUNDAMENTAL:
DXY: ${fd.usdIndex.toFixed(2)} (${fd.usdIndexChange > 0 ? '+' : ''}${fd.usdIndexChange.toFixed(2)}%) → ${fd.usdIndexChange < 0 ? 'USD weakening = BULLISH gold' : 'USD strengthening = headwind'}
Fed Rate: ${fd.fedFundsRate.toFixed(2)}% | Real Yield: ${fd.realYield.toFixed(2)}% | CPI: ${fd.inflation.toFixed(1)}% | VIX: ${fd.vix.toFixed(1)}

RECENT PRICES (last 10 days):
${recentPrices.slice(-10).map((p: number, i: number) => `D${i + 1}:$${p.toFixed(0)}`).join(' ')}

Now produce valid JSON only. No extra text.`;

    // ── Call Gemini API (free tier — gemini-1.5-flash) ───────────────────────
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',  // Force JSON output mode
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ success: false, error: `Gemini API error ${geminiRes.status}` });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) throw new Error('Empty response from Gemini');

    // Strip accidental markdown fences (just in case)
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const prediction = JSON.parse(clean);

    // Ensure keyLevels always present
    if (!prediction.keyLevels) {
      prediction.keyLevels = {
        support:    [parseFloat(fib382.toFixed(2)), parseFloat(fib500.toFixed(2)), parseFloat(fib618.toFixed(2))],
        resistance: [parseFloat(fib236.toFixed(2)), parseFloat((currentPrice + atr).toFixed(2)), parseFloat(priceMax.toFixed(2))],
      };
    }

    return res.status(200).json({
      success: true,
      prediction: {
        ...prediction,
        instrument,
        currentPrice,
        timeframe,
        generatedAt: new Date().toISOString(),
        poweredBy: 'gemini-2.0-flash',
      },
    });

  } catch (err) {
    console.error('Predict handler error:', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}
