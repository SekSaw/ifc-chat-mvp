"use client";

import React, { useMemo, useRef, useState } from "react";

const ALLOWED_EXT = [".ifc", ".ifczip"];
const MAX_SIZE_MB = 500;

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [server, setServer] = useState<string>("https://app.speckle.systems");
  const [token, setToken] = useState<string>("");
  const [streamId, setStreamId] = useState("");
  const [status, setStatus] = useState<"idle"|"validating"|"uploading"|"success"|"error">("idle");
  const [message, setMessage] = useState<string>("");
  const [resp, setResp] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => {
    if (!resp) return null;
    const r = resp as any; const out: Record<string,string> = {};
    if (r?.streamId) out["Stream ID"] = r.streamId;
    if (r?.branchName) out["Branch"] = r.branchName;
    if (r?.commitId) out["Commit ID"] = r.commitId;
    if (r?.message) out["Message"] = r.message;
    if (r?.status) out["Status"] = r.status;
    return Object.keys(out).length ? out : null;
  }, [resp]);

  function validateFile(f: File | null): string | null {
    if (!f) return "Bitte eine Datei auswählen.";
    const okExt = ALLOWED_EXT.some(ext => f.name.toLowerCase().endsWith(ext));
    if (!okExt) return `Ungültiger Dateityp. Erlaubt: ${ALLOWED_EXT.join(", ")}`;
    const sizeMb = f.size / (1024*1024);
    if (sizeMb > MAX_SIZE_MB) return `Datei zu groß (${sizeMb.toFixed(1)} MB). Maximal ${MAX_SIZE_MB} MB.`;
    if (!server.trim()) return "Bitte Speckle-Server angeben.";
    if (!token.trim()) return "Bitte Personal Access Token (PAT) angeben.";
    if (!streamId.trim()) return "Bitte eine Stream ID eintragen.";
    return null;
  }

  // Direkter Upload mit Progress zu /api/file/autodetect/{streamId}/main
  function directUpload(form: FormData): Promise<Response> {
    return new Promise((resolve, reject) => {
      const cleanServer = server.replace(/\/$/, "");
      const url = `${cleanServer}/api/file/autodetect/${encodeURIComponent(streamId.trim())}/main`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token.trim()}`);
      xhr.upload.onprogress = (evt) => { if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100)); };
      xhr.onload = () => resolve(new Response(xhr.responseText ?? "", { status: xhr.status }));
      xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload."));
      xhr.send(form);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResp(null); setMessage("");

    setStatus("validating");
    const err = validateFile(file);
    if (err) { setStatus("error"); setMessage(err); return; }

    setStatus("uploading"); setProgress(1);
    try {
      const form = new FormData();
      // Speckle akzeptiert hier "file" sicher; (die FE-Variante nutzt teils "files[]")
      form.append("file", file as Blob, file?.name || "upload.ifc");

      const res = await directUpload(form);
      const text = await res.text();
      let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      setResp(data);

      if (!res.ok) { setStatus("error"); setMessage(data?.error || `Upload fehlgeschlagen (HTTP ${res.status}).`); return; }
      setStatus("success"); setMessage("Upload erfolgreich direkt an Speckle übermittelt.");
    } catch (e: any) {
      setStatus("error"); setMessage(e?.message || "Unbekannter Fehler.");
    }
  }

  function resetForm() {
    setFile(null); setStreamId(""); setStatus("idle"); setMessage(""); setResp(null); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>IFC Upload (Direkt zu Speckle)</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Unterstützt: <code>.ifc</code>, <code>.ifczip</code> – Upload direkt in deinen Stream.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Speckle Server</div>
          <input type="text" value={server} onChange={(e)=>setServer(e.target.value)}
                 placeholder="https://app.speckle.systems"
                 style={{ width:"100%", padding:10, border:"1px solid #ddd", borderRadius:10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Personal Access Token (nur Tests)</div>
          <input type="password" value={token} onChange={(e)=>setToken(e.target.value)}
                 placeholder="PAT einfügen…" autoComplete="off"
                 style={{ width:"100%", padding:10, border:"1px solid #ddd", borderRadius:10 }} />
          <small style={{ color:"#666" }}>Wird nur im Browser genutzt, nicht an unseren Server geschickt.</small>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Stream ID</div>
          <input type="text" value={streamId} onChange={(e)=>setStreamId(e.target.value)}
                 placeholder="z. B. abc123…" style={{ width:"100%", padding:10, border:"1px solid #ddd", borderRadius:10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>IFC-Datei</div>
          <input ref={inputRef} type="file" accept={ALLOWED_EXT.join(",")}
                 onChange={(e)=>setFile(e.target.files?.[0] || null)} />
        </label>

        <div style={{ display:"flex", gap:10 }}>
          <button type="submit" disabled={status==="uploading"||status==="validating"}
                  style={{ padding:"10px 16px", borderRadius:12, border:"1px solid #111", background:"#111", color:"#fff", fontWeight:700 }}>
            {status==="uploading" ? "Lade hoch…" : "Hochladen"}
          </button>
          <button type="button" onClick={resetForm}
                  style={{ padding:"10px 14px", borderRadius:12, border:"1px solid #ddd", background:"#fff", fontWeight:600 }}>
            Zurücksetzen
          </button>
        </div>
      </form>

      {status==="uploading" && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize:12, color:"#666", marginBottom:6 }}>Upload-Fortschritt</div>
          <div style={{ height:10, background:"#eee", borderRadius:999 }}>
            <div style={{ width:`${progress}%`, height:10, background:"#111", borderRadius:999, transition:"width .2s" }} />
          </div>
          <div style={{ fontSize:12, color:"#666", marginTop:6 }}>{progress}%</div>
        </div>
      )}

      {status!=="idle" && (
        <div style={{
          marginTop:16, padding:12, borderRadius:12, border:"1px solid",
          borderColor: status==="success" ? "#1a7f37" : status==="error" ? "#cc0000" : "#ddd",
          background: status==="success" ? "#e9f7ef" : status==="error" ? "#fdeaea" : "#f8f8f8",
          color: status==="success" ? "#1a7f37" : status==="error" ? "#cc0000" : "#333"
        }}>
          <b>{status==="success" ? "Erfolg" : status==="error" ? "Fehler" : status==="validating" ? "Prüfung" : "Info"}:</b>{" "}
          {message}
        </div>
      )}

      {summary && (
        <div style={{ marginTop:16, padding:12, border:"1px solid #ddd", borderRadius:12 }}>
          <div style={{ fontWeight:700, marginBottom:8 }}>Zusammenfassung</div>
          <ul style={{ margin:0, paddingLeft:18 }}>
            {Object.entries(summary).map(([k,v]) => (<li key={k}><b>{k}:</b> <code>{v}</code></li>))}
          </ul>
        </div>
      )}

      {resp && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor:"pointer", fontWeight:600 }}>Technische Antwort (JSON)</summary>
          <pre style={{ marginTop:10, background:"#f7f7f7", padding:12, borderRadius:8, overflow:"auto" }}>
{JSON.stringify(resp, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
