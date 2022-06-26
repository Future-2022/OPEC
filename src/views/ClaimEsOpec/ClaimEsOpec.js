import React, { useState } from "react";
import useSWR from "swr";
import { ethers } from "ethers";
import { useWeb3React } from "@web3-react/core";
import {
  ARBITRUM,
  AVALANCHE,
  PLACEHOLDER_ACCOUNT,
  useChainId,
  fetcher,
  formatAmount,
  formatAmountFree,
  parseValue,
  bigNumberify,
} from "../../Helpers";

import { getContract } from "../../Addresses";

import { callContract } from "../../Api";

import Token from "../../abis/Token.json";
import RewardReader from "../../abis/RewardReader.json";

import Checkbox from "../../components/Checkbox/Checkbox";

import "./ClaimEsOpec.css";

import arbitrumIcon from "../../img/ic_arbitrum_96.svg";
import avaIcon from "../../img/ic_avalanche_96.svg";

const VEST_WITH_GMX_ARB = "VEST_WITH_GMX_ARB";
const VEST_WITH_XPC_ARB = "VEST_WITH_XPC_ARB";
const VEST_WITH_GMX_AVAX = "VEST_WITH_GMX_AVAX";
const VEST_WITH_XPC_AVAX = "VEST_WITH_XPC_AVAX";

export function getVestingDataV2(vestingInfo) {
  if (!vestingInfo || vestingInfo.length === 0) {
    return;
  }

  const keys = ["opecVester", "xpcVester"];
  const data = {};
  const propsLength = 12;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    data[key] = {
      pairAmount: vestingInfo[i * propsLength],
      vestedAmount: vestingInfo[i * propsLength + 1],
      escrowedBalance: vestingInfo[i * propsLength + 2],
      claimedAmounts: vestingInfo[i * propsLength + 3],
      claimable: vestingInfo[i * propsLength + 4],
      maxVestableAmount: vestingInfo[i * propsLength + 5],
      combinedAverageStakedAmount: vestingInfo[i * propsLength + 6],
      cumulativeReward: vestingInfo[i * propsLength + 7],
      transferredCumulativeReward: vestingInfo[i * propsLength + 8],
      bonusReward: vestingInfo[i * propsLength + 9],
      averageStakedAmount: vestingInfo[i * propsLength + 10],
      transferredAverageStakedAmount: vestingInfo[i * propsLength + 11],
    };

    data[key + "PairAmount"] = data[key].pairAmount;
    data[key + "VestedAmount"] = data[key].vestedAmount;
    data[key + "EscrowedBalance"] = data[key].escrowedBalance;
    data[key + "ClaimSum"] = data[key].claimedAmounts.add(data[key].claimable);
    data[key + "Claimable"] = data[key].claimable;
    data[key + "MaxVestableAmount"] = data[key].maxVestableAmount;
    data[key + "CombinedAverageStakedAmount"] = data[key].combinedAverageStakedAmount;
    data[key + "CumulativeReward"] = data[key].cumulativeReward;
    data[key + "TransferredCumulativeReward"] = data[key].transferredCumulativeReward;
    data[key + "BonusReward"] = data[key].bonusReward;
    data[key + "AverageStakedAmount"] = data[key].averageStakedAmount;
    data[key + "TransferredAverageStakedAmount"] = data[key].transferredAverageStakedAmount;
  }

  return data;
}

