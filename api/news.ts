import type { VercelRequest, VercelResponse } from '@vercel/node';

// Proxy to fetch real gold news from RSS feeds via rss2json.com
// rss2json.com is a free CORS-friendly RSS-to-JSON service
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // cache 5 min
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const RSS_FEEDS = [
      {
        url: 'https://www.kitco.com/rss/kitco_news.rss',
        source: 'Kitco News',
        baseUrl: 'https://www.kitco.com',
      },
      {
        url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',
        source: 'MarketWatch',
        baseUrl: 'https://www.marketwatch.com',
      },
    ];

    const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json';

    const allItems: any[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const resp = await fetch(
          `${RSS2JSON_BASE}?rss_url=${encodeURIComponent(feed.url)}&api_key=free&count=10`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data.status !== 'ok' || !data.items?.length) continue;

        for (const item of data.items) {
          const title: string = item.title || '';
          const link: string = item.link || feed.baseUrl;
          const pubDate: string = item.pubDate || new Date().toISOString();
          const description: string = stripHtml(item.description || item.content || '');

          // Basic gold relevance filter
          const text = (title + ' ' + description).toLowerCase();
          const goldTerms = ['gold', 'silver', 'xau', 'xag', 'precious metal', 'bullion', 'commodity', 'fed', 'inflation', 'rate', 'dollar'];
          const isRelevant = goldTerms.some(t => text.includes(t));
          if (!isRelevant) continue;

          allItems.push({
            title,
            link,
            pubDate,
            summary: description.slice(0, 180),
            source: feed.source,
          });
        }
      } catch {
        // silently skip failed feeds
      }
    }

    // Sort by date desc, take top 10
    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    const top = allItems.slice(0, 10);

    return res.status(200).json({ success: true, items: top });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
