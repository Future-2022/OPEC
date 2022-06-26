import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";

import { useWeb3React } from "@web3-react/core";
import useSWR from "swr";
import { ethers } from "ethers";

import Tab from "../Tab/Tab";
import cx from "classnames";

import { getToken, getTokens, getWhitelistedTokens, getWrappedToken, getNativeToken } from "../../data/Tokens";
import { getContract } from "../../Addresses";
import {
  helperToast,
  useLocalStorageByChainId,
  getTokenInfo,
  // getChainName,
  useChainId,
  expandDecimals,
  fetcher,
  bigNumberify,
  formatAmount,
  formatAmountFree,
  formatKeyAmount,
  // formatDateTime,
  getBuyXpcToAmount,
  getBuyXpcFromAmount,
  getSellXpcFromAmount,
  getSellXpcToAmount,
  parseValue,
  approveTokens,
  getUsd,
  adjustForDecimals,
  XPC_DECIMALS,
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  XPC_COOLDOWN_DURATION,
  SECONDS_PER_YEAR,
  USDG_DECIMALS,
  ARBITRUM,
  PLACEHOLDER_ACCOUNT,
} from "../../Helpers";

import { callContract, useOpecPrice, useInfoTokens } from "../../Api";

import TokenSelector from "../Exchange/TokenSelector";
import BuyInputSection from "../BuyInputSection/BuyInputSection";
import Tooltip from "../Tooltip/Tooltip";

import ReaderV2 from "../../abis/ReaderV2.json";
import RewardReader from "../../abis/RewardReader.json";
import VaultV2 from "../../abis/VaultV2.json";
import XpcManager from "../../abis/XpcManager.json";
import RewardTracker from "../../abis/RewardTracker.json";
import Vester from "../../abis/Vester.json";
import RewardRouter from "../../abis/RewardRouter.json";
import Token from "../../abis/Token.json";

import xpc24Icon from "../../img/ic_glp_24.svg";
import xpc40Icon from "../../img/ic_glp_40.svg";
import arrowIcon from "../../img/ic_convert_down.svg";

import avalanche16Icon from "../../img/ic_avalanche_16.svg";
import arbitrum16Icon from "../../img/ic_arbitrum_16.svg";

import "./XpcSwap.css";
import AssetDropdown from "../../views/Dashboard/AssetDropdown";

const { AddressZero } = ethers.constants;

function getStakingData(stakingInfo) {
  if (!stakingInfo || stakingInfo.length === 0) {
    return;
  }

  const keys = ["stakedXpcTracker", "feeXpcTracker"];
  const data = {};
  const propsLength = 5;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    data[key] = {
      claimable: stakingInfo[i * propsLength],
      tokensPerInterval: stakingInfo[i * propsLength + 1],
      averageStakedAmounts: stakingInfo[i * propsLength + 2],
      cumulativeRewards: stakingInfo[i * propsLength + 3],
      totalSupply: stakingInfo[i * propsLength + 4],
    };
  }

  return data;
}