function getVestingValues({ minRatio, amount, vestingDataItem }) {
  if (!vestingDataItem || !amount || amount.eq(0)) {
    return;
  }

  let currentRatio = bigNumberify(0);

  const ratioMultiplier = 10000;
  const maxVestableAmount = vestingDataItem.maxVestableAmount;
  const nextMaxVestableEsOpec = maxVestableAmount.add(amount);

  const combinedAverageStakedAmount = vestingDataItem.combinedAverageStakedAmount;
  if (maxVestableAmount.gt(0)) {
    currentRatio = combinedAverageStakedAmount.mul(ratioMultiplier).div(maxVestableAmount);
  }

  const transferredCumulativeReward = vestingDataItem.transferredCumulativeReward;
  const nextTransferredCumulativeReward = transferredCumulativeReward.add(amount);
  const cumulativeReward = vestingDataItem.cumulativeReward;
  const totalCumulativeReward = cumulativeReward.add(nextTransferredCumulativeReward);

  let nextCombinedAverageStakedAmount = combinedAverageStakedAmount;

  if (combinedAverageStakedAmount.lt(totalCumulativeReward.mul(minRatio))) {
    const averageStakedAmount = vestingDataItem.averageStakedAmount;
    let nextTransferredAverageStakedAmount = totalCumulativeReward.mul(minRatio);
    nextTransferredAverageStakedAmount = nextTransferredAverageStakedAmount.sub(
      averageStakedAmount.mul(cumulativeReward).div(totalCumulativeReward)
    );
    nextTransferredAverageStakedAmount = nextTransferredAverageStakedAmount
      .mul(totalCumulativeReward)
      .div(nextTransferredCumulativeReward);

    nextCombinedAverageStakedAmount = averageStakedAmount
      .mul(cumulativeReward)
      .div(totalCumulativeReward)
      .add(nextTransferredAverageStakedAmount.mul(nextTransferredCumulativeReward).div(totalCumulativeReward));
  }

  const nextRatio = nextCombinedAverageStakedAmount.mul(ratioMultiplier).div(nextMaxVestableEsOpec);

  const initialStakingAmount = currentRatio.mul(maxVestableAmount);
  const nextStakingAmount = nextRatio.mul(nextMaxVestableEsOpec);

  return {
    maxVestableAmount,
    currentRatio,
    nextMaxVestableEsOpec,
    nextRatio,
    initialStakingAmount,
    nextStakingAmount,
  };
}

