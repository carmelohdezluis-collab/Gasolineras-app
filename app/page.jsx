"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://mute-union-f2b1.carmelohdezluis.workers.dev/")
      .then((res) => res.json())
      .then((data) => {
        const adaptedData = data.map(g => ({
          ...g,
          "Rótulo": g.empresa,
          "Municipio": g.municipio,
          "Precio Gasolina 95 E5": g.precio.toString(),
          "IDEESS": g.empresa + g.direccion
        }));
        setStations(adaptedData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando datos:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Cargando gasolineras...</div>;

  return (
    <main style={{ padding: "20px" }}>
      <h1>Lista de Gasolineras</h1>
      <ul>
        {stations.slice(0, 10).map((s, i) => (
          <li key={i}>
            {s.Rótulo} - {s["Precio Gasolina 95 E5"]} €
          </li>
        ))}
      </ul>
    </main>
  );
}
