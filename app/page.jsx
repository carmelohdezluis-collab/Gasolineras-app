"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Navigation, Star, Map, List, Calculator, X, Fuel } from "lucide-react";

let L = null;

export default function Home() {
  const [search, setSearch] = useState("");
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [fuelType, setFuelType] = useState("Precio Gasolina 95 E5");
  const [favorites, setFavorites] = useState([]);
  const [view, setView] = useState("list");
  const [calcLiters, setCalcLiters] = useState(50);
  const [calcFreq, setCalcFreq] = useState(2);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const saved = localStorage.getItem("fav_stations");
    if (saved) setFavorites(JSON.parse(saved));

    fetch("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
      .then((res) => res.json())
      .then((data) => {
        setStations(data.ListaEESSPrecio || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => { L = window.L; };
    document.head.appendChild(script);
  }, []);

  const getDistance = (s) => {
    if (!userLocation) return null;
    const lat = parseFloat(s.Latitud?.replace(",", "."));
    const lng = parseFloat(s["Longitud (WGS84)"]?.replace(",", "."));
    if (isNaN(lat) || isNaN(lng)) return null;
    const R = 6371;
    const dLat = ((lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((lng - userLocation.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const filteredStations = useMemo(() => {
    let list = [...stations];
    if (search) {
      list = list.filter(
        (s) =>
          s.Municipio?.toLowerCase().includes(search.toLowerCase()) ||
          s["Rótulo"]?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (userLocation) {
      list = list.sort((a, b) => (getDistance(a) || 999) - (getDistance(b) || 999));
    }
    return list.slice(0, 80);
  }, [search, stations, userLocation, fuelType]);

  useEffect(() => {
    if (view !== "map") return;
    if (!L) {
      const interval = setInterval(() => {
        if (window.L) {
          L = window.L;
          clearInterval(interval);
          initMap();
        }
      }, 200);
      return;
    }
    initMap();
  }, [view, filteredStations]);

  function initMap() {
    if (!mapRef.current || !L) return;
    const center = userLocation ? [userLocation.lat, userLocation.lng] : [40.416775, -3.70379];
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(center, userLocation ? 12 : 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.setView(center, userLocation ? 12 : 6);
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const prices = filteredStations.map((s) => parseFloat(s[fuelType]?.replace(",", ".")) || null).filter(Boolean);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    filteredStations.slice(0, 100).forEach((s) => {
      const lat = parseFloat(s.Latitud?.replace(",", "."));
      const lng = parseFloat(s["Longitud (WGS84)"]?.replace(",", "."));
      if (!lat || !lng) return;
      const price = parseFloat(s[fuelType]?.replace(",", ".")) || null;
      const ratio = price ? (price - minP) / (maxP - minP || 1) : 0.5;
      const r = Math.round(ratio * 200);
      const g = Math.round((1 - ratio) * 180);
      const color = `rgb(${r},${g},40)`;
      const icon = L.divIcon({
        html: `<div style="background:${color};color:white;font-size:10px;font-weight:bold;padding:3px 6px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${price ? price.toFixed(3) + "€" : "?"}</div>`,
        className: "",
        iconAnchor: [20, 10],
      });
      const marker = L.marker([lat, lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${s["Rótulo"]}</b><br>${s.Municipio}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank">🗺 Ir ahora</a>`);
      markersRef.current.push(marker);
    });
  }

  const toggleFav = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      localStorage.setItem("fav_stations", JSON.stringify(next));
      return next;
    });
  };

  const favStations = useMemo(() => stations.filter((s) => favorites.includes(s.IDEESS)), [stations, favorites]);

  const prices = filteredStations.map((s) => parseFloat(s[fuelType]?.replace(",", ".")) || null).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const savingsVsMax = maxPrice && minPrice ? ((maxPrice - minPrice) * calcLiters * calcFreq * 12).toFixed(2) : null;
  const savingsVsAvg = avgPrice && minPrice ? ((avgPrice - minPrice) * calcLiters * calcFreq * 12).toFixed(2) : null;
  const cheapestStation = filteredStations.find((s) => parseFloat(s[fuelType]?.replace(",", ".")) === minPrice);

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => alert("Activa la ubicación en los ajustes del navegador.")
      );
    }
  };

  const fuelLabel = {
    "Precio Gasolina 95 E5": "Gasolina 95 E5",
    "Precio Gasoleo A": "Gasóleo A",
    "Precio Gasolina 98 E5": "Gasolina 98 E5",
    "Precio Gasoleo Premium": "Gasóleo Premium",
  }[fuelType] || fuelType;

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#f0f4f8", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)", padding: "20px 16px 16px", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          <Fuel size={22} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>AHORRA GASOLINA</h1>
        </div>
        {avgPrice && (
          <p style={{ margin: 0, textAlign: "center", fontSize: 12, opacity: 0.85 }}>
            Media zona: <b>{avgPrice.toFixed(3)}€</b> · Mín: <b style={{ color: "#86efac" }}>{minPrice?.toFixed(3)}€</b> · Máx: <b style={{ color: "#fca5a5" }}>{maxPrice?.toFixed(3)}€</b>
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: "12px 16px", background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
        {!userLocation ? (
          <button onClick={updateLocation} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", background: "#0ea5e9", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Navigation size={16} /> ACTIVAR UBICACIÓN
          </button>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: "#0ea5e9", textAlign: "center" }}>📍 Ordenado por distancia</p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Buscar municipio o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none" }}
          />
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            style={{ padding: "10px 8px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, background: "white", cursor: "pointer" }}
          >
            <option value="Precio Gasolina 95 E5">95 E5</option>
            <option value="Precio Gasolina 95 E10">95 E10</option>
            <option value="Precio Gasolina 95 E5 Premium">95 Premium</option>
            <option value="Precio Gasolina 98 E5">98 E5</option>
            <option value="Precio Gasolina 98 E10">98 E10</option>
            <option value="Precio Gasoleo A">Gasóleo A</option>
            <option value="Precio Gasoleo B">Gasóleo B</option>
            <option value="Precio Gasoleo Premium">Gasóleo Premium</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "white", borderBottom: "2px solid #e2e8f0" }}>
        {[
          { id: "list", icon: <List size={15} />, label: "Lista" },
          { id: "favs", icon: <Star size={15} />, label: `Favoritos${favorites.length ? ` (${favorites.length})` : ""}` },
          { id: "map", icon: <Map size={15} />, label: "Mapa" },
          { id: "calc", icon: <Calculator size={15} />, label: "Ahorro" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              flex: 1, padding: "10px 4px", border: "none", background: "transparent",
              borderBottom: view === tab.id ? "2px solid #0ea5e9" : "2px solid transparent",
              color: view === tab.id ? "#0ea5e9" : "#94a3b8",
              fontWeight: view === tab.id ? 700 : 500,
              fontSize: 12, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              marginBottom: -2,
            }}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "12px 16px" }}>

        {/* LIST */}
        {view === "list" && (
          loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⛽</div>
              Cargando estaciones...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredStations.map((s, i) => {
                const lat = s.Latitud?.replace(",", ".");
                const lng = s["Longitud (WGS84)"]?.replace(",", ".");
                const price = parseFloat(s[fuelType]?.replace(",", ".")) || null;
                const isFav = favorites.includes(s.IDEESS);
                const dist = getDistance(s);
                const isCheapest = price && price === minPrice;
                return (
                  <div key={i} style={{ background: "white", borderRadius: 14, padding: "12px 14px", boxShadow: isCheapest ? "0 0 0 2px #22c55e" : "0 1px 4px rgba(0,0,0,0.07)", position: "relative" }}>
                    {isCheapest && (
                      <span style={{ position: "absolute", top: -8, left: 12, background: "#22c55e", color: "white", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>
                        MÁS BARATA 🏆
                      </span>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s["Rótulo"]}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{s.Municipio}{dist ? ` · ${dist.toFixed(1)} km` : ""}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ margin: 0, fontWeight: 900, fontSize: 20, color: isCheapest ? "#22c55e" : price === maxPrice ? "#ef4444" : "#0ea5e9" }}>
                            {price ? `${price.toFixed(3)}€` : "N/A"}
                          </p>
                          {price && avgPrice && (
                            <p style={{ margin: 0, fontSize: 10, color: price < avgPrice ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {price < avgPrice ? `${((avgPrice - price) * 1000).toFixed(0)}‰ bajo media` : `${((price - avgPrice) * 1000).toFixed(0)}‰ sobre media`}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button onClick={() => toggleFav(s.IDEESS)} style={{ background: isFav ? "#fef3c7" : "#f8fafc", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                            <Star size={16} fill={isFav ? "#f59e0b" : "none"} color={isFav ? "#f59e0b" : "#94a3b8"} />
                          </button>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" style={{ background: "#0ea5e9", borderRadius: 8, padding: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Navigation size={14} color="white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* FAVS */}
        {view === "favs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {favStations.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <Star size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p>Aún no tienes favoritos.</p>
                <p style={{ fontSize: 12 }}>Pulsa ⭐ en cualquier estación.</p>
              </div>
            ) : (
              favStations.map((s, i) => {
                const lat = s.Latitud?.replace(",", ".");
                const lng = s["Longitud (WGS84)"]?.replace(",", ".");
                const price = parseFloat(s[fuelType]?.replace(",", ".")) || null;
                const dist = getDistance(s);
                return (
                  <div key={i} style={{ background: "white", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{s["Rótulo"]}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{s.Municipio}{dist ? ` · ${dist.toFixed(1)} km` : ""}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <p style={{ margin: 0, fontWeight: 900, fontSize: 20, color: "#0ea5e9" }}>{price ? `${price.toFixed(3)}€` : "N/A"}</p>
                        <button onClick={() => toggleFav(s.IDEESS)} style={{ background: "#fef3c7", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                          <Star size={16} fill="#f59e0b" color="#f59e0b" />
                        </button>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" style={{ background: "#0ea5e9", borderRadius: 8, padding: 6, display: "flex" }}>
                          <Navigation size={14} color="white" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MAP */}
        {view === "map" && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", textAlign: "center" }}>
              Verde = barato · Rojo = caro · Toca un pin para más info
            </p>
            <div ref={mapRef} style={{ width: "100%", height: 480, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }} />
          </div>
        )}

        {/* CALC */}
        {view === "calc" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#1e293b" }}>🧮 Calculadora de Ahorro Anual</h3>
              <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Litros por llenado</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 14px" }}>
                <input type="range" min={10} max={100} value={calcLiters} onChange={(e) => setCalcLiters(Number(e.target.value))} style={{ flex: 1, accentColor: "#0ea5e9" }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: "#0ea5e9", minWidth: 48, textAlign: "right" }}>{calcLiters}L</span>
              </div>
              <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Llenados al mes</label>
              <div style={{ display: "flex", gap: 8, margin: "6px 0 14px" }}>
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} onClick={() => setCalcFreq(n)}
                    style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 10, background: calcFreq === n ? "#0ea5e9" : "#f1f5f9", color: calcFreq === n ? "white" : "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    {n}x
                  </button>
                ))}
              </div>
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#16a34a", fontWeight: 600 }}>COMBUSTIBLE: {fuelLabel}</p>
                {minPrice && maxPrice ? (
                  <>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#374151" }}>
                      Más barata: <b style={{ color: "#16a34a" }}>{minPrice.toFixed(3)}€/L</b> {cheapestStation ? `(${cheapestStation["Rótulo"]})` : ""}
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1, background: "white", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #bbf7d0" }}>
                        <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>vs más cara</p>
                        <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#16a34a" }}>{savingsVsMax}€</p>
                        <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>al año</p>
                      </div>
                      <div style={{ flex: 1, background: "white", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #bbf7d0" }}>
                        <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>vs precio medio</p>
                        <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0ea5e9" }}>{savingsVsAvg}€</p>
                        <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>al año</p>
                      </div>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 11, color: "#6b7280", textAlign: "center" }}>
                      Basado en {filteredStations.length} estaciones · {calcLiters}L × {calcFreq}x/mes
                    </p>
                  </>
                ) : (
                  <p style={{ color: "#6b7280", fontSize: 13 }}>Cargando datos de precios...</p>
                )}
              </div>
            </div>

            {avgPrice && (
              <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#1e293b" }}>Ahorro por estación vs precio medio</h3>
                {filteredStations.slice(0, 10).map((s, i) => {
                  const price = parseFloat(s[fuelType]?.replace(",", ".")) || null;
                  if (!price) return null;
                  const annualSaving = ((avgPrice - price) * calcLiters * calcFreq * 12).toFixed(0);
                  const saving = Number(annualSaving);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{s["Rótulo"]}</p>
                        <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{s.Municipio}</p>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 14, color: saving > 0 ? "#16a34a" : "#ef4444" }}>
                        {saving > 0 ? `+${annualSaving}€` : `${annualSaving}€`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
