import React, { useState, useEffect } from "react";

const App = () => {
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [totalCapital, setTotalCapital] = useState("");
  const [riskPercentage, setRiskPercentage] = useState("1"); // Will be "1" or "2"
  const [assetAllocation, setAssetAllocation] = useState("10");
  const [maxLeverage, setMaxLeverage] = useState("75"); // Max leverage available for the coin pair
  const [positionType, setPositionType] = useState("long");
  const [exchangeRate, setExchangeRate] = useState(58.52);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  
  // Partial TP settings
  const [enablePartialTP, setEnablePartialTP] = useState(true);
  const [partialTP1Percent, setPartialTP1Percent] = useState("50"); // % of position to close at TP1
  const [partialTP2Percent, setPartialTP2Percent] = useState("30"); // % of position to close at TP2

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      const apis = [
        "https://api.frankfurter.app/latest?from=USD&to=PHP",
        "https://open.er-api.com/v6/latest/USD",
        "https://api.exchangerate-api.com/v4/latest/USD",
      ];

      for (const apiUrl of apis) {
        try {
          const response = await fetch(apiUrl);
          const data = await response.json();

          let rate = null;
          if (data.rates && data.rates.PHP) {
            rate = data.rates.PHP;
          }

          if (rate && rate > 0) {
            setExchangeRate(rate);
            console.log(`Exchange rate updated: $1 = ₱${rate.toFixed(4)}`);
            break;
          }
        } catch (err) {
          console.log(`Failed to fetch from ${apiUrl}, trying next...`);
          continue;
        }
      }
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
    } finally {
      setIsLoadingRate(false);
    }
  };

  const formatPHP = (usdAmount) => {
    if (!usdAmount) return "₱0.00";
    const phpAmount = usdAmount * exchangeRate;
    return `₱${phpAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateOptimalLeverage = (entry, stop, capital, riskPct, allocation, maxLev) => {
    // Calculate risk per coin (price distance to stop loss)
    const riskPerCoin = Math.abs(entry - stop);
    const riskPercentageMove = (riskPerCoin / entry) * 100;
    
    // Max capital we're willing to risk (1% of total)
    const maxRiskAmount = (capital * riskPct) / 100;
    
    // Allocated capital for this trade (10-25% of total)
    const allocatedCapital = (capital * allocation) / 100;
    
    // Calculate optimal leverage
    // Formula: Leverage = (Max Risk Amount) / (Allocated Capital × Risk %)
    const optimalLeverage = maxRiskAmount / (allocatedCapital * (riskPercentageMove / 100));
    
    // Round to nearest integer and cap at max available leverage
    let recommendedLeverage = Math.max(1, Math.min(Math.round(optimalLeverage), maxLev));
    
    // Safety constraints based on risk percentage move
    if (riskPercentageMove >= 10) {
      recommendedLeverage = Math.min(recommendedLeverage, 2); // Very volatile
    } else if (riskPercentageMove >= 5) {
      recommendedLeverage = Math.min(recommendedLeverage, 5); // Volatile
    } else if (riskPercentageMove >= 3) {
      recommendedLeverage = Math.min(recommendedLeverage, 10); // Moderate
    } else if (riskPercentageMove >= 2) {
      recommendedLeverage = Math.min(recommendedLeverage, 20); // Low volatility
    }
    // else allow full calculated leverage up to max
    
    return {
      optimal: recommendedLeverage,
      riskPercentageMove,
      explanation: getLeverageExplanation(recommendedLeverage, riskPercentageMove)
    };
  };

  const getLeverageExplanation = (leverage, riskMove) => {
    if (riskMove >= 10) {
      return "High risk distance - using minimal leverage for safety";
    } else if (riskMove >= 5) {
      return "Moderate risk distance - conservative leverage recommended";
    } else if (riskMove >= 3) {
      return "Balanced risk distance - moderate leverage suitable";
    } else if (riskMove >= 2) {
      return "Low risk distance - higher leverage acceptable";
    } else {
      return "Tight stop loss - maximum safe leverage calculated";
    }
  };

  const calculatePartialTPLevels = (entry, stop, target, positionType) => {
    const riskPerCoin = Math.abs(entry - stop);
    
    // TP1: 1R (Break-even point) - Move SL to entry after this hits
    let tp1Price;
    if (positionType === "long") {
      tp1Price = entry + riskPerCoin; // Entry + 1R
    } else {
      tp1Price = entry - riskPerCoin; // Entry - 1R
    }
    
    // TP2: Smart level between 1R and final target
    // Calculate based on R:R ratio for optimal scaling out
    const totalReward = Math.abs(target - entry);
    const rrRatio = totalReward / riskPerCoin;
    
    let tp2Price;
    if (rrRatio >= 3) {
      // For high R:R (3+), place TP2 at 2R
      if (positionType === "long") {
        tp2Price = entry + (riskPerCoin * 2);
      } else {
        tp2Price = entry - (riskPerCoin * 2);
      }
    } else if (rrRatio >= 2) {
      // For medium R:R (2-3), place TP2 at 1.5R
      if (positionType === "long") {
        tp2Price = entry + (riskPerCoin * 1.5);
      } else {
        tp2Price = entry - (riskPerCoin * 1.5);
      }
    } else {
      // For lower R:R, place TP2 halfway between TP1 and final target
      tp2Price = (tp1Price + target) / 2;
    }
    
    return {
      tp1: {
        price: tp1Price,
        rMultiple: 1,
        label: "Break-Even (1R)",
        description: "Secure profits and move SL to entry"
      },
      tp2: {
        price: tp2Price,
        rMultiple: Math.abs(tp2Price - entry) / riskPerCoin,
        label: `TP2 (${(Math.abs(tp2Price - entry) / riskPerCoin).toFixed(1)}R)`,
        description: "Lock in major profits"
      },
      tp3: {
        price: target,
        rMultiple: Math.abs(target - entry) / riskPerCoin,
        label: `Final Target (${(Math.abs(target - entry) / riskPerCoin).toFixed(1)}R)`,
        description: "Maximum profit target"
      }
    };
  };

  const calculatePartialTPProfits = (tpLevels, recommendedAssets, riskPerCoin, entry) => {
    const tp1Percent = parseFloat(partialTP1Percent) / 100;
    const tp2Percent = parseFloat(partialTP2Percent) / 100;
    const tp3Percent = 1 - tp1Percent - tp2Percent; // Remaining position
    
    const tp1Assets = recommendedAssets * tp1Percent;
    const tp2Assets = recommendedAssets * tp2Percent;
    const tp3Assets = recommendedAssets * tp3Percent;
    
    const tp1Profit = tp1Assets * Math.abs(tpLevels.tp1.price - entry);
    const tp2Profit = tp2Assets * Math.abs(tpLevels.tp2.price - entry);
    const tp3Profit = tp3Assets * Math.abs(tpLevels.tp3.price - entry);
    
    const totalProfit = tp1Profit + tp2Profit + tp3Profit;
    const avgExitRMultiple = totalProfit / (recommendedAssets * riskPerCoin);
    
    return {
      tp1: { assets: tp1Assets, profit: tp1Profit, percent: tp1Percent * 100 },
      tp2: { assets: tp2Assets, profit: tp2Profit, percent: tp2Percent * 100 },
      tp3: { assets: tp3Assets, profit: tp3Profit, percent: tp3Percent * 100 },
      totalProfit,
      avgExitRMultiple
    };
  };

  const calculateRiskReward = () => {
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    const target = parseFloat(takeProfit);
    const capital = parseFloat(totalCapital);
    const riskPct = parseFloat(riskPercentage);
    const allocation = parseFloat(assetAllocation);
    const maxLev = parseFloat(maxLeverage);

    if (!entry || !stop || !target) return null;

    let riskPerCoin, rewardPerCoin, isValid;

    if (positionType === "long") {
      riskPerCoin = entry - stop;
      rewardPerCoin = target - entry;
      isValid = stop < entry && target > entry;
    } else {
      riskPerCoin = stop - entry;
      rewardPerCoin = entry - target;
      isValid = stop > entry && target < entry;
    }

    if (!isValid || riskPerCoin <= 0 || rewardPerCoin <= 0) {
      return { error: true, positionType };
    }

    const ratio = rewardPerCoin / riskPerCoin;

    // Calculate position sizing
    let maxRiskAmount = 0;
    let allocatedAmount = 0;
    let leverageInfo = null;
    let recommendedAssets = 0;
    let potentialLoss = 0;
    let potentialProfit = 0;
    let positionValue = 0;
    let partialTPLevels = null;
    let partialTPProfits = null;

    if (capital) {
      // Max risk amount (1% of capital)
      maxRiskAmount = (capital * riskPct) / 100;
      
      // Allocated capital for this trade
      allocatedAmount = (capital * allocation) / 100;
      
      // Calculate optimal leverage
      leverageInfo = calculateOptimalLeverage(entry, stop, capital, riskPct, allocation, maxLev);
      
      // Total position value with leverage
      positionValue = allocatedAmount * leverageInfo.optimal;
      
      // Number of coins we can buy
      recommendedAssets = positionValue / entry;
      
      // Actual potential loss and profit
      potentialLoss = recommendedAssets * riskPerCoin;
      potentialProfit = recommendedAssets * rewardPerCoin;
      
      // Calculate partial TP levels
      partialTPLevels = calculatePartialTPLevels(entry, stop, target, positionType);
      
      // Calculate partial TP profits if enabled
      if (enablePartialTP) {
        partialTPProfits = calculatePartialTPProfits(partialTPLevels, recommendedAssets, riskPerCoin, entry);
      }
    }

    return {
      riskPerCoin,
      rewardPerCoin,
      ratio,
      maxRiskAmount,
      allocatedAmount,
      leverageInfo,
      recommendedAssets,
      potentialLoss,
      potentialProfit,
      positionValue,
      partialTPLevels,
      partialTPProfits,
      error: false,
    };
  };

  const results = calculateRiskReward();

  const getRatioColor = (ratio) => {
    if (ratio >= 3) return "emerald";
    if (ratio >= 2) return "blue";
    if (ratio >= 1) return "amber";
    return "rose";
  };

  const getRatioLabel = (ratio) => {
    if (ratio >= 3) return "Excellent";
    if (ratio >= 2) return "Good";
    if (ratio >= 1) return "Fair";
    return "Poor";
  };

  const color = results && !results.error ? getRatioColor(results.ratio) : "slate";

  const getErrorMessage = () => {
    if (positionType === "long") {
      return "For LONG positions: Stop Loss must be below Entry Price, and Take Profit must be above Entry Price";
    } else {
      return "For SHORT positions: Stop Loss must be above Entry Price, and Take Profit must be below Entry Price";
    }
  };

  const isRiskManagementValid = () => {
    if (!results || results.error || !totalCapital) return true;

    const riskPct = parseFloat(riskPercentage);
    const allocation = parseFloat(assetAllocation);

    const isSafeRisk = riskPct >= 1 && riskPct <= 2;
    const isSafeAllocation = allocation >= 10 && allocation <= 25;

    return isSafeRisk && isSafeAllocation;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-2 sm:p-4 flex items-center justify-center">
      <div className="w-full max-w-5xl">
        {/* Main Card */}
        <div className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/5">
          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-90"></div>
            <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
            <div className="relative px-4 sm:px-8 py-6 sm:py-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                      Bitget Smart Leverage Calculator
                    </h1>
                    <p className="text-purple-100 mt-1 text-xs sm:text-base">
                      Auto-leverage with 1-2% risk rule and smart partial TPs
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <div className="text-white/90 text-xs sm:text-sm font-medium">Exchange Rate</div>
                  <div className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                    $1 = {formatPHP(1)}
                    <button
                      onClick={fetchExchangeRate}
                      disabled={isLoadingRate}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                      title="Refresh exchange rate"
                    >
                      <svg className={`w-4 h-4 text-white ${isLoadingRate ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            {/* Position Type Toggle */}
            <div className="mb-6 sm:mb-8">
              <label className="block text-slate-400 text-xs sm:text-sm font-semibold mb-3 uppercase tracking-wide">
                Position Type
              </label>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => setPositionType("long")}
                  className={`position-toggle ${positionType === "long" ? "active-long" : "inactive"}`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="font-bold text-sm sm:text-base">LONG</span>
                  <span className="text-xs opacity-75 hidden sm:block">Buy Low, Sell High</span>
                </button>
                <button
                  onClick={() => setPositionType("short")}
                  className={`position-toggle ${positionType === "short" ? "active-short" : "inactive"}`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  <span className="font-bold text-sm sm:text-base">SHORT</span>
                  <span className="text-xs opacity-75 hidden sm:block">Sell High, Buy Low</span>
                </button>
              </div>
            </div>

            {/* Risk Management Section */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl sm:rounded-2xl">
              <h3 className="text-base sm:text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Trading Setup
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Capital */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Total Capital (USD)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(e.target.value)}
                    placeholder="10000"
                    className="input-field"
                  />
                  {totalCapital && (
                    <div className="mt-1 text-xs text-indigo-400">
                      {formatPHP(parseFloat(totalCapital))}
                    </div>
                  )}
                </div>

                {/* Risk Percentage - Toggle between 1% and 2% */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Risk per Trade</span>
                    <span className="ml-2 text-xs text-slate-400">(Choose your risk level)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRiskPercentage("1")}
                      className={`risk-toggle ${riskPercentage === "1" ? "active-conservative" : "inactive-risk"}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-sm">1%</span>
                        <span className="text-xs opacity-75">Conservative</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setRiskPercentage("2")}
                      className={`risk-toggle ${riskPercentage === "2" ? "active-aggressive" : "inactive-risk"}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-sm">2%</span>
                        <span className="text-xs opacity-75">Aggressive</span>
                      </div>
                    </button>
                  </div>
                  {totalCapital && (
                    <div className="mt-2 text-xs text-indigo-400">
                      Max Risk: ${((parseFloat(totalCapital) * parseFloat(riskPercentage)) / 100).toFixed(2)} ({formatPHP((parseFloat(totalCapital) * parseFloat(riskPercentage)) / 100)})
                    </div>
                  )}
                </div>

                {/* Asset Allocation */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Position Size</span>
                    <span className={`ml-2 text-xs ${parseFloat(assetAllocation) >= 10 && parseFloat(assetAllocation) <= 25 ? "text-emerald-400" : "text-amber-400"}`}>
                      ({parseFloat(assetAllocation) >= 10 && parseFloat(assetAllocation) <= 25 ? "Optimal" : "Review"})
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      min="5"
                      max="100"
                      value={assetAllocation}
                      onChange={(e) => setAssetAllocation(e.target.value)}
                      className="input-field pr-8"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                  </div>
                  {totalCapital && assetAllocation && (
                    <div className="mt-1 text-xs text-indigo-400">
                      ${((parseFloat(totalCapital) * parseFloat(assetAllocation)) / 100).toFixed(2)} USD allocated
                    </div>
                  )}
                </div>

                {/* Max Leverage Available */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Max Leverage (Pair)</span>
                    <span className="ml-2 text-xs text-slate-500">(Exchange Limit)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      min="1"
                      max="125"
                      value={maxLeverage}
                      onChange={(e) => setMaxLeverage(e.target.value)}
                      className="input-field pr-8"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">x</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Set based on coin pair limits
                  </div>
                </div>
              </div>
            </div>

            {/* Price Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Entry Price */}
              <div className="input-group">
                <label className="input-label">
                  <span className="text-slate-400">Entry Price (USD)</span>
                  <span className="text-indigo-400 ml-2">●</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                />
                {entryPrice && (
                  <div className="mt-1 text-xs text-indigo-400">
                    {formatPHP(parseFloat(entryPrice))}
                  </div>
                )}
              </div>

              {/* Stop Loss */}
              <div className="input-group">
                <label className="input-label">
                  <span className="text-slate-400">Stop Loss (USD)</span>
                  <span className="text-rose-400 ml-2">●</span>
                  {positionType === "long" && entryPrice && (
                    <span className="text-xs text-slate-500 ml-2">(below ${entryPrice})</span>
                  )}
                  {positionType === "short" && entryPrice && (
                    <span className="text-xs text-slate-500 ml-2">(above ${entryPrice})</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="0.00"
                  className="input-field focus:ring-rose-500/50"
                />
                {stopLoss && (
                  <div className="mt-1 text-xs text-rose-400">
                    {formatPHP(parseFloat(stopLoss))}
                  </div>
                )}
              </div>

              {/* Take Profit */}
              <div className="input-group">
                <label className="input-label">
                  <span className="text-slate-400">Take Profit (USD)</span>
                  <span className="text-emerald-400 ml-2">●</span>
                  {positionType === "long" && entryPrice && (
                    <span className="text-xs text-slate-500 ml-2">(above ${entryPrice})</span>
                  )}
                  {positionType === "short" && entryPrice && (
                    <span className="text-xs text-slate-500 ml-2">(below ${entryPrice})</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="0.00"
                  className="input-field focus:ring-emerald-500/50"
                />
                {takeProfit && (
                  <div className="mt-1 text-xs text-emerald-400">
                    {formatPHP(parseFloat(takeProfit))}
                  </div>
                )}
              </div>
            </div>

            {/* Partial Take Profit Section */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl sm:rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-emerald-300 flex items-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Partial Take Profit Strategy
                </h3>
                <button
                  onClick={() => setEnablePartialTP(!enablePartialTP)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    enablePartialTP 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                  }`}
                >
                  {enablePartialTP ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {enablePartialTP && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="input-group">
                    <label className="input-label">
                      <span className="text-slate-300">TP1 Close %</span>
                      <span className="text-xs text-emerald-400 ml-2">(At 1R - Break-even)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="5"
                        min="0"
                        max="100"
                        value={partialTP1Percent}
                        onChange={(e) => setPartialTP1Percent(e.target.value)}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Recommended: 50% to secure profits
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">
                      <span className="text-slate-300">TP2 Close %</span>
                      <span className="text-xs text-teal-400 ml-2">(At 1.5-2R)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="5"
                        min="0"
                        max="100"
                        value={partialTP2Percent}
                        onChange={(e) => setPartialTP2Percent(e.target.value)}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Remaining {100 - parseFloat(partialTP1Percent) - parseFloat(partialTP2Percent)}% rides to final target
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="text-emerald-300 font-semibold text-xs sm:text-sm">Smart Profit Taking</div>
                    <div className="text-slate-400 text-xs mt-1">
                      TP1 at 1R secures break-even (move SL to entry). TP2 locks major gains. Remaining position rides to final target for maximum profit.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {results && results.error && (
              <div className="error-message">
                <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-rose-300 text-sm">{getErrorMessage()}</p>
              </div>
            )}

            {/* Risk Management Warning */}
            {!isRiskManagementValid() && (
              <div className="warning-message">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-amber-300 text-sm">
                  Recommended: Choose 1-2% risk per trade and 10-25% position size for optimal risk management!
                </p>
              </div>
            )}

            {/* Results Section */}
            {results && !results.error && (
              <div className="space-y-6 animate-fade-in">
                {/* Leverage Recommendation - HIGHLIGHTED */}
                {totalCapital && results.leverageInfo && (
                  <div className="leverage-highlight">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        Recommended Leverage
                      </h3>
                      <div className="leverage-badge">
                        {results.leverageInfo.optimal}x
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="leverage-stat">
                        <div className="text-slate-400 text-sm mb-1">Risk Distance</div>
                        <div className="text-white text-xl font-bold">
                          {results.leverageInfo.riskPercentageMove.toFixed(2)}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">From entry to SL</div>
                      </div>
                      
                      <div className="leverage-stat">
                        <div className="text-slate-400 text-sm mb-1">Position Value</div>
                        <div className="text-white text-xl font-bold">
                          ${results.positionValue.toFixed(2)}
                        </div>
                        <div className="text-xs text-indigo-400 mt-1">
                          {formatPHP(results.positionValue)}
                        </div>
                      </div>
                      
                      <div className="leverage-stat">
                        <div className="text-slate-400 text-sm mb-1">Max Risk (1%)</div>
                        <div className="text-rose-400 text-xl font-bold">
                          ${results.maxRiskAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-rose-400 mt-1">
                          {formatPHP(results.maxRiskAmount)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <div className="text-purple-300 font-semibold text-sm">Why this leverage?</div>
                          <div className="text-slate-400 text-sm mt-1">{results.leverageInfo.explanation}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Ratio Card */}
                <div className={`ratio-card bg-gradient-to-br from-${color}-500/10 to-${color}-600/5 border-${color}-500/20`}>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs sm:text-sm font-medium uppercase tracking-wider mb-3">
                      Risk-Reward Ratio
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                      <div className={`text-4xl sm:text-6xl font-black text-${color}-400`}>
                        1:{results.ratio.toFixed(2)}
                      </div>
                      <div className={`status-badge bg-${color}-500/20 border-${color}-400/30 text-${color}-300`}>
                        {getRatioLabel(results.ratio)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Partial Take Profit Levels */}
                {totalCapital && results.partialTPLevels && enablePartialTP && (
                  <div className="partial-tp-section">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        Partial Take Profit Levels
                      </h3>
                      {results.partialTPProfits && (
                        <div className="text-right">
                          <div className="text-slate-400 text-xs">Avg Exit</div>
                          <div className="text-emerald-400 font-bold text-lg">
                            {results.partialTPProfits.avgExitRMultiple.toFixed(2)}R
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      {/* TP1 - Break Even */}
                      <div className="tp-level-card tp1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="tp-number">1</div>
                            <div>
                              <div className="text-emerald-300 font-bold text-sm sm:text-base">
                                {results.partialTPLevels.tp1.label}
                              </div>
                              <div className="text-slate-400 text-xs">
                                {results.partialTPLevels.tp1.description}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-emerald-400 text-lg sm:text-xl font-bold">
                              ${results.partialTPLevels.tp1.price.toFixed(2)}
                            </div>
                            <div className="text-emerald-500 text-xs">
                              {formatPHP(results.partialTPLevels.tp1.price)}
                            </div>
                          </div>
                        </div>
                        {results.partialTPProfits && (
                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-emerald-500/20">
                            <div>
                              <div className="text-slate-500 text-xs">Close</div>
                              <div className="text-white font-semibold text-sm">
                                {results.partialTPProfits.tp1.percent.toFixed(0)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Assets</div>
                              <div className="text-white font-semibold text-sm">
                                {results.partialTPProfits.tp1.assets.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Profit</div>
                              <div className="text-emerald-400 font-semibold text-sm">
                                ${results.partialTPProfits.tp1.profit.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-300">
                          <span className="font-semibold">Action:</span> Move stop loss to entry price (break-even)
                        </div>
                      </div>

                      {/* TP2 - Major Profit Lock */}
                      <div className="tp-level-card tp2">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="tp-number">2</div>
                            <div>
                              <div className="text-teal-300 font-bold text-sm sm:text-base">
                                {results.partialTPLevels.tp2.label}
                              </div>
                              <div className="text-slate-400 text-xs">
                                {results.partialTPLevels.tp2.description}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-teal-400 text-lg sm:text-xl font-bold">
                              ${results.partialTPLevels.tp2.price.toFixed(2)}
                            </div>
                            <div className="text-teal-500 text-xs">
                              {formatPHP(results.partialTPLevels.tp2.price)}
                            </div>
                          </div>
                        </div>
                        {results.partialTPProfits && (
                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-teal-500/20">
                            <div>
                              <div className="text-slate-500 text-xs">Close</div>
                              <div className="text-white font-semibold text-sm">
                                {results.partialTPProfits.tp2.percent.toFixed(0)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Assets</div>
                              <div className="text-white font-semibold text-sm">
                                {results.partialTPProfits.tp2.assets.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Profit</div>
                              <div className="text-teal-400 font-semibold text-sm">
                                ${results.partialTPProfits.tp2.profit.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 p-2 bg-teal-500/10 border border-teal-500/20 rounded text-xs text-teal-300">
                          <span className="font-semibold">Action:</span> Move stop loss to TP1 (risk-free trade)
                        </div>
                      </div>

                      {/* TP3 - Final Target */}
                      <div className="tp-level-card tp3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="tp-number">3</div>
                            <div>
                              <div className="text-blue-300 font-bold text-sm sm:text-base">
                                {results.partialTPLevels.tp3.label}
                              </div>
                              <div className="text-slate-400 text-xs">
                                {results.partialTPLevels.tp3.description}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-400 text-lg sm:text-xl font-bold">
                              ${results.partialTPLevels.tp3.price.toFixed(2)}
                            </div>
                            <div className="text-blue-500 text-xs">
                              {formatPHP(results.partialTPLevels.tp3.price)}
                            </div>
                          </div>
                        </div>
                        {results.partialTPProfits && (
                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-blue-500/20">
                            <div>
                              <div className="text-slate-500 text-xs">Close</div>
                              <div className="text-white font-semibold text-sm">
                                {results.partialTPProfits.tp3.percent.toFixed(0)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Assets</div>
                              <div className="text-white font-semibold text-sm">
                                {results.partialTPProfits.tp3.assets.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Profit</div>
                              <div className="text-blue-400 font-semibold text-sm">
                                ${results.partialTPProfits.tp3.profit.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total Partial TP Summary */}
                    {results.partialTPProfits && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-slate-400 text-xs sm:text-sm">Total Projected Profit</div>
                            <div className="text-white text-xl sm:text-2xl font-bold mt-1">
                              ${results.partialTPProfits.totalProfit.toFixed(2)}
                            </div>
                            <div className="text-emerald-400 text-xs sm:text-sm mt-1">
                              {formatPHP(results.partialTPProfits.totalProfit)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-400 text-xs sm:text-sm">Avg R:R Exit</div>
                            <div className="text-emerald-400 text-xl sm:text-2xl font-bold mt-1">
                              1:{results.partialTPProfits.avgExitRMultiple.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Position Details */}
                {totalCapital && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="position-card">
                      <h4 className="text-indigo-300 font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Position Details
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">Allocated Capital</span>
                          <div className="text-right">
                            <span className="text-white font-bold block">
                              ${results.allocatedAmount.toFixed(2)}
                            </span>
                            <span className="text-indigo-400 text-xs">
                              {formatPHP(results.allocatedAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">Position Size</span>
                          <div className="text-right">
                            <span className="text-white font-bold block">
                              {results.recommendedAssets.toFixed(4)} coins
                            </span>
                            <span className="text-slate-500 text-xs">
                              @ ${parseFloat(entryPrice).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                          <span className="text-indigo-300 text-sm font-semibold">Total Position Value</span>
                          <span className="text-indigo-400 font-bold text-lg">
                            ${results.positionValue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="position-card">
                      <h4 className="text-purple-300 font-semibold mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Risk Analysis
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">Risk % Move</span>
                          <span className="text-white font-bold">
                            {results.leverageInfo.riskPercentageMove.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">Win Rate Needed</span>
                          <span className="text-white font-bold">
                            {(100 / (1 + results.ratio)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                          <span className="text-purple-300 text-sm font-semibold">R:R Ratio</span>
                          <span className="text-purple-400 font-bold text-lg">
                            1:{results.ratio.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Risk Card */}
                  <div className="stat-card group hover:border-rose-500/30 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-rose-400 text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1">
                          Risk per Coin
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-white">
                          ${results.riskPerCoin.toFixed(2)}
                        </p>
                        <p className="text-rose-400 text-xs sm:text-sm mt-1 truncate">
                          {formatPHP(results.riskPerCoin)}
                        </p>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors flex-shrink-0">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </div>
                    </div>
                    {totalCapital && (
                      <div className="pt-4 border-t border-rose-500/10">
                        <p className="text-rose-300/70 text-xs sm:text-sm">Total Risk (Max Loss)</p>
                        <p className="text-rose-200 text-lg sm:text-xl font-bold mt-1">
                          ${results.potentialLoss.toFixed(2)}
                        </p>
                        <p className="text-rose-400 text-xs sm:text-sm mt-1 truncate">
                          {formatPHP(results.potentialLoss)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Reward Card */}
                  <div className="stat-card group hover:border-emerald-500/30 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-emerald-400 text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1">
                          Reward per Coin
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-white">
                          ${results.rewardPerCoin.toFixed(2)}
                        </p>
                        <p className="text-emerald-400 text-xs sm:text-sm mt-1 truncate">
                          {formatPHP(results.rewardPerCoin)}
                        </p>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors flex-shrink-0">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    {totalCapital && (
                      <div className="pt-4 border-t border-emerald-500/10">
                        <p className="text-emerald-300/70 text-xs sm:text-sm">Total Profit (Target)</p>
                        <p className="text-emerald-200 text-lg sm:text-xl font-bold mt-1">
                          ${results.potentialProfit.toFixed(2)}
                        </p>
                        <p className="text-emerald-400 text-xs sm:text-sm mt-1 truncate">
                          {formatPHP(results.potentialProfit)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Ratio Bar */}
                <div className="ratio-bar-container">
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    Visual Breakdown
                  </p>
                  <div className="flex gap-2 sm:gap-3 h-12 sm:h-16">
                    <div className="risk-bar">
                      <span className="bar-label">Risk 1x</span>
                    </div>
                    <div className="reward-bar" style={{ flex: results.ratio }}>
                      <span className="bar-label">Reward {results.ratio.toFixed(1)}x</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!results && (
              <div className="empty-state">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-400 text-center text-sm sm:text-base px-4">
                  Enter your trade parameters to calculate optimal leverage
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pro Tips */}
        <div className="tip-card">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-indigo-300 font-semibold mb-1 text-sm sm:text-base">
                Smart Trading Strategy
              </p>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                <span className="font-semibold text-emerald-400">Choose 1%</span> for conservative trading or <span className="font-semibold text-amber-400">2%</span> for aggressive growth.
                <span className="mx-1 sm:mx-2">•</span>
                The calculator automatically determines <span className="font-semibold text-purple-400">optimal leverage</span> based on your stop loss distance.
                <span className="mx-1 sm:mx-2">•</span>
                <span className="font-semibold text-emerald-400">Partial TP at 1R</span> locks in break-even and protects capital.
                <span className="mx-1 sm:mx-2">•</span>
                <span className="font-semibold text-teal-400">TP2 at 1.5-2R</span> captures major profits while keeping runners.
                <span className="mx-1 sm:mx-2">•</span>
                <span className="font-semibold text-blue-400">Final 20% rides</span> to maximum target for windfall gains.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .glass-card {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
        }

        .bg-grid-pattern {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        .leverage-highlight {
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.15));
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-radius: 1.5rem;
          position: relative;
          overflow: hidden;
        }

        .leverage-highlight::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.03), transparent);
          animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }

        .leverage-badge {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
          border: 2px solid rgba(139, 92, 246, 0.5);
          border-radius: 1rem;
          font-size: 1.75rem;
          font-weight: 900;
          color: rgb(196, 181, 253);
          text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
        }

        .leverage-stat {
          padding: 1rem;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.3);
          border-radius: 0.75rem;
        }

        .position-toggle {
          flex: 1;
          padding: 0.75rem;
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          transition: all 0.3s;
          border: 2px solid;
          min-height: 80px;
          touch-action: manipulation;
        }

        @media (min-width: 640px) {
          .position-toggle {
            padding: 1rem;
            gap: 0.5rem;
            min-height: auto;
          }
        }

        .active-long {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1));
          border-color: rgba(16, 185, 129, 0.5);
          color: rgb(16, 185, 129);
        }

        .active-short {
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(239, 68, 68, 0.1));
          border-color: rgba(244, 63, 94, 0.5);
          color: rgb(244, 63, 94);
        }

        .inactive {
          background: rgba(30, 41, 59, 0.3);
          border-color: rgba(71, 85, 105, 0.3);
          color: rgba(148, 163, 184, 0.6);
        }

        .inactive:hover {
          background: rgba(30, 41, 59, 0.5);
          border-color: rgba(71, 85, 105, 0.5);
        }

        .risk-toggle {
          flex: 1;
          padding: 0.75rem;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s;
          border: 2px solid;
          min-height: 60px;
          touch-action: manipulation;
          justify-content: center;
        }

        @media (min-width: 640px) {
          .risk-toggle {
            padding: 0.875rem;
          }
        }

        .active-conservative {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1));
          border-color: rgba(16, 185, 129, 0.5);
          color: rgb(16, 185, 129);
        }

        .active-aggressive {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1));
          border-color: rgba(251, 191, 36, 0.5);
          color: rgb(251, 191, 36);
        }

        .inactive-risk {
          background: rgba(30, 41, 59, 0.3);
          border-color: rgba(71, 85, 105, 0.3);
          color: rgba(148, 163, 184, 0.6);
        }

        .inactive-risk:hover {
          background: rgba(30, 41, 59, 0.5);
          border-color: rgba(71, 85, 105, 0.5);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .warning-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .position-card {
          padding: 1rem;
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(71, 85, 105, 0.3);
          border-radius: 1rem;
        }

        @media (min-width: 640px) {
          .position-card {
            padding: 1.5rem;
            border-radius: 1.25rem;
          }
        }

        .input-group {
          position: relative;
        }

        .input-label {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          gap: 0.25rem;
        }

        @media (min-width: 640px) {
          .input-label {
            font-size: 0.875rem;
          }
        }

        .input-field {
          width: 100%;
          padding: 0.875rem 1rem;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.3);
          border-radius: 0.75rem;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.2s;
          min-height: 48px;
        }

        @media (min-width: 640px) {
          .input-field {
            padding: 1rem;
            font-size: 1.125rem;
          }
        }

        .input-field:focus {
          outline: none;
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(99, 102, 241, 0.5);
          ring: 2px;
          ring-color: rgba(99, 102, 241, 0.3);
        }

        .input-field::placeholder {
          color: rgba(148, 163, 184, 0.5);
        }

        .ratio-card {
          padding: 1.5rem;
          border-radius: 1.25rem;
          border: 1px solid;
        }

        @media (min-width: 640px) {
          .ratio-card {
            padding: 2rem;
            border-radius: 1.5rem;
          }
        }

        .status-badge {
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          border: 1px solid;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        @media (min-width: 640px) {
          .status-badge {
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
          }
        }

        .stat-card {
          padding: 1rem;
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(71, 85, 105, 0.3);
          border-radius: 1rem;
        }

        @media (min-width: 640px) {
          .stat-card {
            padding: 1.5rem;
            border-radius: 1.25rem;
          }
        }

        .ratio-bar-container {
          padding: 1rem;
          background: rgba(30, 41, 59, 0.3);
          border: 1px solid rgba(71, 85, 105, 0.2);
          border-radius: 1rem;
        }

        @media (min-width: 640px) {
          .ratio-bar-container {
            padding: 1.5rem;
            border-radius: 1.25rem;
          }
        }

        .risk-bar {
          flex: 1;
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(239, 68, 68, 0.2));
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }

        .reward-bar {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(5, 150, 105, 0.2));
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }

        .bar-label {
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0 0.5rem;
          text-align: center;
        }

        @media (min-width: 640px) {
          .bar-label {
            font-size: 0.875rem;
          }
        }

        .empty-state {
          padding: 3rem 1rem;
        }

        @media (min-width: 640px) {
          .empty-state {
            padding: 4rem 2rem;
          }
        }

        .tip-card {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 0.75rem;
        }

        @media (min-width: 640px) {
          .tip-card {
            margin-top: 1.5rem;
            padding: 1.25rem;
            border-radius: 1rem;
          }
        }

        .partial-tp-section {
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(20, 184, 166, 0.1));
          border: 2px solid rgba(16, 185, 129, 0.2);
          border-radius: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .tp-level-card {
          padding: 1rem;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid;
          border-radius: 1rem;
          transition: all 0.3s;
        }

        @media (min-width: 640px) {
          .tp-level-card {
            padding: 1.25rem;
          }
        }

        .tp-level-card.tp1 {
          border-color: rgba(16, 185, 129, 0.3);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.05));
        }

        .tp-level-card.tp1:hover {
          border-color: rgba(16, 185, 129, 0.5);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.08));
        }

        .tp-level-card.tp2 {
          border-color: rgba(20, 184, 166, 0.3);
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.05), rgba(13, 148, 136, 0.05));
        }

        .tp-level-card.tp2:hover {
          border-color: rgba(20, 184, 166, 0.5);
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(13, 148, 136, 0.08));
        }

        .tp-level-card.tp3 {
          border-color: rgba(59, 130, 246, 0.3);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.05));
        }

        .tp-level-card.tp3:hover {
          border-color: rgba(59, 130, 246, 0.5);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.08));
        }

        .tp-number {
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
          border: 1px solid rgba(99, 102, 241, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          color: rgb(196, 181, 253);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
};

export default App;