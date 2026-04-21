import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { generateNews } from '@/data/dynamicData';
import { useRealNews, type RealNewsItem } from '@/hooks/useRealNews';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Newspaper, TrendingUp, TrendingDown, Minus,
  Globe, Shield, BarChart3, Users, RefreshCw,
  ExternalLink, Wifi, WifiOff, Loader2,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const sentimentStyles = {
  Bullish: { icon: TrendingUp,   color: 'text-gain',             bg: 'bg-gain/10 border-gain/30' },
  Bearish: { icon: TrendingDown, color: 'text-loss',             bg: 'bg-loss/10 border-loss/30' },
  Neutral: { icon: Minus,        color: 'text-muted-foreground', bg: 'bg-muted border-border' },
};

const categoryIcons: Record<string, React.ElementType> = {
  Market:       BarChart3,
  Geopolitical: Globe,
  Macro:        Shield,
  Demand:       Users,
};

type FilterCategory = 'All' | 'Market' | 'Geopolitical' | 'Macro' | 'Demand';

interface NewsSentimentProps {
  goldPrice?: number;
  silverPrice?: number;
  changePct?: number;
}

function NewsCard({ news, t }: { news: RealNewsItem; t: (k: string) => string }) {
  const sentiment = news.sentiment as keyof typeof sentimentStyles;
  const style     = sentimentStyles[sentiment];
  const SentimentIcon  = style.icon;
  const CategoryIcon   = categoryIcons[news.category] || Newspaper;

  return (
    <div className={`p-3 rounded-lg border transition-all hover:border-accent/40 hover:shadow-sm ${style.bg}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Badge variant="outline" className="text-[10px] h-5">{news.source}</Badge>
          <Badge variant="outline" className="text-[10px] h-5 bg-accent/10 text-accent border-accent/30">
            {t(`cat.${news.category.toLowerCase()}`)}
          </Badge>
          <span className="text-[10px] text-muted-foreground" title={format(news.publishedAt, 'PPpp')}>
            {format(news.publishedAt, 'MMM d')} · {format(news.publishedAt, 'HH:mm')} ({formatDistanceToNow(news.publishedAt, { addSuffix: true })})
          </span>
        </div>
        <div className={`flex items-center gap-1 ${style.color} shrink-0`}>
          <SentimentIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-medium">{t(`anal.${news.sentiment.toLowerCase()}`)}</span>
        </div>
      </div>

      {/* Title — real headline, no AI generation */}
      <h4 className="text-sm font-semibold text-foreground leading-snug mb-1 line-clamp-2">
        {news.title}
      </h4>

      {/* Summary */}
      {news.summary && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{news.summary}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <Badge variant="outline" className="text-[10px]">
          {t('trade.impact')}: {t(`anal.${news.impact.toLowerCase()}`)}
        </Badge>
        <a
          href={news.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-accent hover:underline font-medium"
        >
          <ExternalLink className="h-3 w-3" />
          Baca di {news.source}
        </a>
      </div>
    </div>
  );
}

export function NewsSentiment({ goldPrice = 0, silverPrice = 0, changePct = 0 }: NewsSentimentProps) {
  const { t, language } = useI18n();
  const [filter, setFilter] = useState<FilterCategory>('All');

  // ── Real news from RSS feeds ──────────────────────────────────────────────
  const { news: realNews, isLoading, error, lastFetched, refetch } = useRealNews();

  // ── Fallback: generated news when real fetch fails ─────────────────────────
  const fallbackNews: RealNewsItem[] = generateNews(goldPrice, silverPrice, changePct, language).map(n => ({
    ...n,
    sourceUrl: n.sourceUrl || '#',
  }));

  const allNews: RealNewsItem[] = realNews.length > 0 ? realNews : fallbackNews;

  const filteredNews = filter === 'All'
    ? allNews
    : allNews.filter(n => n.category === filter);

  const bullishCount = allNews.filter(n => n.sentiment === 'Bullish').length;
  const bearishCount = allNews.filter(n => n.sentiment === 'Bearish').length;
  const total        = allNews.length;
  const sentimentScore = total > 0 ? Math.round((bullishCount / total) * 100) : 50;
  const geoCount     = allNews.filter(n => n.category === 'Geopolitical').length;
  const isRealData   = realNews.length > 0;

  const filters: { value: FilterCategory; labelKey: string; icon?: React.ElementType }[] = [
    { value: 'All',          labelKey: 'cat.all' },
    { value: 'Geopolitical', labelKey: 'cat.geopolitical', icon: Globe },
    { value: 'Macro',        labelKey: 'cat.macro',        icon: Shield },
    { value: 'Demand',       labelKey: 'cat.demand',       icon: Users },
    { value: 'Market',       labelKey: 'cat.market',       icon: BarChart3 },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Newspaper className="h-5 w-5 text-accent" />
            {t('tab.news')}
            {isRealData && (
              <Badge variant="outline" className="bg-gain/10 text-gain border-gain/30 text-[10px] gap-1">
                <Wifi className="h-2.5 w-2.5" /> Live
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={refetch}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {t('ui.refresh')}
            </Button>

            {/* Bull/Bear counts */}
            <div className="flex items-center gap-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-gain" />
              <span className="text-muted-foreground">{bullishCount}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-loss" />
              <span className="text-muted-foreground">{bearishCount}</span>
            </div>
          </div>
        </div>

        {/* Last fetched time */}
        {lastFetched && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Diperbarui {formatDistanceToNow(lastFetched, { addSuffix: true })} · {allNews.length} artikel dari Kitco &amp; MarketWatch
          </p>
        )}

        {/* Sentiment Gauge */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{t('anal.bearish')}</span>
            <span className="font-medium text-foreground">Sentiment: {sentimentScore}%</span>
            <span>{t('anal.bullish')}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            <div className="bg-loss h-full transition-all" style={{ width: `${100 - sentimentScore}%` }} />
            <div className="bg-gain h-full transition-all" style={{ width: `${sentimentScore}%` }} />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 mt-3 flex-wrap">
          {filters.map(f => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => setFilter(f.value)}
            >
              {f.icon && <f.icon className="h-3 w-3" />}
              {t(f.labelKey)} {f.value === 'Geopolitical' ? `(${geoCount})` : ''}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {isLoading && realNews.length === 0 && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Memuat berita terbaru dari Kitco &amp; MarketWatch…</span>
          </div>
        )}

        {/* Error note removed to make fallback silent */}

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredNews.map(n => (
            <NewsCard key={n.id} news={n} t={t} />
          ))}
          {filteredNews.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada berita di kategori ini</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}