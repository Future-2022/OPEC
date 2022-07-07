import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3React } from "@web3-react/core";
import useSWR from "swr";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import TooltipComponent from "../../components/Tooltip/Tooltip";

import hexToRgba from "hex-to-rgba";
import { ethers } from "ethers";

import { getWhitelistedTokens, getTokenBySymbol } from "../../data/Tokens";
import { getFeeHistory } from "../../data/Fees";

import {
  fetcher,
  formatAmount,
  formatKeyAmount,
  expandDecimals,
  bigNumberify,
  numberWithCommas,
  formatDate,
  getServerUrl,
  getChainName,
  useChainId,
  USD_DECIMALS,
  OPEC_DECIMALS,
  XPC_DECIMALS,
  BASIS_POINTS_DIVISOR,
  ARBITRUM,
  AVALANCHE,
  getTotalVolumeSum,
  XPCPOOLCOLORS,
  DEFAULT_MAX_USDG_AMOUNT,
  getPageTitle,
} from "../../Helpers";
import { useTotalOpecInLiquidity, useOpecPrice, useTotalOpecStaked, useTotalOpecSupply, useInfoTokens } from "../../Api";

import { getContract } from "../../Addresses";

import VaultV2 from "../../abis/VaultV2.json";
import ReaderV2 from "../../abis/ReaderV2.json";
import XpcManager from "../../abis/XpcManager.json";
import Footer from "../../Footer";

import "./DashboardV2.css";

import opec40Icon from "../../img/ic_gmx_40.svg";
import xpc40Icon from "../../img/ic_glp_40.svg";
import avalanche16Icon from "../../img/ic_avalanche_16.svg";
import arbitrum16Icon from "../../img/ic_arbitrum_16.svg";
import arbitrum24Icon from "../../img/ic_arbitrum_24.svg";
import avalanche24Icon from "../../img/ic_avalanche_24.svg";

import AssetDropdown from "./AssetDropdown";
import SEO from "../../components/Common/SEO";

const { AddressZero } = ethers.constants;

function getVolumeInfo(hourlyVolume) {
  if (!hourlyVolume || hourlyVolume.length === 0) {
    return {};
  }

  const secondsPerHour = 60 * 60;
  const minTime = parseInt(Date.now() / 1000 / secondsPerHour) * secondsPerHour - 24 * secondsPerHour;

  const info = {};
  let totalVolume = bigNumberify(0);
  for (let i = 0; i < hourlyVolume.length; i++) {
    const item = hourlyVolume[i].data;
    if (parseInt(item.timestamp) < minTime) {
      break;
    }

    if (!info[item.token]) {
      info[item.token] = bigNumberify(0);
    }

    info[item.token] = info[item.token].add(item.volume);
    totalVolume = totalVolume.add(item.volume);
  }

  info.totalVolume = totalVolume;

  return info;
}

function getCurrentFeesUsd(tokenAddresses, fees, infoTokens) {
  if (!fees || !infoTokens) {
    return bigNumberify(0);
  }

  let currentFeesUsd = bigNumberify(0);
  for (let i = 0; i < tokenAddresses.length; i++) {
    const tokenAddress = tokenAddresses[i];
    const tokenInfo = infoTokens[tokenAddress];
    if (!tokenInfo || !tokenInfo.contractMinPrice) {
      continue;
    }

    const feeUsd = fees[i].mul(tokenInfo.contractMinPrice).div(expandDecimals(1, tokenInfo.decimals));
    currentFeesUsd = currentFeesUsd.add(feeUsd);
  }

  return currentFeesUsd;
}

