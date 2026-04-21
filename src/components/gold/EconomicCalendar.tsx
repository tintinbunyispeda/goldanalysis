import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { generateEconomicCalendar } from '@/data/dynamicData';
import type { EconomicEvent, EventImpact } from '@/types/gold';
import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const impactStyles: Record<EventImpact, string> = {
  'High': 'bg-loss text-loss-foreground',
  'Medium': 'bg-yellow-500 text-black',
  'Low': 'bg-muted text-muted-foreground'
};

const impactDots: Record<EventImpact, string> = {
  'High': 'bg-loss',
  'Medium': 'bg-yellow-500',
  'Low': 'bg-muted-foreground'
};

function EventCard({ event, t }: { event: EconomicEvent; t: (k: string) => string }) {
  const isEventToday    = isToday(event.date);
  const isEventTomorrow = isTomorrow(event.date);
  const dayLabel = isEventToday
    ? t('time.today')
    : isEventTomorrow
      ? t('time.tomorrow')
      : null;
  const fullDate = format(event.date, 'EEE, MMM d, yyyy');

  return (
    <div className="p-4 rounded-lg border border-border hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={impactStyles[event.impact]} variant="secondary">
            {t(`anal.${event.impact.toLowerCase()}`)}
          </Badge>
          <Badge variant="outline">{event.country}</Badge>
        </div>
        <div className="text-right">
          {dayLabel && (
            <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${isEventToday ? 'text-loss' : 'text-accent'}`}>
              {dayLabel}
            </p>
          )}
          <p className="text-sm font-medium text-foreground">{fullDate}</p>
          <p className="text-xs text-muted-foreground">{event.time}</p>
        </div>
      </div>
      
      <h4 className="font-semibold text-foreground mb-1">{event.title}</h4>
      <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
      
      {(event.previous || event.forecast) && (
        <div className="flex gap-4 pt-2 border-t border-border">
          {event.previous && (
            <div>
              <p className="text-xs text-muted-foreground">{t('trade.previous')}</p>
              <p className="font-mono text-sm">{event.previous}</p>
            </div>
          )}
          {event.forecast && (
            <div>
              <p className="text-xs text-muted-foreground">{t('trade.forecast')}</p>
              <p className="font-mono text-sm text-accent">{event.forecast}</p>
            </div>
          )}
          {event.actual && (
            <div>
              <p className="text-xs text-muted-foreground">{t('trade.actual')}</p>
              <p className="font-mono text-sm font-bold">{event.actual}</p>
            </div>
          )}
        </div>
      )}

      {/* Source link */}
      {event.sourceUrl && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline font-medium w-fit"
          >
            <ExternalLink className="h-3 w-3" />
            Lihat di {
              event.sourceUrl.includes('federalreserve.gov') ? 'Federal Reserve' :
              event.sourceUrl.includes('forexfactory') ? 'Forex Factory' :
              event.sourceUrl.includes('gold.org') ? 'World Gold Council' :
              'Investing.com'
            }
          </a>
        </div>
      )}
    </div>
  );
}

export function EconomicCalendar() {
  const { t, language } = useI18n();
  const [filter, setFilter] = useState<'all' | 'high'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const events = useMemo(() => generateEconomicCalendar(language), [refreshKey, language]);

  const filteredEvents = events
    .filter(e => filter === 'all' || e.impact === 'High')
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const upcomingHigh = events.filter(e => 
    e.impact === 'High' && e.date >= new Date()
  ).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('tab.calendar')}
            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-[10px]">
              {t('ui.live')}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 h-7 px-2 text-xs border border-border rounded hover:bg-muted transition-colors"
              onClick={() => setRefreshKey(k => k + 1)}
            >
              <RefreshCw className="h-3 w-3" />
              {t('ui.refresh')}
            </button>
            {upcomingHigh > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {upcomingHigh} {t('anal.high')} {t('trade.impact')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('all')}
          >
            {t('cat.all')}
          </Button>
          <Button 
            variant={filter === 'high' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('high')}
          >
            {t('anal.high')} {t('trade.impact')}
          </Button>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {filteredEvents.map(event => (
            <EventCard key={event.id} event={event} t={t} />
          ))}
        </div>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">{t('trade.impact')}:</span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${impactDots['High']}`} />
                <span>{t('anal.high')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${impactDots['Medium']}`} />
                <span>{t('anal.medium')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${impactDots['Low']}`} />
                <span>{t('anal.low')}</span>
              </div>
            </div>
            {/* Full calendar link */}
            <a
              href="https://www.forexfactory.com/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-accent hover:underline font-medium shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
              Kalender Lengkap
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

