import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateExpertAnalyses } from '@/data/dynamicData';
import { useAIExperts } from '@/hooks/useAIExperts';
import { useRealNews } from '@/hooks/useRealNews';
import type { ExpertAnalysis, Signal, GoldInstrument } from '@/types/gold';
import { formatDistanceToNow, format } from 'date-fns';
import { Target, Shield, User, RefreshCw, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface ExpertAnalysisListProps {
  instrument?: GoldInstrument;
  goldPrice?: number;
  silverPrice?: number;
}

const signalColors: Record<Signal, string> = {
  'Strong Buy': 'bg-gain text-gain-foreground',
  'Buy': 'bg-gain/80 text-gain-foreground',
  'Neutral': 'bg-muted text-muted-foreground',
  'Sell': 'bg-loss/80 text-loss-foreground',
  'Strong Sell': 'bg-loss text-loss-foreground'
};

const formatPrice = (price: number): string => {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function ExpertCard({ expert, t }: { expert: ExpertAnalysis; t: (k: string) => string }) {
  return (
    <div className="p-4 rounded-lg border border-border hover:border-accent/50 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-accent/20 text-accent">
            {expert.expertName.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{expert.expertName}</p>
              <p className="text-xs text-muted-foreground">{expert.expertTitle}</p>
            </div>
            <Badge className={signalColors[expert.signal]}>
              {expert.signal}
            </Badge>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{expert.analysis}</p>

      <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-sm">
          <Target className="h-4 w-4 text-accent" />
          <span className="text-muted-foreground">{t('trade.target')}:</span>
          <span className="font-mono text-foreground">{formatPrice(expert.targetPrice)}</span>
        </div>
        {expert.stopLoss && (
          <div className="flex items-center gap-1.5 text-sm">
            <Shield className="h-4 w-4 text-loss" />
            <span className="text-muted-foreground">{t('trade.stop')}:</span>
            <span className="font-mono text-foreground">{formatPrice(expert.stopLoss)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{t('trade.accuracy')}:</span>
          <span className={`font-mono ${expert.accuracy >= 70 ? 'text-gain' : 'text-foreground'}`}>
            {expert.accuracy}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <Badge variant="outline" className="text-[10px]">{expert.instrument}</Badge>
        <span className="text-[10px] text-muted-foreground font-medium" title={expert.publishedAt.toString()}>
          {format(expert.publishedAt, 'dd MMM yyyy')} · {formatDistanceToNow(expert.publishedAt, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

export function ExpertAnalysisList({ instrument, goldPrice = 0, silverPrice = 0 }: ExpertAnalysisListProps) {
  const { t, language } = useI18n();
  const { news: realNews } = useRealNews(); // Get real RSS news
  const { experts, isLoading, isRealTime, refetch } = useAIExperts(goldPrice, silverPrice, realNews);

  const filteredExperts = instrument 
    ? experts.filter(e => e.instrument === instrument)
    : experts;

  const sortedExperts = [...filteredExperts].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('tab.experts')}
            {isRealTime && (
              <Badge variant="outline" className="bg-gain/10 text-gain border-gain/30 text-[10px] gap-1">
                <Wifi className="h-2.5 w-2.5" /> AI Live Sync
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={refetch}
              disabled={isLoading || goldPrice === 0}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {t('ui.refresh')}
            </Button>
            <Badge variant="outline">{sortedExperts.length} {t('trade.analysts')}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 relative min-h-0">
        <div className="absolute inset-0 px-6 pb-6 overflow-y-auto">
          <div className="space-y-4 pr-3">
            {sortedExperts.map(expert => (
              <ExpertCard key={expert.id} expert={expert} t={t} />
            ))}
          </div>

          {sortedExperts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
              No expert analysis available for this instrument.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

