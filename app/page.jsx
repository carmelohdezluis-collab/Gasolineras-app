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

  useEffect(() => {
    const saved = localStorage.getItem("fav_stations");
    if (saved) setFavorites(JSON.parse(saved));

    // AHORA USA TU NUEVO SERVIDOR ESTABLE DE CLOUDFLARE
    // Pedimos MADRID por defecto, pero con limite=100 para tener bastantes datos
    fetch("https://mute-union-f2b1.carmelohdezluis.workers.dev/" )

      .then((res) => res.json())
      .then((data) => {
        // Adaptamos el formato de Cloudflare al que esperaba tu app original
        // Tu app original usaba los nombres largos del Ministerio, vamos a mapearlos:
        const adaptedData = data.map(g => ({
          ...g,
          "Rótulo": g.empresa,
          "Municipio": g.municipio,
          "Precio Gasolina 95 E5": g.precio.toString(),
          "IDEESS": g.empresa + g.direccion // Generamos un ID simple
        }));
        setStations(adaptedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error cargando datos:", err);
        setLoading(false);
      });
  }, []);

  // ... (El resto del código sigue igual que el tuyo)
  // Nota: Para que sea 100% funcional con todas las provincias, 
  // podríamos añadir un selector de provincia en el futuro.
