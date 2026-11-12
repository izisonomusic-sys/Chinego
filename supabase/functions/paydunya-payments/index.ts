import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const env = (key: string) => Deno.env.get(key) || "";

async function sha512(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function serviceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function handleIpn(req: Request) {
  const master = env("PAYDUNYA_MASTER_KEY");
  if (!master) return json({ error: "PayDunya non configuré." }, 503);
  const contentType = req.headers.get("content-type") || "";
  let payload: any = {};
  if (contentType.includes("application/json")) payload = await req.json();
  else {
    const form = await req.formData();
    const raw = form.get("data");
    if (typeof raw === "string") {
      try { payload = JSON.parse(raw); } catch { return json({ error: "Notification invalide." }, 400); }
    } else {
      const rawBody = await req.text();
      try { payload = JSON.parse(rawBody); } catch { return json({ error: "Notification invalide." }, 400); }
    }
  }
  const data = payload?.data || payload;
  const receivedHash = String(data?.hash || "");
  const expectedHash = await sha512(master);
  if (!safeEqual(receivedHash.toLowerCase(), expectedHash.toLowerCase())) {
    return json({ error: "Signature PayDunya invalide." }, 401);
  }
  const token = String(data?.invoice?.token || data?.token || "");
  const status = String(data?.status || "").toLowerCase();
  const amount = Number(data?.invoice?.total_amount || data?.total_amount || 0);
  if (!token || !["completed", "cancelled", "failed", "pending"].includes(status)) {
    return json({ error: "Données de paiement incomplètes." }, 400);
  }
  const admin = serviceClient();
  const { data: transaction, error: readError } = await admin.from("payment_transactions")
    .select("id,order_id,amount_xof,status").eq("provider", "paydunya")
    .eq("provider_invoice_token", token).maybeSingle();
  if (readError || !transaction) return json({ error: "Transaction ChinaGo introuvable." }, 404);
  if (status === "completed" && Math.round(amount) !== Math.round(Number(transaction.amount_xof))) {
    return json({ error: "Le montant confirmé ne correspond pas à la commande." }, 409);
  }
  const nextStatus = status === "completed" ? "completed" : status;
  const { error: updatePaymentError } = await admin.from("payment_transactions").update({
    status: nextStatus,
    provider_payload: data,
    confirmed_at: status === "completed" ? new Date().toISOString() : null,
    paid_at: status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", transaction.id);
  if (updatePaymentError) return json({ error: updatePaymentError.message }, 500);

  if (status === "completed" && transaction.status !== "completed") {
    const { error: orderError } = await admin.from("orders").update({
      status: "paid", updated_at: new Date().toISOString(),
    }).eq("id", transaction.order_id).in("status", ["pending", "awaiting_payment", "quote_requested"]);
    if (orderError) return json({ error: orderError.message }, 500);
  }
  return json({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceKey) return json({ error: "Configuration Supabase incomplète." }, 503);

  const body = await req.json().catch(() => ({}));
  if (body.action === "paydunya_ipn") return await handleIpn(req);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Connexion requise." }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Session invalide." }, 401);

  if (body.action === "create_checkout") {
    const master = env("PAYDUNYA_MASTER_KEY");
    const privateKey = env("PAYDUNYA_PRIVATE_KEY");
    const tokenKey = env("PAYDUNYA_TOKEN");
    if (!master || !privateKey || !tokenKey) return json({ error: "PayDunya n'est pas encore configuré. Ajoutez les trois clés API dans les secrets Supabase." }, 503);
    const orderId = String(body.order_id || "");
    if (!orderId) return json({ error: "Identifiant de commande manquant." }, 400);
    const admin = serviceClient();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,order_number,customer_id,status,total_xof,contact_name,contact_phone,contact_email,order_items(product_title,quantity,line_total_xof,unit_price_xof)")
      .eq("id", orderId).eq("customer_id", authData.user.id).maybeSingle();
    if (orderError || !order) return json({ error: "Commande introuvable." }, 404);
    if (!["pending", "awaiting_payment", "quote_requested"].includes(order.status)) {
      return json({ error: "Cette commande n'est pas payable dans son état actuel." }, 409);
    }
    const amount = Math.round(Number(order.total_xof || 0));
    if (!Number.isSafeInteger(amount) || amount < 100) return json({ error: "Le montant de la commande est invalide." }, 400);

    const mode = env("PAYDUNYA_MODE").toLowerCase() === "live" ? "live" : "test";
    const endpoint = mode === "live"
      ? "https://app.paydunya.com/api/v1/checkout-invoice/create"
      : "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create";
    const baseUrl = env("CHINAGO_PUBLIC_URL") || "https://chinago-tby6.onrender.com";
    const itemMap: Record<string, unknown> = {};
    (order.order_items || []).slice(0, 30).forEach((item: any, index: number) => {
      itemMap["item_" + index] = {
        name: String(item.product_title || "Article ChinaGo").slice(0, 120),
        quantity: Number(item.quantity || 1),
        unit_price: String(Math.round(Number(item.unit_price_xof || 0))),
        total_price: String(Math.round(Number(item.line_total_xof || 0))),
      };
    });
    const invoice = {
      invoice: {
        total_amount: amount,
        description: "Commande " + order.order_number + " sur ChinaGo",
        items: itemMap,
        customer: {
          name: order.contact_name || authData.user.user_metadata?.full_name || "Client ChinaGo",
          email: order.contact_email || authData.user.email || "",
          phone: order.contact_phone || "",
        },
      },
      store: {
        name: "ChinaGo",
        tagline: "Achetez en Chine depuis le Togo",
        website_url: baseUrl,
      },
      custom_data: { order_id: order.id, order_number: order.order_number, user_id: authData.user.id },
      actions: {
        return_url: baseUrl + "/?payment=success",
        cancel_url: baseUrl + "/?payment=cancelled",
        callback_url: env("PAYDUNYA_CALLBACK_URL") || url + "/functions/v1/paydunya-payments",
      },
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": master,
        "PAYDUNYA-PRIVATE-KEY": privateKey,
        "PAYDUNYA-TOKEN": tokenKey,
      },
      body: JSON.stringify(invoice),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.response_code !== "00" || !result.token || !result.response_text?.startsWith("http")) {
      return json({ error: result.response_text || "PayDunya n'a pas pu créer la facture.", provider: result }, 502);
    }
    const { error: insertError } = await admin.from("payment_transactions").insert({
      order_id: order.id,
      user_id: authData.user.id,
      amount_xof: amount,
      payment_method: "mobile_money",
      provider: "paydunya",
      provider_invoice_token: result.token,
      checkout_url: result.response_text,
      status: "pending",
      notes: "Facture PayDunya " + mode,
    });
    if (insertError) return json({ error: "Facture créée mais enregistrement local impossible. Contactez le support avant de recommencer." }, 500);
    return json({ ok: true, checkout_url: result.response_text, invoice_token: result.token, mode });
  }

  return json({ error: "Action inconnue." }, 400);
});
