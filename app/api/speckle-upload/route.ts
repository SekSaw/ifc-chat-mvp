import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const SPECKLE_SERVER = process.env.SPECKLE_SERVER;
    const SPECKLE_TOKEN  = process.env.SPECKLE_TOKEN;

    if (!SPECKLE_SERVER || !SPECKLE_TOKEN) {
      return new Response(JSON.stringify({
        error: "SPECKLE_SERVER oder SPECKLE_TOKEN fehlt (in Vercel als Env-Variablen setzen)."
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const form = await req.formData();
    const file = form.get("file") as unknown as File | null;
    const streamId = (form.get("streamId") ?? "").toString().trim();

    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return new Response(JSON.stringify({ error: "Keine Datei empfangen (Feldname: 'file')." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const forward = new FormData();
    forward.append("files[]", file as unknown as Blob, (file as any).name ?? "upload.ifc");
    if (streamId) forward.append("streamId", streamId);

    const res = await fetch(`${SPECKLE_SERVER}/api/file/autodetect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SPECKLE_TOKEN}` },
      body: forward,
    });

    const text = await res.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    return new Response(JSON.stringify(json), {
      status: res.status, headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Unbekannter Fehler beim Upload." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    ok: true, hint: "POST eine IFC-Datei als FormData (file) und optional streamId."
  }), { headers: { "Content-Type": "application/json" } });
}
