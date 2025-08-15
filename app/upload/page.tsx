"use client";

import React, { useMemo, useRef, useState } from "react";

// ---- Konfiguration (Frontend-Checks) ----
const ALLOWED_EXT = [".ifc", ".ifczip"];
const MAX_SIZE_MB = 200; // rein Frontend; echtes Limit serverseitig/bei Speckle

type SpeckleUploadResponse = any; // wir zeigen generisch + ein paar häufige Felder

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [streamId, setStreamId] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [resp, setResp] = useState<SpeckleUploadResponse | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => {
    if (!resp) return null;
    const s: Record<string, string> = {};
    try {
      const r: any = resp;
      if (r?.streamId) s["Stream ID"] = r.streamId;
      if (r?.branchName) s["Branch"] = r.branchName;
      if (r?.commitId) s["Commit ID"] = r.commitId;
      if (r?.message) s["Message"] = r.message;
      if (r?.status) s["Status"] = r.status;
      if (!Object.keys(s).length) return null;
      return s;
    } catch {
      return null;
    }
  }, [resp]);

  function resetForm() {
    setFile(null);
    setStreamId("");
    setStatus("idle");
    setMessage("");
    setResp(null);
    setProgress(0);
    inputRef.current?.value && (inputRef.current.value = "");
  }

  function validateFile(f: File | null): string | null {
    if (!f) return "Bitte eine Datei auswählen.";
    const name = f.name.toLowerCase();
    const okExt = ALLOWED_EXT.some((ext) => name.endsWith(ext));
    if (!okExt) return `Ungültiger Dateityp. Erlaubt: ${ALLOWED_EXT.join(", ")}`;
    const sizeMb = f.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) return `Datei zu groß (${sizeMb.toFixed(1)} MB). Maximal ${MAX_SIZE_MB} MB.`;
    return null;
  }

  // fetch() hat kein Upload-Progress → wir verwenden XHR für Fortschritt
  function uploadWithProgress(form: FormData): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/speckle-upload", true);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setProgress(pct);
        }
      };

      xhr.onload = () => {
        const status = xhr.status;
        const headers = new Headers();
        const body = xhr.responseText ?? "";
        resolve(new Response(body, { status, headers }));
      };
      xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload."));
      xhr.send(form);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResp(null);
    setMessage("");

    setStatus("validating");
    const err = validateFile(file);
    if (err) { setStatus("error"); setMessage(err); return; }

    setStatus("uploading"); setProgress(1);
    try {
      const form = new FormData();
      form.append("file", file as Blob, (file as any).name || "upload.ifc");
      if (streamId.trim()) form.append("streamId", streamId.trim());

      const res = await uploadWithProgress(form);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      setResp(data);

      if (!res.ok) { setStatus("error"); setMessage(data?.error || `Upload fehlgeschlagen (HTTP ${res.status}).`); return; }
      setStatus("success"); setMessage("Upload erfolgreich an Speckle übermittelt.");
    } catch (err: any) {
      setStatus("error"); setMessage(err?.message || "Unbekannter Fehler beim Upload.");
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>IFC Upload (Speckle MVP)</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Unterstützt: <code>.ifc</code>, <code>.ifczip</code> – max. {MAX_SIZE_MB} MB
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>IFC-Datei</div>
          <input ref={inputRef} type="file" accept={ALLOWED_EXT.join(",")} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Speckle Stream ID (optional)</div>
          <input type="text" placeholder="z. B. abc123…" value={streamId} onChange={(e) => setStreamId(e.target.value)}
                 style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 }} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={status === "uploading" || status === "validating"}
                  style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "white", fontWeight: 700, cursor: status === "uploading" ? "not-allowed" : "pointer" }}>
            {status === "uploading" ? "Lade hoch…" : "Hochladen"}
          </button>
          <button type="button" onClick={resetForm}
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "white", fontWeight: 600, cursor: "pointer" }}>
            Zurücksetzen
          </button>
        </div>
      </form>

      {status === "uploading" && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Upload-Fortschritt</div>
          <div style={{ height: 10, background: "#eee", borderRadius: 999 }}>
            <div style={{ width: `${progress}%`, height: 10, background: "#111", borderRadius: 999, transition: "width .2s ease" }} />
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{progress}%</div>
        </div>
      )}

      {status !== "idle" && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid",
                      borderColor: status === "success" ? "#1a7f37" : status === "error" ? "#cc0000" : "#ddd",
                      background: status === "success" ? "#e9f7ef" : status === "error" ? "#fdeaea" : "#f8f8f8",
                      color: status === "success" ? "#1a7f37" : status === "error" ? "#cc0000" : "#333" }}>
          <b>{status === "success" ? "Erfolg" : status === "error" ? "Fehler" : status === "validating" ? "Prüfung" : "Info"}:</b>{" "}
          {message || (status === "validating" ? "Prüfe Datei…" : status === "uploading" ? "Hochladen…" : "")}
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Zusammenfassung</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {Object.entries(summary).map(([k, v]) => (
              <li key={k}><b>{k}:</b> <code>{v}</code></li>
            ))}
          </ul>
        </div>
      )}

      {resp && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Technische Antwort (JSON)</summary>
          <pre style={{ marginTop: 10, background: "#f7f7f7", padding: 12, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(resp, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
