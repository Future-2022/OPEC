import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWeb3React } from "@web3-react/core";

import Modal from "../../components/Modal/Modal";
import Checkbox from "../../components/Checkbox/Checkbox";
import Tooltip from "../../components/Tooltip/Tooltip";
import Footer from "../../Footer";

import Vault from "../../abis/Vault.json";
import ReaderV2 from "../../abis/ReaderV2.json";
import Vester from "../../abis/Vester.json";
import RewardRouter from "../../abis/RewardRouter.json";
import RewardReader from "../../abis/RewardReader.json";
import Token from "../../abis/Token.json";
import XpcManager from "../../abis/XpcManager.json";

import { ethers } from "ethers";
import {
  helperToast,
  bigNumberify,
  fetcher,
  formatAmount,
  formatKeyAmount,
  formatAmountFree,
  getChainName,
  expandDecimals,
  parseValue,
  approveTokens,
  getServerUrl,
  useLocalStorageSerializeKey,
  useChainId,
  XPC_DECIMALS,
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  ARBITRUM,
  PLACEHOLDER_ACCOUNT,
  getBalanceAndSupplyData,
  getDepositBalanceData,
  getVestingData,
  getStakingData,
  getProcessedData,
  getPageTitle,
} from "../../Helpers";
import { callContract, useOpecPrice, useTotalOpecStaked, useTotalOpecSupply } from "../../Api";
import { getConstant } from "../../Constants";

import useSWR from "swr";

import { getContract } from "../../Addresses";

import "./StakeV2.css";
import SEO from "../../components/Common/SEO";

const { AddressZero } = ethers.constants;