export default function XpcSwap(props) {
  const { savedSlippageAmount, isBuying, setPendingTxns, connectWallet, setIsBuying } = props;
  const history = useHistory();
  const swapLabel = isBuying ? "BuyXpc" : "SellXpc";
  const tabLabel = isBuying ? "Buy XPC" : "Sell XPC";
  const { active, library, account } = useWeb3React();
  const { chainId } = useChainId();
  // const chainName = getChainName(chainId)
  const tokens = getTokens(chainId);
  const whitelistedTokens = getWhitelistedTokens(chainId);
  const tokenList = whitelistedTokens.filter((t) => !t.isWrapped);
  const [swapValue, setSwapValue] = useState("");
  const [xpcValue, setXpcValue] = useState("");
  const [swapTokenAddress, setSwapTokenAddress] = useLocalStorageByChainId(
    chainId,
    `${swapLabel}-swap-token-address`,
    AddressZero
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [anchorOnSwapAmount, setAnchorOnSwapAmount] = useState(true);
  const [feeBasisPoints, setFeeBasisPoints] = useState("");

  const readerAddress = getContract(chainId, "Reader");
  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const stakedXpcTrackerAddress = getContract(chainId, "StakedXpcTracker");
  const feeXpcTrackerAddress = getContract(chainId, "FeeXpcTracker");
  const usdgAddress = getContract(chainId, "USDG");
  const xpcManagerAddress = getContract(chainId, "XpcManager");
  const rewardRouterAddress = getContract(chainId, "RewardRouter");
  const tokensForBalanceAndSupplyQuery = [stakedXpcTrackerAddress, usdgAddress];

  const tokenAddresses = tokens.map((token) => token.address);
  const { data: tokenBalances } = useSWR(
    [`XpcSwap:getTokenBalances:${active}`, chainId, readerAddress, "getTokenBalances", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, ReaderV2, [tokenAddresses]),
    }
  );

  const { data: balancesAndSupplies } = useSWR(
    [
      `XpcSwap:getTokenBalancesWithSupplies:${active}`,
      chainId,
      readerAddress,
      "getTokenBalancesWithSupplies",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(library, ReaderV2, [tokensForBalanceAndSupplyQuery]),
    }
  );

  const { data: aums } = useSWR([`XpcSwap:getAums:${active}`, chainId, xpcManagerAddress, "getAums"], {
    fetcher: fetcher(library, XpcManager),
  });

  const { data: totalTokenWeights } = useSWR(
    [`XpcSwap:totalTokenWeights:${active}`, chainId, vaultAddress, "totalTokenWeights"],
    {
      fetcher: fetcher(library, VaultV2),
    }
  );

  const tokenAllowanceAddress = swapTokenAddress === AddressZero ? nativeTokenAddress : swapTokenAddress;
  const { data: tokenAllowance } = useSWR(
    [active, chainId, tokenAllowanceAddress, "allowance", account || PLACEHOLDER_ACCOUNT, xpcManagerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const { data: lastPurchaseTime } = useSWR(
    [`XpcSwap:lastPurchaseTime:${active}`, chainId, xpcManagerAddress, "lastAddedAt", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, XpcManager),
    }
  );

  const { data: xpcBalance } = useSWR(
    [`XpcSwap:xpcBalance:${active}`, chainId, feeXpcTrackerAddress, "stakedAmounts", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, RewardTracker),
    }
  );

  const xpcVesterAddress = getContract(chainId, "XpcVester");
  const { data: reservedAmount } = useSWR(
    [`XpcSwap:reservedAmount:${active}`, chainId, xpcVesterAddress, "pairAmounts", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, Vester),
    }
  );

  const { opecPrice } = useOpecPrice(chainId, { arbitrum: chainId === ARBITRUM ? library : undefined }, active);

  const rewardTrackersForStakingInfo = [stakedXpcTrackerAddress, feeXpcTrackerAddress];
  const { data: stakingInfo } = useSWR(
    [`XpcSwap:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const stakingData = getStakingData(stakingInfo);

  const redemptionTime = lastPurchaseTime ? lastPurchaseTime.add(XPC_COOLDOWN_DURATION) : undefined;
  const inCooldownWindow = redemptionTime && parseInt(Date.now() / 1000) < redemptionTime;

  const xpcSupply = balancesAndSupplies ? balancesAndSupplies[1] : bigNumberify(0);
  const usdgSupply = balancesAndSupplies ? balancesAndSupplies[3] : bigNumberify(0);
  let aum;
  if (aums && aums.length > 0) {
    aum = isBuying ? aums[0] : aums[1];
  }
  const xpcPrice =
    aum && aum.gt(0) && xpcSupply.gt(0)
      ? aum.mul(expandDecimals(1, XPC_DECIMALS)).div(xpcSupply)
      : expandDecimals(1, USD_DECIMALS);
  let xpcBalanceUsd;
  if (xpcBalance) {
    xpcBalanceUsd = xpcBalance.mul(xpcPrice).div(expandDecimals(1, XPC_DECIMALS));
  }
  const xpcSupplyUsd = xpcSupply.mul(xpcPrice).div(expandDecimals(1, XPC_DECIMALS));

  let reserveAmountUsd;
  if (reservedAmount) {
    reserveAmountUsd = reservedAmount.mul(xpcPrice).div(expandDecimals(1, XPC_DECIMALS));
  }

  let maxSellAmount = xpcBalance;
  if (xpcBalance && reservedAmount) {
    maxSellAmount = xpcBalance.sub(reservedAmount);
  }

  const { infoTokens } = useInfoTokens(library, chainId, active, tokenBalances, undefined);
  const swapToken = getToken(chainId, swapTokenAddress);
  const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);

  const swapTokenBalance = swapTokenInfo && swapTokenInfo.balance ? swapTokenInfo.balance : bigNumberify(0);

  const swapAmount = parseValue(swapValue, swapToken && swapToken.decimals);
  const xpcAmount = parseValue(xpcValue, XPC_DECIMALS);

  const needApproval =
    isBuying && swapTokenAddress !== AddressZero && tokenAllowance && swapAmount && swapAmount.gt(tokenAllowance);

  const swapUsdMin = getUsd(swapAmount, swapTokenAddress, false, infoTokens);
  const xpcUsdMax = xpcAmount && xpcPrice ? xpcAmount.mul(xpcPrice).div(expandDecimals(1, XPC_DECIMALS)) : undefined;

  let isSwapTokenCapReached;
  if (swapTokenInfo.managedUsd && swapTokenInfo.maxUsdgAmount) {
    isSwapTokenCapReached = swapTokenInfo.managedUsd.gt(
      adjustForDecimals(swapTokenInfo.maxUsdgAmount, USDG_DECIMALS, USD_DECIMALS)
    );
  }

  const onSwapValueChange = (e) => {
    setAnchorOnSwapAmount(true);
    setSwapValue(e.target.value);
  };

  const onXpcValueChange = (e) => {
    setAnchorOnSwapAmount(false);
    setXpcValue(e.target.value);
  };

  const onSelectSwapToken = (token) => {
    setSwapTokenAddress(token.address);
    setIsWaitingForApproval(false);
  };

  const nativeToken = getTokenInfo(infoTokens, AddressZero);

  let totalApr = bigNumberify(0);

  let feeXpcTrackerAnnualRewardsUsd;
  let feeXpcTrackerApr;
  if (
    stakingData &&
    stakingData.feeXpcTracker &&
    stakingData.feeXpcTracker.tokensPerInterval &&
    nativeToken &&
    nativeToken.minPrice &&
    xpcSupplyUsd &&
    xpcSupplyUsd.gt(0)
  ) {
    feeXpcTrackerAnnualRewardsUsd = stakingData.feeXpcTracker.tokensPerInterval
      .mul(SECONDS_PER_YEAR)
      .mul(nativeToken.minPrice)
      .div(expandDecimals(1, 18));
    feeXpcTrackerApr = feeXpcTrackerAnnualRewardsUsd.mul(BASIS_POINTS_DIVISOR).div(xpcSupplyUsd);
    totalApr = totalApr.add(feeXpcTrackerApr);
  }

  let stakedXpcTrackerAnnualRewardsUsd;
  let stakedXpcTrackerApr;

  if (
    opecPrice &&
    stakingData &&
    stakingData.stakedXpcTracker &&
    stakingData.stakedXpcTracker.tokensPerInterval &&
    xpcSupplyUsd &&
    xpcSupplyUsd.gt(0)
  ) {
    stakedXpcTrackerAnnualRewardsUsd = stakingData.stakedXpcTracker.tokensPerInterval
      .mul(SECONDS_PER_YEAR)
      .mul(opecPrice)
      .div(expandDecimals(1, 18));
    stakedXpcTrackerApr = stakedXpcTrackerAnnualRewardsUsd.mul(BASIS_POINTS_DIVISOR).div(xpcSupplyUsd);
    totalApr = totalApr.add(stakedXpcTrackerApr);
  }

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (anchorOnSwapAmount) {
        if (!swapAmount) {
          setXpcValue("");
          setFeeBasisPoints("");
          return;
        }

        if (isBuying) {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getBuyXpcToAmount(
            swapAmount,
            swapTokenAddress,
            infoTokens,
            xpcPrice,
            usdgSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, XPC_DECIMALS, XPC_DECIMALS);
          setXpcValue(nextValue);
          setFeeBasisPoints(feeBps);
        } else {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getSellXpcFromAmount(
            swapAmount,
            swapTokenAddress,
            infoTokens,
            xpcPrice,
            usdgSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, XPC_DECIMALS, XPC_DECIMALS);
          setXpcValue(nextValue);
          setFeeBasisPoints(feeBps);
        }

        return;
      }

      if (!xpcAmount) {
        setSwapValue("");
        setFeeBasisPoints("");
        return;
      }

      if (swapToken) {
        if (isBuying) {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getBuyXpcFromAmount(
            xpcAmount,
            swapTokenAddress,
            infoTokens,
            xpcPrice,
            usdgSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, swapToken.decimals, swapToken.decimals);
          setSwapValue(nextValue);
          setFeeBasisPoints(feeBps);
        } else {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getSellXpcToAmount(
            xpcAmount,
            swapTokenAddress,
            infoTokens,
            xpcPrice,
            usdgSupply,
            totalTokenWeights,
            true
          );

          const nextValue = formatAmountFree(nextAmount, swapToken.decimals, swapToken.decimals);
          setSwapValue(nextValue);
          setFeeBasisPoints(feeBps);
        }
      }
    };

    updateSwapAmounts();
  }, [
    isBuying,
    anchorOnSwapAmount,
    swapAmount,
    xpcAmount,
    swapToken,
    swapTokenAddress,
    infoTokens,
    xpcPrice,
    usdgSupply,
    totalTokenWeights,
  ]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const switchSwapOption = (hash = "") => {
    history.push(`${history.location.pathname}#${hash}`);
    props.setIsBuying(hash === "redeem" ? false : true);
  };

  const fillMaxAmount = () => {
    if (isBuying) {
      setAnchorOnSwapAmount(true);
      setSwapValue(formatAmountFree(swapTokenBalance, swapToken.decimals, swapToken.decimals));
      return;
    }

    setAnchorOnSwapAmount(false);
    setXpcValue(formatAmountFree(maxSellAmount, XPC_DECIMALS, XPC_DECIMALS));
  };

  const getError = () => {
    if (!isBuying && inCooldownWindow) {
      return [`Redemption time not yet reached`];
    }

    if (!swapAmount || swapAmount.eq(0)) {
      return ["Enter an amount"];
    }
    if (!xpcAmount || xpcAmount.eq(0)) {
      return ["Enter an amount"];
    }

    if (isBuying) {
      const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);
      if (swapTokenInfo && swapTokenInfo.balance && swapAmount && swapAmount.gt(swapTokenInfo.balance)) {
        return [`Insufficient ${swapTokenInfo.symbol} balance`];
      }

      if (swapTokenInfo.maxUsdgAmount && swapTokenInfo.usdgAmount && swapUsdMin) {
        const usdgFromAmount = adjustForDecimals(swapUsdMin, USD_DECIMALS, USDG_DECIMALS);
        const nextUsdgAmount = swapTokenInfo.usdgAmount.add(usdgFromAmount);
        if (swapTokenInfo.maxUsdgAmount.gt(0) && nextUsdgAmount.gt(swapTokenInfo.maxUsdgAmount)) {
          return [`${swapTokenInfo.symbol} pool exceeded, try different token`, true];
        }
      }
    }

    if (!isBuying) {
      if (maxSellAmount && xpcAmount && xpcAmount.gt(maxSellAmount)) {
        return [`Insufficient XPC balance`];
      }

      const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);
      if (
        swapTokenInfo &&
        swapTokenInfo.availableAmount &&
        swapAmount &&
        swapAmount.gt(swapTokenInfo.availableAmount)
      ) {
        return [`Insufficient liquidity`];
      }
    }

    return [false];
  };

  const isPrimaryEnabled = () => {
    if (!active) {
      return true;
    }
    const [error, modal] = getError();
    if (error && !modal) {
      return false;
    }
    if ((needApproval && isWaitingForApproval) || isApproving) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }
    if (isBuying && isSwapTokenCapReached) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    if (!active) {
      return "Connect Wallet";
    }
    const [error, modal] = getError();
    if (error && !modal) {
      return error;
    }
    if (isBuying && isSwapTokenCapReached) {
      return `Max Capacity for ${swapToken.symbol} Reached`;
    }

    if (needApproval && isWaitingForApproval) {
      return "Waiting for Approval";
    }
    if (isApproving) {
      return `Approving ${swapToken.symbol}...`;
    }
    if (needApproval) {
      return `Approve ${swapToken.symbol}`;
    }

    if (isSubmitting) {
      return isBuying ? `Buying...` : `Selling...`;
    }

    return isBuying ? "Buy XPC" : "Sell XPC";
  };

  const approveFromToken = () => {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: swapToken.address,
      spender: xpcManagerAddress,
      chainId: chainId,
      onApproveSubmitted: () => {
        setIsWaitingForApproval(true);
      },
      infoTokens,
      getTokenInfo,
    });
  };

  const buyXpc = () => {
    setIsSubmitting(true);

    const minXpc = xpcAmount.mul(BASIS_POINTS_DIVISOR - savedSlippageAmount).div(BASIS_POINTS_DIVISOR);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = swapTokenAddress === AddressZero ? "mintAndStakeXpcETH" : "mintAndStakeXpc";
    const params = swapTokenAddress === AddressZero ? [0, minXpc] : [swapTokenAddress, swapAmount, 0, minXpc];
    const value = swapTokenAddress === AddressZero ? swapAmount : 0;

    callContract(chainId, contract, method, params, {
      value,
      sentMsg: "Buy submitted.",
      failMsg: "Buy failed.",
      successMsg: `${formatAmount(xpcAmount, 18, 4, true)} XPC bought with ${formatAmount(
        swapAmount,
        swapTokenInfo.decimals,
        4,
        true
      )} ${swapTokenInfo.symbol}!`,
      setPendingTxns,
    })
      .then(async () => {})
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const sellXpc = () => {
    setIsSubmitting(true);

    const minOut = swapAmount.mul(BASIS_POINTS_DIVISOR - savedSlippageAmount).div(BASIS_POINTS_DIVISOR);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = swapTokenAddress === AddressZero ? "unstakeAndRedeemXpcETH" : "unstakeAndRedeemXpc";
    const params =
      swapTokenAddress === AddressZero ? [xpcAmount, minOut, account] : [swapTokenAddress, xpcAmount, minOut, account];

    callContract(chainId, contract, method, params, {
      sentMsg: "Sell submitted!",
      failMsg: "Sell failed.",
      successMsg: `${formatAmount(xpcAmount, 18, 4, true)} XPC sold for ${formatAmount(
        swapAmount,
        swapTokenInfo.decimals,
        4,
        true
      )} ${swapTokenInfo.symbol}!`,
      setPendingTxns,
    })
      .then(async () => {})
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const onClickPrimary = () => {
    if (!active) {
      connectWallet();
      return;
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    const [, modal] = getError();

    if (modal) {
      return;
    }

    if (isBuying) {
      buyXpc();
    } else {
      sellXpc();
    }
  };

  let payLabel = "Pay";
  let receiveLabel = "Receive";
  let payBalance = "$0.00";
  let receiveBalance = "$0.00";
  if (isBuying) {
    if (swapUsdMin) {
      payBalance = `$${formatAmount(swapUsdMin, USD_DECIMALS, 2, true)}`;
    }
    if (xpcUsdMax) {
      receiveBalance = `$${formatAmount(xpcUsdMax, USD_DECIMALS, 2, true)}`;
    }
  } else {
    if (xpcUsdMax) {
      payBalance = `$${formatAmount(xpcUsdMax, USD_DECIMALS, 2, true)}`;
    }
    if (swapUsdMin) {
      receiveBalance = `$${formatAmount(swapUsdMin, USD_DECIMALS, 2, true)}`;
    }
  }

  const selectToken = (token) => {
    setAnchorOnSwapAmount(false);
    setSwapTokenAddress(token.address);
    helperToast.success(`${token.symbol} selected in order form`);
  };

  let feePercentageText = formatAmount(feeBasisPoints, 2, 2, true, "-");
  if (feeBasisPoints !== undefined && feeBasisPoints.toString().length > 0) {
    feePercentageText += "%";
  }

  const wrappedTokenSymbol = getWrappedToken(chainId).symbol;
  const nativeTokenSymbol = getNativeToken(chainId).symbol;

  const onSwapOptionChange = (opt) => {
    if (opt === "Sell XPC") {
      switchSwapOption("redeem");
    } else {
      switchSwapOption();
    }
  };

  return (
    <div className="XpcSwap">
      {/* <div className="Page-title-section">
        <div className="Page-title">{isBuying ? "Buy XPC" : "Sell XPC"}</div>
        {isBuying && <div className="Page-description">
          Purchase <a href="https://gmxio.gitbook.io/gmx/xpc" target="_blank" rel="noopener noreferrer">XPC tokens</a> to earn {nativeTokenSymbol} fees from swaps and leverage trading.<br/>
          Note that there is a minimum holding time of 15 minutes after a purchase.<br/>
          <div>View <Link to="/earn">staking</Link> page.</div>
        </div>}
        {!isBuying && <div className="Page-description">
          Redeem your XPC tokens for any supported asset.
          {inCooldownWindow && <div>
            XPC tokens can only be redeemed 15 minutes after your most recent purchase.<br/>
            Your last purchase was at {formatDateTime(lastPurchaseTime)}, you can redeem XPC tokens after {formatDateTime(redemptionTime)}.<br/>
          </div>}
          <div>View <Link to="/earn">staking</Link> page.</div>
        </div>}
      </div> */}
      <div className="XpcSwap-content">
        <div className="App-card XpcSwap-stats-card">
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
            </div>
          </div>
          <div className="App-card-divider"></div>
          <div className="App-card-content">
            <div className="App-card-row">
              <div className="label">Price</div>
              <div className="value">${formatAmount(xpcPrice, USD_DECIMALS, 3, true)}</div>
            </div>
            <div className="App-card-row">
              <div className="label">Wallet</div>
              <div className="value">
                {formatAmount(xpcBalance, XPC_DECIMALS, 4, true)} XPC ($
                {formatAmount(xpcBalanceUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
            <div className="App-card-row">
              <div className="label">Staked</div>
              <div className="value">
                {formatAmount(xpcBalance, XPC_DECIMALS, 4, true)} XPC ($
                {formatAmount(xpcBalanceUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
          </div>
          <div className="App-card-divider"></div>
          <div className="App-card-content">
            {!isBuying && (
              <div className="App-card-row">
                <div className="label">Reserved</div>
                <div className="value">
                  <Tooltip
                    handle={`${formatAmount(reservedAmount, 18, 4, true)} XPC ($${formatAmount(
                      reserveAmountUsd,
                      USD_DECIMALS,
                      2,
                      true
                    )})`}
                    position="right-bottom"
                    renderContent={() =>
                      `${formatAmount(reservedAmount, 18, 4, true)} XPC have been reserved for vesting.`
                    }
                  />
                </div>
              </div>
            )}
            <div className="App-card-row">
              <div className="label">APR</div>
              <div className="value">
                <Tooltip
                  handle={`${formatAmount(totalApr, 2, 2, true)}%`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <>
                        <div className="Tooltip-row">
                          <span className="label">
                            {nativeTokenSymbol} ({wrappedTokenSymbol}) APR
                          </span>
                          <span>{formatAmount(feeXpcTrackerApr, 2, 2, false)}%</span>
                        </div>
                        <div className="Tooltip-row">
                          <span className="label">Escrowed OPEC APR</span>
                          <span>{formatAmount(stakedXpcTrackerApr, 2, 2, false)}%</span>
                        </div>
                      </>
                    );
                  }}
                />
              </div>
            </div>
            <div className="App-card-row">
              <div className="label">Total Supply</div>
              <div className="value">
                {formatAmount(xpcSupply, XPC_DECIMALS, 4, true)} XPC ($
                {formatAmount(xpcSupplyUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
          </div>
        </div>
        <div className="XpcSwap-box App-box">
          <Tab
            options={["Buy XPC", "Sell XPC"]}
            option={tabLabel}
            onChange={onSwapOptionChange}
            className="Exchange-swap-option-tabs"
          />
          {isBuying && (
            <BuyInputSection
              topLeftLabel={payLabel}
              topRightLabel={`Balance: `}
              tokenBalance={`${formatAmount(swapTokenBalance, swapToken.decimals, 4, true)}`}
              inputValue={swapValue}
              onInputValueChange={onSwapValueChange}
              showMaxButton={swapValue !== formatAmountFree(swapTokenBalance, swapToken.decimals, swapToken.decimals)}
              onClickTopRightLabel={fillMaxAmount}
              onClickMax={fillMaxAmount}
              selectedToken={swapToken}
              balance={payBalance}
            >
              <TokenSelector
                label="Pay"
                chainId={chainId}
                tokenAddress={swapTokenAddress}
                onSelectToken={onSelectSwapToken}
                tokens={whitelistedTokens}
                infoTokens={infoTokens}
                className="XpcSwap-from-token"
                showSymbolImage={true}
                showTokenImgInDropdown={true}
              />
            </BuyInputSection>
          )}

          {!isBuying && (
            <BuyInputSection
              topLeftLabel={payLabel}
              topRightLabel={`Available: `}
              tokenBalance={`${formatAmount(maxSellAmount, XPC_DECIMALS, 4, true)}`}
              inputValue={xpcValue}
              onInputValueChange={onXpcValueChange}
              showMaxButton={xpcValue !== formatAmountFree(maxSellAmount, XPC_DECIMALS, XPC_DECIMALS)}
              onClickTopRightLabel={fillMaxAmount}
              onClickMax={fillMaxAmount}
              balance={payBalance}
              defaultTokenName={"XPC"}
            >
              <div className="selected-token">
                XPC <img src={xpc24Icon} alt="xpc24Icon" />
              </div>
            </BuyInputSection>
          )}

          <div className="AppOrder-ball-container">
            <div className="AppOrder-ball">
              <img
                src={arrowIcon}
                alt="arrowIcon"
                onClick={() => {
                  setIsBuying(!isBuying);
                  switchSwapOption(isBuying ? "redeem" : "");
                }}
              />
            </div>
          </div>

          {isBuying && (
            <BuyInputSection
              topLeftLabel={receiveLabel}
              topRightLabel={`Balance: `}
              tokenBalance={`${formatAmount(xpcBalance, XPC_DECIMALS, 4, true)}`}
              inputValue={xpcValue}
              onInputValueChange={onXpcValueChange}
              balance={receiveBalance}
              defaultTokenName={"XPC"}
            >
              <div className="selected-token">
                XPC <img src={xpc24Icon} alt="xpc24Icon" />
              </div>
            </BuyInputSection>
          )}

          {!isBuying && (
            <BuyInputSection
              topLeftLabel={receiveLabel}
              topRightLabel={`Balance: `}
              tokenBalance={`${formatAmount(swapTokenBalance, swapToken.decimals, 4, true)}`}
              inputValue={swapValue}
              onInputValueChange={onSwapValueChange}
              balance={receiveBalance}
              selectedToken={swapToken}
            >
              <TokenSelector
                label="Receive"
                chainId={chainId}
                tokenAddress={swapTokenAddress}
                onSelectToken={onSelectSwapToken}
                tokens={whitelistedTokens}
                infoTokens={infoTokens}
                className="XpcSwap-from-token"
                showSymbolImage={true}
                showTokenImgInDropdown={true}
              />
            </BuyInputSection>
          )}
          <div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">{feeBasisPoints > 50 ? "WARNING: High Fees" : "Fees"}</div>
              <div className="align-right fee-block">
                {isBuying && (
                  <Tooltip
                    handle={isBuying && isSwapTokenCapReached ? "NA" : feePercentageText}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          {feeBasisPoints > 50 && <div>To reduce fees, select a different asset to pay with.</div>}
                          Check the "Save on Fees" section below to get the lowest fee percentages.
                        </>
                      );
                    }}
                  />
                )}
                {!isBuying && (
                  <Tooltip
                    handle={feePercentageText}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          {feeBasisPoints > 50 && <div>To reduce fees, select a different asset to receive.</div>}
                          Check the "Save on Fees" section below to get the lowest fee percentages.
                        </>
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="XpcSwap-cta Exchange-swap-button-container">
            <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
              {getPrimaryText()}
            </button>
          </div>
        </div>
      </div>
      <div className="Tab-title-section">
        <div className="Page-title">Save on Fees</div>
        {isBuying && (
          <div className="Page-description">
            Fees may vary depending on which asset you use to buy XPC.
            <br /> Enter the amount of XPC you want to purchase in the order form, then check here to compare fees.
          </div>
        )}
        {!isBuying && (
          <div className="Page-description">
            Fees may vary depending on which asset you sell XPC for.
            <br /> Enter the amount of XPC you want to redeem in the order form, then check here to compare fees.
          </div>
        )}
      </div>
      <div className="XpcSwap-token-list">
        {/* <div className="XpcSwap-token-list-content"> */}
        <table className="token-table">
          <thead>
            <tr>
              <th>TOKEN</th>
              <th>PRICE</th>
              <th>
                {isBuying ? (
                  <Tooltip
                    handle={"AVAILABLE"}
                    tooltipIconPosition="right"
                    position="right-bottom text-none"
                    renderContent={() => "Available amount to deposit into XPC."}
                  />
                ) : (
                  <Tooltip
                    handle={"AVAILABLE"}
                    tooltipIconPosition="right"
                    position="right-bottom text-none"
                    renderContent={() => {
                      return (
                        <>
                          <div>Available amount to withdraw from XPC.</div>
                          <div>Funds not utilized by current open positions.</div>
                        </>
                      );
                    }}
                  />
                )}
              </th>
              <th>WALLET</th>
              <th>
                <Tooltip
                  handle={"FEES"}
                  tooltipIconPosition="right"
                  position="right-bottom text-none"
                  renderContent={() => {
                    return (
                      <>
                        <div>Fees will be shown once you have entered an amount in the order form.</div>
                      </>
                    );
                  }}
                />
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tokenList.map((token) => {
              let tokenFeeBps;
              if (isBuying) {
                const { feeBasisPoints: feeBps } = getBuyXpcFromAmount(
                  xpcAmount,
                  token.address,
                  infoTokens,
                  xpcPrice,
                  usdgSupply,
                  totalTokenWeights
                );
                tokenFeeBps = feeBps;
              } else {
                const { feeBasisPoints: feeBps } = getSellXpcToAmount(
                  xpcAmount,
                  token.address,
                  infoTokens,
                  xpcPrice,
                  usdgSupply,
                  totalTokenWeights
                );
                tokenFeeBps = feeBps;
              }
              const tokenInfo = getTokenInfo(infoTokens, token.address);
              let managedUsd;
              if (tokenInfo && tokenInfo.managedUsd) {
                managedUsd = tokenInfo.managedUsd;
              }
              let availableAmountUsd;
              if (tokenInfo && tokenInfo.minPrice && tokenInfo.availableAmount) {
                availableAmountUsd = tokenInfo.availableAmount
                  .mul(tokenInfo.minPrice)
                  .div(expandDecimals(1, token.decimals));
              }
              let balanceUsd;
              if (tokenInfo && tokenInfo.minPrice && tokenInfo.balance) {
                balanceUsd = tokenInfo.balance.mul(tokenInfo.minPrice).div(expandDecimals(1, token.decimals));
              }

              var tokenImage = null;

              try {
                tokenImage = require("../../img/ic_" + token.symbol.toLowerCase() + "_40.svg");
              } catch (error) {
                console.error(error);
              }
              let isCapReached = tokenInfo.managedAmount?.gt(tokenInfo.maxUsdgAmount);

              let amountLeftToDeposit;
              if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
                amountLeftToDeposit = adjustForDecimals(tokenInfo.maxUsdgAmount, USDG_DECIMALS, USD_DECIMALS).sub(
                  tokenInfo.managedUsd
                );
              }
              function renderFees() {
                const swapUrl =
                  chainId === ARBITRUM
                    ? `https://app.uniswap.org/#/swap?inputCurrency=${token.address}`
                    : `https://traderjoexyz.com/trade?inputCurrency=${token.address}`;
                switch (true) {
                  case (isBuying && isCapReached) || (!isBuying && managedUsd?.lt(1)):
                    return (
                      <Tooltip
                        handle="NA"
                        position="right-bottom"
                        renderContent={() => (
                          <div>
                            Max pool capacity reached for {tokenInfo.symbol}
                            <br />
                            <br />
                            Please mint XPC using another token
                            <br />
                            <p>
                              <a href={swapUrl} target="_blank" rel="noreferrer">
                                Swap on {chainId === ARBITRUM ? "Uniswap" : "Trader Joe"}
                              </a>
                            </p>
                          </div>
                        )}
                      />
                    );
                  case (isBuying && !isCapReached) || (!isBuying && managedUsd?.gt(0)):
                    return `${formatAmount(tokenFeeBps, 2, 2, true, "-")}${
                      tokenFeeBps !== undefined && tokenFeeBps.toString().length > 0 ? "%" : ""
                    }`;
                  default:
                    return "";
                }
              }

              return (
                <tr key={token.symbol}>
                  <td>
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
                  </td>
                  <td>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}</td>
                  <td>
                    {isBuying && (
                      <div>
                        <Tooltip
                          handle={
                            amountLeftToDeposit && amountLeftToDeposit.lt(0)
                              ? "$0.00"
                              : `$${formatAmount(amountLeftToDeposit, USD_DECIMALS, 2, true)}`
                          }
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => {
                            return (
                              <>
                                Current Pool Amount: ${formatAmount(managedUsd, USD_DECIMALS, 2, true)} (
                                {formatKeyAmount(tokenInfo, "poolAmount", token.decimals, 2, true)} {token.symbol})
                                <br />
                                <br />
                                Max Pool Capacity: ${formatAmount(tokenInfo.maxUsdgAmount, 18, 0, true)}
                              </>
                            );
                          }}
                        />
                      </div>
                    )}
                    {!isBuying && (
                      <div>
                        {formatKeyAmount(tokenInfo, "availableAmount", token.decimals, 2, true)} {token.symbol} ($
                        {formatAmount(availableAmountUsd, USD_DECIMALS, 2, true)})
                      </div>
                    )}
                  </td>
                  <td>
                    {formatKeyAmount(tokenInfo, "balance", tokenInfo.decimals, 2, true)} {tokenInfo.symbol} ($
                    {formatAmount(balanceUsd, USD_DECIMALS, 2, true)})
                  </td>
                  <td>{renderFees()}</td>
                  <td>
                    <button
                      className={cx("App-button-option action-btn", isBuying ? "buying" : "selling")}
                      onClick={() => selectToken(token)}
                    >
                      {isBuying ? "Buy with " + token.symbol : "Sell for " + token.symbol}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="token-grid">
          {tokenList.map((token) => {
            let tokenFeeBps;
            if (isBuying) {
              const { feeBasisPoints: feeBps } = getBuyXpcFromAmount(
                xpcAmount,
                token.address,
                infoTokens,
                xpcPrice,
                usdgSupply,
                totalTokenWeights
              );
              tokenFeeBps = feeBps;
            } else {
              const { feeBasisPoints: feeBps } = getSellXpcToAmount(
                xpcAmount,
                token.address,
                infoTokens,
                xpcPrice,
                usdgSupply,
                totalTokenWeights
              );
              tokenFeeBps = feeBps;
            }
            const tokenInfo = getTokenInfo(infoTokens, token.address);
            let managedUsd;
            if (tokenInfo && tokenInfo.managedUsd) {
              managedUsd = tokenInfo.managedUsd;
            }
            let availableAmountUsd;
            if (tokenInfo && tokenInfo.minPrice && tokenInfo.availableAmount) {
              availableAmountUsd = tokenInfo.availableAmount
                .mul(tokenInfo.minPrice)
                .div(expandDecimals(1, token.decimals));
            }
            let balanceUsd;
            if (tokenInfo && tokenInfo.minPrice && tokenInfo.balance) {
              balanceUsd = tokenInfo.balance.mul(tokenInfo.minPrice).div(expandDecimals(1, token.decimals));
            }

            let amountLeftToDeposit;
            if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
              amountLeftToDeposit = adjustForDecimals(tokenInfo.maxUsdgAmount, USDG_DECIMALS, USD_DECIMALS).sub(
                tokenInfo.managedUsd
              );
            }
            let isCapReached = tokenInfo.managedAmount?.gt(tokenInfo.maxUsdgAmount);

            function renderFees() {
              switch (true) {
                case (isBuying && isCapReached) || (!isBuying && managedUsd?.lt(1)):
                  return (
                    <Tooltip
                      handle="NA"
                      position="right-bottom"
                      renderContent={() =>
                        `Max pool capacity reached for ${tokenInfo.symbol}. Please mint XPC using another token`
                      }
                    />
                  );
                case (isBuying && !isCapReached) || (!isBuying && managedUsd?.gt(0)):
                  return `${formatAmount(tokenFeeBps, 2, 2, true, "-")}${
                    tokenFeeBps !== undefined && tokenFeeBps.toString().length > 0 ? "%" : ""
                  }`;
                default:
                  return "";
              }
            }

            return (
              <div className="App-card" key={token.symbol}>
                <div className="App-card-title">{token.name}</div>
                <div className="App-card-divider"></div>
                <div className="App-card-content">
                  <div className="App-card-row">
                    <div className="label">Price</div>
                    <div>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}</div>
                  </div>
                  {isBuying && (
                    <div className="App-card-row">
                      <Tooltip
                        className="label"
                        handle="Available"
                        position="left-bottom"
                        renderContent={() => "Available amount to deposit into XPC."}
                      />
                      <div>
                        <Tooltip
                          handle={amountLeftToDeposit && `$${formatAmount(amountLeftToDeposit, USD_DECIMALS, 2, true)}`}
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => {
                            return (
                              <>
                                Current Pool Amount: ${formatAmount(managedUsd, USD_DECIMALS, 2, true)} (
                                {formatKeyAmount(tokenInfo, "poolAmount", token.decimals, 2, true)} {token.symbol})
                                <br />
                                <br />
                                Max Pool Capacity: ${formatAmount(tokenInfo.maxUsdgAmount, 18, 0, true)}
                              </>
                            );
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {!isBuying && (
                    <div className="App-card-row">
                      <Tooltip
                        handle="Available"
                        position="left-bottom"
                        renderContent={() => {
                          return (
                            <>
                              <div>Available amount to withdraw from XPC.</div>
                              <div>Funds not utilized by current open positions.</div>
                            </>
                          );
                        }}
                      />
                      <div>
                        {formatKeyAmount(tokenInfo, "availableAmount", token.decimals, 2, true)} {token.symbol} ($
                        {formatAmount(availableAmountUsd, USD_DECIMALS, 2, true)})
                      </div>
                    </div>
                  )}

                  <div className="App-card-row">
                    <div className="label">Wallet</div>
                    <div>
                      {formatKeyAmount(tokenInfo, "balance", tokenInfo.decimals, 2, true)} {tokenInfo.symbol} ($
                      {formatAmount(balanceUsd, USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">
                      {tokenFeeBps ? (
                        "Fees"
                      ) : (
                        <Tooltip
                          handle={`Fees`}
                          renderContent={() => `Please enter an amount to see fee percentages`}
                        />
                      )}
                    </div>
                    <div>{renderFees()}</div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-options">
                    {isBuying && (
                      <button className="App-button-option App-card-option" onClick={() => selectToken(token)}>
                        Buy with {token.symbol}
                      </button>
                    )}
                    {!isBuying && (
                      <button className="App-button-option App-card-option" onClick={() => selectToken(token)}>
                        Sell for {token.symbol}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* </div> */}
      </div>
    </div>
  );
}