export default function DashboardV2() {
  const { active, library } = useWeb3React();
  const { chainId } = useChainId();

  const chainName = getChainName(chainId);

  const positionStatsUrl = getServerUrl(chainId, "/position_stats");
  const { data: positionStats } = useSWR([positionStatsUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  const hourlyVolumeUrl = getServerUrl(chainId, "/hourly_volume");
  const { data: hourlyVolume } = useSWR([hourlyVolumeUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  const totalVolumeUrl = getServerUrl(chainId, "/total_volume");
  const { data: totalVolume } = useSWR([totalVolumeUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  let { total: totalOpecSupply } = useTotalOpecSupply();

  let totalLongPositionSizes;
  let totalShortPositionSizes;
  if (positionStats && positionStats.totalLongPositionSizes && positionStats.totalShortPositionSizes) {
    totalLongPositionSizes = bigNumberify(positionStats.totalLongPositionSizes);
    totalShortPositionSizes = bigNumberify(positionStats.totalShortPositionSizes);
  }

  const volumeInfo = getVolumeInfo(hourlyVolume);

  const totalVolumeSum = getTotalVolumeSum(totalVolume);

  const whitelistedTokens = getWhitelistedTokens(chainId);
  const whitelistedTokenAddresses = whitelistedTokens.map((token) => token.address);
  const tokenList = whitelistedTokens.filter((t) => !t.isWrapped);

  const readerAddress = getContract(chainId, "Reader");
  const vaultAddress = getContract(chainId, "Vault");
  const xpcManagerAddress = getContract(chainId, "XpcManager");

  const opecAddress = getContract(chainId, "OPEC");
  const xpcAddress = getContract(chainId, "XPC");
  const usdgAddress = getContract(chainId, "USDG");

  const tokensForSupplyQuery = [opecAddress, xpcAddress, usdgAddress];

  const { data: aums } = useSWR([`Dashboard:getAums:${active}`, chainId, xpcManagerAddress, "getAums"], {
    fetcher: fetcher(library, XpcManager),
  });

  const { data: fees } = useSWR([`Dashboard:fees:${active}`, chainId, readerAddress, "getFees", vaultAddress], {
    fetcher: fetcher(library, ReaderV2, [whitelistedTokenAddresses]),
  });

  const { data: totalSupplies } = useSWR(
    [`Dashboard:totalSupplies:${active}`, chainId, readerAddress, "getTokenBalancesWithSupplies", AddressZero],
    {
      fetcher: fetcher(library, ReaderV2, [tokensForSupplyQuery]),
    }
  );

  const { data: totalTokenWeights } = useSWR(
    [`XpcSwap:totalTokenWeights:${active}`, chainId, vaultAddress, "totalTokenWeights"],
    {
      fetcher: fetcher(library, VaultV2),
    }
  );

  const { infoTokens } = useInfoTokens(library, chainId, active, undefined, undefined);

  const eth = infoTokens[getTokenBySymbol(chainId, "ETH").address];
  const currentFeesUsd = getCurrentFeesUsd(whitelistedTokenAddresses, fees, infoTokens);

  const feeHistory = getFeeHistory(chainId);
  const shouldIncludeCurrrentFees = feeHistory.length && parseInt(Date.now() / 1000) - feeHistory[0].to > 60 * 60;
  let totalFeesDistributed = shouldIncludeCurrrentFees
    ? parseFloat(bigNumberify(formatAmount(currentFeesUsd, USD_DECIMALS - 2, 0, false)).toNumber()) / 100
    : 0;
  for (let i = 0; i < feeHistory.length; i++) {
    totalFeesDistributed += parseFloat(feeHistory[i].feeUsd);
  }

  const { opecPrice, opecPriceFromArbitrum, opecPriceFromAvalanche } = useOpecPrice(
    chainId,
    { arbitrum: chainId === ARBITRUM ? library : undefined },
    active
  );

  let { total: totalOpecInLiquidity } = useTotalOpecInLiquidity(chainId, active);

  let { avax: avaxStakedOpec, arbitrum: arbitrumStakedOpec, total: totalStakedOpec } = useTotalOpecStaked();

  let opecMarketCap;
  if (opecPrice && totalOpecSupply) {
    opecMarketCap = opecPrice.mul(totalOpecSupply).div(expandDecimals(1, OPEC_DECIMALS));
  }

  let stakedOpecSupplyUsd;
  if (opecPrice && totalStakedOpec) {
    stakedOpecSupplyUsd = totalStakedOpec.mul(opecPrice).div(expandDecimals(1, OPEC_DECIMALS));
  }

  let aum;
  if (aums && aums.length > 0) {
    aum = aums[0].add(aums[1]).div(2);
  }

  let xpcPrice;
  let xpcSupply;
  let xpcMarketCap;
  if (aum && totalSupplies && totalSupplies[3]) {
    xpcSupply = totalSupplies[3];
    xpcPrice =
      aum && aum.gt(0) && xpcSupply.gt(0)
        ? aum.mul(expandDecimals(1, XPC_DECIMALS)).div(xpcSupply)
        : expandDecimals(1, USD_DECIMALS);
    xpcMarketCap = xpcPrice.mul(xpcSupply).div(expandDecimals(1, XPC_DECIMALS));
  }

  let tvl;
  if (xpcMarketCap && opecPrice && totalStakedOpec) {
    tvl = xpcMarketCap.add(opecPrice.mul(totalStakedOpec).div(expandDecimals(1, OPEC_DECIMALS)));
  }

  const ethFloorPriceFund = expandDecimals(350 + 148 + 384, 18);
  const xpcFloorPriceFund = expandDecimals(660001, 18);
  const usdcFloorPriceFund = expandDecimals(784598 + 200000, 30);

  let totalFloorPriceFundUsd;

  if (eth && eth.contractMinPrice && xpcPrice) {
    const ethFloorPriceFundUsd = ethFloorPriceFund.mul(eth.contractMinPrice).div(expandDecimals(1, eth.decimals));
    const xpcFloorPriceFundUsd = xpcFloorPriceFund.mul(xpcPrice).div(expandDecimals(1, 18));

    totalFloorPriceFundUsd = ethFloorPriceFundUsd.add(xpcFloorPriceFundUsd).add(usdcFloorPriceFund);
  }

  let adjustedUsdgSupply = bigNumberify(0);

  for (let i = 0; i < tokenList.length; i++) {
    const token = tokenList[i];
    const tokenInfo = infoTokens[token.address];
    if (tokenInfo && tokenInfo.usdgAmount) {
      adjustedUsdgSupply = adjustedUsdgSupply.add(tokenInfo.usdgAmount);
    }
  }

  const getWeightText = (tokenInfo) => {
    if (
      !tokenInfo.weight ||
      !tokenInfo.usdgAmount ||
      !adjustedUsdgSupply ||
      adjustedUsdgSupply.eq(0) ||
      !totalTokenWeights
    ) {
      return "...";
    }

    const currentWeightBps = tokenInfo.usdgAmount.mul(BASIS_POINTS_DIVISOR).div(adjustedUsdgSupply);
    const targetWeightBps = tokenInfo.weight.mul(BASIS_POINTS_DIVISOR).div(totalTokenWeights);

    const weightText = `${formatAmount(currentWeightBps, 2, 2, false)}% / ${formatAmount(
      targetWeightBps,
      2,
      2,
      false
    )}%`;

    return (
      <TooltipComponent
        handle={weightText}
        position="right-bottom"
        renderContent={() => {
          return (
            <>
              Current Weight: {formatAmount(currentWeightBps, 2, 2, false)}%<br />
              Target Weight: {formatAmount(targetWeightBps, 2, 2, false)}%<br />
              <br />
              {currentWeightBps.lt(targetWeightBps) && (
                <div>
                  {tokenInfo.symbol} is below its target weight.
                  <br />
                  <br />
                  Get lower fees to{" "}
                  <Link to="/buy_xpc" target="_blank" rel="noopener noreferrer">
                    buy XPC
                  </Link>{" "}
                  with {tokenInfo.symbol},&nbsp; and to{" "}
                  <Link to="/trade" target="_blank" rel="noopener noreferrer">
                    swap
                  </Link>{" "}
                  {tokenInfo.symbol} for other tokens.
                </div>
              )}
              {currentWeightBps.gt(targetWeightBps) && (
                <div>
                  {tokenInfo.symbol} is above its target weight.
                  <br />
                  <br />
                  Get lower fees to{" "}
                  <Link to="/trade" target="_blank" rel="noopener noreferrer">
                    swap
                  </Link>{" "}
                  tokens for {tokenInfo.symbol}.
                </div>
              )}
              <br />
              <div>
                <a href="https://gmxio.gitbook.io/gmx/xpc" target="_blank" rel="noopener noreferrer">
                  More Info
                </a>
              </div>
            </>
          );
        }}
      />
    );
  };

  let stakedPercent = 0;

  if (totalOpecSupply && !totalOpecSupply.isZero() && !totalStakedOpec.isZero()) {
    stakedPercent = totalStakedOpec.mul(100).div(totalOpecSupply).toNumber();
  }

  let liquidityPercent = 0;

  if (totalOpecSupply && !totalOpecSupply.isZero() && totalOpecInLiquidity) {
    liquidityPercent = totalOpecInLiquidity.mul(100).div(totalOpecSupply).toNumber();
  }

  let notStakedPercent = 100 - stakedPercent - liquidityPercent;

  let opecDistributionData = [
    {
      name: "staked",
      value: stakedPercent,
      color: "#4353fa",
    },
    {
      name: "in liquidity",
      value: liquidityPercent,
      color: "#0598fa",
    },
    {
      name: "not staked",
      value: notStakedPercent,
      color: "#5c0af5",
    },
  ];

  const totalStatsStartDate = chainId === AVALANCHE ? "06 Jan 2022" : "01 Sep 2021";

  let stableXpc = 0;
  let totalXpc = 0;

  let xpcPool = tokenList.map((token) => {
    const tokenInfo = infoTokens[token.address];
    if (tokenInfo.usdgAmount && adjustedUsdgSupply) {
      const currentWeightBps = tokenInfo.usdgAmount.mul(BASIS_POINTS_DIVISOR).div(adjustedUsdgSupply);
      if (tokenInfo.isStable) {
        stableXpc += parseFloat(`${formatAmount(currentWeightBps, 2, 2, false)}`);
      }
      totalXpc += parseFloat(`${formatAmount(currentWeightBps, 2, 2, false)}`);
      return {
        fullname: token.name,
        name: token.symbol,
        value: parseFloat(`${formatAmount(currentWeightBps, 2, 2, false)}`),
      };
    }
    return null;
  });

  let stablePercentage = totalXpc > 0 ? ((stableXpc * 100) / totalXpc).toFixed(2) : "0.0";

  xpcPool = xpcPool.filter(function (element) {
    return element !== null;
  });

  xpcPool = xpcPool.sort(function (a, b) {
    if (a.value < b.value) return 1;
    else return -1;
  });

  opecDistributionData = opecDistributionData.sort(function (a, b) {
    if (a.value < b.value) return 1;
    else return -1;
  });

  const [opecActiveIndex, setOPECActiveIndex] = useState(null);

  const onOPECDistributionChartEnter = (_, index) => {
    setOPECActiveIndex(index);
  };

  const onOPECDistributionChartLeave = (_, index) => {
    setOPECActiveIndex(null);
  };

  const [xpcActiveIndex, setXPCActiveIndex] = useState(null);

  const onXPCPoolChartEnter = (_, index) => {
    setXPCActiveIndex(index);
  };

  const onXPCPoolChartLeave = (_, index) => {
    setXPCActiveIndex(null);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="stats-label">
          <div className="stats-label-color" style={{ backgroundColor: payload[0].color }}></div>
          {payload[0].value}% {payload[0].name}
        </div>
      );
    }

    return null;
  };

  return (
    <SEO title={getPageTitle("Dashboard")}>
      <div className="default-container DashboardV2 page-layout">
        <div className="section-title-block">
          <div className="section-title-icon"></div>
          <div className="section-title-content">
            <div className="Page-title">
              Stats {chainId === AVALANCHE && <img src={avalanche24Icon} alt="avalanche24Icon" />}
              {chainId === ARBITRUM && <img src={arbitrum24Icon} alt="arbitrum24Icon" />}
            </div>
            <div className="Page-description">
              {chainName} Total Stats start from {totalStatsStartDate}.<br /> For detailed stats:{" "}
              {chainId === ARBITRUM && (
                <a href="https://stats.opec.io" target="_blank" rel="noopener noreferrer">
                  https://stats.opec.io
                </a>
              )}
              {chainId === AVALANCHE && (
                <a href="https://stats.opec.io/avalanche" target="_blank" rel="noopener noreferrer">
                  https://stats.opec.io/avalanche
                </a>
              )}
              .
            </div>
          </div>
        </div>
        <div className="DashboardV2-content">
          <div className="DashboardV2-cards">
            <div className="App-card">
              <div className="App-card-title">Overview</div>
              <div className="App-card-divider"></div>
              <div className="App-card-content">
                <div className="App-card-row">
                  <div className="label">AUM</div>
                  <div>
                    <TooltipComponent
                      handle={`$${formatAmount(tvl, USD_DECIMALS, 0, true)}`}
                      position="right-bottom"
                      renderContent={() => `Assets Under Management: OPEC staked (All chains) + XPC pool (${chainName})`}
                    />
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">XPC Pool</div>
                  <div>
                    <TooltipComponent
                      handle={`$${formatAmount(aum, USD_DECIMALS, 0, true)}`}
                      position="right-bottom"
                      renderContent={() => `Total value of tokens in XPC pool (${chainName})`}
                    />
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">24h Volume</div>
                  <div>${formatAmount(volumeInfo.totalVolume, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row">
                  <div className="label">Long Positions</div>
                  <div>${formatAmount(totalLongPositionSizes, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row">
                  <div className="label">Short Positions</div>
                  <div>${formatAmount(totalShortPositionSizes, USD_DECIMALS, 0, true)}</div>
                </div>
                {feeHistory.length ? (
                  <div className="App-card-row">
                    <div className="label">Fees since {formatDate(feeHistory[0].to)}</div>
                    <div>${formatAmount(currentFeesUsd, USD_DECIMALS, 2, true)}</div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="App-card">
              <div className="App-card-title">Total Stats</div>
              <div className="App-card-divider"></div>
              <div className="App-card-content">
                <div className="App-card-row">
                  <div className="label">Total Fees</div>
                  <div>${numberWithCommas(totalFeesDistributed.toFixed(0))}</div>
                </div>
                <div className="App-card-row">
                  <div className="label">Total Volume</div>
                  <div>${formatAmount(totalVolumeSum, USD_DECIMALS, 0, true)}</div>
                </div>
                <div className="App-card-row">
                  <div className="label">Floor Price Fund</div>
                  <div>${formatAmount(totalFloorPriceFundUsd, 30, 0, true)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">
              Tokens {chainId === AVALANCHE && <img src={avalanche24Icon} alt="avalanche24Icon" />}
              {chainId === ARBITRUM && <img src={arbitrum24Icon} alt="arbitrum24Icon" />}
            </div>
            <div className="Page-description">Platform and XPC index tokens.</div>
          </div>
          <div className="DashboardV2-token-cards">
            <div className="stats-wrapper stats-wrapper--opec">
              <div className="App-card">
                <div className="stats-block">
                  <div className="App-card-title">
                    <div className="App-card-title-mark">
                      <div className="App-card-title-mark-icon">
                        <img src={opec40Icon} alt="opec40Icon" />
                      </div>
                      <div className="App-card-title-mark-info">
                        <div className="App-card-title-mark-title">OPEC</div>
                        <div className="App-card-title-mark-subtitle">OPEC</div>
                      </div>
                      <div>
                        <AssetDropdown assetSymbol="OPEC" />
                      </div>
                    </div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">Price</div>
                      <div>
                        {!opecPrice && "..."}
                        {opecPrice && (
                          <TooltipComponent
                            position="right-bottom"
                            className="nowrap"
                            handle={"$" + formatAmount(opecPrice, USD_DECIMALS, 2, true)}
                            renderContent={() => (
                              <>
                                Price on Arbitrum: ${formatAmount(opecPriceFromArbitrum, USD_DECIMALS, 2, true)}
                                <br />
                                Price on Avalanche: ${formatAmount(opecPriceFromAvalanche, USD_DECIMALS, 2, true)}
                              </>
                            )}
                          />
                        )}
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Supply</div>
                      <div>{formatAmount(totalOpecSupply, OPEC_DECIMALS, 0, true)} OPEC</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Total Staked</div>
                      <div>
                        {
                          <TooltipComponent
                            position="right-bottom"
                            className="nowrap"
                            handle={`$${formatAmount(stakedOpecSupplyUsd, USD_DECIMALS, 0, true)}`}
                            renderContent={() => (
                              <>
                                Staked on Arbitrum: {formatAmount(arbitrumStakedOpec, OPEC_DECIMALS, 0, true)} OPEC
                                <br />
                                Staked on Avalanche: {formatAmount(avaxStakedOpec, OPEC_DECIMALS, 0, true)} OPEC
                              </>
                            )}
                          />
                        }
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Market Cap</div>
                      <div>${formatAmount(opecMarketCap, USD_DECIMALS, 0, true)}</div>
                    </div>
                  </div>
                </div>
                <div className="stats-piechart" onMouseLeave={onOPECDistributionChartLeave}>
                  {opecDistributionData.length > 0 && (
                    <PieChart width={210} height={210}>
                      <Pie
                        data={opecDistributionData}
                        cx={100}
                        cy={100}
                        innerRadius={73}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={2}
                        onMouseEnter={onOPECDistributionChartEnter}
                        onMouseOut={onOPECDistributionChartLeave}
                        onMouseLeave={onOPECDistributionChartLeave}
                      >
                        {opecDistributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            style={{
                              filter:
                                opecActiveIndex === index
                                  ? `drop-shadow(0px 0px 6px ${hexToRgba(entry.color, 0.7)})`
                                  : "none",
                              cursor: "pointer",
                            }}
                            stroke={entry.color}
                            strokeWidth={opecActiveIndex === index ? 1 : 1}
                          />
                        ))}
                      </Pie>
                      <text x={"50%"} y={"50%"} fill="white" textAnchor="middle" dominantBaseline="middle">
                        Distribution
                      </text>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  )}
                </div>
              </div>
              <div className="App-card">
                <div className="stats-block">
                  <div className="App-card-title">
                    <div className="App-card-title-mark">
                      <div className="App-card-title-mark-icon">
                        <img src={xpc40Icon} alt="xpc40Icon" />
                        {chainId === ARBITRUM ? (
                          <img src={arbitrum16Icon} alt="arbitrum16Icon" className="selected-network-symbol" />
                        ) : (
                          <img src={avalanche16Icon} alt="avalanche16Icon" className="selected-network-symbol" />
                        )}
                      </div>
                      <div className="App-card-title-mark-info">
                        <div className="App-card-title-mark-title">XPC</div>
                        <div className="App-card-title-mark-subtitle">XPC</div>
                      </div>
                      <div>
                        <AssetDropdown assetSymbol="XPC" />
                      </div>
                    </div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">Price</div>
                      <div>${formatAmount(xpcPrice, USD_DECIMALS, 3, true)}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Supply</div>
                      <div>{formatAmount(xpcSupply, XPC_DECIMALS, 0, true)} XPC</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Total Staked</div>
                      <div>${formatAmount(xpcMarketCap, USD_DECIMALS, 0, true)}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Market Cap</div>
                      <div>${formatAmount(xpcMarketCap, USD_DECIMALS, 0, true)}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Stablecoin Percentage</div>
                      <div>{stablePercentage}%</div>
                    </div>
                  </div>
                </div>
                <div className="stats-piechart" onMouseOut={onXPCPoolChartLeave}>
                  {xpcPool.length > 0 && (
                    <PieChart width={210} height={210}>
                      <Pie
                        data={xpcPool}
                        cx={100}
                        cy={100}
                        innerRadius={73}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        onMouseEnter={onXPCPoolChartEnter}
                        onMouseOut={onXPCPoolChartLeave}
                        onMouseLeave={onXPCPoolChartLeave}
                        paddingAngle={2}
                      >
                        {xpcPool.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={XPCPOOLCOLORS[entry.name]}
                            style={{
                              filter:
                                xpcActiveIndex === index
                                  ? `drop-shadow(0px 0px 6px ${hexToRgba(XPCPOOLCOLORS[entry.name], 0.7)})`
                                  : "none",
                              cursor: "pointer",
                            }}
                            stroke={XPCPOOLCOLORS[entry.name]}
                            strokeWidth={xpcActiveIndex === index ? 1 : 1}
                          />
                        ))}
                      </Pie>
                      <text x={"50%"} y={"50%"} fill="white" textAnchor="middle" dominantBaseline="middle">
                        XPC Pool
                      </text>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  )}
                </div>
              </div>
            </div>
            <div className="token-table-wrapper App-card">
              <div className="App-card-title">
                XPC Index Composition {chainId === AVALANCHE && <img src={avalanche16Icon} alt="avalanche16Icon" />}
                {chainId === ARBITRUM && <img src={arbitrum16Icon} alt="arbitrum16Icon" />}
              </div>
              <div className="App-card-divider"></div>
              <table className="token-table">
                <thead>
                  <tr>
                    <th>TOKEN</th>
                    <th>PRICE</th>
                    <th>POOL</th>
                    <th>WEIGHT</th>
                    <th>UTILIZATION</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenList.map((token) => {
                    const tokenInfo = infoTokens[token.address];
                    let utilization = bigNumberify(0);
                    if (tokenInfo && tokenInfo.reservedAmount && tokenInfo.poolAmount && tokenInfo.poolAmount.gt(0)) {
                      utilization = tokenInfo.reservedAmount.mul(BASIS_POINTS_DIVISOR).div(tokenInfo.poolAmount);
                    }
                    let maxUsdgAmount = DEFAULT_MAX_USDG_AMOUNT;
                    if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
                      maxUsdgAmount = tokenInfo.maxUsdgAmount;
                    }

                    var tokenImage = null;

                    try {
                      tokenImage = require("../../img/ic_" + token.symbol.toLowerCase() + "_40.svg");
                    } catch (error) {
                      console.error(error);
                    }

                    return (
                      <tr key={token.symbol}>
                        <td>
                          <div className="token-symbol-wrapper">
                            <div className="App-card-title-info">
                              <div className="App-card-title-info-icon">
                                <img src={tokenImage && tokenImage.default} alt={token.symbol} width="40px" />
                              </div>
                              <div className="App-card-title-info-text">
                                <div className="App-card-info-title">{token.name}</div>
                                <div className="App-card-info-subtitle">{token.symbol}</div>
                              </div>
                              <div>
                                <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}</td>
                        <td>
                          <TooltipComponent
                            handle={`$${formatKeyAmount(tokenInfo, "managedUsd", USD_DECIMALS, 0, true)}`}
                            position="right-bottom"
                            renderContent={() => {
                              return (
                                <>
                                  Pool Amount: {formatKeyAmount(tokenInfo, "managedAmount", token.decimals, 2, true)}{" "}
                                  {token.symbol}
                                  <br />
                                  <br />
                                  Max {tokenInfo.symbol} Capacity: ${formatAmount(maxUsdgAmount, 18, 0, true)}
                                </>
                              );
                            }}
                          />
                        </td>
                        <td>{getWeightText(tokenInfo)}</td>
                        <td>{formatAmount(utilization, 2, 2, false)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="token-grid">
              {tokenList.map((token) => {
                const tokenInfo = infoTokens[token.address];
                let utilization = bigNumberify(0);
                if (tokenInfo && tokenInfo.reservedAmount && tokenInfo.poolAmount && tokenInfo.poolAmount.gt(0)) {
                  utilization = tokenInfo.reservedAmount.mul(BASIS_POINTS_DIVISOR).div(tokenInfo.poolAmount);
                }
                let maxUsdgAmount = DEFAULT_MAX_USDG_AMOUNT;
                if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
                  maxUsdgAmount = tokenInfo.maxUsdgAmount;
                }

                return (
                  <div className="App-card" key={token.symbol}>
                    <div className="App-card-title">
                      <div style={{ display: "flex" }}>
                        {token.symbol}
                        <div>
                          <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                        </div>
                      </div>
                    </div>
                    <div className="App-card-divider"></div>
                    <div className="App-card-content">
                      <div className="App-card-row">
                        <div className="label">Price</div>
                        <div>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}</div>
                      </div>
                      <div className="App-card-row">
                        <div className="label">Pool</div>
                        <div>
                          <TooltipComponent
                            handle={`$${formatKeyAmount(tokenInfo, "managedUsd", USD_DECIMALS, 0, true)}`}
                            position="right-bottom"
                            renderContent={() => {
                              return (
                                <>
                                  Pool Amount: {formatKeyAmount(tokenInfo, "managedAmount", token.decimals, 2, true)}{" "}
                                  {token.symbol}
                                  <br />
                                  <br />
                                  Max {tokenInfo.symbol} Capacity: ${formatAmount(maxUsdgAmount, 18, 0, true)}
                                </>
                              );
                            }}
                          />
                        </div>
                      </div>
                      <div className="App-card-row">
                        <div className="label">Weight</div>
                        <div>{getWeightText(tokenInfo)}</div>
                      </div>
                      <div className="App-card-row">
                        <div className="label">Utilization</div>
                        <div>{formatAmount(utilization, 2, 2, false)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </SEO>
  );
}
