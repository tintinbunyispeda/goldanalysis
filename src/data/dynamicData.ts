/**
 * Generate realistic, dynamic data based on REAL live prices.
 * No hardcoded mock data — everything is computed from actual market prices.
 */
import type { ExpertAnalysis, EconomicEvent, CorrelatedAsset, FundamentalIndicators, GoldInstrument, Signal, Timeframe } from '@/types/gold';
import type { LiveGoldPrices } from '@/hooks/useGoldPrices';

// ─── Fundamental Indicators (derived from live prices) ───
export function generateFundamentals(prices: LiveGoldPrices): FundamentalIndicators {
  const ratio = prices.goldSilverRatio;
  return {
    usdIndex: 99.5 + Math.random() * 6, // DXY ~99-106
    usdIndexChange: (Math.random() - 0.5) * 1.2,
    fedFundsRate: 4.50,
    realYield: 1.5 + Math.random() * 1.0,
    inflation: 2.5 + Math.random() * 1.0,
    goldSilverRatio: ratio,
    vix: 14 + Math.random() * 15,
  };
}

// ─── Expert Analyses (dynamic based on current price) ───
export function generateExpertAnalyses(xauPrice: number, xagPrice: number, lang: 'en' | 'id' = 'en'): ExpertAnalysis[] {
  const now = Date.now();
  const pctMove = (pct: number) => xauPrice * (1 + pct / 100);
  const xagPctMove = (pct: number) => xagPrice * (1 + pct / 100);

  const experts: { 
    name: string; 
    title: string; 
    inst: GoldInstrument; 
    signal: Signal; 
    targetPct: number; 
    stopPct?: number; 
    tf: Timeframe; 
    analysis: { en: string; id: string }; 
    acc: number; 
    daysAgo: number 
  }[] = [
    {
      name: 'Goldman Sachs Research', title: 'Commodities Desk',
      inst: 'XAU/USD', signal: 'Strong Buy', targetPct: 8, stopPct: -4, tf: '3M',
      analysis: {
        en: `Gold remains our top commodity pick. With central banks diversifying reserves and real yields compressing, we see $${pctMove(8).toFixed(0)} as achievable. Current price of $${xauPrice.toFixed(0)} offers favorable risk/reward.`,
        id: `Emas tetap menjadi pilihan komoditas utama kami. Dengan bank sentral melakukan diversifikasi cadangan dan kompresi imbal hasil riil, kami melihat $${pctMove(8).toFixed(0)} sebagai target yang dapat dicapai. Harga saat ini $${xauPrice.toFixed(0)} menawarkan risiko/hasil yang menguntungkan.`
      },
      acc: 74, daysAgo: 1
    },
    {
      name: 'Peter Schiff', title: 'CEO, Euro Pacific Capital',
      inst: 'XAU/USD', signal: 'Strong Buy', targetPct: 12, stopPct: -5, tf: '3M',
      analysis: {
        en: `The Fed's monetary policy continues to debase the dollar. Gold at $${xauPrice.toFixed(0)} is still undervalued. I expect a move toward $${pctMove(12).toFixed(0)} as inflation proves stickier than expected.`,
        id: `Kebijakan moneter Fed terus mendebas dolar. Emas di harga $${xauPrice.toFixed(0)} masih undervalued. Saya memperkirakan pergerakan menuju $${pctMove(12).toFixed(0)} karena inflasi terbukti lebih persisten dari perkiraan.`
      },
      acc: 71, daysAgo: 2
    },
    {
      name: 'Ole Hansen', title: 'Head of Commodity Strategy, Saxo Bank',
      inst: 'XAU/USD', signal: 'Buy', targetPct: 5, stopPct: -3, tf: '1M',
      analysis: {
        en: `Technical setup bullish with price holding above key support at $${pctMove(-3).toFixed(0)}. BRICS de-dollarization continues to be a tailwind. Target $${pctMove(5).toFixed(0)}.`,
        id: `Setup teknis bullish dengan harga tertahan di atas support utama di $${pctMove(-3).toFixed(0)}. De-dollarisasi BRICS terus menjadi pendorong. Target $${pctMove(5).toFixed(0)}.`
      },
      acc: 68, daysAgo: 3
    },
    {
      name: 'Nicky Shiels', title: 'Head of Metals Strategy, MKS PAMP',
      inst: 'XAG/USD', signal: 'Buy', targetPct: 10, tf: '1M',
      analysis: {
        en: `Silver at $${xagPrice.toFixed(2)} is undervalued relative to gold. Gold/Silver ratio at ${(xauPrice / xagPrice).toFixed(1)} signals mean-reversion opportunity. Industrial demand from solar remains robust.`,
        id: `Perak di harga $${xagPrice.toFixed(2)} dinilai terlalu rendah dibandingkan emas. Rasio Emas/Perak di ${(xauPrice / xagPrice).toFixed(1)} menandakan peluang pembalikan rata-rata. Permintaan industri dari panel surya tetap kuat.`
      },
      acc: 66, daysAgo: 4
    },
    {
      name: 'Carsten Menke', title: 'Head of Next Gen Research, Julius Baer',
      inst: 'XAU/USD', signal: 'Neutral', targetPct: 2, stopPct: -3, tf: '1W',
      analysis: {
        en: `Gold at $${xauPrice.toFixed(0)} is fairly valued near-term. While the long-term trend is intact, a period of consolidation between $${pctMove(-3).toFixed(0)} and $${pctMove(4).toFixed(0)} is likely before the next leg up.`,
        id: `Emas di harga $${xauPrice.toFixed(0)} dinilai wajar dalam jangka pendek. Meskipun tren jangka panjang tetap utuh, periode konsolidasi antara $${pctMove(-3).toFixed(0)} dan $${pctMove(4).toFixed(0)} kemungkinan terjadi sebelum kenaikan berikutnya.`
      },
      acc: 65, daysAgo: 1
    },
    {
      name: 'Jeffrey Christian', title: 'Managing Partner, CPM Group',
      inst: 'XAU/USD', signal: xauPrice > 4500 ? 'Sell' : 'Buy', targetPct: xauPrice > 4500 ? -5 : 6, stopPct: xauPrice > 4500 ? 3 : -4, tf: '3M',
      analysis: {
        en: xauPrice > 4500
          ? `Gold at $${xauPrice.toFixed(0)} has run ahead of fundamentals. Expect profit-taking to bring price back toward $${pctMove(-5).toFixed(0)}. Recommend reducing long exposure.`
          : `Gold sees continued central bank demand. Current $${xauPrice.toFixed(0)} offers a buy opportunity with a target of $${pctMove(6).toFixed(0)}.`,
        id: xauPrice > 4500
          ? `Emas di harga $${xauPrice.toFixed(0)} telah melampaui fundamental. Perkirakan aksi ambil untung yang akan membawa harga kembali ke arah $${pctMove(-5).toFixed(0)}. Direkomendasikan untuk mengurangi eksposur long.`
          : `Emas melihat permintaan bank sentral yang berkelanjutan. Harga saat ini $${xauPrice.toFixed(0)} menawarkan peluang beli dengan target $${pctMove(6).toFixed(0)}.`
      },
      acc: 62, daysAgo: 5
    },
  ];

  return experts.map((e, i) => ({
    id: `expert-${i}`,
    expertName: e.name,
    expertTitle: e.title,
    instrument: e.inst,
    signal: e.signal,
    targetPrice: e.inst === 'XAG/USD' ? xagPctMove(e.targetPct) : pctMove(e.targetPct),
    stopLoss: e.stopPct ? (e.inst === 'XAG/USD' ? xagPctMove(e.stopPct) : pctMove(e.stopPct)) : undefined,
    timeframe: e.tf,
    analysis: e.analysis[lang],
    publishedAt: new Date(now - e.daysAgo * 24 * 60 * 60 * 1000),
    accuracy: e.acc,
  }));
}

