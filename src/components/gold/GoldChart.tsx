import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GoldInstrument, OHLC } from '@/types/gold';
import {
  calculateAllIndicators,
  calculateEMASeries,
  calculateRSISeries,
  calculateMACDSeries,
  calculateBollingerSeries,
  calculateFibonacciLevels,
  generateSignal,
  calculateSMA
} from '@/lib/technicalIndicators';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, ComposedChart, Bar, ReferenceLine, Cell
} from 'recharts';
import { format } from 'date-fns';
import {
  TrendingUp, TrendingDown, Maximize2, BarChart2,
  LineChartIcon, CandlestickChart, Minus, Settings2
} from 'lucide-react';

interface GoldChartProps {
  instrument: GoldInstrument;
  livePrice?: number;
  ohlcData?: OHLC[];
  showIndicators?: {
    sma20?: boolean;
    sma50?: boolean;
    ema12?: boolean;
    ema26?: boolean;
    bollinger?: boolean;
    fibonacci?: boolean;
  };
}

type ChartType = 'area' | 'candle' | 'line';
type ChartPeriod = '3D' | '1W' | '1M' | '3M' | '6M' | '1Y';

const formatPrice = (price: number, _instrument: GoldInstrument): string => {
  return `$${price.toFixed(2)}`;
};

