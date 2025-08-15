"use client";
import React, { useState, useRef } from "react";

const ALLOWED_EXT = [".ifc", ".ifczip"];

export default function UploadPage() {
  const [server, setServer] = useState("https://app.speckle.systems");
  const [token, setToken] = useState("");      // Speckle PAT (nur im Browser benutzt)
  const [streamId, setStreamId] = useState(""); // <<< HIER die STREAM-ID eintragen/einfügen
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [resp, setResp] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function validate(): string | null {
    if (!server.trim()) return "Speckle-Server fehlt.";
    if (!token.trim()) return "Personal Access Token (PAT) fehlt.";
    if (!streamId.trim()) return "Stream ID fehlt.";
    if (!file) return "Bitte eine Datei auswählen.";
    if (!ALLOWED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))) return "Nur .ifc oder .ifczip erlaubt.";
    return null;
  }

  function directUpload(form: FormData): Promise<Response> {
    return new Promise((resolve, reject) => {
      const url = `${server.replace(/\/$/, "")}/api/file/autodetect/${encodeURIComponent(streamId.trim())}/main`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token.trim()}`);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => resolve(new Response(xhr.responseText ?? "", { status: xhr.status }));
      xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload."));
      xhr.send(form);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setResp(null); setProgress(0);
    const err = validate(); if (err) { setMsg(err); return; }
    try {
      const form = new FormData();
      form.append("file", file as Blob, file?.name || "upload.ifc"); // Speckle akzeptiert "file"
      setMsg("Lade hoch…");
      const res = await directUpload(form);
      const text = await res.text(); let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      setResp(data);
      setMsg(res.ok ? "Upload erfolgreich." : `Fehler (HTTP ${res.status})`);
    } catch (e:any) {
      setMsg(e?.message || "Unbekannter Fehler.");
    }
  }

  function reset() {
    setFile(null); setResp(null); setMsg(""); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>IFC Upload → Speckle (Direkt, ohne Server-Limit)</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>Speckle Server
          <input value={server} onChange={(e)=>setServer(e.target.value)} placeholder="https://app.speckle.systems"
                 style={{ width:"100%", padding:8, border:"1px solid #ddd", borderRadius:8 }} />
        </label>
        <label>Personal Access Token (PAT)
          <input type="password" value={token} onChange={(e)=>setToken(e.target.value)} placeholder="PAT einfügen…"
                 style={{ width:"100%", padding:8, border:"1px solid #ddd", borderRadius:8 }} />
        </label>
        <label>Stream ID
          <input value={streamId} onChange={(e)=>setStreamId(e.target.value)} placeholder="z. B. abcd1234…"
                 style={{ width:"100%", padding:8, border:"1px solid #ddd", borderRadius:8 }} />
        </label>
        <label>IFC-Datei
          <input ref={inputRef} type="file" accept={ALLOWED_EXT.join(",")} onChange={(e)=>setFile(e.target.files?.[0]||null)} />
        </label>
        <div style={{ display:"flex", gap:10 }}>
          <button type="submit" style={{ padding:"10px 14px", borderRadius:10, border:"1px solid #111", background:"#111", color:"#fff" }}>Hochladen</button>
          <button type="button" onClick={reset} style={{ padding:"10px 14px", borderRadius:10, border:"1px solid #ddd" }}>Zurücksetzen</button>
        </div>
      </form>

      {progress>0 && <div style={{ marginTop:12 }}>
        <div style={{ height:10, background:"#eee", borderRadius:999 }}>
          <div style={{ width:`${progress}%`, height:10, background:"#111", borderRadius:999 }} />
        </div>
        <div style={{ fontSize:12, color:"#666", marginTop:6 }}>{progress}%</div>
      </div>}

      {msg && <div style={{ marginTop:12, padding:10, border:"1px solid #ddd", borderRadius:10 }}>{msg}</div>}

      {resp && <details style={{ marginTop:12 }} open>
        <summary style={{ fontWeight:700, cursor:"pointer" }}>Antwort (JSON)</summary>
        <pre style={{ background:"#f7f7f7", padding:12, borderRadius:8, overflow:"auto" }}>{JSON.stringify(resp, null, 2)}</pre>
      </details>}
    </main>
  );
}
