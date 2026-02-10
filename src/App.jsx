import React, { useState, useEffect } from "react";

const App = () => {
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [totalCapital, setTotalCapital] = useState("");
  const [riskPercentage, setRiskPercentage] = useState("1");
  const [assetAllocation, setAssetAllocation] = useState("10");
  const [leverage, setLeverage] = useState("1");
  const [positionType, setPositionType] = useState("long");
  const [exchangeRate, setExchangeRate] = useState(58.52); // Default PHP to USD rate
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  // Fetch exchange rate on component mount
  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      // Try multiple API sources for better accuracy
      const apis = [
        "https://api.frankfurter.app/latest?from=USD&to=PHP",
        "https://open.er-api.com/v6/latest/USD",
        "https://api.exchangerate-api.com/v4/latest/USD",
      ];

      for (const apiUrl of apis) {
        try {
          const response = await fetch(apiUrl);
          const data = await response.json();

          // Handle different API response formats
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
      // Keep default rate if all APIs fail
    } finally {
      setIsLoadingRate(false);
    }
  };

  const formatPHP = (usdAmount) => {
    if (!usdAmount) return "₱0.00";
    const phpAmount = usdAmount * exchangeRate;
    return `₱${phpAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateRiskReward = () => {
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    const target = parseFloat(takeProfit);
    const capital = parseFloat(totalCapital);
    const riskPct = parseFloat(riskPercentage);
    const allocation = parseFloat(assetAllocation);
    const lev = parseFloat(leverage);

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
    let maxPositionSize = 0;
    let recommendedAssets = 0;
    let potentialLoss = 0;
    let potentialProfit = 0;
    let allocatedAmount = 0;

    if (capital) {
      // Max risk amount based on risk percentage (1% of capital)
      maxRiskAmount = (capital * riskPct) / 100;

      // Max position size based on allocation (10-25% of capital)
      maxPositionSize = (capital * allocation) / 100;

      // Amount actually allocated
      allocatedAmount = maxPositionSize;

      // Calculate how many coins we can buy with leverage
      recommendedAssets = (maxPositionSize * lev) / entry;

      // Calculate actual risk and reward
      potentialLoss = recommendedAssets * riskPerCoin;
      potentialProfit = recommendedAssets * rewardPerCoin;
    }

    // Leverage recommendation
    const leverageRecommendation = getLeverageRecommendation(
      ratio,
      riskPerCoin,
      entry,
    );

    return {
      riskPerCoin,
      rewardPerCoin,
      ratio,
      maxRiskAmount,
      maxPositionSize,
      recommendedAssets,
      potentialLoss,
      potentialProfit,
      allocatedAmount,
      leverageRecommendation,
      error: false,
    };
  };

  const getLeverageRecommendation = (ratio, riskPerCoin, entry) => {
    const riskPercentage = (riskPerCoin / entry) * 100;

    // Conservative recommendations based on R:R and volatility
    if (ratio >= 3 && riskPercentage <= 2) {
      return { min: 3, max: 5, recommended: 3, level: "moderate" };
    } else if (ratio >= 2 && riskPercentage <= 3) {
      return { min: 2, max: 3, recommended: 2, level: "conservative" };
    } else if (ratio >= 1.5 && riskPercentage <= 5) {
      return { min: 1, max: 2, recommended: 1, level: "very conservative" };
    } else {
      return { min: 1, max: 1, recommended: 1, level: "spot only" };
    }
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

  const color =
    results && !results.error ? getRatioColor(results.ratio) : "slate";

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

    // Check if risk % is within safe limits (1-2%)
    const isSafeRisk = riskPct >= 1 && riskPct <= 2;

    // Check if allocation is within recommended range (10-25%)
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
                    <svg
                      className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                      Bitget Risk-Reward Calculator
                    </h1>
                    <p className="text-purple-100 mt-1 text-xs sm:text-base">
                      Professional crypto trading with smart risk management
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <div className="text-white/90 text-xs sm:text-sm font-medium">
                    Exchange Rate
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                    $1 = {formatPHP(1)}
                    <button
                      onClick={fetchExchangeRate}
                      disabled={isLoadingRate}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                      title="Refresh exchange rate"
                    >
                      <svg
                        className={`w-4 h-4 text-white ${isLoadingRate ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
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
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  <span className="font-bold text-sm sm:text-base">LONG</span>
                  <span className="text-xs opacity-75 hidden sm:block">
                    Buy Low, Sell High
                  </span>
                </button>
                <button
                  onClick={() => setPositionType("short")}
                  className={`position-toggle ${positionType === "short" ? "active-short" : "inactive"}`}
                >
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                    />
                  </svg>
                  <span className="font-bold text-sm sm:text-base">SHORT</span>
                  <span className="text-xs opacity-75 hidden sm:block">
                    Sell High, Buy Low
                  </span>
                </button>
              </div>
            </div>

            {/* Risk Management Section */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl sm:rounded-2xl">
              <h3 className="text-base sm:text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Risk Management Settings
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

                {/* Risk Percentage */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Risk per Trade</span>
                    <span
                      className={`ml-2 text-xs ${parseFloat(riskPercentage) <= 2 ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      ({parseFloat(riskPercentage) <= 2 ? "Safe" : "High Risk"})
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="5"
                      value={riskPercentage}
                      onChange={(e) => setRiskPercentage(e.target.value)}
                      className="input-field pr-8"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      %
                    </span>
                  </div>
                </div>

                {/* Asset Allocation */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Asset Allocation</span>
                    <span
                      className={`ml-2 text-xs ${parseFloat(assetAllocation) >= 10 && parseFloat(assetAllocation) <= 25 ? "text-emerald-400" : "text-amber-400"}`}
                    >
                      (
                      {parseFloat(assetAllocation) >= 10 &&
                      parseFloat(assetAllocation) <= 25
                        ? "Optimal"
                        : "Review"}
                      )
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
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      %
                    </span>
                  </div>
                  {totalCapital && assetAllocation && (
                    <div className="mt-1 text-xs text-indigo-400">
                      {(
                        (parseFloat(totalCapital) *
                          parseFloat(assetAllocation)) /
                        100
                      ).toFixed(2)}{" "}
                      USD allocated
                    </div>
                  )}
                </div>

                {/* Leverage */}
                <div className="input-group">
                  <label className="input-label">
                    <span className="text-slate-300">Leverage</span>
                    {results &&
                      !results.error &&
                      results.leverageRecommendation && (
                        <span className="ml-2 text-xs text-indigo-400">
                          (Rec: {results.leverageRecommendation.recommended}x)
                        </span>
                      )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="125"
                      value={leverage}
                      onChange={(e) => setLeverage(e.target.value)}
                      className="input-field pr-8"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      x
                    </span>
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
                    <span className="text-xs text-slate-500 ml-2">
                      (below ${entryPrice})
                    </span>
                  )}
                  {positionType === "short" && entryPrice && (
                    <span className="text-xs text-slate-500 ml-2">
                      (above ${entryPrice})
                    </span>
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
                    <span className="text-xs text-slate-500 ml-2">
                      (above ${entryPrice})
                    </span>
                  )}
                  {positionType === "short" && entryPrice && (
                    <span className="text-xs text-slate-500 ml-2">
                      (below ${entryPrice})
                    </span>
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

            {/* Error Message */}
            {results && results.error && (
              <div className="error-message">
                <svg
                  className="w-5 h-5 text-rose-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-rose-300 text-sm">{getErrorMessage()}</p>
              </div>
            )}

            {/* Risk Management Warning */}
            {!isRiskManagementValid() && (
              <div className="warning-message">
                <svg
                  className="w-5 h-5 text-amber-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-amber-300 text-sm">
                  Recommended: 1-2% risk per trade and 10-25% asset allocation
                  to avoid overexposure!
                </p>
              </div>
            )}

            {/* Results Section */}
            {results && !results.error && (
              <div className="space-y-6 animate-fade-in">
                {/* Main Ratio Card */}
                <div
                  className={`ratio-card bg-gradient-to-br from-${color}-500/10 to-${color}-600/5 border-${color}-500/20`}
                >
                  <div className="text-center">
                    <p className="text-slate-500 text-xs sm:text-sm font-medium uppercase tracking-wider mb-3">
                      Risk-Reward Ratio
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                      <div
                        className={`text-4xl sm:text-6xl font-black text-${color}-400`}
                      >
                        1:{results.ratio.toFixed(2)}
                      </div>
                      <div
                        className={`status-badge bg-${color}-500/20 border-${color}-400/30 text-${color}-300`}
                      >
                        {getRatioLabel(results.ratio)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Position Sizing Info */}
                {totalCapital && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="position-card">
                      <h4 className="text-indigo-300 font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        Position Sizing
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Max Risk Amount
                          </span>
                          <div className="text-right">
                            <span className="text-white font-bold block">
                              ${results.maxRiskAmount.toFixed(2)}
                            </span>
                            <span className="text-indigo-400 text-xs">
                              {formatPHP(results.maxRiskAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Max Position Size
                          </span>
                          <div className="text-right">
                            <span className="text-white font-bold block">
                              ${results.maxPositionSize.toFixed(2)}
                            </span>
                            <span className="text-indigo-400 text-xs">
                              {formatPHP(results.maxPositionSize)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                          <span className="text-indigo-300 text-sm font-semibold">
                            Recommended Assets
                          </span>
                          <span className="text-indigo-400 font-bold text-lg">
                            {results.recommendedAssets.toFixed(4)} coins
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="position-card">
                      <h4 className="text-purple-300 font-semibold mb-4 flex items-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Leverage Recommendation
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Strategy Level
                          </span>
                          <span className="text-white font-bold capitalize">
                            {results.leverageRecommendation.level}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Safe Range
                          </span>
                          <span className="text-white font-bold">
                            {results.leverageRecommendation.min}x -{" "}
                            {results.leverageRecommendation.max}x
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                          <span className="text-purple-300 text-sm font-semibold">
                            Recommended
                          </span>
                          <span className="text-purple-400 font-bold text-lg">
                            {results.leverageRecommendation.recommended}x
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
                        <svg
                          className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                          />
                        </svg>
                      </div>
                    </div>
                    {totalCapital && (
                      <div className="pt-4 border-t border-rose-500/10">
                        <p className="text-rose-300/70 text-xs sm:text-sm">
                          Total Risk
                        </p>
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
                        <svg
                          className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                      </div>
                    </div>
                    {totalCapital && (
                      <div className="pt-4 border-t border-emerald-500/10">
                        <p className="text-emerald-300/70 text-xs sm:text-sm">
                          Total Profit
                        </p>
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
                      <span className="bar-label">
                        Reward {results.ratio.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!results && (
              <div className="empty-state">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4 mx-auto">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-slate-400 text-center text-sm sm:text-base px-4">
                  Enter your trade parameters to calculate risk-reward ratio
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
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-indigo-300 font-semibold mb-1 text-sm sm:text-base">
                Bitget Trading Tips
              </p>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                <span className="font-semibold text-emerald-400">
                  Risk 1-2%
                </span>{" "}
                of total capital per trade.
                <span className="mx-1 sm:mx-2">•</span>
                <span className="font-semibold text-blue-400">
                  Allocate 10-25%
                </span>{" "}
                max per position to avoid overexposure.
                <span className="mx-1 sm:mx-2">•</span>
                Use{" "}
                <span className="font-semibold text-purple-400">
                  low leverage (1-3x)
                </span>{" "}
                for safer trades.
                <span className="mx-1 sm:mx-2">•</span>
                Aim for minimum{" "}
                <span className="font-semibold text-amber-400">
                  1:2 R:R
                </span>{" "}
                ratio.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05) 1px,
              transparent 1px
            );
          background-size: 20px 20px;
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
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.2),
            rgba(5, 150, 105, 0.1)
          );
          border-color: rgba(16, 185, 129, 0.5);
          color: rgb(16, 185, 129);
        }

        .active-short {
          background: linear-gradient(
            135deg,
            rgba(244, 63, 94, 0.2),
            rgba(239, 68, 68, 0.1)
          );
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
          background: linear-gradient(
            135deg,
            rgba(244, 63, 94, 0.3),
            rgba(239, 68, 68, 0.2)
          );
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }

        .reward-bar {
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.3),
            rgba(5, 150, 105, 0.2)
          );
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
      `}</style>
    </div>
  );
};

export default App;
