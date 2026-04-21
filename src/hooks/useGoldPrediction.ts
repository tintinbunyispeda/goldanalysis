import { useState, useEffect, useCallback, useRef } from 'react';
import type { GoldPrediction, GoldInstrument, Timeframe, OHLC } from '@/types/gold';
import { getGoldPrediction } from '@/lib/api/goldPrediction';
import { calculateAllIndicators } from '@/lib/technicalIndicators';
import { fundamentalIndicators } from '@/data/mockGoldData';
import { useToast } from '@/hooks/use-toast';

export function useGoldPrediction(
  instrument: GoldInstrument,
  timeframe: Timeframe,
  livePrice?: number,
  ohlcData: OHLC[] = []
) {
  const [prediction, setPrediction] = useState<GoldPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Track previous OHLC length to avoid regenerating on micro price ticks
  const prevOhlcLengthRef = useRef(0);

  const generatePrediction = useCallback(async () => {
    if (!ohlcData || ohlcData.length < 30) {
      setError('Insufficient historical data (need at least 30 bars)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const technicalData = calculateAllIndicators(ohlcData);
      const currentPrice = livePrice || ohlcData[ohlcData.length - 1].close;

      // Pass 60 candles of price history for richer trend context
      const recentPrices = ohlcData.slice(-60).map(d => d.close);

      const result = await getGoldPrediction({
        instrument,
        currentPrice,
        technicalData,
        fundamentalData: fundamentalIndicators,
        recentPrices,
        timeframe
      });

      setPrediction(result);
      prevOhlcLengthRef.current = ohlcData.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate prediction';
      setError(message);
      toast({
        title: 'Prediction Error',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [instrument, timeframe, livePrice, ohlcData, toast]);

  return {
    prediction,
    isLoading,
    error,
    generatePrediction
  };
}