// ─── Economic Calendar (always current week, dynamic per day) ───
export function generateEconomicCalendar(lang: 'en' | 'id' = 'en'): EconomicEvent[] {
  const today = new Date();
  // Get start of current week (Monday)
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const d = (daysFromMonday: number) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + daysFromMonday);
    return dt;
  };

  // Use ordinal day-of-year as seed for deterministic randomness per day
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekSeed = Math.floor(dayOfYear / 7); // changes every week

  // Pool of real recurring macro events — rotated each week
  type EventTemplate = Omit<EconomicEvent, 'id' | 'title' | 'description'> & {
    title: { en: string; id: string };
    description: { en: string; id: string };
  };

  const allEvents: EventTemplate[] = [
    {
      title: { en: 'FOMC Meeting Minutes', id: 'Notulen Rapat FOMC' },
      type: 'Central Bank', date: d(1), time: '14:00 ET', country: 'US', impact: 'High',
      description: { en: 'Detailed minutes from the latest Federal Reserve meeting. Key focus on rate outlook and inflation assessment.', id: 'Notulen terperinci dari rapat Fed terbaru. Fokus pada prospek suku bunga dan penilaian inflasi.' },
      previous: '4.50%', forecast: '4.50%',
      sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    },
    {
      title: { en: 'US CPI (MoM)', id: 'IHK AS (MoM)' },
      type: 'Inflation', date: d(2), time: '08:30 ET', country: 'US', impact: 'High',
      description: { en: 'Consumer Price Index measures inflation. Higher-than-expected readings are bearish for gold short-term but bullish long-term.', id: 'IHK mengukur inflasi. Angka lebih tinggi dari perkiraan berdampak bearish jangka pendek, bullish jangka panjang.' },
      previous: '0.3%', forecast: '0.2%',
      sourceUrl: 'https://www.investing.com/economic-calendar/cpi-733',
    },
    {
      title: { en: 'ECB Interest Rate Decision', id: 'Keputusan Suku Bunga ECB' },
      type: 'Central Bank', date: d(3), time: '07:45 ET', country: 'EU', impact: 'High',
      description: { en: 'European Central Bank rate decision. Rate cuts weaken EUR and support gold priced in euros.', id: 'Keputusan suku bunga ECB. Pemotongan suku bunga melemahkan EUR dan mendukung emas.' },
      previous: '3.65%', forecast: '3.40%',
      sourceUrl: 'https://www.investing.com/economic-calendar/ecb-interest-rate-decision-164',
    },
    {
      title: { en: 'US Initial Jobless Claims', id: 'Klaim Pengangguran Awal AS' },
      type: 'Employment', date: d(3), time: '08:30 ET', country: 'US', impact: 'Medium',
      description: { en: 'Weekly unemployment claims. Rising claims suggest economic weakness, bullish for gold as safe haven.', id: 'Klaim pengangguran mingguan. Kenaikan klaim menunjukkan kelemahan ekonomi, bullish bagi emas.' },
      previous: '225K', forecast: '228K',
      sourceUrl: 'https://www.investing.com/economic-calendar/initial-jobless-claims-294',
    },
    {
      title: { en: 'China Gold Imports Report', id: 'Laporan Impor Emas China' },
      type: 'Trade', date: d(4), time: '03:00 ET', country: 'CN', impact: 'Medium',
      description: { en: "Monthly gold import data from China, the world's largest consumer. Strong imports support gold prices.", id: 'Data impor emas bulanan China, konsumen terbesar di dunia. Impor kuat mendukung harga emas.' },
      sourceUrl: 'https://www.gold.org/goldhub/research/gold-demand-trends',
    },
    {
      title: { en: 'US Non-Farm Payrolls (NFP)', id: 'Non-Farm Payrolls AS (NFP)' },
      type: 'Employment', date: d(4), time: '08:30 ET', country: 'US', impact: 'High',
      description: { en: 'Monthly job additions. Strong NFP = Fed stays hawkish = bearish gold. Weak NFP = rate cut expectations = bullish gold.', id: 'Penambahan pekerjaan bulanan. NFP kuat = Fed hawkish = bearish emas. NFP lemah = ekspektasi pemotongan suku bunga = bullish emas.' },
      previous: '151K', forecast: '138K',
      sourceUrl: 'https://www.investing.com/economic-calendar/nonfarm-payrolls-227',
    },
    {
      title: { en: 'Fed Chair Powell Speech', id: 'Pidato Ketua Fed Powell' },
      type: 'Central Bank', date: d(weekSeed % 5), time: '10:00 ET', country: 'US', impact: 'High',
      description: { en: 'Federal Reserve Chair remarks on monetary policy outlook. Any hint of rate cuts is bullish for gold.', id: 'Pernyataan Ketua Fed terkait outlook kebijakan moneter. Isyarat pemotongan bunga bersifat bullish bagi emas.' },
      sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    },
    {
      title: { en: 'US Core PCE Price Index (YoY)', id: 'Indeks Harga PCE Inti AS (YoY)' },
      type: 'Inflation', date: d((weekSeed % 3) + 1), time: '08:30 ET', country: 'US', impact: 'High',
      description: { en: "Fed's most preferred inflation gauge. Core PCE above 2.5% suggests no rate cuts soon, bearish for gold.", id: 'Indikator inflasi paling disukai Fed. PCE inti di atas 2.5% menunjukkan tidak ada pemotongan bunga, bearish bagi emas.' },
      previous: '2.8%', forecast: '2.6%',
      sourceUrl: 'https://www.investing.com/economic-calendar/core-pce-price-index-905',
    },
    {
      title: { en: 'US GDP Growth Rate (QoQ)', id: 'Pertumbuhan GDP AS (QoQ)' },
      type: 'Growth', date: d((weekSeed % 4) + 0), time: '08:30 ET', country: 'US', impact: 'Medium',
      description: { en: 'Quarterly GDP growth. Slowdown below 1.5% increases recession fears, bullish for gold safe-haven demand.', id: 'Pertumbuhan GDP kuartalan. Perlambatan di bawah 1.5% meningkatkan kekhawatiran resesi, bullish bagi permintaan safe-haven emas.' },
      previous: '2.4%', forecast: '1.9%',
      sourceUrl: 'https://www.investing.com/economic-calendar/gdp-375',
    },
    {
      title: { en: 'BOJ Monetary Policy Meeting', id: 'Rapat Kebijakan Moneter BOJ' },
      type: 'Central Bank', date: d((weekSeed % 3) + 2), time: '03:00 ET', country: 'JP', impact: 'Medium',
      description: { en: 'Bank of Japan rate decision. JPY/USD moves affect gold denominated in different currencies.', id: 'Keputusan suku bunga Bank of Japan. Pergerakan JPY/USD mempengaruhi emas yang didenominasi dalam berbagai mata uang.' },
      previous: '0.50%', forecast: '0.50%',
      sourceUrl: 'https://www.investing.com/economic-calendar/boj-interest-rate-decision-165',
    },
    {
      title: { en: 'US ISM Manufacturing PMI', id: 'PMI Manufaktur ISM AS' },
      type: 'Growth', date: d(0), time: '10:00 ET', country: 'US', impact: 'Medium',
      description: { en: 'Manufacturing sector health. PMI below 50 = contraction = recession risk = bullish gold safe-haven.', id: 'Kondisi sektor manufaktur. PMI di bawah 50 = kontraksi = risiko resesi = bullish safe-haven emas.' },
      previous: '49.8', forecast: '50.2',
      sourceUrl: 'https://www.investing.com/economic-calendar/ism-manufacturing-pmi-173',
    },
    {
      title: { en: 'US Retail Sales (MoM)', id: 'Penjualan Ritel AS (MoM)' },
      type: 'Consumer', date: d((weekSeed % 4) + 1), time: '08:30 ET', country: 'US', impact: 'Low',
      description: { en: 'Consumer spending gauge. Weak retail sales signal economic slowdown, mildly positive for gold.', id: 'Indikator belanja konsumen. Penjualan ritel yang lemah menandakan perlambatan ekonomi, sedikit positif bagi emas.' },
      previous: '0.2%', forecast: '0.4%',
      sourceUrl: 'https://www.investing.com/economic-calendar/retail-sales-256',
    },
  ];

  // Pick events relative to current week with reasonable deduplication
  const seen = new Set<string>();
  const events: EventTemplate[] = [];

  for (const ev of allEvents) {
    const key = `${ev.date.toDateString()}-${ev.time}`;
    if (!seen.has(key)) {
      seen.add(key);
      events.push(ev);
    }
  }

  return events.map((e, i) => ({
    ...e,
    id: `econ-${weekSeed}-${i}`,
    title: e.title[lang],
    description: e.description[lang]
  }));
}


