import { useState, useRef, useEffect } from "react";
import Globe from "react-globe.gl";

const C = {
  bg: "#0a0c0d",
  panel: "#111416",
  border: "#1c2128",
  border2: "#30363d",
  sage: "#7ee787",
  rose: "#e2b1b1",
  teal: "#258ea6",
  white: "#f0f6fc",
  muted: "#8b949e",
};

export function LiveGlobe() {
  const [events, setEvents] = useState([]);
  const globeRef = useRef();

  useEffect(() => {
    fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=150")
      .then((res) => res.json())
      .then((data) => {
        const parsedEvents = data.events.flatMap((e) => {
          const geom = e.geometry[0];
          if (!geom || geom.type !== "Point") return [];

          const catId = e.categories[0]?.id || "unknown";

          let color = C.sage;
          if (catId === "wildfires") color = C.rose;
          if (catId === "severeStorms") color = C.teal;
          if (catId === "volcanoes") color = "#c4956a";

          return {
            id: e.id,
            title: e.title,
            category: e.categories[0]?.title,
            lat: geom.coordinates[1],
            lng: geom.coordinates[0],
            color: color,
            size: 0.15,
          };
        });
        setEvents(parsedEvents);
      })
      .catch((err) => console.error("Error fetching live events:", err));
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, []);

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
        height: 550,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.muted,
            letterSpacing: "1px",
          }}
        >
          LIVE GLOBAL EVENTS (NOAA / NASA EONET)
        </div>
        <div
          style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11 }}
        >
          <span>
            <span style={{ color: C.teal }}>●</span> Severe Storms
          </span>
          <span>
            <span style={{ color: C.rose }}>●</span> Wildfires
          </span>
          <span>
            <span style={{ color: "#c4956a" }}>●</span> Volcanoes
          </span>
        </div>
      </div>
      <div style={{ flex: 1, cursor: "grab" }}>
        <Globe
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,0,0,0)"
          pointsData={events}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="size"
          pointRadius={0.4}
          pointsMerge={true}
          pointLabel={(d) => `
            <div style="background: ${C.panel}; border: 1px solid ${C.border2}; padding: 6px 10px; border-radius: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11px;">
              <div style="color: ${d.color}; font-weight: bold; margin-bottom: 2px;">${d.category}</div>
              <div style="color: ${C.white}">${d.title}</div>
            </div>
          `}
        />
      </div>
    </div>
  );
}

export { C };
export default LiveGlobe;
