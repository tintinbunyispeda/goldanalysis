import { useState, useCallback, useEffect } from 'react';
import type { ExpertAnalysis } from '@/types/gold';
import type { RealNewsItem } from '@/hooks/useRealNews';
import { generateExpertAnalyses } from '@/data/dynamicData';
import { useI18n } from '@/lib/i18n';

export function useAIExperts(
  goldPrice: number,
  silverPrice: number,
  realNews: RealNewsItem[]
) {
  const { language } = useI18n();
  const [experts, setExperts] = useState<ExpertAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRealTime, setIsRealTime] = useState(false);

  const fetchExperts = useCallback(async () => {
    if (goldPrice === 0) return;
    if (realNews.length === 0) {
      setExperts(generateExpertAnalyses(goldPrice, silverPrice, language));
      setIsRealTime(false);
      return;
    }
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback fallback
      setExperts(generateExpertAnalyses(goldPrice, silverPrice, language));
      return;
    }

    setIsLoading(true);
    try {
      // Prepare news context
      const newsContext = realNews.slice(0, 8).map(n => `- [${n.source}] ${n.title}: ${n.summary}`).join('\n');
      
      const prompt = `You are a financial analyst extracting actual expert opinions from the latest news.
Read the following recent news headlines/summaries about Gold.
Identify 3 to 5 financial institutions or experts (e.g., Goldman Sachs, JP Morgan, Peter Schiff, Fed officials, or named analysts) mentioned or implied in the current market context.
Generate a realistic "Expert Analysis" profile for each based on the prevailing sentiment in the news. 
If specific price targets are not in the news, estimate a mathematically realistic target based on the current price of $${goldPrice.toFixed(2)}.

Return ONLY a valid JSON array of objects with these exact keys:
[
  {
    "expertName": "Real Institution or Person Name",
    "expertTitle": "Title or Desk",
    "signal": "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell",
    "targetPrice": number (realistic target price),
    "timeframe": "1W" | "1M" | "3M" | "6M" | "1Y",
    "analysis": "2-3 sentences of professional analysis directly referencing the provided news context, in ${language === 'id' ? 'Indonesian' : 'English'}",
    "accuracy": number (random integer between 60 and 85)
  }
]

RECENT REAL NEWS:
${newsContext}
`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Invalid format");

      const mapped: ExpertAnalysis[] = parsed.map((e: any, i: number) => ({
        id: `ai-expert-${i}-${Date.now()}`,
        expertName: e.expertName || 'Anonymous Analyst',
        expertTitle: e.expertTitle || 'Market Analyst',
        instrument: 'XAU/USD',
        signal: e.signal || 'Neutral',
        targetPrice: e.targetPrice || goldPrice * 1.02,
        timeframe: e.timeframe || '1M',
        analysis: e.analysis || '',
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)), // within last 24h
        accuracy: e.accuracy || 70,
      }));

      setExperts(mapped);
      setIsRealTime(true);
      
    } catch (err) {
      console.warn("Failed to fetch AI experts, falling back to dynamicData:", err);
      setExperts(generateExpertAnalyses(goldPrice, silverPrice, language));
      setIsRealTime(false);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldPrice, silverPrice, language, realNews.length]);

  useEffect(() => {
    fetchExperts();
  }, [fetchExperts]);

  return { experts, isLoading, isRealTime, refetch: fetchExperts };
}