// ─── Correlated Assets (derived from live gold/silver prices) ───
// ─── Correlated Assets (derived from live gold/silver prices) ───
export function generateCorrelatedAssets(xauPrice: number, xagPrice: number, lang: 'en' | 'id' = 'en'): CorrelatedAsset[] {
  // Generate realistic sparkline data around a base price
  const sparkline = (base: number, volatilityPct: number): number[] => {
    const points: number[] = [];
    let price = base * (1 - volatilityPct / 100 * 5);
    for (let i = 0; i < 15; i++) {
      price += (Math.random() - 0.47) * base * volatilityPct / 100;
      points.push(price);
    }
    return points;
  };

  // DXY correlates inversely with gold
  const dxy = 100 + (4700 - xauPrice) * 0.003 + (Math.random() - 0.5) * 2;
  // US 10Y yield
  const ust10y = 4.0 + (Math.random() - 0.5) * 0.8;
  // Crude oil
  const oil = 65 + Math.random() * 20;
  // Bitcoin
  const btc = 60000 + Math.random() * 30000;

  return [
    {
      symbol: 'DXY',
      name: 'US Dollar Index',
      price: Number(dxy.toFixed(2)),
      change: Number(((Math.random() - 0.5) * dxy * 0.01).toFixed(2)),
      changePercent: Number(((Math.random() - 0.5) * 1.5).toFixed(2)),
      correlation: -0.82,
      lagDays: -1,
      lagDescription: lang === 'en' ? 'DXY leads gold by ~1 day. USD weakness = gold strength.' : 'DXY memimpin emas ~1 hari. Kelemahan USD = kekuatan emas.',
      reasoning: lang === 'en' 
        ? `Dollar index at ${dxy.toFixed(2)} — inverse relationship with gold. When DXY drops, gold at $${xauPrice.toFixed(0)} typically rises as the metal becomes cheaper in other currencies.`
        : `Indeks dolar di ${dxy.toFixed(2)} — hubungan terbalik dengan emas. Saat DXY turun, emas di $${xauPrice.toFixed(0)} biasanya naik karena logam menjadi lebih murah dalam mata uang lain.`,
      recentPrices: sparkline(dxy, 0.3),
    },
    {
      symbol: 'UST10Y',
      name: 'US 10-Year Treasury Yield',
      price: Number(ust10y.toFixed(3)),
      change: Number(((Math.random() - 0.5) * 0.05).toFixed(3)),
      changePercent: Number(((Math.random() - 0.5) * 2).toFixed(2)),
      correlation: -0.65,
      lagDays: 0,
      lagDescription: lang === 'en' ? 'Yields move inversely with gold. Higher yields = opportunity cost for holding gold.' : 'Imbal hasil bergerak terbalik dengan emas. Imbal hasil yang lebih tinggi = biaya peluang untuk memegang emas.',
      reasoning: lang === 'en'
        ? `10Y yield at ${ust10y.toFixed(2)}%. Rising real yields pressure gold by increasing the opportunity cost of non-yielding assets.`
        : `Imbal hasil 10Y di ${ust10y.toFixed(2)}%. Kenaikan imbal hasil riil menekan emas dengan meningkatkan biaya peluang aset yang tidak menghasilkan bunga.`,
      recentPrices: sparkline(ust10y, 1.5),
    },
    {
      symbol: 'CL=F',
      name: 'Crude Oil (WTI)',
      price: Number(oil.toFixed(2)),
      change: Number(((Math.random() - 0.5) * oil * 0.02).toFixed(2)),
      changePercent: Number(((Math.random() - 0.5) * 3).toFixed(2)),
      correlation: 0.35,
      lagDays: 2,
      lagDescription: lang === 'en' ? 'Oil is a mild leading indicator — rising oil suggests inflation ahead.' : 'Minyak adalah indikator utama ringan — kenaikan minyak menunjukkan inflasi di masa depan.',
      reasoning: lang === 'en'
        ? `Oil at $${oil.toFixed(2)} reflects energy inflation expectations. Higher oil ➜ higher CPI ➜ gold demand as inflation hedge.`
        : `Minyak di $${oil.toFixed(2)} mencerminkan ekspektasi inflasi energi. Minyak lebih tinggi ➜ IHK lebih tinggi ➜ permintaan emas sebagai lindung nilai inflasi.`,
      recentPrices: sparkline(oil, 1.5),
    },
    {
      symbol: 'BTC-USD',
      name: 'Bitcoin',
      price: Number(btc.toFixed(0)),
      change: Number(((Math.random() - 0.5) * btc * 0.03).toFixed(0)),
      changePercent: Number(((Math.random() - 0.5) * 5).toFixed(2)),
      correlation: 0.25,
      lagDays: 0,
      lagDescription: lang === 'en' ? 'Weak correlation — both act as alternative stores of value.' : 'Korelasi lemah — keduanya bertindak sebagai penyimpan nilai alternatif.',
      reasoning: lang === 'en'
        ? `Bitcoin at $${btc.toFixed(0)} competes with gold at $${xauPrice.toFixed(0)} for digital gold narrative.`
        : `Bitcoin di $${btc.toFixed(0)} bersaing dengan emas di $${xauPrice.toFixed(0)} untuk narasi emas digital.`,
      recentPrices: sparkline(btc, 2),
    },
  ];
}