export default function ClaimEsOpec({ setPendingTxns }) {
  const { active, account, library } = useWeb3React();
  const { chainId } = useChainId();
  const [selectedOption, setSelectedOption] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [value, setValue] = useState("");

  const isArbitrum = chainId === ARBITRUM;

  const esOpecIouAddress = getContract(chainId, "ES_GMX_IOU");

  const { data: esOpecIouBalance } = useSWR(
    isArbitrum && [
      `ClaimEsOpec:esOpecIouBalance:${active}`,
      chainId,
      esOpecIouAddress,
      "balanceOf",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const arbRewardReaderAddress = getContract(ARBITRUM, "RewardReader");
  const avaxRewardReaderAddress = getContract(AVALANCHE, "RewardReader");

  const arbVesterAdddresses = [getContract(ARBITRUM, "OpecVester"), getContract(ARBITRUM, "XpcVester")];
  const avaxVesterAdddresses = [getContract(AVALANCHE, "OpecVester"), getContract(AVALANCHE, "XpcVester")];

  const { data: arbVestingInfo } = useSWR(
    [
      `StakeV2:vestingInfo:${active}`,
      ARBITRUM,
      arbRewardReaderAddress,
      "getVestingInfoV2",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(undefined, RewardReader, [arbVesterAdddresses]),
    }
  );

  const { data: avaxVestingInfo } = useSWR(
    [
      `StakeV2:vestingInfo:${active}`,
      AVALANCHE,
      avaxRewardReaderAddress,
      "getVestingInfoV2",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(undefined, RewardReader, [avaxVesterAdddresses]),
    }
  );

  const arbVestingData = getVestingDataV2(arbVestingInfo);
  const avaxVestingData = getVestingDataV2(avaxVestingInfo);

  let amount = parseValue(value, 18);

  let maxVestableAmount;
  let currentRatio;

  let nextMaxVestableEsOpec;
  let nextRatio;

  let initialStakingAmount;
  let nextStakingAmount;

  let stakingToken = "staked OPEC";

  const shouldShowStakingAmounts = false;

  if (selectedOption === VEST_WITH_GMX_ARB && arbVestingData) {
    const result = getVestingValues({
      minRatio: bigNumberify(4),
      amount,
      vestingDataItem: arbVestingData.opecVester,
    });

    if (result) {
      ({ maxVestableAmount, currentRatio, nextMaxVestableEsOpec, nextRatio, initialStakingAmount, nextStakingAmount } =
        result);
    }
  }

  if (selectedOption === VEST_WITH_XPC_ARB && arbVestingData) {
    const result = getVestingValues({
      minRatio: bigNumberify(320),
      amount,
      vestingDataItem: arbVestingData.xpcVester,
    });

    if (result) {
      ({ maxVestableAmount, currentRatio, nextMaxVestableEsOpec, nextRatio, initialStakingAmount, nextStakingAmount } =
        result);
    }

    stakingToken = "XPC";
  }

  if (selectedOption === VEST_WITH_GMX_AVAX && avaxVestingData) {
    const result = getVestingValues({
      minRatio: bigNumberify(4),
      amount,
      vestingDataItem: avaxVestingData.opecVester,
    });

    if (result) {
      ({ maxVestableAmount, currentRatio, nextMaxVestableEsOpec, nextRatio, initialStakingAmount, nextStakingAmount } =
        result);
    }
  }

  if (selectedOption === VEST_WITH_XPC_AVAX && avaxVestingData) {
    const result = getVestingValues({
      minRatio: bigNumberify(320),
      amount,
      vestingDataItem: avaxVestingData.xpcVester,
    });

    if (result) {
      ({ maxVestableAmount, currentRatio, nextMaxVestableEsOpec, nextRatio, initialStakingAmount, nextStakingAmount } =
        result);
    }

    stakingToken = "XPC";
  }

  const getError = () => {
    if (!active) {
      return "Wallet not connected";
    }

    if (esOpecIouBalance && esOpecIouBalance.eq(0)) {
      return "No esGMX to claim";
    }

    if (!amount || amount.eq(0)) {
      return "Enter an amount";
    }

    if (selectedOption === "") {
      return "Select an option";
    }

    return false;
  };

  const error = getError();

  const getPrimaryText = () => {
    if (error) {
      return error;
    }

    if (isClaiming) {
      return "Claiming...";
    }

    return "Claim";
  };

  const isPrimaryEnabled = () => {
    return !error && !isClaiming;
  };

  const claim = () => {
    setIsClaiming(true);

    let receiver;

    if (selectedOption === VEST_WITH_GMX_ARB) {
      receiver = "0x544a6ec142Aa9A7F75235fE111F61eF2EbdC250a";
    }

    if (selectedOption === VEST_WITH_XPC_ARB) {
      receiver = "0x9d8f6f6eE45275A5Ca3C6f6269c5622b1F9ED515";
    }

    if (selectedOption === VEST_WITH_GMX_AVAX) {
      receiver = "0x171a321A78dAE0CDC0Ba3409194df955DEEcA746";
    }

    if (selectedOption === VEST_WITH_XPC_AVAX) {
      receiver = "0x28863Dd19fb52DF38A9f2C6dfed40eeB996e3818";
    }

    const contract = new ethers.Contract(esOpecIouAddress, Token.abi, library.getSigner());
    callContract(chainId, contract, "transfer", [receiver, amount], {
      sentMsg: "Claim submitted!",
      failMsg: "Claim failed.",
      successMsg: "Claim completed!",
      setPendingTxns,
    })
      .then(async (res) => {})
      .finally(() => {
        setIsClaiming(false);
      });
  };

  return (
    <div className="ClaimEsOpec Page page-layout">
      <div className="Page-title-section mt-0">
        <div className="Page-title">Claim esGMX</div>
        {!isArbitrum && (
          <div className="Page-description">
            <br />
            Please switch your network to Arbitrum.
          </div>
        )}
        {isArbitrum && (
          <div>
            <div className="Page-description">
              <br />
              You have {formatAmount(esOpecIouBalance, 18, 2, true)} esGMX (IOU) tokens.
              <br />
              <br />
              The address of the esGMX (IOU) token is {esOpecIouAddress}.<br />
              The esGMX (IOU) token is transferrable. You can add the token to your wallet and send it to another
              address to claim if you'd like.
              <br />
              <br />
              Select your vesting option below then click "Claim".
              <br />
              After claiming, the esGMX tokens will be airdropped to your account on the selected network within 7 days.{" "}
              <br />
              The esGMX tokens can be staked or vested at any time.
              <br />
              Your esGMX (IOU) balance will decrease by your claim amount after claiming, this is expected behaviour.
              <br />
              You can check your claim history{" "}
              <a
                href={`https://arbiscan.io/token/${esOpecIouAddress}?a=${account}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>
              .
            </div>
            <br />
            <div className="ClaimEsOpec-vesting-options">
              <Checkbox
                className="arbitrum btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_GMX_ARB}
                setIsChecked={() => setSelectedOption(VEST_WITH_GMX_ARB)}
              >
                <div className="ClaimEsOpec-option-label">Vest with OPEC on Arbitrum</div>
                <img src={arbitrumIcon} alt="arbitrum" />
              </Checkbox>
              <Checkbox
                className="arbitrum btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_XPC_ARB}
                setIsChecked={() => setSelectedOption(VEST_WITH_XPC_ARB)}
              >
                <div className="ClaimEsOpec-option-label">Vest with XPC on Arbitrum</div>
                <img src={arbitrumIcon} alt="arbitrum" />
              </Checkbox>
              <Checkbox
                className="avalanche btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_GMX_AVAX}
                setIsChecked={() => setSelectedOption(VEST_WITH_GMX_AVAX)}
              >
                <div className="ClaimEsOpec-option-label">Vest with OPEC on Avalanche</div>
                <img src={avaIcon} alt="avalanche" />
              </Checkbox>
              <Checkbox
                className="avalanche btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_XPC_AVAX}
                setIsChecked={() => setSelectedOption(VEST_WITH_XPC_AVAX)}
              >
                <div className="ClaimEsOpec-option-label avalanche">Vest with XPC on Avalanche</div>
                <img src={avaIcon} alt="avalanche" />
              </Checkbox>
            </div>
            <br />
            {!error && (
              <div className="muted">
                You can currently vest a maximum of {formatAmount(maxVestableAmount, 18, 2, true)} esGMX tokens at a
                ratio of {formatAmount(currentRatio, 4, 2, true)} {stakingToken} to 1 esGMX.{" "}
                {shouldShowStakingAmounts && `${formatAmount(initialStakingAmount, 18, 2, true)}.`}
                <br />
                After claiming you will be able to vest a maximum of {formatAmount(
                  nextMaxVestableEsOpec,
                  18,
                  2,
                  true
                )}{" "}
                esGMX at a ratio of {formatAmount(nextRatio, 4, 2, true)} {stakingToken} to 1 esGMX.{" "}
                {shouldShowStakingAmounts && `${formatAmount(nextStakingAmount, 18, 2, true)}.`}
                <br />
                <br />
              </div>
            )}
            <div>
              <div className="ClaimEsOpec-input-label muted">Amount to claim</div>
              <div className="ClaimEsOpec-input-container">
                <input type="number" placeholder="0.0" value={value} onChange={(e) => setValue(e.target.value)} />
                {value !== formatAmountFree(esOpecIouBalance, 18, 18) && (
                  <div
                    className="ClaimEsOpec-max-button"
                    onClick={() => setValue(formatAmountFree(esOpecIouBalance, 18, 18))}
                  >
                    MAX
                  </div>
                )}
              </div>
            </div>
            <br />
            <div>
              <button className="App-cta Exchange-swap-button" disabled={!isPrimaryEnabled()} onClick={() => claim()}>
                {getPrimaryText()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
