"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Navigation, Star, Map, List, Calculator, Fuel } from "lucide-react";

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
      });
  }, []);

  // Load Leaflet CSS + JS
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
    const R = 6371;
    const dLat = ((lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((lng - userLocation.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Filtrado y Ordenación ESTRICTA POR PRECIO (De más barata a más cara)
  const filteredStations = useMemo(() => {
    let list = [...stations];
    
    // 1. Filtrar estaciones que tengan precio válido para el combustible seleccionado
    list = list.filter((s) => {
      const p = parseFloat(s[fuelType]?.replace(",", "."));
      return p && !isNaN(p);
    });

    // 2. Filtrar por búsqueda si el usuario escribe un municipio o marca
    if (search) {
      list = list.filter(
        (s) =>
          s.Municipio?.toLowerCase().includes(search.toLowerCase()) ||
          s.Rótulo?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 3. Ordenar siempre de menor a mayor precio matemático
    list.sort((a, b) => {
      const precioA = parseFloat(a[fuelType]?.replace(",", ".")) || 9999;
      const precioB = parseFloat(b[fuelType]?.replace(",", ".")) || 9999;
      return precioA - precioB;
    });

    return list.slice(0, 80);
  }, [search, stations, fuelType]);

  // Init map when switching to map view
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

    const center = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [40.416775, -3.70379];

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(center, userLocation ? 12 : 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.setView(center, userLocation ? 12 : 6);
    }

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const prices = filteredStations
      .map((s) => parseFloat(s[fuelType]?.replace(",", ".")) || null)
      .filter(Boolean);
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
        .bindPopup(`<b>${s.Rótulo}</b><br>${s.Municipio}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank">🗺 Ir ahora</a>`);
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

  const favStations = useMemo(
    () => stations.filter((s) => favorites.includes(s.IDEESS)),
    [stations, favorites]
  );

  // Calc savings
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

  const fuelLabel = fuelType === "Precio Gasolina 95 E5" ? "Gasolina 95 E5" : "Gasóleo A";

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
          <p style={{ margin: 0, fontSize: 12, color: "#0ea5e9", textAlign: "center" }}>📍 Ubicación activada (Mostrando precios más baratos)</p>
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
            <option value="Precio Gasolina 95 E10">Gasolina 95 E10</option>
            <option value="Precio Gasolina 95 E5 Premium">Gasolina 95 Premium</option>
            <option value="Precio Gasolina 98 E5">Gasolina 98 E5</option>
            <option value="Precio Gasolina 98 E10">Gasolina 98 E10</option>
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
          { id: "map", icon: , label: "Mapa" },
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
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "12px 16px" }}>

        {/* LIST VIEW */}
        {view === "list" && (
          loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando estaciones...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredStations.map((s, i) => {
                const lat = s.Latitud?.replace(",", ".");
                const lng = s["Longitud (WGS84)"]?.replace(",", ".");
                const price = parseFloat(s[fuelType]?.replace(",", ".")) || null;
                const isFav = favorites.includes(s.IDEESS);
                const dist = getDistance(s);
