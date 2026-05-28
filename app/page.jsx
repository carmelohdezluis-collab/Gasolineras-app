"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Navigation, Star, Map, List, Calculator, X, Fuel } from "lucide-react";

// Leaflet loaded via CDN in useEffect
let L = null;

export default function Home() {
  const [search, setSearch] = useState("");
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [fuelType, setFuelType] = useState("Precio Gasolina 95 E5");
  const [favorites, setFavorites] = useState([]);
  const [view, setView] = useState("list"); // list | map | calc
  const [showCalc, setShowCalc] = useState(false);
  const [calcLiters, setCalcLiters] = useState(50);
  const [calcFreq, setCalcFreq] = useState(2);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Load favorites & stations
  useEffect(() => {
    const saved = localStorage.getItem("fav_stations");
    if (saved) setFavorites(JSON.parse(saved));

    fetch("https://mute-union-f2b1.carmelohdezluis.workers.dev/")
      .then((res) => res.json())
      .then((data) => {
        const adaptedData = data.map((g) => ({
          ...g,
          "Rótulo": g.empresa,
          "Municipio": g.municipio,
          "Precio Gasolina 95 E5": g.precio ? g.precio.toString() : "",
          "IDEESS": g.empresa + g.direccion,
        }));
        setStations(adaptedData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando datos:", err);
        setLoading(false);
      });
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  // Load Leaflet via CDN
  useEffect(() => {
    if (view !== "map") return;
    if (typeof window === "undefined") return;

    const loadLeaflet = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!window.L) {
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      L = window.L;
      initMap();
    };

    loadLeaflet();
  }, [view, filteredStations]);

  const initMap = () => {
    if (!mapRef.current || !L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const center = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [40.4168, -3.7038];

    const map = L.map(mapRef.current).setView(center, 12);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup("Tu ubicación");
    }

    markersRef.current = [];
    filteredStations.forEach((s) => {
      const lat = parseFloat((s.latitud || s.Latitud || "").toString().replace(",", "."));
      const lng = parseFloat((s["longitud (wgs84)"] || s.Longitud || s.longitud || "").toString().replace(",", "."));
      if (isNaN(lat) || isNaN(lng)) return;

      const price = parseFloat((s[fuelType] || "").toString().replace(",", "."));
      const isFav = favorites.includes(s["IDEESS"]);

      const marker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;min-width:140px">
            <strong>${s["Rótulo"] || "Gasolinera"}</strong><br/>
            ${s["Municipio"] || ""}<br/>
            <span style="color:#16a34a;font-size:1.1em;font-weight:bold">${!isNaN(price) ? price.toFixed(3) + " €/L" : "Sin precio"}</span>
            ${isFav ? '<br/><span style="color:#f59e0b">★ Favorita</span>' : ""}
          </div>`
        );
      markersRef.current.push(marker);
    });
  };

  // Filtered & sorted stations
  const filteredStations = useMemo(() => {
    let list = stations.filter((s) => {
      const label = (s["Rótulo"] || "").toLowerCase();
      const muni = (s["Municipio"] || "").toLowerCase();
      const q = search.toLowerCase();
      return label.includes(q) || muni.includes(q);
    });

    if (userLocation) {
      list = list.map((s) => {
        const lat = parseFloat((s.latitud || s.Latitud || "").toString().replace(",", "."));
        const lng = parseFloat((s["longitud (wgs84)"] || s.Longitud || s.longitud || "").toString().replace(",", "."));
        if (isNaN(lat) || isNaN(lng)) return { ...s, _dist: Infinity };
        const d = Math.sqrt(
          Math.pow((lat - userLocation.lat) * 111, 2) +
            Math.pow((lng - userLocation.lng) * 111 * Math.cos((userLocation.lat * Math.PI) / 180), 2)
        );
        return { ...s, _dist: d };
      });
      list.sort((a, b) => a._dist - b._dist);
    }

    return list;
  }, [stations, search, userLocation, fuelType]);

  const toggleFavorite = (id) => {
    const updated = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem("fav_stations", JSON.stringify(updated));
  };

  const cheapestPrice = useMemo(() => {
    const prices = filteredStations
      .map((s) => parseFloat((s[fuelType] || "").toString().replace(",", ".")))
      .filter((p) => !isNaN(p) && p > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [filteredStations, fuelType]);

  const avgPrice = useMemo(() => {
    const prices = filteredStations
      .map((s) => parseFloat((s[fuelType] || "").toString().replace(",", ".")))
      .filter((p) => !isNaN(p) && p > 0);
    return prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  }, [filteredStations, fuelType]);

  const calcSaving = () => {
    if (!cheapestPrice || !avgPrice) return null;
    const saving = (avgPrice - cheapestPrice) * calcLiters * calcFreq * 52;
    return saving.toFixed(2);
  };

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto", padding: "0 0 80px 0", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ background: "#1e3a5f", color: "white", padding: "16px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Fuel size={24} color="#38bdf8" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Ahorra Gasolina</h1>
        </div>
        <input
          type="text"
          placeholder="Buscar gasolinera o municipio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            fontSize: 15,
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.15)",
            color: "white",
            outline: "none",
          }}
        />
        {/* Fuel type selector */}
        <select
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value)}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            fontSize: 14,
            background: "rgba(255,255,255,0.15)",
            color: "white",
            boxSizing: "border-box",
          }}
        >
          <option value="Precio Gasolina 95 E5">Gasolina 95 E5</option>
          <option value="Precio Gasoleo A">Gasóleo A</option>
          <option value="Precio Gasolina 98 E5">Gasolina 98 E5</option>
          <option value="Precio Gasoleo Premium">Gasóleo Premium</option>
        </select>
      </header>

      {/* Stats bar */}
      {!loading && (
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>Más barata</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a" }}>
              {cheapestPrice ? cheapestPrice.toFixed(3) + " €" : "—"}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>Media zona</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0369a1" }}>
              {avgPrice ? avgPrice.toFixed(3) + " €" : "—"}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>Estaciones</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f" }}>
              {filteredStations.length}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⛽</div>
          <p>Cargando gasolineras...</p>
        </div>
      ) : view === "list" ? (
        <div>
          {filteredStations.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              No se encontraron gasolineras
            </div>
          ) : (
            filteredStations.map((s, i) => {
              const price = parseFloat((s[fuelType] || "").toString().replace(",", "."));
              const isFav = favorites.includes(s["IDEESS"]);
              const isCheapest = !isNaN(price) && cheapestPrice && price === cheapestPrice;
              const dist = s._dist;

              return (
                <div
                  key={s["IDEESS"] + i}
                  style={{
                    background: "white",
                    margin: "8px 12px",
                    borderRadius: 14,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    boxShadow: isCheapest ? "0 0 0 2px #16a34a" : "0 1px 4px rgba(0,0,0,0.08)",
                  }}
                >
                  {/* Price badge */}
                  <div
                    style={{
                      minWidth: 68,
                      textAlign: "center",
                      background: isCheapest ? "#dcfce7" : "#f1f5f9",
                      borderRadius: 10,
                      padding: "8px 4px",
                    }}
                  >
                    <div style={{ fontSize: 17, fontWeight: 800, color: isCheapest ? "#16a34a" : "#1e3a5f" }}>
                      {!isNaN(price) ? price.toFixed(3) : "—"}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>€/L</div>
                    {isCheapest && <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>MÁS BARATA</div>}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s["Rótulo"] || "Gasolinera"}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                      {s["Municipio"] || s.municipio || ""}
                      {s.direccion ? ` · ${s.direccion}` : ""}
                    </div>
                    {dist !== undefined && dist !== Infinity && (
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                        📍 {dist < 1 ? (dist * 1000).toFixed(0) + " m" : dist.toFixed(1) + " km"}
                      </div>
                    )}
                  </div>

                  {/* Favorite button */}
                  <button
                    onClick={() => toggleFavorite(s["IDEESS"])}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 8,
                      color: isFav ? "#f59e0b" : "#cbd5e1",
                    }}
                    aria-label={isFav ? "Quitar favorito" : "Añadir favorito"}
                  >
                    <Star size={22} fill={isFav ? "#f59e0b" : "none"} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : view === "map" ? (
        <div ref={mapRef} style={{ height: "calc(100vh - 220px)", width: "100%" }} />
      ) : (
        // Favorites view
        <div>
          <div style={{ padding: "16px 16px 8px", color: "#64748b", fontSize: 14 }}>
            Tus gasolineras favoritas
          </div>
          {favorites.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              <Star size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>Aún no tienes favoritas.<br />Pulsa ★ en cualquier gasolinera.</p>
            </div>
          ) : (
            stations
              .filter((s) => favorites.includes(s["IDEESS"]))
              .map((s, i) => {
                const price = parseFloat((s[fuelType] || "").toString().replace(",", "."));
                return (
                  <div
                    key={s["IDEESS"] + i}
                    style={{
                      background: "white",
                      margin: "8px 12px",
                      borderRadius: 14,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div style={{ minWidth: 68, textAlign: "center", background: "#fef9c3", borderRadius: 10, padding: "8px 4px" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#b45309" }}>
                        {!isNaN(price) ? price.toFixed(3) : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>€/L</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s["Rótulo"] || "Gasolinera"}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                        {s["Municipio"] || s.municipio || ""}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFavorite(s["IDEESS"])}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#f59e0b" }}
                    >
                      <Star size={22} fill="#f59e0b" />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* Calculator modal */}
      {showCalc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowCalc(false)}
        >
          <div
            style={{ background: "white", width: "100%", borderRadius: "20px 20px 0 0", padding: 24, maxWidth: 600, margin: "0 auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#1e3a5f" }}>💰 Calculadora de ahorro</h2>
              <button onClick={() => setShowCalc(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={24} color="#64748b" />
              </button>
            </div>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: "#64748b" }}>Litros por repostaje</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={calcLiters}
                  onChange={(e) => setCalcLiters(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 40, fontWeight: 700, color: "#1e3a5f" }}>{calcLiters} L</span>
              </div>
            </label>

            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={{ fontSize: 14, color: "#64748b" }}>Veces por semana que repostas</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={calcFreq}
                  onChange={(e) => setCalcFreq(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 40, fontWeight: 700, color: "#1e3a5f" }}>{calcFreq}x</span>
              </div>
            </label>

            {cheapestPrice && avgPrice ? (
              <div style={{ background: "#f0fdf4", borderRadius: 14, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#16a34a", marginBottom: 4 }}>Ahorro anual estimado</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#15803d" }}>{calcSaving()} €</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                  Diferencia de {(avgPrice - cheapestPrice).toFixed(3)} €/L · {calcLiters}L · {calcFreq}x/sem · 52 semanas
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No hay datos de precios suficientes</div>
            )}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 600,
          background: "white",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          zIndex: 100,
        }}
      >
        {[
          { id: "list", icon: <List size={22} />, label: "Lista" },
          { id: "map", icon: <Map size={22} />, label: "Mapa" },
          { id: "favs", icon: <Star size={22} />, label: "Favoritas" },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: view === id ? "#1e3a5f" : "#94a3b8",
              fontWeight: view === id ? 700 : 400,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              borderTop: view === id ? "2px solid #1e3a5f" : "2px solid transparent",
            }}
          >
            {icon}
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowCalc(true)}
          style={{
            flex: 1,
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            borderTop: "2px solid transparent",
          }}
        >
          <Calculator size={22} />
          Calcular
        </button>
      </nav>
    </main>
  );
}
