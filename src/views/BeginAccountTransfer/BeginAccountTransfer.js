import React, { useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { ethers } from "ethers";
import { useWeb3React } from "@web3-react/core";

import { getContract } from "../../Addresses";
import { callContract } from "../../Api";

import Modal from "../../components/Modal/Modal";
import Footer from "../../Footer";

import Token from "../../abis/Token.json";
import Vester from "../../abis/Vester.json";
import RewardTracker from "../../abis/RewardTracker.json";
import RewardRouter from "../../abis/RewardRouter.json";

import { FaCheck, FaTimes } from "react-icons/fa";

import { fetcher, approveTokens, useChainId } from "../../Helpers";

import "./BeginAccountTransfer.css";

function ValidationRow({ isValid, children }) {
  return (
    <div className="ValidationRow">
      <div className="ValidationRow-icon-container">
        {isValid && <FaCheck className="ValidationRow-icon" />}
        {!isValid && <FaTimes className="ValidationRow-icon" />}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function BeginAccountTransfer(props) {
  const { setPendingTxns } = props;
  const { active, library, account } = useWeb3React();
  const { chainId } = useChainId();

  const [receiver, setReceiver] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isTransferSubmittedModalVisible, setIsTransferSubmittedModalVisible] = useState(false);
  let parsedReceiver = ethers.constants.AddressZero;
  if (ethers.utils.isAddress(receiver)) {
    parsedReceiver = receiver;
  }

  const opecAddress = getContract(chainId, "OPEC");
  const opecVesterAddress = getContract(chainId, "OpecVester");
  const xpcVesterAddress = getContract(chainId, "XpcVester");

  const rewardRouterAddress = getContract(chainId, "RewardRouter");

  const { data: opecVesterBalance } = useSWR([active, chainId, opecVesterAddress, "balanceOf", account], {
    fetcher: fetcher(library, Token),
  });

  const { data: xpcVesterBalance } = useSWR([active, chainId, xpcVesterAddress, "balanceOf", account], {
    fetcher: fetcher(library, Token),
  });

  const stakedOpecTrackerAddress = getContract(chainId, "StakedOpecTracker");
  const { data: cumulativeOpecRewards } = useSWR(
    [active, chainId, stakedOpecTrackerAddress, "cumulativeRewards", parsedReceiver],
    {
      fetcher: fetcher(library, RewardTracker),
    }
  );

  const stakedXpcTrackerAddress = getContract(chainId, "StakedXpcTracker");
  const { data: cumulativeXpcRewards } = useSWR(
    [active, chainId, stakedXpcTrackerAddress, "cumulativeRewards", parsedReceiver],
    {
      fetcher: fetcher(library, RewardTracker),
    }
  );

  const { data: transferredCumulativeOpecRewards } = useSWR(
    [active, chainId, opecVesterAddress, "transferredCumulativeRewards", parsedReceiver],
    {
      fetcher: fetcher(library, Vester),
    }
  );

  const { data: transferredCumulativeXpcRewards } = useSWR(
    [active, chainId, xpcVesterAddress, "transferredCumulativeRewards", parsedReceiver],
    {
      fetcher: fetcher(library, Vester),
    }
  );

  const { data: pendingReceiver } = useSWR([active, chainId, rewardRouterAddress, "pendingReceivers", account], {
    fetcher: fetcher(library, RewardRouter),
  });

  const { data: opecAllowance } = useSWR([active, chainId, opecAddress, "allowance", account, stakedOpecTrackerAddress], {
    fetcher: fetcher(library, Token),
  });

  const { data: opecStaked } = useSWR(
    [active, chainId, stakedOpecTrackerAddress, "depositBalances", account, opecAddress],
    {
      fetcher: fetcher(library, RewardTracker),
    }
  );

  const needApproval = opecAllowance && opecStaked && opecStaked.gt(opecAllowance);

  const hasVestedOpec = opecVesterBalance && opecVesterBalance.gt(0);
  const hasVestedXpc = xpcVesterBalance && xpcVesterBalance.gt(0);
  const hasStakedOpec =
    (cumulativeOpecRewards && cumulativeOpecRewards.gt(0)) ||
    (transferredCumulativeOpecRewards && transferredCumulativeOpecRewards.gt(0));
  const hasStakedXpc =
    (cumulativeXpcRewards && cumulativeXpcRewards.gt(0)) ||
    (transferredCumulativeXpcRewards && transferredCumulativeXpcRewards.gt(0));
  const hasPendingReceiver = pendingReceiver && pendingReceiver !== ethers.constants.AddressZero;

  const getError = () => {
    if (!account) {
      return "Wallet is not connected";
    }
    if (hasVestedOpec) {
      return "Vested OPEC not withdrawn";
    }
    if (hasVestedXpc) {
      return "Vested XPC not withdrawn";
    }
    if (!receiver || receiver.length === 0) {
      return "Enter Receiver Address";
    }
    if (!ethers.utils.isAddress(receiver)) {
      return "Invalid Receiver Address";
    }
    if (hasStakedOpec || hasStakedXpc) {
      return "Invalid Receiver";
    }
    if ((parsedReceiver || "").toString().toLowerCase() === (account || "").toString().toLowerCase()) {
      return "Self-transfer not supported";
    }

    if (
      (parsedReceiver || "").length > 0 &&
      (parsedReceiver || "").toString().toLowerCase() === (pendingReceiver || "").toString().toLowerCase()
    ) {
      return "Transfer already initiated";
    }
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isTransferring) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (needApproval) {
      return "Approve OPEC";
    }
    if (isApproving) {
      return "Approving...";
    }
    if (isTransferring) {
      return "Transferring";
    }

    return "Begin Transfer";
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

    setIsTransferring(true);
    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());

    callContract(chainId, contract, "signalTransfer", [parsedReceiver], {
      sentMsg: "Transfer submitted!",
      failMsg: "Transfer failed.",
      setPendingTxns,
    })
      .then(async (res) => {
        setIsTransferSubmittedModalVisible(true);
      })
      .finally(() => {
        setIsTransferring(false);
      });
  };

  const completeTransferLink = `/complete_account_transfer/${account}/${parsedReceiver}`;
  const pendingTransferLink = `/complete_account_transfer/${account}/${pendingReceiver}`;

  return (
    <div className="BeginAccountTransfer Page page-layout">
      <Modal
        isVisible={isTransferSubmittedModalVisible}
        setIsVisible={setIsTransferSubmittedModalVisible}
        label="Transfer Submitted"
      >
        Your transfer has been initiated.
        <br />
        <br />
        <Link className="App-cta" to={completeTransferLink}>
          Continue
        </Link>
      </Modal>
      <div className="Page-title-section">
        <div className="Page-title">Transfer Account</div>
        <div className="Page-description">
          Please only use this for full account transfers.
          <br />
          This will transfer all your OPEC, esGMX, XPC and Multiplier Points to your new account.
          <br />
          Transfers are only supported if the receiving account has not staked OPEC or XPC tokens before.
          <br />
          Transfers are one-way, you will not be able to transfer staked tokens back to the sending account.
        </div>
        {hasPendingReceiver && (
          <div className="Page-description">
            You have a <Link to={pendingTransferLink}>pending transfer</Link> to {pendingReceiver}.
          </div>
        )}
      </div>
      <div className="Page-content">
        <div className="input-form">
          <div className="input-row">
            <label className="input-label">Receiver Address</label>
            <div>
              <input
                type="text"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                className="text-input"
              />
            </div>
          </div>
          <div className="BeginAccountTransfer-validations">
            <ValidationRow isValid={!hasVestedOpec}>
              Sender has withdrawn all tokens from OPEC Vesting Vault
            </ValidationRow>
            <ValidationRow isValid={!hasVestedXpc}>
              Sender has withdrawn all tokens from XPC Vesting Vault
            </ValidationRow>
            <ValidationRow isValid={!hasStakedOpec}>Receiver has not staked OPEC tokens before</ValidationRow>
            <ValidationRow isValid={!hasStakedXpc}>Receiver has not staked XPC tokens before</ValidationRow>
          </div>
          <div className="input-row">
            <button
              className="App-cta Exchange-swap-button"
              disabled={!isPrimaryEnabled()}
              onClick={() => onClickPrimary()}
            >
              {getPrimaryText()}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