// Custom Candlestick component
const Candlestick = (props: any) => {
  const { x, width, payload, yScale } = props;
  if (!payload || yScale === undefined) return null;

  const isUp = payload.close >= payload.open;
  const color = isUp ? 'hsl(var(--gain))' : 'hsl(var(--loss))';
  const candleWidth = Math.max(width * 0.6, 2);

  const openY = yScale(payload.open);
  const closeY = yScale(payload.close);
  const highY = yScale(payload.high);
  const lowY = yScale(payload.low);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.abs(closeY - openY) || 1;

  return (
    <g>
      <line
        x1={x + width / 2} y1={highY}
        x2={x + width / 2} y2={lowY}
        stroke={color} strokeWidth={1}
      />
      <rect
        x={x + (width - candleWidth) / 2}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={isUp ? 'transparent' : color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

export function GoldChart({ instrument, livePrice, ohlcData = [], showIndicators = {} }: GoldChartProps) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [period, setPeriod] = useState<ChartPeriod>('1W');
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  const periodDays: Record<ChartPeriod, number> = {
    '3D': 3, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365
  };

  const indicators = useMemo(() => calculateAllIndicators(ohlcData), [ohlcData]);
  const currentPrice = livePrice || (ohlcData.length > 0 ? ohlcData[ohlcData.length - 1].close : 0);
  const signalResult = useMemo(() => generateSignal(indicators, currentPrice), [indicators, currentPrice]);

  // ── Pre-compute ALL series from full OHLC (before slicing for display) ──────
  // This prevents drift / accumulation errors in sub-slices
  const allSeries = useMemo(() => {
    if (ohlcData.length === 0) return null;
    const closes = ohlcData.map(d => d.close);
    return {
      ema12: calculateEMASeries(closes, 12),
      ema26: calculateEMASeries(closes, 26),
      sma20: closes.map((_, i) =>
        i >= 19 ? closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20 : null
      ),
      sma50: closes.map((_, i) =>
        i >= 49 ? closes.slice(i - 49, i + 1).reduce((a, b) => a + b, 0) / 50 : null
      ),
      rsi: calculateRSISeries(closes, 14),
      macd: calculateMACDSeries(closes),
      bollinger: calculateBollingerSeries(closes, 20)
    };
  }, [ohlcData]);

  // ── Fibonacci anchored to fixed 60-bar swing (stable across period changes) ──
  const fibLevels = useMemo(() => calculateFibonacciLevels(ohlcData, 60), [ohlcData]);

  // ── Chart data slice with pre-computed series values injected ────────────────
  const chartData = useMemo(() => {
    const days = Math.min(periodDays[period], ohlcData.length);
    const offset = ohlcData.length - days;
    const sliced = ohlcData.slice(-days);

    return sliced.map((candle, index) => {
      const gi = offset + index; // global index into full series
      const isLast = index === sliced.length - 1;
      const candleClose = isLast && livePrice ? livePrice : candle.close;
      const candleHigh = isLast && livePrice ? Math.max(candle.high, livePrice) : candle.high;
      const candleLow = isLast && livePrice ? Math.min(candle.low, livePrice) : candle.low;

      return {
        date: format(candle.date, 'MMM dd'),
        fullDate: format(candle.date, 'MMM dd, yyyy'),
        price: candleClose,
        high: candleHigh,
        low: candleLow,
        open: candle.open,
        close: candleClose,
        volume: candle.volume,
        isUp: candleClose >= candle.open,
        // Overlays from pre-computed series
        sma20: allSeries?.sma20[gi] ?? null,
        sma50: allSeries?.sma50[gi] ?? null,
        ema12: allSeries?.ema12[gi] ?? null,
        ema26: allSeries?.ema26[gi] ?? null,
        upperBand: allSeries?.bollinger.upper[gi] ?? null,
        lowerBand: allSeries?.bollinger.lower[gi] ?? null,
        midBand: allSeries?.bollinger.middle[gi] ?? null,
        rsi: allSeries?.rsi[gi] ?? null,
        macdLine: allSeries?.macd.macd[gi] ?? null,
        macdSignal: allSeries?.macd.signal[gi] ?? null,
        macdHist: allSeries?.macd.histogram[gi] ?? null
      };
    });
  }, [ohlcData, period, livePrice, allSeries]);

  const priceChange = chartData.length >= 2
    ? chartData[chartData.length - 1].price - chartData[0].price
    : 0;
  const priceChangePercent = chartData.length >= 2
    ? (priceChange / chartData[0].price) * 100
    : 0;

  const signalColor = {
    'Strong Buy': 'bg-gain text-gain-foreground',
    'Buy': 'bg-gain/80 text-gain-foreground',
    'Neutral': 'bg-muted text-muted-foreground',
    'Sell': 'bg-loss/80 text-loss-foreground',
    'Strong Sell': 'bg-loss text-loss-foreground'
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="text-sm font-medium text-foreground mb-2">{data.fullDate}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">O:</span>
          <span className="font-mono">{formatPrice(data.open, instrument)}</span>
          <span className="text-muted-foreground">H:</span>
          <span className="font-mono text-gain">{formatPrice(data.high, instrument)}</span>
          <span className="text-muted-foreground">L:</span>
          <span className="font-mono text-loss">{formatPrice(data.low, instrument)}</span>
          <span className="text-muted-foreground">C:</span>
          <span className={`font-mono ${data.isUp ? 'text-gain' : 'text-loss'}`}>
            {formatPrice(data.close, instrument)}
          </span>
        </div>
        {/* EMA values in tooltip */}
        {(data.ema12 != null || data.ema26 != null) && (
          <div className="mt-1 pt-1 border-t border-border space-y-0.5">
            {data.ema12 != null && (
              <div><span className="text-muted-foreground">EMA12: </span>
                <span className="font-mono text-accent">{formatPrice(data.ema12, instrument)}</span>
              </div>
            )}
            {data.ema26 != null && (
              <div><span className="text-muted-foreground">EMA26: </span>
                <span className="font-mono" style={{ color: 'hsl(var(--warning))' }}>{formatPrice(data.ema26, instrument)}</span>
              </div>
            )}
          </div>
        )}
        {data.rsi != null && (
          <div className="mt-1 pt-1 border-t border-border">
            <span className="text-muted-foreground">RSI: </span>
            <span className={`font-mono ${data.rsi > 70 ? 'text-loss' : data.rsi < 30 ? 'text-gain' : 'text-foreground'}`}>
              {data.rsi.toFixed(1)}
            </span>
          </div>
        )}
        {data.macdLine != null && (
          <div>
            <span className="text-muted-foreground">MACD: </span>
            <span className={`font-mono ${(data.macdHist ?? 0) > 0 ? 'text-gain' : 'text-loss'}`}>
              {data.macdLine.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const mainChartHeight = showRSI || showMACD ? 280 : 400;
  const subChartHeight = 100;

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{instrument}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold">
                {formatPrice(currentPrice, instrument)}
              </span>
              <span className={`flex items-center gap-1 text-sm font-mono ${priceChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={signalColor[signalResult.signal]}>
              {signalResult.signal}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Score: {signalResult.score}/100
            </span>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {(['3D', '1W', '1M', '3M', '6M', '1Y'] as ChartPeriod[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPeriod(p)}
              >
                {p}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <Button variant={chartType === 'area' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setChartType('area')}>
              <BarChart2 className="h-4 w-4" />
            </Button>
            <Button variant={chartType === 'line' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setChartType('line')}>
              <LineChartIcon className="h-4 w-4" />
            </Button>
            <Button variant={chartType === 'candle' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setChartType('candle')}>
              <CandlestickChart className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Indicator Legend */}
        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Settings2 className="h-3.5 w-3.5" />
            Indicators:
          </span>
          <div className="flex items-center gap-3 border-r border-border pr-3">
            {showIndicators.sma20 && (
              <Badge variant="outline" className="text-[10px] bg-gain/10 text-gain border-gain/30 cursor-default">
                <div className="w-2 h-0.5 bg-gain mr-1" /> SMA20
              </Badge>
            )}
            {showIndicators.sma50 && (
              <Badge variant="outline" className="text-[10px] bg-loss/10 text-loss border-loss/30 cursor-default">
                <div className="w-2 h-0.5 bg-loss mr-1" /> SMA50
              </Badge>
            )}
            {showIndicators.ema12 && (
              <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30 cursor-default">
                <div className="w-2 h-0.5 bg-accent mr-1" /> EMA12
              </Badge>
            )}
            {showIndicators.ema26 && (
              <Badge variant="outline" className="text-[10px] cursor-default" style={{ color: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning) / 0.3)', background: 'hsl(var(--warning) / 0.1)' }}>
                <div className="w-2 h-0.5 mr-1" style={{ background: 'hsl(var(--warning))' }} /> EMA26
              </Badge>
            )}
            {showIndicators.bollinger && (
              <Badge variant="outline" className="text-[10px] cursor-default">
                <div className="w-2 h-0.5 bg-muted-foreground mr-1" /> BB(20)
              </Badge>
            )}
            {showIndicators.fibonacci && (
              <Badge variant="outline" className="text-[10px] cursor-default" style={{ color: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning) / 0.3)', background: 'hsl(var(--warning) / 0.1)' }}>
                Fib (60d)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRSI(!showRSI)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${showRSI ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              RSI(14)
            </button>
            <button
              onClick={() => setShowMACD(!showMACD)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${showMACD ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              MACD
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Main Price Chart */}
        <div style={{ height: mainChartHeight }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bollingerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => v.toFixed(0)}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* ── Fibonacci Levels (60-day anchored, stable across period changes) ── */}
              {showIndicators.fibonacci && (
                <>
                  <ReferenceLine y={fibLevels.fib0}    stroke="hsl(var(--warning))" strokeWidth={1} strokeOpacity={0.4} label={{ value: '0% (High)', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                  <ReferenceLine y={fibLevels.fib236}  stroke="hsl(var(--warning))" strokeDasharray="5 3" strokeOpacity={0.7} label={{ value: '23.6%', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                  <ReferenceLine y={fibLevels.fib382}  stroke="hsl(var(--warning))" strokeDasharray="5 3" strokeOpacity={0.85} label={{ value: '38.2%', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                  <ReferenceLine y={fibLevels.fib500}  stroke="hsl(var(--warning))" strokeDasharray="3 3" strokeOpacity={1.0}  strokeWidth={1.5} label={{ value: '50.0%', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                  <ReferenceLine y={fibLevels.fib618}  stroke="hsl(var(--warning))" strokeDasharray="5 3" strokeOpacity={0.85} label={{ value: '61.8% ★', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                  <ReferenceLine y={fibLevels.fib786}  stroke="hsl(var(--warning))" strokeDasharray="5 3" strokeOpacity={0.7} label={{ value: '78.6%', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                  <ReferenceLine y={fibLevels.fib1000} stroke="hsl(var(--warning))" strokeWidth={1} strokeOpacity={0.4} label={{ value: '100% (Low)', position: 'right', fill: 'hsl(var(--warning))', fontSize: 9 }} />
                </>
              )}

              {/* ── Bollinger Bands (series-based) ── */}
              {showIndicators.bollinger && (
                <>
                  <Area type="monotone" dataKey="upperBand" stroke="none" fill="url(#bollingerGradient)" fillOpacity={1} />
                  <Line type="monotone" dataKey="upperBand" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1} dot={false} strokeOpacity={0.6} />
                  <Line type="monotone" dataKey="midBand"   stroke="hsl(var(--muted-foreground))" strokeDasharray="8 4" strokeWidth={1} dot={false} strokeOpacity={0.3} />
                  <Line type="monotone" dataKey="lowerBand" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1} dot={false} strokeOpacity={0.6} />
                </>
              )}

              {/* ── Price ── */}
              {chartType === 'area' && (
                <Area type="monotone" dataKey="price" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#priceGradient)" dot={false} />
              )}
              {chartType === 'line' && (
                <Line type="monotone" dataKey="price" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              )}
              {chartType === 'candle' && (
                <Bar
                  dataKey="high"
                  fill="transparent"
                  shape={(props: any) => {
                    const { x, y, width, payload, index } = props;
                    if (!payload) return null;
                    const minPrice = Math.min(...chartData.map(d => d.low));
                    const maxPrice = Math.max(...chartData.map(d => d.high));
                    const chartH = mainChartHeight - 30;
                    const yScale = (price: number) => ((maxPrice - price) / (maxPrice - minPrice)) * chartH + 10;
                    return <Candlestick key={index} x={x} y={y} width={width} height={0} payload={payload} yScale={yScale} />;
                  }}
                />
              )}

              {/* ── Moving Averages ── */}
              {showIndicators.sma20 && (
                <Line type="monotone" dataKey="sma20" stroke="hsl(var(--gain))" strokeWidth={1.5} dot={false} name="SMA 20" connectNulls={false} />
              )}
              {showIndicators.sma50 && (
                <Line type="monotone" dataKey="sma50" stroke="hsl(var(--loss))" strokeWidth={1.5} dot={false} name="SMA 50" connectNulls={false} />
              )}

              {/* ── EMA Lines (series-based, accurate) ── */}
              {showIndicators.ema12 && (
                <Line type="monotone" dataKey="ema12" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} name="EMA 12" strokeDasharray="4 2" connectNulls={false} />
              )}
              {showIndicators.ema26 && (
                <Line type="monotone" dataKey="ema26" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} name="EMA 26" strokeDasharray="4 2" connectNulls={false} />
              )}

              {/* Current Price Reference */}
              <ReferenceLine y={currentPrice} stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeOpacity={0.35} label={{ value: `$${currentPrice.toFixed(0)}`, position: 'left', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* RSI Sub-Chart — Wilder-smoothed */}
        {showRSI && (
          <div className="mt-1 border-t border-border pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground font-medium">RSI (14) — Wilder Smoothed</span>
              <span className={`text-[10px] font-mono ${(chartData[chartData.length - 1]?.rsi ?? 50) > 70 ? 'text-loss' :
                (chartData[chartData.length - 1]?.rsi ?? 50) < 30 ? 'text-gain' : 'text-foreground'
                }`}>
                {(chartData[chartData.length - 1]?.rsi ?? 0).toFixed(1)}
              </span>
            </div>
            <div style={{ height: subChartHeight }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={false} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={60} ticks={[20, 30, 50, 70, 80]} />
                  <ReferenceLine y={70} stroke="hsl(var(--loss))" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '70', position: 'right', fill: 'hsl(var(--loss))', fontSize: 8 }} />
                  <ReferenceLine y={50} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <ReferenceLine y={30} stroke="hsl(var(--gain))" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '30', position: 'right', fill: 'hsl(var(--gain))', fontSize: 8 }} />
                  <Area type="monotone" dataKey="rsi" stroke="hsl(var(--accent))" strokeWidth={1.5} fill="hsl(var(--accent))" fillOpacity={0.1} dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* MACD Sub-Chart — full series-based signal line */}
        {showMACD && (
          <div className="mt-1 border-t border-border pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground font-medium">MACD (12, 26, 9)</span>
              <span className={`text-[10px] font-mono ${(chartData[chartData.length - 1]?.macdHist ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                {(chartData[chartData.length - 1]?.macdLine ?? 0).toFixed(4)}
              </span>
            </div>
            <div style={{ height: subChartHeight }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={false} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={60} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                  <Bar dataKey="macdHist" maxBarSize={4}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={(entry.macdHist ?? 0) >= 0 ? 'hsl(var(--gain))' : 'hsl(var(--loss))'} fillOpacity={0.6} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="macdLine"   stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="macdSignal" stroke="hsl(var(--loss))"   strokeWidth={1}   dot={false} strokeDasharray="3 3" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Signal Reasons */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {signalResult.reasons.slice(0, 5).map((reason, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
