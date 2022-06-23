import React, { useCallback } from "react";
import Footer from "../../Footer";
import { Link, NavLink } from "react-router-dom";

import "./Home.css";

import totaluserIcon from "../../img/ic_totaluser.svg";
import statsIcon from "../../img/ic_stats.svg";
import tradingIcon from "../../img/ic_trading.svg";

import useSWR from "swr";

import {
  formatAmount,
  bigNumberify,
  numberWithCommas,
  getServerUrl,
  USD_DECIMALS,
  useChainId,
  ARBITRUM,
  AVALANCHE,
  switchNetwork,
  getTotalVolumeSum,
} from "../../Helpers";

import { useWeb3React } from "@web3-react/core";

import { useUserStat } from "../../Api";


export default function Home() {

  const { chainId } = useChainId();
  const { active } = useWeb3React();

  // ARBITRUM

  const arbitrumPositionStatsUrl = getServerUrl(ARBITRUM, "/position_stats");
  const { data: arbitrumPositionStats } = useSWR([arbitrumPositionStatsUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  const arbitrumTotalVolumeUrl = getServerUrl(ARBITRUM, "/total_volume");
  const { data: arbitrumTotalVolume } = useSWR([arbitrumTotalVolumeUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  // AVALANCHE

  const avalanchePositionStatsUrl = getServerUrl(AVALANCHE, "/position_stats");
  const { data: avalanchePositionStats } = useSWR([avalanchePositionStatsUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  const avalancheTotalVolumeUrl = getServerUrl(AVALANCHE, "/total_volume");
  const { data: avalancheTotalVolume } = useSWR([avalancheTotalVolumeUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });

  // Total Volume

  const arbitrumTotalVolumeSum = getTotalVolumeSum(arbitrumTotalVolume);
  const avalancheTotalVolumeSum = getTotalVolumeSum(avalancheTotalVolume);

  let totalVolumeSum = bigNumberify(0);
  if (arbitrumTotalVolumeSum && avalancheTotalVolumeSum) {
    totalVolumeSum = totalVolumeSum.add(arbitrumTotalVolumeSum);
    totalVolumeSum = totalVolumeSum.add(avalancheTotalVolumeSum);
  }

  // Open Interest

  let openInterest = bigNumberify(0);
  if (
    arbitrumPositionStats &&
    arbitrumPositionStats.totalLongPositionSizes &&
    arbitrumPositionStats.totalShortPositionSizes
  ) {
    openInterest = openInterest.add(arbitrumPositionStats.totalLongPositionSizes);
    openInterest = openInterest.add(arbitrumPositionStats.totalShortPositionSizes);
  }

  if (
    avalanchePositionStats &&
    avalanchePositionStats.totalLongPositionSizes &&
    avalanchePositionStats.totalShortPositionSizes
  ) {
    openInterest = openInterest.add(avalanchePositionStats.totalLongPositionSizes);
    openInterest = openInterest.add(avalanchePositionStats.totalShortPositionSizes);
  }

  // user stat
  const arbitrumUserStats = useUserStat(ARBITRUM);
  const avalancheUserStats = useUserStat(AVALANCHE);
  let totalUsers = 0;

  if (arbitrumUserStats && arbitrumUserStats.uniqueCount) {
    totalUsers += arbitrumUserStats.uniqueCount;
  }

  if (avalancheUserStats && avalancheUserStats.uniqueCount) {
    totalUsers += avalancheUserStats.uniqueCount;
  }

  const changeNetwork = useCallback(
    (network) => {
      if (network === chainId) {
        return;
      }
      if (!active) {
        setTimeout(() => {
          return switchNetwork(network, active);
        }, 500);
      } else {
        return switchNetwork(network, active);
      }
    },
    [chainId, active]
  );

  return (
    <div className="Home">
      <div className="Home-top">
        {/* <div className="Home-top-image"></div> */}
        <div className="Home-title-section-container default-container">
          <div className="Home-title-section">
            <div className="Home-title">
              Decentralized
              <br />
              Perpetual Exchange
            </div>
            <div className="Home-description">
              Trade BTC, ETH, AVAX and other top cryptocurrencies with up to 30x leverage directly from your wallet
            </div>
            <NavLink activeClassName="active" to="/trade" className="default-btn">
              Launch Exchange
            </NavLink>
          </div>
        </div>
        <div className="Home-latest-info-container default-container">
          <div className="Home-latest-info-block">
            <img src={tradingIcon} alt="trading" className="Home-latest-info__icon" />
            <div className="Home-latest-info-content">
              <div className="Home-latest-info__title">Total Trading Volume</div>
              <div className="Home-latest-info__value">${formatAmount(totalVolumeSum, USD_DECIMALS, 0, true)}</div>
            </div>
          </div>
          <div className="Home-latest-info-block">
            <img src={statsIcon} alt="trading" className="Home-latest-info__icon" />
            <div className="Home-latest-info-content">
              <div className="Home-latest-info__title">Open Interest</div>
              <div className="Home-latest-info__value">${formatAmount(openInterest, USD_DECIMALS, 0, true)}</div>
            </div>
          </div>
          <div className="Home-latest-info-block">
            <img src={totaluserIcon} alt="trading" className="Home-latest-info__icon" />
            <div className="Home-latest-info-content">
              <div className="Home-latest-info__title">Total Users</div>
              <div className="Home-latest-info__value">{numberWithCommas(totalUsers.toFixed(0))}</div>
            </div>
          </div>
        </div>
      </div>



      <Footer />
    </div>
  );
}
