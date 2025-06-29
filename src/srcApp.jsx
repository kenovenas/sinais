import { useEffect, useState } from "react";

export default function App() {
  const [signals, setSignals] = useState({
    BTC: null,
    XRP: null,
    BNB: null,
    ADA: null,
    LTC: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const assets = ["BTC", "XRP", "BNB", "ADA", "LTC"];

  // Função para buscar dados do par de negociação na Binance
  const fetchKlines = async (symbol) => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1m&limit=200`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro na resposta da API");

      const data = await response.json();

      if (!Array.isArray(data)) throw new Error("Dados inválidos");

      return data.map((item) => parseFloat(item[4])); // Preços de fechamento
    } catch (err) {
      console.error(`Erro ao buscar dados para ${symbol}:`, err.message);
      return [];
    }
  };

  // Cálculo de RSI melhorado
  const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) return null;
    let gains = [], losses = [];

    for (let i = 1; i <= period; i++) {
      let diff = prices[i] - prices[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? Math.abs(diff) : 0);
    }

    let avgGain = gains.reduce((a, b) => a + b) / period;
    let avgLoss = losses.reduce((a, b) => a + b) / period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  // Cálculo de MACD com magnitude relativa
  const calculateMACD = (prices) => {
    if (prices.length < 26) return { line: 0, signal: 0 };
    const ema12 = calculateEMA(prices, 12).slice(-prices.length);
    const ema26 = calculateEMA(prices, 26).slice(-prices.length);
    const macdLine = prices.map((_, i) => ema12[i] - ema26[i]);
    const signalLine = calculateEMA(macdLine, 9);
    return { line: macdLine.slice(-1)[0], signal: signalLine.slice(-1)[0] };
  };

  // Momentum com período ajustado
  const calculateMomentum = (prices, period = 10) => {
    if (prices.length < period) return null;
    return prices.slice(-1)[0] / prices.slice(-period - 1, -period)[0];
  };

  // EMA com análise de trend
  const calculateEMA = (prices, period = 20) => {
    let multiplier = 2 / (period + 1);
    let emaValues = [];
    prices.forEach((price, i) => {
      if (i === 0) {
        emaValues.push(price);
      } else {
        emaValues.push(
          price * multiplier + emaValues[i - 1] * (1 - multiplier)
        );
      }
    });
    return emaValues;
  };

  // Bollinger Bands com análise de squeeze
  const calculateBollingerBands = (prices, period = 20, stdDevs = 2) => {
    if (prices.length < period) return null;
    const recentPrices = prices.slice(-period);
    const mean =
      recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
    const variance =
      recentPrices.reduce((sum, p) => sum + (p - mean) ** 2, 0) /
      recentPrices.length;
    const stdDev = Math.sqrt(variance);
    const upper = mean + stdDev * stdDevs;
    const lower = mean - stdDev * stdDevs;
    const currentPrice = prices.slice(-1)[0];

    return { upper, middle: mean, lower, price: currentPrice };
  };

  // Analisa os dados e gera o sinal com horários absolutamente precisos
  const analyzeAsset = async (symbol) => {
    const prices = await fetchKlines(symbol);
    if (prices.length < 20) return null;

    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const momentum = calculateMomentum(prices);
    const ema = calculateEMA(prices, 20).slice(-1)[0];
    const bollinger = calculateBollingerBands(prices);

    let buyCount = 0;
    let sellCount = 0;

    if (rsi < 30) buyCount += 2;
    else if (rsi > 70) sellCount += 2;
    else if (rsi >= 40 && rsi <= 60) buyCount += 0.5;

    if (macd.line > macd.signal && Math.abs(macd.line - macd.signal) > 0.001) buyCount += 1.5;
    else if (macd.line < macd.signal && Math.abs(macd.line - macd.signal) > 0.001) sellCount += 1.5;

    if (momentum > 1.005) buyCount += 1;
    else if (momentum < 0.995) sellCount += 1;

    if (bollinger.price < bollinger.lower) buyCount += 2;
    else if (bollinger.price > bollinger.upper) sellCount += 2;

    const lastPrice = prices.slice(-1)[0];
    if (lastPrice > ema) buyCount += 1;
    else sellCount += 1;

    let signalType = buyCount > sellCount + 1 ? "COMPRA" : sellCount > buyCount + 1 ? "VENDA" : "NEUTRO";
    let reason = signalType === "COMPRA"
      ? "Sinal positivo com forte consenso técnico"
      : signalType === "VENDA"
      ? "Sinal negativo com forte consenso técnico"
      : "Indicadores estão equilibrados ou contraditórios";

    // Gera horários absolutamente precisos
    const now = new Date();
    const nextMinute = new Date(now.getTime());
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1); // Próximo minuto cheio

    const signalTime = new Date(nextMinute.getTime() - 180000); // Exato 3 minutos antes

    const formatTime = (date) =>
      date.toTimeString().slice(0, 5);

    return {
      symbol,
      indicators: {
        RSI: rsi?.toFixed(2),
        MACD: { line: macd.line.toFixed(2), signal: macd.signal.toFixed(2) },
        Momentum: momentum?.toFixed(2),
        EMA: ema.toFixed(2),
        Bollinger: {
          upper: bollinger.upper.toFixed(2),
          middle: bollinger.middle.toFixed(2),
          lower: bollinger.lower.toFixed(2),
          price: bollinger.price.toFixed(2),
        },
      },
      signal: { type: signalType, reason },
      timestamp: {
        generatedAt: formatTime(signalTime),
        executeAt: formatTime(nextMinute),
        protection1: formatTime(new Date(nextMinute.getTime() + 60000)),
        protection2: formatTime(new Date(nextMinute.getTime() + 120000)),
      },
    };
  };

  // Atualiza todos os ativos
  const updateAllAssets = async () => {
    setLoading(true);
    setError(null);
    const updatedSignals = {};
    try {
      await Promise.all(
        assets.map(async (asset) => {
          const result = await analyzeAsset(asset);
          updatedSignals[asset] = result;
        })
      );
      setSignals(updatedSignals);
    } catch (err) {
      setError("Erro ao carregar sinais");
    } finally {
      setLoading(false);
    }
  };

  // Agendamento inicial e único por ciclo de 5 minutos
  useEffect(() => {
    const scheduleNextUpdate = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const nextMultiple = Math.ceil(minutes / 5) * 5;
      const nextUpdate = new Date(now);
      nextUpdate.setMinutes(nextMultiple, 0, 0);

      const delay = nextUpdate.getTime() - now.getTime();

      setTimeout(async () => {
        await updateAllAssets();
        scheduleNextUpdate(); // Recursivo apenas após conclusão
      }, delay);
    };

    updateAllAssets(); // Primeira execução imediata
    scheduleNextUpdate(); // Configura próxima atualização
  }, []);

  const getSignalColor = (type) => {
    switch (type) {
      case "COMPRA":
        return "bg-green-500 text-white";
      case "VENDA":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Sinais de Daytrade (5 min)
        </h1>
        <p className="text-gray-400 mt-2">Análise técnica com RSI, MACD, Momentum, EMA e Bollinger</p>
      </header>

      {error && (
        <div className="text-center text-yellow-400 mb-4">{error}</div>
      )}

      <main className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-400">Carregando dados...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(signals).map(([asset, data]) =>
              data ? (
                <div key={asset} className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                  <div className={`px-4 py-3 flex justify-between items-center ${
                    data.signal.type === 'COMPRA' ? 'bg-green-700' :
                    data.signal.type === 'VENDA' ? 'bg-red-700' : 'bg-gray-700'
                  }`}>
                    <h2 className="text-lg font-semibold">{data.symbol}/USDT</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getSignalColor(data.signal.type)}`}
                    >
                      {data.signal.type}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="text-sm text-gray-300 mb-3">
                      <p><strong>Gerado às:</strong> {data.timestamp.generatedAt}</p>
                      <p><strong>Entrada:</strong> {data.timestamp.executeAt}</p>
                      <p><strong>Proteção 1:</strong> {data.timestamp.protection1}</p>
                      <p><strong>Proteção 2:</strong> {data.timestamp.protection2}</p>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">{data.signal.reason}</p>
                    <ul className="space-y-1 text-xs text-gray-400">
                      <li>RSI: {data.indicators.RSI}</li>
                      <li>MACD: {data.indicators.MACD.line} ({data.indicators.MACD.signal})</li>
                      <li>Momentum: {data.indicators.Momentum}</li>
                      <li>EMA: {data.indicators.EMA}</li>
                      <li>Bollinger: {data.indicators.Bollinger.price} | U:{data.indicators.Bollinger.upper}</li>
                    </ul>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </main>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} - Sistema de Análise Técnica em Tempo Real</p>
        <p className="mt-1">Atualizado a cada 5 minutos via API da Binance.</p>
      </footer>
    </div>
  );
}