"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://mute-union-f2b1.carmelohdezluis.workers.dev/")
      .then((res) => res.json())
      .then((data) => {
        setStations(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <main>
      <h1>Gasolineras</h1>
      <ul>
        {stations.map((s, i) => (
          <li key={i}>{s.empresa}</li>
        ))}
      </ul>
    </main>
  );
}
