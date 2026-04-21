/**
 * useRealNews — fetches REAL gold news from Kitco + Reuters RSS feeds
 * via rss2json.com (free, no API key needed for basic usage)
 * Falls back to generated news if fetch fails.
 */
import { useState, useCallback, useEffect } from 'react';

export interface RealNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;   // link to original article
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  impact: 'High' | 'Medium' | 'Low';
  category: 'Market' | 'Geopolitical' | 'Macro' | 'Demand';
  publishedAt: Date;
}

// Classify news sentiment based on keywords in title
function classifySentiment(title: string): 'Bullish' | 'Bearish' | 'Neutral' {
  const t = title.toLowerCase();
  const bullishWords = ['rise', 'rises', 'rise', 'gain', 'gains', 'rally', 'rallies', 'surge', 'surges', 'high', 'higher', 'up', 'bullish', 'buy', 'demand', 'safe-haven', 'safe haven', 'record', 'soar', 'soars'];
  const bearishWords = ['fall', 'falls', 'drop', 'drops', 'decline', 'declines', 'slide', 'slides', 'lower', 'down', 'bearish', 'sell', 'pressure', 'weakness', 'tumble'];
  const bullScore = bullishWords.filter(w => t.includes(w)).length;
  const bearScore = bearishWords.filter(w => t.includes(w)).length;
  if (bullScore > bearScore) return 'Bullish';
  if (bearScore > bullScore) return 'Bearish';
  return 'Neutral';
}

// Classify impact based on keywords
function classifyImpact(title: string): 'High' | 'Medium' | 'Low' {
  const t = title.toLowerCase();
  const highWords = ['fed', 'federal reserve', 'fomc', 'cpi', 'inflation', 'rate', 'nfp', 'payroll', 'war', 'war', 'central bank', 'recession', 'crash', 'record'];
  const isHigh = highWords.some(w => t.includes(w));
  if (isHigh) return 'High';
  return 'Medium';
}

// Classify category
function classifyCategory(title: string): 'Market' | 'Geopolitical' | 'Macro' | 'Demand' {
  const t = title.toLowerCase();
  if (['war', 'conflict', 'geopolit', 'sanction', 'ukraine', 'middle east', 'china', 'russia', 'tariff'].some(w => t.includes(w))) return 'Geopolitical';
  if (['fed', 'fomc', 'cpi', 'inflation', 'rate', 'gdp', 'recession', 'treasury', 'yield', 'dollar'].some(w => t.includes(w))) return 'Macro';
  if (['demand', 'import', 'mine', 'supply', 'etf', 'central bank', 'jewel'].some(w => t.includes(w))) return 'Demand';
  return 'Market';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RSSFeed {
  url: string;
  source: string;
  baseUrl: string;
}

const FEEDS: RSSFeed[] = [
  {
    // Kitco News — largest dedicated gold news site, reliable RSS
    url: 'https://www.kitco.com/rss/news.rss',
    source: 'Kitco News',
    baseUrl: 'https://www.kitco.com',
  },
  {
    // MarketWatch top stories RSS — official MW feed
    url: 'https://www.marketwatch.com/rss/topstories',
    source: 'MarketWatch',
    baseUrl: 'https://www.marketwatch.com',
  },
  {
    // Seeking Alpha commodity news RSS
    url: 'https://seekingalpha.com/feed/tag/gold.xml',
    source: 'Seeking Alpha',
    baseUrl: 'https://seekingalpha.com',
  },
];

async function fetchFeed(feed: RSSFeed): Promise<RealNewsItem[]> {
  const encodedUrl = encodeURIComponent(feed.url);
  const resp = await fetch(
    `/api/rss2json/v1/api.json?rss_url=${encodedUrl}&count=8`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!resp.ok) throw new Error(`rss2json HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('Invalid rss2json response');

  return data.items
    .map((item: any, i: number) => {
      const title: string = stripHtml(item.title || '');
      const link: string = item.link || item.guid || feed.baseUrl;
      const pubDate: string = item.pubDate || new Date().toISOString();
      const rawDesc: string = stripHtml(item.description || item.content || '');
      const summary = rawDesc.slice(0, 200) + (rawDesc.length > 200 ? '…' : '');

      // Gold relevance check
      const text = (title + ' ' + rawDesc).toLowerCase();
      const goldTerms = ['gold', 'silver', 'xau', 'xag', 'precious', 'bullion', 'commodity', 'fed', 'inflation', 'rate cut', 'rate hike', 'dollar', 'treasury', 'safe haven'];
      if (!goldTerms.some(t => text.includes(t))) return null;

      return {
        id: `real-${feed.source}-${i}-${Date.now()}`,
        title,
        summary,
        source: feed.source,
        sourceUrl: link,
        sentiment: classifySentiment(title),
        impact: classifyImpact(title),
        category: classifyCategory(title),
        publishedAt: new Date(pubDate),
      } as RealNewsItem;
    })
    .filter(Boolean) as RealNewsItem[];
}

export function useRealNews() {
  const [news, setNews] = useState<RealNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(FEEDS.map(fetchFeed));
      const allItems: RealNewsItem[] = [];

      for (const r of results) {
        if (r.status === 'fulfilled') allItems.push(...r.value);
        else console.warn('RSS feed failed:', r.reason);
      }

      if (allItems.length === 0) {
        throw new Error('No gold news found from any RSS feed');
      }

      // Sort by date desc, deduplicate by similar titles
      allItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      // Basic deduplication: remove items with very similar titles
      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        const key = item.title.toLowerCase().slice(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setNews(deduped.slice(0, 12));
      setLastFetched(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch news';
      setError(msg);
      console.warn('Real news fetch failed:', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and every 10 minutes
  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return { news, isLoading, error, lastFetched, refetch: fetchNews };
}