function StakeModal(props) {
  const {
    isVisible,
    setIsVisible,
    chainId,
    title,
    maxAmount,
    value,
    setValue,
    active,
    account,
    library,
    stakingTokenSymbol,
    stakingTokenAddress,
    farmAddress,
    rewardRouterAddress,
    stakeMethodName,
    setPendingTxns,
  } = props;
  const [isStaking, setIsStaking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { data: tokenAllowance } = useSWR(
    active && stakingTokenAddress && [active, chainId, stakingTokenAddress, "allowance", account, farmAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  let amount = parseValue(value, 18);
  const needApproval = farmAddress !== AddressZero && tokenAllowance && amount && amount.gt(tokenAllowance);

  const getError = () => {
    if (!amount || amount.eq(0)) {
      return "Enter an amount";
    }
    if (maxAmount && amount.gt(maxAmount)) {
      return "Max amount exceeded";
    }
  };

  const onClickPrimary = () => {
    if (needApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: stakingTokenAddress,
        spender: farmAddress,
        chainId,
      });
      return;
    }

    setIsStaking(true);
    console.log('reward router address', stakeMethodName);
    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());

    callContract(chainId, contract, stakeMethodName, [amount], {
      sentMsg: "Stake submitted!",
      failMsg: "Stake failed.",
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsStaking(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isStaking) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isApproving) {
      return `Approving ${stakingTokenSymbol}...`;
    }
    if (needApproval) {
      return `Approve ${stakingTokenSymbol}`;
    }
    if (isStaking) {
      return "Staking...";
    }
    return "Stake";
  };

  return (
    <div className="StakeModal">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title}>
        <div className="Exchange-swap-section">
          <div className="Exchange-swap-section-top">
            <div className="muted">
              <div className="Exchange-swap-usd">Stake</div>
            </div>
            <div className="muted align-right clickable" onClick={() => setValue(formatAmountFree(maxAmount, 18, 18))}>
              Max: {formatAmount(maxAmount, 18, 4, true)}
            </div>
          </div>
          <div className="Exchange-swap-section-bottom">
            <div>
              <input
                type="number"
                placeholder="0.0"
                className="Exchange-swap-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="PositionEditor-token-symbol">{stakingTokenSymbol}</div>
          </div>
        </div>
        <div className="Exchange-swap-button-container">
          <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function UnstakeModal(props) {
  const {
    isVisible,
    setIsVisible,
    chainId,
    title,
    maxAmount,
    value,
    setValue,
    library,
    unstakingTokenSymbol,
    rewardRouterAddress,
    unstakeMethodName,
    multiplierPointsAmount,
    reservedAmount,
    bonusOpecInFeeOpec,
    setPendingTxns,
  } = props;
  const [isUnstaking, setIsUnstaking] = useState(false);

  let amount = parseValue(value, 18);
  let burnAmount;

  if (
    multiplierPointsAmount &&
    multiplierPointsAmount.gt(0) &&
    amount &&
    amount.gt(0) &&
    bonusOpecInFeeOpec &&
    bonusOpecInFeeOpec.gt(0)
  ) {
    burnAmount = multiplierPointsAmount.mul(amount).div(bonusOpecInFeeOpec);
  }

  const shouldShowReductionAmount = true;
  let rewardReductionBasisPoints;
  if (burnAmount && bonusOpecInFeeOpec) {
    rewardReductionBasisPoints = burnAmount.mul(BASIS_POINTS_DIVISOR).div(bonusOpecInFeeOpec);
  }

  const getError = () => {
    if (!amount) {
      return "Enter an amount";
    }
    if (amount.gt(maxAmount)) {
      return "Max amount exceeded";
    }
  };

  const onClickPrimary = () => {
    setIsUnstaking(true);
    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    callContract(chainId, contract, unstakeMethodName, [amount], {
      sentMsg: "Unstake submitted!",
      failMsg: "Unstake failed.",
      successMsg: "Unstake completed!",
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsUnstaking(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isUnstaking) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isUnstaking) {
      return "Unstaking...";
    }
    return "Unstake";
  };

  return (
    <div className="StakeModal">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title}>
        <div className="Exchange-swap-section">
          <div className="Exchange-swap-section-top">
            <div className="muted">
              <div className="Exchange-swap-usd">Unstake</div>
            </div>
            <div className="muted align-right clickable" onClick={() => setValue(formatAmountFree(maxAmount, 18, 18))}>
              Max: {formatAmount(maxAmount, 18, 4, true)}
            </div>
          </div>
          <div className="Exchange-swap-section-bottom">
            <div>
              <input
                type="number"
                placeholder="0.0"
                className="Exchange-swap-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="PositionEditor-token-symbol">{unstakingTokenSymbol}</div>
          </div>
        </div>
        {reservedAmount && reservedAmount.gt(0) && (
          <div className="Modal-note">
            You have {formatAmount(reservedAmount, 18, 2, true)} tokens reserved for vesting.
          </div>
        )}
        {burnAmount && burnAmount.gt(0) && rewardReductionBasisPoints && rewardReductionBasisPoints.gt(0) && (
          <div className="Modal-note">
            Unstaking will burn&nbsp;
            <a href="https://gmxio.gitbook.io/gmx/rewards" target="_blank" rel="noopener noreferrer">
              {formatAmount(burnAmount, 18, 4, true)} Multiplier Points
            </a>
            .&nbsp;
            {shouldShowReductionAmount && (
              <span>Boost Percentage: -{formatAmount(rewardReductionBasisPoints, 2, 2)}%.</span>
            )}
          </div>
        )}
        <div className="Exchange-swap-button-container">
          <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function VesterDepositModal(props) {
  const {
    isVisible,
    setIsVisible,
    chainId,
    title,
    maxAmount,
    value,
    setValue,
    balance,
    vestedAmount,
    averageStakedAmount,
    maxVestableAmount,
    library,
    stakeTokenLabel,
    reserveAmount,
    maxReserveAmount,
    vesterAddress,
    setPendingTxns,
  } = props;
  const [isDepositing, setIsDepositing] = useState(false);

  let amount = parseValue(value, 18);

  let nextReserveAmount = reserveAmount;

  let nextDepositAmount = vestedAmount;
  if (amount) {
    nextDepositAmount = vestedAmount.add(amount);
  }

  let additionalReserveAmount = bigNumberify(0);
  if (amount && averageStakedAmount && maxVestableAmount && maxVestableAmount.gt(0)) {
    nextReserveAmount = nextDepositAmount.mul(averageStakedAmount).div(maxVestableAmount);
    if (nextReserveAmount.gt(reserveAmount)) {
      additionalReserveAmount = nextReserveAmount.sub(reserveAmount);
    }
  }

  const getError = () => {
    if (!amount || amount.eq(0)) {
      return "Enter an amount";
    }
    if (maxAmount && amount.gt(maxAmount)) {
      return "Max amount exceeded";
    }
    if (nextReserveAmount.gt(maxReserveAmount)) {
      return "Insufficient staked tokens";
    }
  };

  const onClickPrimary = () => {
    setIsDepositing(true);
    const contract = new ethers.Contract(vesterAddress, Vester.abi, library.getSigner());

    callContract(chainId, contract, "deposit", [amount], {
      sentMsg: "Deposit submitted!",
      failMsg: "Deposit failed!",
      successMsg: "Deposited!",
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsDepositing(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isDepositing) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isDepositing) {
      return "Depositing...";
    }
    return "Deposit";
  };

  return (
    <SEO title={getPageTitle("Earn")}>
      <div className="StakeModal">
        <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title} className="non-scrollable">
          <div className="Exchange-swap-section">
            <div className="Exchange-swap-section-top">
              <div className="muted">
                <div className="Exchange-swap-usd">Deposit</div>
              </div>
              <div
                className="muted align-right clickable"
                onClick={() => setValue(formatAmountFree(maxAmount, 18, 18))}
              >
                Max: {formatAmount(maxAmount, 18, 4, true)}
              </div>
            </div>
            <div className="Exchange-swap-section-bottom">
              <div>
                <input
                  type="number"
                  placeholder="0.0"
                  className="Exchange-swap-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="PositionEditor-token-symbol">esOPEC</div>
            </div>
          </div>
          <div className="VesterDepositModal-info-rows">
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Wallet</div>
              <div className="align-right">{formatAmount(balance, 18, 2, true)} esOPEC</div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Vault Capacity</div>
              <div className="align-right">
                <Tooltip
                  handle={`${formatAmount(nextDepositAmount, 18, 2, true)} / ${formatAmount(
                    maxVestableAmount,
                    18,
                    2,
                    true
                  )}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <>
                        Vault Capacity for your Account
                        <br />
                        <br />
                        Deposited: {formatAmount(vestedAmount, 18, 2, true)} esOPEC
                        <br />
                        Max Capacity: {formatAmount(maxVestableAmount, 18, 2, true)} esOPEC
                        <br />
                      </>
                    );
                  }}
                />
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Reserve Amount</div>
              <div className="align-right">
                <Tooltip
                  handle={`${formatAmount(
                    reserveAmount && reserveAmount.gte(additionalReserveAmount)
                      ? reserveAmount
                      : additionalReserveAmount,
                    18,
                    2,
                    true
                  )} / ${formatAmount(maxReserveAmount, 18, 2, true)}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <>
                        Current Reserved: {formatAmount(reserveAmount, 18, 2, true)}
                        <br />
                        Additional reserve required: {formatAmount(additionalReserveAmount, 18, 2, true)}
                        <br />
                        {amount && nextReserveAmount.gt(maxReserveAmount) && (
                          <div>
                            <br />
                            You need a total of at least {formatAmount(nextReserveAmount, 18, 2, true)}{" "}
                            {stakeTokenLabel} to vest {formatAmount(amount, 18, 2, true)} esOPEC.
                          </div>
                        )}
                      </>
                    );
                  }}
                />
              </div>
            </div>
          </div>
          <div className="Exchange-swap-button-container">
            <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
              {getPrimaryText()}
            </button>
          </div>
        </Modal>
      </div>
    </SEO>
  );
}

function VesterWithdrawModal(props) {
  const { isVisible, setIsVisible, chainId, title, library, vesterAddress, setPendingTxns } = props;
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const onClickPrimary = () => {
    setIsWithdrawing(true);
    const contract = new ethers.Contract(vesterAddress, Vester.abi, library.getSigner());

    callContract(chainId, contract, "withdraw", [], {
      sentMsg: "Withdraw submitted.",
      failMsg: "Withdraw failed.",
      successMsg: "Withdrawn!",
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsWithdrawing(false);
      });
  };

  return (
    <div className="StakeModal">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title}>
        <div>
          This will withdraw and unreserve all tokens as well as pause vesting.
          <br />
          <br />
          esOPEC tokens that have been converted to OPEC will remain as OPEC tokens.
          <br />
          <br />
          To claim OPEC tokens without withdrawing, use the "Claim" button under the Total Rewards section.
          <br />
          <br />
        </div>
        <div className="Exchange-swap-button-container">
          <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={isWithdrawing}>
            {!isWithdrawing && "Confirm Withdraw"}
            {isWithdrawing && "Confirming..."}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function CompoundModal(props) {
  const {
    isVisible,
    setIsVisible,
    rewardRouterAddress,
    active,
    account,
    library,
    chainId,
    setPendingTxns,
    totalVesterRewards,
    nativeTokenSymbol,
    wrappedTokenSymbol,
  } = props;
  const [isCompounding, setIsCompounding] = useState(false);
  const [shouldClaimOpec, setShouldClaimOpec] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-claim-opec"],
    true
  );
  const [shouldStakeOpec, setShouldStakeOpec] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-stake-opec"],
    true
  );
  const [shouldClaimEsOpec, setShouldClaimEsOpec] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-claim-es-opec"],
    true
  );
  const [shouldStakeEsOpec, setShouldStakeEsOpec] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-stake-es-opec"],
    true
  );
  const [shouldStakeMultiplierPoints, setShouldStakeMultiplierPoints] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-stake-multiplier-points"],
    true
  );
  const [shouldClaimWeth, setShouldClaimWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-claim-weth"],
    true
  );
  const [shouldConvertWeth, setShouldConvertWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-convert-weth"],
    true
  );

  const opecAddress = getContract(chainId, "OPEC");
  const stakedOpecTrackerAddress = getContract(chainId, "StakedOpecTracker");

  const [isApproving, setIsApproving] = useState(false);

  const { data: tokenAllowance } = useSWR(
    active && [active, chainId, opecAddress, "allowance", account, stakedOpecTrackerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const needApproval = shouldStakeOpec && tokenAllowance && totalVesterRewards && totalVesterRewards.gt(tokenAllowance);

  const isPrimaryEnabled = () => {
    return !isCompounding && !isApproving && !isCompounding;
  };

  const getPrimaryText = () => {
    if (isApproving) {
      return `Approving OPEC...`;
    }
    if (needApproval) {
      return `Approve OPEC`;
    }
    if (isCompounding) {
      return "Compounding...";
    }
    return "Compound";
  };

  const onClickPrimary = () => {
    if (needApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: opecAddress,
        spender: stakedOpecTrackerAddress,
        chainId,
      });
      return;
    }

    setIsCompounding(true);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    callContract(
      chainId,
      contract,
      "handleRewards",
      [
        shouldClaimOpec || shouldStakeOpec,
        shouldStakeOpec,
        shouldClaimEsOpec || shouldStakeEsOpec,
        shouldStakeEsOpec,
        shouldStakeMultiplierPoints,
        shouldClaimWeth || shouldConvertWeth,
        shouldConvertWeth,
      ],
      {
        sentMsg: "Compound submitted!",
        failMsg: "Compound failed.",
        successMsg: "Compound completed!",
        setPendingTxns,
      }
    )
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsCompounding(false);
      });
  };

  const toggleShouldStakeOpec = (value) => {
    if (value) {
      setShouldClaimOpec(true);
    }
    setShouldStakeOpec(value);
  };

  const toggleShouldStakeEsOpec = (value) => {
    if (value) {
      setShouldClaimEsOpec(true);
    }
    setShouldStakeEsOpec(value);
  };

  const toggleConvertWeth = (value) => {
    if (value) {
      setShouldClaimWeth(true);
    }
    setShouldConvertWeth(value);
  };

  return (
    <div className="StakeModal">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label="Compound Rewards">
        <div className="CompoundModal-menu">
          <div>
            <Checkbox isChecked={shouldStakeMultiplierPoints} setIsChecked={setShouldStakeMultiplierPoints} disabled={true}>
              Stake Multiplier Points
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimOpec} setIsChecked={setShouldClaimOpec} disabled={shouldStakeOpec}>
              Claim OPEC Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldStakeOpec} setIsChecked={toggleShouldStakeOpec}>
              Stake OPEC Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimEsOpec} setIsChecked={setShouldClaimEsOpec} disabled={shouldStakeEsOpec}>
              Claim esOPEC Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldStakeEsOpec} setIsChecked={toggleShouldStakeEsOpec}>
              Stake esOPEC Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimWeth} setIsChecked={setShouldClaimWeth} disabled={shouldConvertWeth}>
              Claim {wrappedTokenSymbol} Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldConvertWeth} setIsChecked={toggleConvertWeth}>
              Convert {wrappedTokenSymbol} to {nativeTokenSymbol}
            </Checkbox>
          </div>
        </div>
        <div className="Exchange-swap-button-container">
          <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ClaimModal(props) {
  const {
    isVisible,
    setIsVisible,
    rewardRouterAddress,
    library,
    chainId,
    setPendingTxns,
    nativeTokenSymbol,
    wrappedTokenSymbol,
  } = props;
  const [isClaiming, setIsClaiming] = useState(false);
  const [shouldClaimOpec, setShouldClaimOpec] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-claim-opec"],
    true
  );
  const [shouldClaimEsOpec, setShouldClaimEsOpec] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-claim-es-opec"],
    true
  );
  const [shouldClaimWeth, setShouldClaimWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-claim-weth"],
    true
  );
  const [shouldConvertWeth, setShouldConvertWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-convert-weth"],
    true
  );

  const isPrimaryEnabled = () => {
    return !isClaiming;
  };

  const getPrimaryText = () => {
    if (isClaiming) {
      return `Claiming...`;
    }
    return "Claim";
  };

  const onClickPrimary = () => {
    setIsClaiming(true);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    callContract(
      chainId,
      contract,
      "handleRewards",
      [
        shouldClaimOpec,
        false, // shouldStakeOpec
        shouldClaimEsOpec,
        false, // shouldStakeEsOpec
        false, // shouldStakeMultiplierPoints
        shouldClaimWeth,
        shouldConvertWeth,
      ],
      {
        sentMsg: "Claim submitted.",
        failMsg: "Claim failed.",
        successMsg: "Claim completed!",
        setPendingTxns,
      }
    )
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsClaiming(false);
      });
  };

  const toggleConvertWeth = (value) => {
    if (value) {
      setShouldClaimWeth(true);
    }
    setShouldConvertWeth(value);
  };

  return (
    <div className="StakeModal">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label="Claim Rewards">
        <div className="CompoundModal-menu">
          <div>
            <Checkbox isChecked={shouldClaimOpec} setIsChecked={setShouldClaimOpec}>
              Claim OPEC Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimEsOpec} setIsChecked={setShouldClaimEsOpec}>
              Claim esOPEC Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimWeth} setIsChecked={setShouldClaimWeth} disabled={shouldConvertWeth}>
              Claim {wrappedTokenSymbol} Rewards
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldConvertWeth} setIsChecked={toggleConvertWeth}>
              Convert {wrappedTokenSymbol} to {nativeTokenSymbol}
            </Checkbox>
          </div>
        </div>
        <div className="Exchange-swap-button-container">
          <button className="App-cta Exchange-swap-button" onClick={onClickPrimary} disabled={!isPrimaryEnabled()}>
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function StakeV2({ setPendingTxns, connectWallet }) {
  const { active, library, account } = useWeb3React();
  const { chainId } = useChainId();

  const chainName = getChainName(chainId);

  const hasInsurance = true;

  const [isStakeModalVisible, setIsStakeModalVisible] = useState(false);
  const [stakeModalTitle, setStakeModalTitle] = useState("");
  const [stakeModalMaxAmount, setStakeModalMaxAmount] = useState(undefined);
  const [stakeValue, setStakeValue] = useState("");
  const [stakingTokenSymbol, setStakingTokenSymbol] = useState("");
  const [stakingTokenAddress, setStakingTokenAddress] = useState("");
  const [stakingFarmAddress, setStakingFarmAddress] = useState("");
  const [stakeMethodName, setStakeMethodName] = useState("");

  const [isUnstakeModalVisible, setIsUnstakeModalVisible] = useState(false);
  const [unstakeModalTitle, setUnstakeModalTitle] = useState("");
  const [unstakeModalMaxAmount, setUnstakeModalMaxAmount] = useState(undefined);
  const [unstakeModalReservedAmount, setUnstakeModalReservedAmount] = useState(undefined);
  const [unstakeValue, setUnstakeValue] = useState("");
  const [unstakingTokenSymbol, setUnstakingTokenSymbol] = useState("");
  const [unstakeMethodName, setUnstakeMethodName] = useState("");

  const [isVesterDepositModalVisible, setIsVesterDepositModalVisible] = useState(false);
  const [vesterDepositTitle, setVesterDepositTitle] = useState("");
  const [vesterDepositStakeTokenLabel, setVesterDepositStakeTokenLabel] = useState("");
  const [vesterDepositMaxAmount, setVesterDepositMaxAmount] = useState("");
  const [vesterDepositBalance, setVesterDepositBalance] = useState("");
  const [vesterDepositEscrowedBalance, setVesterDepositEscrowedBalance] = useState("");
  const [vesterDepositVestedAmount, setVesterDepositVestedAmount] = useState("");
  const [vesterDepositAverageStakedAmount, setVesterDepositAverageStakedAmount] = useState("");
  const [vesterDepositMaxVestableAmount, setVesterDepositMaxVestableAmount] = useState("");
  const [vesterDepositValue, setVesterDepositValue] = useState("");
  const [vesterDepositReserveAmount, setVesterDepositReserveAmount] = useState("");
  const [vesterDepositMaxReserveAmount, setVesterDepositMaxReserveAmount] = useState("");
  const [vesterDepositAddress, setVesterDepositAddress] = useState("");

  const [isVesterWithdrawModalVisible, setIsVesterWithdrawModalVisible] = useState(false);
  const [vesterWithdrawTitle, setVesterWithdrawTitle] = useState(false);
  const [vesterWithdrawAddress, setVesterWithdrawAddress] = useState("");

  const [isCompoundModalVisible, setIsCompoundModalVisible] = useState(false);
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);

  const rewardRouterAddress = getContract(chainId, "RewardRouter");
  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const readerAddress = getContract(chainId, "Reader");

  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const opecAddress = getContract(chainId, "OPEC");
  const esOpecAddress = getContract(chainId, "ES_OPEC");
  const bnOpecAddress = getContract(chainId, "BN_OPEC");
  const xpcAddress = getContract(chainId, "XPC");

  const stakedOpecTrackerAddress = getContract(chainId, "StakedOpecTracker");
  const bonusOpecTrackerAddress = getContract(chainId, "BonusOpecTracker");
  const feeOpecTrackerAddress = getContract(chainId, "FeeOpecTracker");

  const stakedXpcTrackerAddress = getContract(chainId, "StakedXpcTracker");
  const feeXpcTrackerAddress = getContract(chainId, "FeeXpcTracker");

  const xpcManagerAddress = getContract(chainId, "XpcManager");

  const stakedOpecDistributorAddress = getContract(chainId, "StakedOpecDistributor");
  const stakedXpcDistributorAddress = getContract(chainId, "StakedXpcDistributor");

  const opecVesterAddress = getContract(chainId, "OpecVester");
  const xpcVesterAddress = getContract(chainId, "XpcVester");

  const vesterAddresses = [opecVesterAddress, xpcVesterAddress];

  const excludedEsOpecAccounts = [stakedOpecDistributorAddress, stakedXpcDistributorAddress];

  const nativeTokenSymbol = getConstant(chainId, "nativeTokenSymbol");
  const wrappedTokenSymbol = getConstant(chainId, "wrappedTokenSymbol");

  const walletTokens = [opecAddress, esOpecAddress, xpcAddress, stakedOpecTrackerAddress];
  console.log(opecAddress)
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
    [
      `StakeV2:walletBalances:${active}`,
      chainId,
      readerAddress,
      "getTokenBalancesWithSupplies",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(library, ReaderV2, [walletTokens]),
    }
  );

  const { data: depositBalances } = useSWR(
    [
      `StakeV2:depositBalances:${active}`,
      chainId,
      rewardReaderAddress,
      "getDepositBalances",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: fetcher(library, RewardReader, [depositTokens, rewardTrackersForDepositBalances]),
    }
  );

  const { data: stakingInfo } = useSWR(
    [`StakeV2:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const { data: stakedOpecSupply } = useSWR(
    [`StakeV2:stakedOpecSupply:${active}`, chainId, opecAddress, "balanceOf", stakedOpecTrackerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const { data: aums } = useSWR([`StakeV2:getAums:${active}`, chainId, xpcManagerAddress, "getAums"], {
    fetcher: fetcher(library, XpcManager),
  });

  const { data: nativeTokenPrice } = useSWR(
    [`StakeV2:nativeTokenPrice:${active}`, chainId, vaultAddress, "getMinPrice", nativeTokenAddress],
    {
      fetcher: fetcher(library, Vault),
    }
  );

  const { data: esOpecSupply } = useSWR(
    [`StakeV2:esOpecSupply:${active}`, chainId, readerAddress, "getTokenSupply", esOpecAddress],
    {
      fetcher: fetcher(library, ReaderV2, [excludedEsOpecAccounts]),
    }
  );

  const { data: vestingInfo } = useSWR(
    [`StakeV2:vestingInfo:${active}`, chainId, readerAddress, "getVestingInfo", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: fetcher(library, ReaderV2, [vesterAddresses]),
    }
  );

  const { opecPrice, opecPriceFromArbitrum, opecPriceFromAvalanche } = useOpecPrice(
    chainId,
    { arbitrum: chainId === ARBITRUM ? library : undefined },
    active
  );

  let { total: totalOpecSupply } = useTotalOpecSupply();

  let { avax: avaxOpecStaked, arbitrum: arbitrumOpecStaked, total: totalOpecStaked } = useTotalOpecStaked();

  const opecSupplyUrl = getServerUrl(chainId, "/gmx_supply");
  const { data: opecSupply } = useSWR([opecSupplyUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.text()),
  });

  const isOpecTransferEnabled = true;

  let esOpecSupplyUsd;
  if (esOpecSupply && opecPrice) {
    esOpecSupplyUsd = esOpecSupply.mul(opecPrice).div(expandDecimals(1, 18));
  }

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

  let hasMultiplierPoints = false;
  let multiplierPointsAmount;
  if (processedData && processedData.bonusOpecTrackerRewards && processedData.bnOpecInFeeOpec) {
    multiplierPointsAmount = processedData.bonusOpecTrackerRewards.add(processedData.bnOpecInFeeOpec);
    if (multiplierPointsAmount.gt(0)) {
      hasMultiplierPoints = true;
    }
  }
  let totalRewardTokens;
  if (processedData && processedData.bnOpecInFeeOpec && processedData.bonusOpecInFeeOpec) {
    totalRewardTokens = processedData.bnOpecInFeeOpec.add(processedData.bonusOpecInFeeOpec);
  }

  let totalRewardTokensAndXpc;
  if (totalRewardTokens && processedData && processedData.xpcBalance) {
    totalRewardTokensAndXpc = totalRewardTokens.add(processedData.xpcBalance);
  }

  const bonusOpecInFeeOpec = processedData ? processedData.bonusOpecInFeeOpec : undefined;

  let stakedOpecSupplyUsd;
  if (!totalOpecStaked.isZero() && opecPrice) {
    stakedOpecSupplyUsd = totalOpecStaked.mul(opecPrice).div(expandDecimals(1, 18));
  }

  let totalSupplyUsd;
  if (totalOpecSupply && !totalOpecSupply.isZero() && opecPrice) {
    totalSupplyUsd = totalOpecSupply.mul(opecPrice).div(expandDecimals(1, 18));
  }

  let maxUnstakeableOpec = bigNumberify(0);
  if (
    totalRewardTokens &&
    vestingData &&
    vestingData.opecVesterPairAmount &&
    multiplierPointsAmount &&
    processedData.bonusOpecInFeeOpec
  ) {
    const availableTokens = totalRewardTokens.sub(vestingData.opecVesterPairAmount);
    const stakedTokens = processedData.bonusOpecInFeeOpec;
    const divisor = multiplierPointsAmount.add(stakedTokens);
    if (divisor.gt(0)) {
      maxUnstakeableOpec = availableTokens.mul(stakedTokens).div(divisor);
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const showStakeOpecModal = () => {
    if (!isOpecTransferEnabled) {
      helperToast.error("OPEC transfers not yet enabled");
      return;
    }

    setIsStakeModalVisible(true);
    setStakeModalTitle("Stake OPEC");
    setStakeModalMaxAmount(processedData.opecBalance);
    setStakeValue("");
    setStakingTokenSymbol("OPEC");
    setStakingTokenAddress(opecAddress);
    setStakingFarmAddress(stakedOpecTrackerAddress);
    setStakeMethodName("stakeOpec");
  };

  const showStakeEsOpecModal = () => {
    setIsStakeModalVisible(true);
    setStakeModalTitle("Stake esOPEC");
    setStakeModalMaxAmount(processedData.esOpecBalance);
    setStakeValue("");
    setStakingTokenSymbol("esOPEC");
    setStakingTokenAddress(esOpecAddress);
    setStakingFarmAddress(AddressZero);
    setStakeMethodName("stakeEsOpec");
  };

  const showOpecVesterDepositModal = () => {
    let remainingVestableAmount = vestingData.opecVester.maxVestableAmount.sub(vestingData.opecVester.vestedAmount);
    if (processedData.esOpecBalance.lt(remainingVestableAmount)) {
      remainingVestableAmount = processedData.esOpecBalance;
    }

    setIsVesterDepositModalVisible(true);
    setVesterDepositTitle("OPEC Vault");
    setVesterDepositStakeTokenLabel("staked OPEC + esOPEC + Multiplier Points");
    setVesterDepositMaxAmount(remainingVestableAmount);
    setVesterDepositBalance(processedData.esOpecBalance);
    setVesterDepositEscrowedBalance(vestingData.opecVester.escrowedBalance);
    setVesterDepositVestedAmount(vestingData.opecVester.vestedAmount);
    setVesterDepositMaxVestableAmount(vestingData.opecVester.maxVestableAmount);
    setVesterDepositAverageStakedAmount(vestingData.opecVester.averageStakedAmount);
    setVesterDepositReserveAmount(vestingData.opecVester.pairAmount);
    setVesterDepositMaxReserveAmount(totalRewardTokens);
    setVesterDepositValue("");
    setVesterDepositAddress(opecVesterAddress);
  };

  const showXpcVesterDepositModal = () => {
    let remainingVestableAmount = vestingData.xpcVester.maxVestableAmount.sub(vestingData.xpcVester.vestedAmount);
    if (processedData.esOpecBalance.lt(remainingVestableAmount)) {
      remainingVestableAmount = processedData.esOpecBalance;
    }

    setIsVesterDepositModalVisible(true);
    setVesterDepositTitle("XPC Vault");
    setVesterDepositStakeTokenLabel("staked XPC");
    setVesterDepositMaxAmount(remainingVestableAmount);
    setVesterDepositBalance(processedData.esOpecBalance);
    setVesterDepositEscrowedBalance(vestingData.xpcVester.escrowedBalance);
    setVesterDepositVestedAmount(vestingData.xpcVester.vestedAmount);
    setVesterDepositMaxVestableAmount(vestingData.xpcVester.maxVestableAmount);
    setVesterDepositAverageStakedAmount(vestingData.xpcVester.averageStakedAmount);
    setVesterDepositReserveAmount(vestingData.xpcVester.pairAmount);
    setVesterDepositMaxReserveAmount(processedData.xpcBalance);
    setVesterDepositValue("");
    setVesterDepositAddress(xpcVesterAddress);
  };

  const showOpecVesterWithdrawModal = () => {
    if (!vestingData || !vestingData.opecVesterVestedAmount || vestingData.opecVesterVestedAmount.eq(0)) {
      helperToast.error("You have not deposited any tokens for vesting.");
      return;
    }

    setIsVesterWithdrawModalVisible(true);
    setVesterWithdrawTitle("Withdraw from OPEC Vault");
    setVesterWithdrawAddress(opecVesterAddress);
  };

  const showXpcVesterWithdrawModal = () => {
    if (!vestingData || !vestingData.xpcVesterVestedAmount || vestingData.xpcVesterVestedAmount.eq(0)) {
      helperToast.error("You have not deposited any tokens for vesting.");
      return;
    }

    setIsVesterWithdrawModalVisible(true);
    setVesterWithdrawTitle("Withdraw from XPC Vault");
    setVesterWithdrawAddress(xpcVesterAddress);
  };

  const showUnstakeOpecModal = () => {
    if (!isOpecTransferEnabled) {
      helperToast.error("OPEC transfers not yet enabled");
      return;
    }
    setIsUnstakeModalVisible(true);
    setUnstakeModalTitle("Unstake OPEC");
    let maxAmount = processedData.opecInStakedOpec;
    if (
      processedData.opecInStakedOpec &&
      vestingData &&
      vestingData.opecVesterPairAmount.gt(0) &&
      maxUnstakeableOpec &&
      maxUnstakeableOpec.lt(processedData.opecInStakedOpec)
    ) {
      maxAmount = maxUnstakeableOpec;
    }
    setUnstakeModalMaxAmount(maxAmount);
    setUnstakeModalReservedAmount(vestingData.opecVesterPairAmount);
    setUnstakeValue("");
    setUnstakingTokenSymbol("OPEC");
    setUnstakeMethodName("unstakeOpec");
  };

  const showUnstakeEsOpecModal = () => {
    setIsUnstakeModalVisible(true);
    setUnstakeModalTitle("Unstake esOPEC");
    let maxAmount = processedData.esOpecInStakedOpec;
    if (
      processedData.esOpecInStakedOpec &&
      vestingData &&
      vestingData.opecVesterPairAmount.gt(0) &&
      maxUnstakeableOpec &&
      maxUnstakeableOpec.lt(processedData.esOpecInStakedOpec)
    ) {
      maxAmount = maxUnstakeableOpec;
    }
    setUnstakeModalMaxAmount(maxAmount);
    setUnstakeModalReservedAmount(vestingData.opecVesterPairAmount);
    setUnstakeValue("");
    setUnstakingTokenSymbol("esOPEC");
    setUnstakeMethodName("unstakeEsOpec");
  };

  const renderMultiplierPointsLabel = useCallback(() => {
    return "Multiplier Points APR";
  }, []);

  const renderMultiplierPointsValue = useCallback(() => {
    return (
      <Tooltip
        handle={`100.00%`}
        position="right-bottom"
        renderContent={() => {
          return (
            <>
              Boost your rewards with Multiplier Points.&nbsp;
              <a href="https://gmxio.gitbook.io/gmx/rewards#multiplier-points" rel="noreferrer" target="_blank">
                More info
              </a>
              .
            </>
          );
        }}
      />
    );
  }, []);

  let earnMsg;
  if (totalRewardTokensAndXpc && totalRewardTokensAndXpc.gt(0)) {
    let opecAmountStr;
    if (processedData.opecInStakedOpec && processedData.opecInStakedOpec.gt(0)) {
      opecAmountStr = formatAmount(processedData.opecInStakedOpec, 18, 2, true) + " OPEC";
    }
    let esOpecAmountStr;
    if (processedData.esOpecInStakedOpec && processedData.esOpecInStakedOpec.gt(0)) {
      esOpecAmountStr = formatAmount(processedData.esOpecInStakedOpec, 18, 2, true) + " esOPEC";
    }
    let mpAmountStr;
    if (processedData.bonusOpecInFeeOpec && processedData.bnOpecInFeeOpec.gt(0)) {
      mpAmountStr = formatAmount(processedData.bnOpecInFeeOpec, 18, 2, true) + " MP";
    }
    let xpcStr;
    if (processedData.xpcBalance && processedData.xpcBalance.gt(0)) {
      xpcStr = formatAmount(processedData.xpcBalance, 18, 2, true) + " XPC";
    }
    const amountStr = [opecAmountStr, esOpecAmountStr, mpAmountStr, xpcStr].filter((s) => s).join(", ");
    earnMsg = (
      <div>
        You are earning {nativeTokenSymbol} rewards with {formatAmount(totalRewardTokensAndXpc, 18, 2, true)} tokens.
        <br />
        Tokens: {amountStr}.
      </div>
    );
  }

  return (
    <div className="default-container page-layout">
      <StakeModal
        isVisible={isStakeModalVisible}
        setIsVisible={setIsStakeModalVisible}
        chainId={chainId}
        title={stakeModalTitle}
        maxAmount={stakeModalMaxAmount}
        value={stakeValue}
        setValue={setStakeValue}
        active={active}
        account={account}
        library={library}
        stakingTokenSymbol={stakingTokenSymbol}
        stakingTokenAddress={stakingTokenAddress}
        farmAddress={stakingFarmAddress}
        rewardRouterAddress={rewardRouterAddress}
        stakeMethodName={stakeMethodName}
        hasMultiplierPoints={hasMultiplierPoints}
        setPendingTxns={setPendingTxns}
        nativeTokenSymbol={nativeTokenSymbol}
        wrappedTokenSymbol={wrappedTokenSymbol}
      />
      <UnstakeModal
        setPendingTxns={setPendingTxns}
        isVisible={isUnstakeModalVisible}
        setIsVisible={setIsUnstakeModalVisible}
        chainId={chainId}
        title={unstakeModalTitle}
        maxAmount={unstakeModalMaxAmount}
        reservedAmount={unstakeModalReservedAmount}
        value={unstakeValue}
        setValue={setUnstakeValue}
        library={library}
        unstakingTokenSymbol={unstakingTokenSymbol}
        rewardRouterAddress={rewardRouterAddress}
        unstakeMethodName={unstakeMethodName}
        multiplierPointsAmount={multiplierPointsAmount}
        bonusOpecInFeeOpec={bonusOpecInFeeOpec}
      />
      <VesterDepositModal
        isVisible={isVesterDepositModalVisible}
        setIsVisible={setIsVesterDepositModalVisible}
        chainId={chainId}
        title={vesterDepositTitle}
        stakeTokenLabel={vesterDepositStakeTokenLabel}
        maxAmount={vesterDepositMaxAmount}
        balance={vesterDepositBalance}
        escrowedBalance={vesterDepositEscrowedBalance}
        vestedAmount={vesterDepositVestedAmount}
        averageStakedAmount={vesterDepositAverageStakedAmount}
        maxVestableAmount={vesterDepositMaxVestableAmount}
        reserveAmount={vesterDepositReserveAmount}
        maxReserveAmount={vesterDepositMaxReserveAmount}
        value={vesterDepositValue}
        setValue={setVesterDepositValue}
        library={library}
        vesterAddress={vesterDepositAddress}
        setPendingTxns={setPendingTxns}
      />
      <VesterWithdrawModal
        isVisible={isVesterWithdrawModalVisible}
        setIsVisible={setIsVesterWithdrawModalVisible}
        vesterAddress={vesterWithdrawAddress}
        chainId={chainId}
        title={vesterWithdrawTitle}
        library={library}
        setPendingTxns={setPendingTxns}
      />
      <CompoundModal
        active={active}
        account={account}
        setPendingTxns={setPendingTxns}
        isVisible={isCompoundModalVisible}
        setIsVisible={setIsCompoundModalVisible}
        rewardRouterAddress={rewardRouterAddress}
        totalVesterRewards={processedData.totalVesterRewards}
        wrappedTokenSymbol={wrappedTokenSymbol}
        nativeTokenSymbol={nativeTokenSymbol}
        library={library}
        chainId={chainId}
      />
      <ClaimModal
        active={active}
        account={account}
        setPendingTxns={setPendingTxns}
        isVisible={isClaimModalVisible}
        setIsVisible={setIsClaimModalVisible}
        rewardRouterAddress={rewardRouterAddress}
        totalVesterRewards={processedData.totalVesterRewards}
        wrappedTokenSymbol={wrappedTokenSymbol}
        nativeTokenSymbol={nativeTokenSymbol}
        library={library}
        chainId={chainId}
      />
      <div className="section-title-block">
        <div className="section-title-icon"></div>
        <div className="section-title-content">
          <div className="Page-title">Earn</div>
          <div className="Page-description">
            Stake{" "}
            <a href="https://gmxio.gitbook.io/gmx/tokenomics" target="_blank" rel="noopener noreferrer">
              OPEC
            </a>{" "}
            and{" "}
            <a href="https://gmxio.gitbook.io/gmx/xpc" target="_blank" rel="noopener noreferrer">
              XPC
            </a>{" "}
            to earn rewards.
          </div>
          {earnMsg && <div className="Page-description">{earnMsg}</div>}
        </div>
      </div>
      <div className="StakeV2-content">
        <div className="StakeV2-cards">
          <div className="App-card StakeV2-opec-card">
            <div className="App-card-title">OPEC</div>
            <div className="App-card-divider"></div>
            <div className="App-card-content">
              <div className="App-card-row">
                <div className="label">Price</div>
                <div>
                  {!opecPrice && "..."}
                  {opecPrice && (
                    <Tooltip
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
                <div className="label">Wallet</div>
                <div>
                  {formatKeyAmount(processedData, "opecBalance", 18, 2, true)} OPEC ($
                  {formatKeyAmount(processedData, "opecBalanceUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Staked</div>
                <div>
                  {formatKeyAmount(processedData, "opecInStakedOpec", 18, 2, true)} OPEC ($
                  {formatKeyAmount(processedData, "opecInStakedOpecUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-row">
                <div className="label">APR</div>
                <div>
                  <Tooltip
                    handle={`${formatKeyAmount(processedData, "opecAprTotalWithBoost", 2, 2, true)}%`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          <div className="Tooltip-row">
                            <span className="label">Escrowed OPEC APR</span>
                            <span>{formatKeyAmount(processedData, "opecAprForEsOpec", 2, 2, true)}%</span>
                          </div>
                          {(!processedData.opecBoostAprForNativeToken ||
                            processedData.opecBoostAprForNativeToken.eq(0)) && (
                            <div className="Tooltip-row">
                              <span className="label">{nativeTokenSymbol} APR</span>
                              <span>{formatKeyAmount(processedData, "opecAprForNativeToken", 2, 2, true)}%</span>
                            </div>
                          )}
                          {processedData.opecBoostAprForNativeToken && processedData.opecBoostAprForNativeToken.gt(0) && (
                            <div>
                              <br />
                              <div className="Tooltip-row">
                                <span className="label">{nativeTokenSymbol} Base APR</span>
                                <span>{formatKeyAmount(processedData, "opecAprForNativeToken", 2, 2, true)}%</span>
                              </div>
                              <div className="Tooltip-row">
                                <span className="label">{nativeTokenSymbol} Boosted APR</span>
                                <span>{formatKeyAmount(processedData, "opecBoostAprForNativeToken", 2, 2, true)}%</span>
                              </div>
                              <div className="Tooltip-row">
                                <span className="label">{nativeTokenSymbol} Total APR</span>
                                <span>
                                  {formatKeyAmount(processedData, "opecAprForNativeTokenWithBoost", 2, 2, true)}%
                                </span>
                              </div>
                              <br />
                              <div className="muted">The Boosted APR is from your staked Multiplier Points.</div>
                            </div>
                          )}
                        </>
                      );
                    }}
                  />
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Rewards</div>
                <div>
                  <Tooltip
                    handle={`$${formatKeyAmount(processedData, "totalOpecRewardsUsd", USD_DECIMALS, 2, true)}`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          <div className="Tooltip-row">
                            <span className="label">
                              {nativeTokenSymbol} ({wrappedTokenSymbol})
                            </span>
                            <span>
                              {formatKeyAmount(processedData, "feeOpecTrackerRewards", 18, 4)} ($
                              {formatKeyAmount(processedData, "feeOpecTrackerRewardsUsd", USD_DECIMALS, 2, true)})
                            </span>
                          </div>
                          <div className="Tooltip-row">
                            <span className="label">Escrowed OPEC</span>
                            <span>
                              {formatKeyAmount(processedData, "stakedOpecTrackerRewards", 18, 4)} ($
                              {formatKeyAmount(processedData, "stakedOpecTrackerRewardsUsd", USD_DECIMALS, 2, true)})
                            </span>
                          </div>
                        </>
                      );
                    }}
                  />
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">{renderMultiplierPointsLabel()}</div>
                <div>{renderMultiplierPointsValue()}</div>
              </div>
              <div className="App-card-row">
                <div className="label">Boost Percentage</div>
                <div>
                  <Tooltip
                    handle={`${formatAmount(processedData.boostBasisPoints, 2, 2, false)}%`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          You are earning {formatAmount(processedData.boostBasisPoints, 2, 2, false)}% more{" "}
                          {nativeTokenSymbol} rewards using {formatAmount(processedData.bnOpecInFeeOpec, 18, 4, 2, true)}{" "}
                          Staked Multiplier Points.
                          <br />
                          <br />
                          Use the "Compound" button to stake your Multiplier Points.
                        </>
                      );
                    }}
                  />
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-row">
                <div className="label">Total Staked</div>
                <div>
                  {!totalOpecStaked && "..."}
                  {totalOpecStaked && (
                    <Tooltip
                      position="right-bottom"
                      className="nowrap"
                      handle={
                        formatAmount(totalOpecStaked, 18, 0, true) +
                        " OPEC" +
                        ` ($${formatAmount(stakedOpecSupplyUsd, USD_DECIMALS, 0, true)})`
                      }
                      renderContent={() => (
                        <>
                          Arbitrum: {formatAmount(arbitrumOpecStaked, 18, 0, true)} OPEC
                          <br />
                          Avalanche: {formatAmount(avaxOpecStaked, 18, 0, true)} OPEC
                        </>
                      )}
                    />
                  )}
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Total Supply</div>
                {!totalOpecSupply && "..."}
                {totalOpecSupply && (
                  <div>
                    {formatAmount(totalOpecSupply, 18, 0, true)} OPEC ($
                    {formatAmount(totalSupplyUsd, USD_DECIMALS, 0, true)})
                  </div>
                )}
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-options">
                <Link className="App-button-option App-card-option" to="/buy_opec">
                  Buy OPEC
                </Link>
                {active && (
                  <button className="App-button-option App-card-option" onClick={() => showStakeOpecModal()}>
                    Stake
                  </button>
                )}
                {active && (
                  <button className="App-button-option App-card-option" onClick={() => showUnstakeOpecModal()}>
                    Unstake
                  </button>
                )}
                {active && (
                  <Link className="App-button-option App-card-option" to="/begin_account_transfer">
                    Transfer Account
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="App-card primary StakeV2-total-rewards-card">
            <div className="App-card-title">Total Rewards</div>
            <div className="App-card-divider"></div>
            <div className="App-card-content">
              <div className="App-card-row">
                <div className="label">
                  {nativeTokenSymbol} ({wrappedTokenSymbol})
                </div>
                <div>
                  {formatKeyAmount(processedData, "totalNativeTokenRewards", 18, 4, true)} ($
                  {formatKeyAmount(processedData, "totalNativeTokenRewardsUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">OPEC</div>
                <div>
                  {formatKeyAmount(processedData, "totalVesterRewards", 18, 4, true)} ($
                  {formatKeyAmount(processedData, "totalVesterRewardsUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Escrowed OPEC</div>
                <div>
                  {formatKeyAmount(processedData, "totalEsOpecRewards", 18, 4, true)} ($
                  {formatKeyAmount(processedData, "totalEsOpecRewardsUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Multiplier Points</div>
                <div>{formatKeyAmount(processedData, "bonusOpecTrackerRewards", 18, 4, true)}</div>
              </div>
              <div className="App-card-row">
                <div className="label">Staked Multiplier Points</div>
                <div>{formatKeyAmount(processedData, "bnOpecInFeeOpec", 18, 4, true)}</div>
              </div>
              <div className="App-card-row">
                <div className="label">Total</div>
                <div>${formatKeyAmount(processedData, "totalRewardsUsd", USD_DECIMALS, 2, true)}</div>
              </div>
              <div className="App-card-bottom-placeholder">
                <div className="App-card-divider"></div>
                <div className="App-card-options">
                  {active && <button className="App-button-option App-card-option">Compound</button>}
                  {active && <button className="App-button-option App-card-option">Claim</button>}
                  {!active && (
                    <button className="App-button-option App-card-option" onClick={() => connectWallet()}>
                      Connect Wallet
                    </button>
                  )}
                </div>
              </div>
              <div className="App-card-bottom">
                <div className="App-card-divider"></div>
                <div className="App-card-options">
                  {active && (
                    <button
                      className="App-button-option App-card-option"
                      onClick={() => setIsCompoundModalVisible(true)}
                    >
                      Compound
                    </button>
                  )}
                  {active && (
                    <button className="App-button-option App-card-option" onClick={() => setIsClaimModalVisible(true)}>
                      Claim
                    </button>
                  )}
                  {!active && (
                    <button className="App-button-option App-card-option" onClick={() => connectWallet()}>
                      Connect Wallet
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="App-card">
            <div className="App-card-title">XPC ({chainName})</div>
            <div className="App-card-divider"></div>
            <div className="App-card-content">
              <div className="App-card-row">
                <div className="label">Price</div>
                <div>${formatKeyAmount(processedData, "xpcPrice", USD_DECIMALS, 3, true)}</div>
              </div>
              <div className="App-card-row">
                <div className="label">Wallet</div>
                <div>
                  {formatKeyAmount(processedData, "xpcBalance", XPC_DECIMALS, 2, true)} XPC ($
                  {formatKeyAmount(processedData, "xpcBalanceUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Staked</div>
                <div>
                  {formatKeyAmount(processedData, "xpcBalance", XPC_DECIMALS, 2, true)} XPC ($
                  {formatKeyAmount(processedData, "xpcBalanceUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-row">
                <div className="label">APR</div>
                <div>
                  <Tooltip
                    handle={`${formatKeyAmount(processedData, "xpcAprTotal", 2, 2, true)}%`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          <div className="Tooltip-row">
                            <span className="label">
                              {nativeTokenSymbol} ({wrappedTokenSymbol}) APR
                            </span>
                            <span>{formatKeyAmount(processedData, "xpcAprForNativeToken", 2, 2, true)}%</span>
                          </div>
                          <div className="Tooltip-row">
                            <span className="label">Escrowed OPEC APR</span>
                            <span>{formatKeyAmount(processedData, "xpcAprForEsOpec", 2, 2, true)}%</span>
                          </div>
                        </>
                      );
                    }}
                  />
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Rewards</div>
                <div>
                  <Tooltip
                    handle={`$${formatKeyAmount(processedData, "totalXpcRewardsUsd", USD_DECIMALS, 2, true)}`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          <div className="Tooltip-row">
                            <span className="label">
                              {nativeTokenSymbol} ({wrappedTokenSymbol})
                            </span>
                            <span>
                              {formatKeyAmount(processedData, "feeXpcTrackerRewards", 18, 4)} ($
                              {formatKeyAmount(processedData, "feeXpcTrackerRewardsUsd", USD_DECIMALS, 2, true)})
                            </span>
                          </div>
                          <div className="Tooltip-row">
                            <span className="label">Escrowed OPEC</span>
                            <span>
                              {formatKeyAmount(processedData, "stakedXpcTrackerRewards", 18, 4)} ($
                              {formatKeyAmount(processedData, "stakedXpcTrackerRewardsUsd", USD_DECIMALS, 2, true)})
                            </span>
                          </div>
                        </>
                      );
                    }}
                  />
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-row">
                <div className="label">Total Staked</div>
                <div>
                  {formatKeyAmount(processedData, "xpcSupply", 18, 2, true)} XPC ($
                  {formatKeyAmount(processedData, "xpcSupplyUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Total Supply</div>
                <div>
                  {formatKeyAmount(processedData, "xpcSupply", 18, 2, true)} XPC ($
                  {formatKeyAmount(processedData, "xpcSupplyUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-options">
                <Link className="App-button-option App-card-option" to="/buy_xpc">
                  Buy XPC
                </Link>
                <Link className="App-button-option App-card-option" to="/buy_xpc#redeem">
                  Sell XPC
                </Link>
                {hasInsurance && (
                  <a
                    className="App-button-option App-card-option"
                    href="https://app.insurace.io/Insurance/Cart?id=124&referrer=545066382753150189457177837072918687520318754040"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Purchase Insurance
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="App-card">
            <div className="App-card-title">Escrowed OPEC</div>
            <div className="App-card-divider"></div>
            <div className="App-card-content">
              <div className="App-card-row">
                <div className="label">Price</div>
                <div>${formatAmount(opecPrice, USD_DECIMALS, 2, true)}</div>
              </div>
              <div className="App-card-row">
                <div className="label">Wallet</div>
                <div>
                  {formatKeyAmount(processedData, "esOpecBalance", 18, 2, true)} esOPEC ($
                  {formatKeyAmount(processedData, "esOpecBalanceUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Staked</div>
                <div>
                  {formatKeyAmount(processedData, "esOpecInStakedOpec", 18, 2, true)} esOPEC ($
                  {formatKeyAmount(processedData, "esOpecInStakedOpecUsd", USD_DECIMALS, 2, true)})
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-row">
                <div className="label">APR</div>
                <div>
                  <div>
                    <Tooltip
                      handle={`${formatKeyAmount(processedData, "opecAprTotalWithBoost", 2, 2, true)}%`}
                      position="right-bottom"
                      renderContent={() => {
                        return (
                          <>
                            <div className="Tooltip-row">
                              <span className="label">
                                {nativeTokenSymbol} ({wrappedTokenSymbol}) Base APR
                              </span>
                              <span>{formatKeyAmount(processedData, "opecAprForNativeToken", 2, 2, true)}%</span>
                            </div>
                            {processedData.bnOpecInFeeOpec && processedData.bnOpecInFeeOpec.gt(0) && (
                              <div className="Tooltip-row">
                                <span className="label">
                                  {nativeTokenSymbol} ({wrappedTokenSymbol}) Boosted APR
                                </span>
                                <span>{formatKeyAmount(processedData, "opecBoostAprForNativeToken", 2, 2, true)}%</span>
                              </div>
                            )}
                            <div className="Tooltip-row">
                              <span className="label">Escrowed OPEC APR</span>
                              <span>{formatKeyAmount(processedData, "opecAprForEsOpec", 2, 2, true)}%</span>
                            </div>
                          </>
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">{renderMultiplierPointsLabel()}</div>
                <div>{renderMultiplierPointsValue()}</div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-row">
                <div className="label">Total Staked</div>
                <div>
                  {formatKeyAmount(processedData, "stakedEsOpecSupply", 18, 0, true)} esOPEC ($
                  {formatKeyAmount(processedData, "stakedEsOpecSupplyUsd", USD_DECIMALS, 0, true)})
                </div>
              </div>
              <div className="App-card-row">
                <div className="label">Total Supply</div>
                <div>
                  {formatAmount(esOpecSupply, 18, 0, true)} esOPEC (${formatAmount(esOpecSupplyUsd, USD_DECIMALS, 0, true)}
                  )
                </div>
              </div>
              <div className="App-card-divider"></div>
              <div className="App-card-options">
                {active && (
                  <button className="App-button-option App-card-option" onClick={() => showStakeEsOpecModal()}>
                    Stake
                  </button>
                )}
                {active && (
                  <button className="App-button-option App-card-option" onClick={() => showUnstakeEsOpecModal()}>
                    Unstake
                  </button>
                )}
                {!active && (
                  <button className="App-button-option App-card-option" onClick={() => connectWallet()}>
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="Tab-title-section">
          <div className="Page-title">Vest</div>
          <div className="Page-description">
            Convert esOPEC tokens to OPEC tokens.
            <br />
            Please read the{" "}
            <a href="https://gmxio.gitbook.io/gmx/rewards#vesting" target="_blank" rel="noopener noreferrer">
              vesting details
            </a>{" "}
            before using the vaults.
          </div>
        </div>
        <div>
          <div className="StakeV2-cards">
            <div className="App-card StakeV2-opec-card">
              <div className="App-card-title">OPEC Vault</div>
              <div className="App-card-divider"></div>
              <div className="App-card-content">
                <div className="App-card-row">
                  <div className="label">Staked Tokens</div>
                  <div>
                    <Tooltip
                      handle={formatAmount(totalRewardTokens, 18, 2, true)}
                      position="right-bottom"
                      renderContent={() => {
                        return (
                          <>
                            {formatAmount(processedData.opecInStakedOpec, 18, 2, true)} OPEC
                            <br />
                            {formatAmount(processedData.esOpecInStakedOpec, 18, 2, true)} esOPEC
                            <br />
                            {formatAmount(processedData.bnOpecInFeeOpec, 18, 2, true)} Multiplier Points
                          </>
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">Reserved for Vesting</div>
                  <div>
                    {formatKeyAmount(vestingData, "opecVesterPairAmount", 18, 2, true)} /{" "}
                    {formatAmount(totalRewardTokens, 18, 2, true)}
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">Vesting Status</div>
                  <div>
                    <Tooltip
                      handle={`${formatKeyAmount(vestingData, "opecVesterClaimSum", 18, 4, true)} / ${formatKeyAmount(
                        vestingData,
                        "opecVesterVestedAmount",
                        18,
                        4,
                        true
                      )}`}
                      position="right-bottom"
                      renderContent={() => {
                        return (
                          <>
                            {formatKeyAmount(vestingData, "opecVesterClaimSum", 18, 4, true)} tokens have been converted
                            to OPEC from the&nbsp;
                            {formatKeyAmount(vestingData, "opecVesterVestedAmount", 18, 4, true)} esOPEC deposited for
                            vesting.
                          </>
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">Claimable</div>
                  <div>
                    <Tooltip
                      handle={`${formatKeyAmount(vestingData, "opecVesterClaimable", 18, 4, true)} OPEC`}
                      position="right-bottom"
                      renderContent={() =>
                        `${formatKeyAmount(
                          vestingData,
                          "opecVesterClaimable",
                          18,
                          4,
                          true
                        )} OPEC tokens can be claimed, use the options under the Total Rewards section to claim them.`
                      }
                    />
                  </div>
                </div>
                <div className="App-card-divider"></div>
                <div className="App-card-options">
                  {!active && (
                    <button className="App-button-option App-card-option" onClick={() => connectWallet()}>
                      Connect Wallet
                    </button>
                  )}
                  {active && (
                    <button className="App-button-option App-card-option" onClick={() => showOpecVesterDepositModal()}>
                      Deposit
                    </button>
                  )}
                  {active && (
                    <button className="App-button-option App-card-option" onClick={() => showOpecVesterWithdrawModal()}>
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="App-card StakeV2-opec-card">
              <div className="App-card-title">XPC Vault</div>
              <div className="App-card-divider"></div>
              <div className="App-card-content">
                <div className="App-card-row">
                  <div className="label">Staked Tokens</div>
                  <div>{formatAmount(processedData.xpcBalance, 18, 2, true)} XPC</div>
                </div>
                <div className="App-card-row">
                  <div className="label">Reserved for Vesting</div>
                  <div>
                    {formatKeyAmount(vestingData, "xpcVesterPairAmount", 18, 2, true)} /{" "}
                    {formatAmount(processedData.xpcBalance, 18, 2, true)}
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">Vesting Status</div>
                  <div>
                    <Tooltip
                      handle={`${formatKeyAmount(vestingData, "xpcVesterClaimSum", 18, 4, true)} / ${formatKeyAmount(
                        vestingData,
                        "xpcVesterVestedAmount",
                        18,
                        4,
                        true
                      )}`}
                      position="right-bottom"
                      renderContent={() => {
                        return (
                          <>
                            {formatKeyAmount(vestingData, "xpcVesterClaimSum", 18, 4, true)} tokens have been converted
                            to OPEC from the&nbsp;
                            {formatKeyAmount(vestingData, "xpcVesterVestedAmount", 18, 4, true)} esOPEC deposited for
                            vesting.
                          </>
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="App-card-row">
                  <div className="label">Claimable</div>
                  <div>
                    <Tooltip
                      handle={`${formatKeyAmount(vestingData, "xpcVesterClaimable", 18, 4, true)} OPEC`}
                      position="right-bottom"
                      renderContent={() =>
                        `${formatKeyAmount(
                          vestingData,
                          "xpcVesterClaimable",
                          18,
                          4,
                          true
                        )} OPEC tokens can be claimed, use the options under the Total Rewards section to claim them.`
                      }
                    ></Tooltip>
                  </div>
                </div>
                <div className="App-card-divider"></div>
                <div className="App-card-options">
                  {!active && (
                    <button className="App-button-option App-card-option" onClick={() => connectWallet()}>
                      Connect Wallet
                    </button>
                  )}
                  {active && (
                    <button className="App-button-option App-card-option" onClick={() => showXpcVesterDepositModal()}>
                      Deposit
                    </button>
                  )}
                  {active && (
                    <button className="App-button-option App-card-option" onClick={() => showXpcVesterWithdrawModal()}>
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
