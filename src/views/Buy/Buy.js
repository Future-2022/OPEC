import React, { useEffect } from "react";
import Footer from "../../Footer";
import "./Buy.css";
import TokenCard from "../../components/TokenCard/TokenCard";
import BuyOPECIcon from "../../img/buy_gmx.svg";
import SEO from "../../components/Common/SEO";
import { getPageTitle } from "../../Helpers";

export default function BuyOPECXPC(props) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <SEO title={getPageTitle("Buy XPC or OPEC")}>
      <div className="BuyOPECXPC page-layout">
        <div className="BuyOPECXPC-container default-container">
          <div className="section-title-block">
            <div className="section-title-icon">
              <img src={BuyOPECIcon} alt="BuyOPECIcon" />
            </div>
            <div className="section-title-content">
              <div className="Page-title">Buy OPEC or XPC</div>
            </div>
          </div>
          <TokenCard />
        </div>
        <Footer />
      </div>
    </SEO>
  );
}
