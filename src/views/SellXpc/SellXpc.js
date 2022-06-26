import { useEffect } from "react";

export default function SellXpc(props) {
  useEffect(() => {
    window.location.href = "/buy_xpc#redeem";
  }, []);
  return <div className="Page page-layout"></div>;
}
