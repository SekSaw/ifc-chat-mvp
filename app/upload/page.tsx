"use client";
import React, { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [streamId, setStreamId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setStatus("Bitte IFC-Datei auswählen."); return; }
    setLoading(true); setStatus("Upload läuft…");

    const form = new FormData();
    form.append("file", file);
    if (streamId.trim()) form.append("streamId", streamId.trim());

    try {
      const res = await fetch("/api/speckle-upload", { method: "POST", body: form });
      const data = await res.json();
      setResp(data);
      setStatus(res.ok ? "Upload an Speckle akzeptiert." : `Fehler: ${data?.error || res.statusText}`);
    } catch (err: any) {
      setStatus(`Fehler: ${err?.message || "Unbekannt"}`);
    } finally { setLoading(false); }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>IFC Upload (Speckle MVP)</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <div>IFC-Datei</div>
          <input type="file" accept=".ifc" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
        </label>
        <label>
          <div>Speckle Stream ID (optional)</div>
          <input
            type="text" placeholder="z. B. abc123…" value={streamId}
            onChange={(e)=>setStreamId(e.target.value)}
            style={{ width:"100%", padding:8, border:"1px solid #ddd", borderRadius:8 }}
          />
        </label>
        <button type="submit" disabled={loading}
          style={{ padding:"10px 14px", borderRadius:10, border:"1px solid #111", fontWeight:600, cursor:"pointer" }}>
          {loading ? "Lade hoch…" : "Hochladen"}
        </button>
      </form>
      {status && <p style={{ marginTop:16 }}>{status}</p>}
      {resp && <pre style={{ marginTop:16, background:"#f7f7f7", padding:12, borderRadius:8, overflow:"auto" }}>
{JSON.stringify(resp, null, 2)}
      </pre>}
    </main>
  );
}