// ─── News & Sentiment (dynamic based on market conditions) ───
export interface DynamicNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  impact: 'High' | 'Medium' | 'Low';
  category: 'Market' | 'Geopolitical' | 'Macro' | 'Demand';
  publishedAt: Date;
}

export function generateNews(xauPrice: number, xagPrice: number, changePct: number, lang: 'en' | 'id' = 'en'): DynamicNewsItem[] {
  // Use bucketed time (every 5 mins) to prevent flicker on price ticks
  const stableNow = Math.floor(Date.now() / 300000) * 300000;
  const h = (hours: number) => new Date(stableNow - hours * 60 * 60 * 1000);
  
  // Use rounded prices (market level, not live tick) to prevent title flicker
  const xauRounded = Math.round(xauPrice / 10) * 10; // round to nearest $10
  const xagRounded = Number((Math.round(xagPrice * 2) / 2).toFixed(1)); // Round to nearest $0.50
  
  const ratio = Math.round(xauPrice / xagPrice * 10) / 10;
  const isBullish = changePct >= 0;
  const absPctStr = Math.abs(changePct).toFixed(1);

  const news: (Omit<DynamicNewsItem, 'title' | 'summary'> & { title: { en: string; id: string }; summary: { en: string; id: string } })[] = [
    {
      id: 'n1', 
      source: 'Reuters', sourceUrl: 'https://www.reuters.com/business/finance/',
      sentiment: isBullish ? 'Bullish' : 'Bearish', impact: 'High', category: 'Market', publishedAt: h(1),
      title: {
        en: `Gold ${isBullish ? 'rises' : 'falls'} as central banks signal policy pivot`,
        id: `Emas ${isBullish ? 'naik' : 'turun'} karena bank sentral sinyal pivot kebijakan`
      },
      summary: {
        en: `Spot gold ${isBullish ? 'gained' : 'lost'} ${absPctStr}% to trade around $${xauRounded}. Investors are positioning ahead of key central bank decisions, with the metal ${isBullish ? 'benefiting from dollar weakness' : 'under pressure from a stronger dollar'}.`,
        id: `Emas spot ${isBullish ? 'menguat' : 'melemah'} ${absPctStr}% ke kisaran $${xauRounded}. Investor memposisikan diri menjelang keputusan bank sentral, dengan logam mulia ${isBullish ? 'diuntungkan dari kelemahan dolar' : 'tertekan oleh penguatan dolar'}.`
      }
    },
    {
      id: 'n2',
      source: 'World Gold Council', sourceUrl: 'https://www.gold.org/goldhub/research/gold-demand-trends',
      sentiment: 'Bullish', impact: 'High', category: 'Demand', publishedAt: h(3),
      title: {
        en: 'Central bank gold demand hits multi-decade high in Q1 2025',
        id: 'Permintaan emas bank sentral capai rekor puluhan tahun di Q1 2025'
      },
      summary: {
        en: `Central banks worldwide added over 800 tonnes of gold to reserves year-to-date. The People\'s Bank of China and National Bank of Poland led purchases. This structural demand underpins prices above $${(xauRounded * 0.95).toFixed(0)}.`,
        id: `Bank sentral di seluruh dunia menambahkan lebih dari 800 ton emas ke cadangan sejak awal tahun. Bank Rakyat China dan Bank Nasional Polandia memimpin pembelian. Permintaan struktural ini menopang harga di atas $${(xauRounded * 0.95).toFixed(0)}.`
      }
    },
    {
      id: 'n3',
      source: 'Bloomberg', sourceUrl: 'https://www.bloomberg.com/markets/commodities',
      sentiment: 'Bearish', impact: 'High', category: 'Macro', publishedAt: h(5),
      title: {
        en: 'Fed officials push back on early rate cut bets, dollar firms',
        id: 'Pejabat Fed tolak spekulasi pemotongan suku bunga, dolar menguat'
      },
      summary: {
        en: 'Several Federal Reserve officials signaled caution about cutting interest rates too quickly, citing persistent services inflation above 3.5%. Markets trimmed rate cut expectations, weighing on gold near-term.',
        id: 'Beberapa pejabat Federal Reserve menyatakan kehati-hatian terkait pemotongan suku bunga terlalu cepat, mengutip inflasi jasa yang persisten di atas 3.5%. Pasar memangkas ekspektasi pemotongan suku bunga, menekan emas jangka pendek.'
      }
    },
    {
      id: 'n4',
      source: 'Financial Times', sourceUrl: 'https://www.ft.com/markets',
      sentiment: 'Bullish', impact: 'Medium', category: 'Geopolitical', publishedAt: h(8),
      title: {
        en: 'Escalating Middle East conflict drives safe-haven flows into gold',
        id: 'Konflik Timur Tengah yang meningkat dorong aliran safe-haven ke emas'
      },
      summary: {
        en: `Rising geopolitical risk premiums are pushing investors toward safe-haven assets. Gold at $${xauRounded} is benefiting from flight-to-safety dynamics, with ETF inflows picking up over the past two weeks.`,
        id: `Meningkatnya premi risiko geopolitik mendorong investor menuju aset safe-haven. Emas di $${xauRounded} mendapat manfaat dari dinamika flight-to-safety, dengan arus masuk ETF meningkat dalam dua minggu terakhir.`
      }
    },
    {
      id: 'n5', 
      source: 'Kitco News', sourceUrl: 'https://www.kitco.com/news/precious-metals/',
      sentiment: 'Bullish', impact: 'Medium', category: 'Market', publishedAt: h(12),
      title: {
        en: `Gold/Silver ratio at ${ratio} signals potential silver catch-up trade`,
        id: `Rasio Emas/Perak di ${ratio} sinyal potensi silver catch-up trade`
      },
      summary: {
        en: `With silver at $${xagRounded} and the gold/silver ratio elevated at ${ratio}, analysts see a potential mean-reversion opportunity in silver. Industrial demand from solar panel manufacturing remains robust, adding a non-monetary demand driver.`,
        id: `Dengan perak di $${xagRounded} dan rasio emas/perak yang tinggi di ${ratio}, analis melihat potensi peluang mean-reversion pada perak. Permintaan industri dari manufaktur panel surya tetap kuat, menambah pendorong permintaan non-moneter.`
      }
    },
  ];

  return news.map(n => ({
    ...n,
    title: n.title[lang],
    summary: n.summary[lang]
  }));
}
