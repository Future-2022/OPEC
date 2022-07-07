import React from "react";
import SEO from "../../components/Common/SEO";

import Footer from "../../Footer";
import { getPageTitle, ARBITRUM, AVALANCHE } from "../../Helpers";

import arbitrumIcon from "../../img/ic_arbitrum_16.svg";
import avalancheIcon from "../../img/ic_avalanche_16.svg";

import "./Ecosystem.css";

const NETWORK_ICONS = {
  [ARBITRUM]: arbitrumIcon,
  [AVALANCHE]: avalancheIcon,
};

const NETWORK_ICON_ALTS = {
  [ARBITRUM]: "Arbitrum Icon",
  [AVALANCHE]: "Avalanche Icon",
};

export default function Ecosystem() {
  const officialPages = [
    {
      title: "OPEC Governance",
      link: "https://gov.opec.io/",
      about: "OPEC Governance Page",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Stats",
      link: "https://stats.opec.io/",
      about: "OPEC Stats Page",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Proposals",
      link: "https://snapshot.org/#/opec.eth",
      about: "OPEC Proposals Voting page",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Announcements",
      link: "https://t.me/OPEC_Announcements",
      about: "OPEC Announcements and Updates",
      chainIds: [ARBITRUM, AVALANCHE],
    },
  ];

  const communityProjects = [
    {
      title: "OPEC Blueberry Club",
      link: "https://www.blueberry.club/",
      about: "OPEC Blueberry NFTs",
      creatorLabel: "@xm92boi",
      creatorLink: "https://t.me/xm92boi",
      chainIds: [ARBITRUM],
    },
    {
      title: "OPEC Leaderboard",
      link: "https://www.opec.house/",
      about: "Leaderboard for OPEC traders",
      creatorLabel: "@Itburnz",
      creatorLink: "https://t.me/Itburnz",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Positions Bot",
      link: "https://t.me/OPECPositions",
      about: "Telegram bot for OPEC position updates",
      creatorLabel: "@zhongfu",
      creatorLink: "https://t.me/zhongfu",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Terminal",
      link: "https://opecterminal.com",
      about: "OPEC explorer for stats and traders",
      creatorLabel: "@vipineth",
      creatorLink: "https://t.me/vipineth",
      chainIds: [ARBITRUM],
    },
    {
      title: "OPEC Analytics",
      link: "https://www.opecstats.com/",
      about: "Financial reports and protocol analytics",
      creatorLabel: "@CryptoMessiah",
      creatorLink: "https://t.me/LarpCapital",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Blueberry Pulse",
      link: "https://blueberrypulse.substack.com/",
      about: "OPEC Weekly Updates",
      creatorLabel: "@puroscohiba",
      creatorLink: "https://t.me/puroscohiba",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "DegenClip",
      link: "https://degenclip.com/opec",
      about: "Community curated tweet collection",
      creatorLabel: "@ox21l",
      creatorLink: "https://t.me/ox21l",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Yield Simulator",
      link: "https://opec.defisims.com/",
      about: "Yield simulator for OPEC",
      creatorLabel: "@s0berknight",
      creatorLink: "https://twitter.com/s0berknight",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Returns Calculator",
      link: "https://docs.google.com/spreadsheets/u/4/d/1mQZlztz_NpTg5qQiYIzc_Ls1OTLfMOUtmEQN-WW8jj4/copy",
      linkLabel: "Google Spreadsheet",
      about: "Returns calculator for OPEC and XPC",
      creatorLabel: "@AStoicTrader1",
      creatorLink: "https://twitter.com/AStoicTrader1",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "OPEC Compound Calculator",
      link: "https://docs.google.com/spreadsheets/d/14DiIE1wZkK9-Y5xSx1PzIgmpcj4ccz1YVw5nwzIWLgI/edit#gid=0",
      linkLabel: "Google Spreadsheet",
      about: "Optimal compound interval calculator",
      creatorLabel: "@ChasenKaminsky",
      creatorLink: "https://twitter.com/ChasenKaminsky",
      chainIds: [AVALANCHE],
    },
  ];

  const integrations = [
    {
      title: "DeBank",
      link: "https://debank.com/",
      about: "DeFi Portfolio Tracker",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1439711532884152324",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Defi Llama",
      link: "https://defillama.com",
      about: "Decentralized Finance Dashboard",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1438124768033660938",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Dopex",
      link: "https://dopex.io",
      about: "Decentralized Options Protocol",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1482445801523716099",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Rook",
      link: "https://www.rook.fi/",
      about: "MEV Optimizer",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/Rook/status/1509613786600116251",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Jones DAO",
      link: "https://jonesdao.io",
      about: "Decentralized Options Strategies",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1482788805635678212",
      chainIds: [ARBITRUM],
    },
    {
      title: "Yield Yak",
      link: "https://yieldyak.com/",
      about: "Yield Optimizer on Avalanche",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1484601407378378754",
      chainIds: [AVALANCHE],
    },
    {
      title: "Vovo Finance",
      link: "https://vovo.finance/",
      about: "Structured Products",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/VovoFinance/status/1531517177790345217",
      chainIds: [ARBITRUM],
    },
    {
      title: "Stabilize Protocol",
      link: "https://www.stabilize.finance/",
      about: "Yield Vaults",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/StabilizePro/status/1532348674986082306",
      chainIds: [ARBITRUM],
    },
    {
      title: "DODO",
      link: "https://dodoex.io/",
      about: "Decentralized Trading Protocol",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1438899138549145605",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Open Ocean",
      link: "https://openocean.finance/",
      about: "DEX Aggregator",
      announcementLabel: "https://twitter.com",
      announcementLink: "https://twitter.com/OPEC_IO/status/1495780826016989191",
      chainIds: [ARBITRUM, AVALANCHE],
    },
  ];

  const telegramGroups = [
    {
      title: "OPEC",
      link: "https://t.me/OPEC_IO",
      about: "Telegram Group",
    },
    {
      title: "OPEC (Chinese)",
      link: "https://t.me/opecch",
      about: "Telegram Group (Chinese)",
    },
    {
      title: "OPEC (Portuguese)",
      link: "https://t.me/OPEC_Portuguese",
      about: "Telegram Group (Portuguese)",
    },
    {
      title: "OPEC Trading Chat",
      link: "https://t.me/gambittradingchat",
      about: "OPEC community discussion",
    },
  ];

  return (
    <SEO title={getPageTitle("Ecosystem Projects")}>
      <div className="default-container page-layout">
        <div>
          <div className="section-title-block">
            <div className="section-title-icon"></div>
            <div className="section-title-content">
              <div className="Page-title">Official Pages</div>
              <div className="Page-description">Official OPEC ecosystem pages.</div>
            </div>
          </div>
          <div className="DashboardV2-projects">
            {officialPages.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card">
                  <div className="App-card-title">
                    {item.title}
                    <div className="App-card-title-icon">
                      {item.chainIds.map((network) => (
                        <img src={NETWORK_ICONS[network]} alt={NETWORK_ICON_ALTS[network]} />
                      ))}
                    </div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">Link</div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">About</div>
                      <div>{item.about}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">Community Projects</div>
            <div className="Page-description">Projects developed by the OPEC community.</div>
          </div>
          <div className="DashboardV2-projects">
            {communityProjects.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card">
                  <div className="App-card-title">
                    {item.title}
                    <div className="App-card-title-icon">
                      {item.chainIds.map((network) => (
                        <img src={NETWORK_ICONS[network]} alt={NETWORK_ICON_ALTS[network]} />
                      ))}
                    </div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">Link</div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">About</div>
                      <div>{item.about}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Creator</div>
                      <div>
                        <a href={item.creatorLink} target="_blank" rel="noopener noreferrer">
                          {item.creatorLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">Partnerships and Integrations</div>
            <div className="Page-description">Projects integrated with OPEC.</div>
          </div>
          <div className="DashboardV2-projects">
            {integrations.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card">
                  <div className="App-card-title">
                    {item.title}
                    <div className="App-card-title-icon">
                      {item.chainIds.map((network) => (
                        <img src={NETWORK_ICONS[network]} alt={NETWORK_ICON_ALTS[network]} />
                      ))}
                    </div>
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">Link</div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">About</div>
                      <div>{item.about}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">Announcement</div>
                      <div>
                        <a href={item.announcementLink} target="_blank" rel="noopener noreferrer">
                          {item.announcementLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">Telegram Groups</div>
            <div className="Page-description">Community-led Telegram groups.</div>
          </div>
          <div className="DashboardV2-projects">
            {telegramGroups.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card">
                  <div className="App-card-title">{item.title}</div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">Link</div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">About</div>
                      <div>{item.about}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Footer />
      </div>
    </SEO>
  );
}
