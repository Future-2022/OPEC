import React, { useCallback } from "react";
import { Link } from "react-router-dom";

import logoImg from "../../img/logo.svg";

import { ARBITRUM, AVALANCHE, switchNetwork, useChainId } from "../../Helpers";

import { useWeb3React } from "@web3-react/core";

import APRLabel from "../APRLabel/APRLabel";

export default function TokenCard() {
  const { chainId } = useChainId();
  const { active } = useWeb3React();

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
    <div className="Home-token-card-options">
      <div className="Home-token-card-option">
        <div className="Home-token-card-option-icon">
          <img src={logoImg} alt="gmxBigIcon" width='30px'/> OPEC
        </div>
        <div className="Home-token-card-option-info">
          <div className="Home-token-card-option-title">
            OPEC is the utility and governance token. Accrues 30% of the platform's generated fees.
          </div>
          <div className="Home-token-card-option-apr">
            Avalanche APR:{" "}
            <APRLabel chainId={AVALANCHE} label="gmxAprTotal" key="AVALANCHE" />
          </div>
          <div className="Home-token-card-option-action">
            <div className="buy">
              <Link to="/buy_gmx" className="default-btn" onClick={() => changeNetwork(AVALANCHE)}>
                Buy on Avalanche
              </Link>
            </div>
            <a
              href="https://opulence.gitbook.io/opec/tokenomics"
              target="_blank"
              rel="noreferrer"
              className="default-btn read-more"
            >
              Read more
            </a>
          </div>
        </div>
      </div>
      <div className="Home-token-card-option">
        <div className="Home-token-card-option-icon">
          <img src={logoImg} alt="pOPECBigIcon" width='30px'/> pOPEC
        </div>
        <div className="Home-token-card-option-info">
          <div className="Home-token-card-option-title">
            pOPEC is the liquidity provider token. Accrues 70% of the platform's generated fees.
          </div>
          <div className="Home-token-card-option-apr">
            Avalanche APR:{" "}
            <APRLabel chainId={AVALANCHE} label="glpAprTotal" key="AVALANCHE" />
          </div>
          <div className="Home-token-card-option-action">
            <div className="buy">
              <Link to="/buy_glp" className="default-btn" onClick={() => changeNetwork(AVALANCHE)}>
                Buy on Avalanche
              </Link>
            </div>
            <a
              href="https://opulence.gitbook.io/opec/popec"
              target="_blank"
              rel="noreferrer"
              className="default-btn read-more"
            >
              Read more
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
