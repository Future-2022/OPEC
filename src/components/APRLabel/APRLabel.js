import React from "react";

import useSWR from "swr";

import {
  PLACEHOLDER_ACCOUNT,
  getServerUrl,
  fetcher,
  formatKeyAmount,
  getBalanceAndSupplyData,
  getDepositBalanceData,
  getVestingData,
  getStakingData,
  getProcessedData,
} from "../../Helpers";

import Vault from "../../abis/Vault.json";
import ReaderV2 from "../../abis/ReaderV2.json";
import RewardReader from "../../abis/RewardReader.json";
import Token from "../../abis/Token.json";
import XpcManager from "../../abis/XpcManager.json";

import { useWeb3React } from "@web3-react/core";

import { useOpecPrice } from "../../Api";

import { getContract } from "../../Addresses";

export default function APRLabel({ chainId, label }) {
  let { active } = useWeb3React();

  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const readerAddress = getContract(chainId, "Reader");

  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const opecAddress = getContract(chainId, "OPEC");
  const esOpecAddress = getContract(chainId, "ES_GMX");
  const bnOpecAddress = getContract(chainId, "BN_GMX");
  const xpcAddress = getContract(chainId, "XPC");

  const stakedOpecTrackerAddress = getContract(chainId, "StakedOpecTracker");
  const bonusOpecTrackerAddress = getContract(chainId, "BonusOpecTracker");
  const feeOpecTrackerAddress = getContract(chainId, "FeeOpecTracker");

  const stakedXpcTrackerAddress = getContract(chainId, "StakedXpcTracker");
  const feeXpcTrackerAddress = getContract(chainId, "FeeXpcTracker");

  const xpcManagerAddress = getContract(chainId, "XpcManager");

  const opecVesterAddress = getContract(chainId, "OpecVester");
  const xpcVesterAddress = getContract(chainId, "XpcVester");

  const vesterAddresses = [opecVesterAddress, xpcVesterAddress];

  const walletTokens = [opecAddress, esOpecAddress, xpcAddress, stakedOpecTrackerAddress];
  const depositTokens = [
    opecAddress,
    esOpecAddress,
    stakedOpecTrackerAddress,
    bonusOpecTrackerAddress,
    bnOpecAddress,
    xpcAddress,
  ];
  const rewardTrackersForDepositBalances = [
    stakedOpecTrackerAddress,
    stakedOpecTrackerAddress,
    bonusOpecTrackerAddress,
    feeOpecTrackerAddress,
    feeOpecTrackerAddress,
    feeXpcTrackerAddress,
  ];
  const rewardTrackersForStakingInfo = [
    stakedOpecTrackerAddress,
    bonusOpecTrackerAddress,
    feeOpecTrackerAddress,
    stakedXpcTrackerAddress,
    feeXpcTrackerAddress,
  ];

  const { data: walletBalances } = useSWR(
    [`StakeV2:walletBalances:${active}`, chainId, readerAddress, "getTokenBalancesWithSupplies", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, ReaderV2, [walletTokens]),
    }
  );

  const { data: depositBalances } = useSWR(
    [`StakeV2:depositBalances:${active}`, chainId, rewardReaderAddress, "getDepositBalances", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, RewardReader, [depositTokens, rewardTrackersForDepositBalances]),
    }
  );

  const { data: stakingInfo } = useSWR(
    [`StakeV2:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const { data: stakedOpecSupply } = useSWR(
    [`StakeV2:stakedOpecSupply:${active}`, chainId, opecAddress, "balanceOf", stakedOpecTrackerAddress],
    {
      fetcher: fetcher(undefined, Token),
    }
  );

  const { data: aums } = useSWR([`StakeV2:getAums:${active}`, chainId, xpcManagerAddress, "getAums"], {
    fetcher: fetcher(undefined, XpcManager),
  });

  const { data: nativeTokenPrice } = useSWR(
    [`StakeV2:nativeTokenPrice:${active}`, chainId, vaultAddress, "getMinPrice", nativeTokenAddress],
    {
      fetcher: fetcher(undefined, Vault),
    }
  );

  const { data: vestingInfo } = useSWR(
    [`StakeV2:vestingInfo:${active}`, chainId, readerAddress, "getVestingInfo", PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(undefined, ReaderV2, [vesterAddresses]),
    }
  );

  const { opecPrice } = useOpecPrice(chainId, {}, active);

  const opecSupplyUrl = getServerUrl(chainId, "/gmx_supply");
  const { data: opecSupply } = useSWR([opecSupplyUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.text()),
  });

  let aum;
  if (aums && aums.length > 0) {
    aum = aums[0].add(aums[1]).div(2);
  }

  const { balanceData, supplyData } = getBalanceAndSupplyData(walletBalances);
  const depositBalanceData = getDepositBalanceData(depositBalances);
  const stakingData = getStakingData(stakingInfo);
  const vestingData = getVestingData(vestingInfo);

  const processedData = getProcessedData(
    balanceData,
    supplyData,
    depositBalanceData,
    stakingData,
    vestingData,
    aum,
    nativeTokenPrice,
    stakedOpecSupply,
    opecPrice,
    opecSupply
  );

  return <>{`${formatKeyAmount(processedData, label, 2, 2, true)}%`}</>;
}
