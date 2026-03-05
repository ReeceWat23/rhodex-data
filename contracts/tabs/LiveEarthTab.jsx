import LiveGlobe from "../Globe.jsx";
import { C } from "../constants.js";

export default function LiveEarthTab({ card = () => ({}) }) {
  const cardStyle = typeof card === "function" ? card() : card;
  return (
    <div style={{ ...cardStyle, minHeight: 420 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>
        LIVE EARTH
      </div>
      <div style={{ width: "100%", height: 400, borderRadius: 6, overflow: "hidden" }}>
        <LiveGlobe />
      </div>
    </div>
  );
}
