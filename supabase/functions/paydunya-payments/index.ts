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
async function prepareSupplierOrderMessages(admin: any, orderId: string, orderNumber: string) {
  const { data: items, error: itemsError } = await admin.from('order_items')
    .select('id,product_title,quantity,products(supplier_contact_id,title,sku,brand)')
    .eq('order_id', orderId);
  if (itemsError) throw new Error(itemsError.message);
  const groups = new Map<string, any[]>();
  for (const item of items || []) {
    const contactId = item.products?.supplier_contact_id;
    if (!contactId) continue;
    groups.set(contactId, [...(groups.get(contactId) || []), item]);
  }
  if (!groups.size) return { prepared: 0, skipped: 'Aucun produit de cette commande n’est lié à un fournisseur enregistré.' };
  const { data: contacts, error: contactsError } = await admin.from('supplier_contacts')
    .select('id,company_name,contact_name,whatsapp,whatsapp_opt_in,status')
    .in('id', [...groups.keys()]);
  if (contactsError) throw new Error(contactsError.message);
  let prepared = 0;
  for (const contact of contacts || []) {
    if (contact.status !== 'active') continue;
    const products = groups.get(contact.id) || [];
    const productLines = products.map((item: any) =>
      (item.product_title || item.products?.title) + ' × ' + item.quantity + (item.products?.sku ? ' (SKU ' + item.products.sku + ')' : '')
    ).join('\n');
    const fallback = 'Hello ' + (contact.contact_name || contact.company_name) + ',\n\nChinaGo has received order ' + orderNumber + ' for the following products:\n' + productLines + '\n\nPlease confirm availability, final unit prices, preparation time, packaging details and the earliest dispatch date. Please do not ship before ChinaGo confirms the next step.\n\nThank you,\nChinaGo Purchasing Team';
    let message = fallback;
    let aiGenerated = false;
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAiKey) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + openAiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            messages: [
              { role: 'system', content: 'You are ChinaGo purchasing assistant. Write concise, professional supplier messages in English. Never invent facts, prices, payment confirmations, addresses, or delivery promises. Ask the supplier to confirm stock, price, packaging, preparation time and dispatch date.' },
              { role: 'user', content: 'Write a supplier message for ChinaGo order ' + orderNumber + '. Supplier: ' + contact.company_name + '. Products and quantities:\n' + productLines }
            ]
          })
        });
        const aiData = await aiResponse.json();
        const generated = aiData.choices?.[0]?.message?.content?.trim();
        if (aiResponse.ok && generated) { message = generated; aiGenerated = true; }
      } catch { /* use safe fallback text */ }
    }
    const existing = await admin.from('supplier_order_messages').select('id,status')
      .eq('order_id', orderId).eq('supplier_contact_id', contact.id).maybeSingle();
    if (existing.data?.status === 'sent') continue;
    let status = 'awaiting_configuration';
    let errorMessage = !contact.whatsapp_opt_in
      ? 'Envoi suspendu : le fournisseur n’a pas encore donné son accord WhatsApp.'
      : (!openAiKey
        ? 'Message standard préparé. Ajoutez OPENAI_API_KEY pour activer la rédaction IA, puis configurez WhatsApp Business.'
        : (!aiGenerated ? 'La génération IA n’a pas abouti. Vérifiez OPENAI_API_KEY avant tout envoi.' : 'Brouillon IA prêt. Configurez les identifiants WhatsApp Business et un modèle approuvé par Meta.'));
    let providerMessageId = null;
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
    const templateLanguage = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'en';
    if (contact.whatsapp_opt_in && contact.whatsapp && aiGenerated && token && phoneId && templateName) {
      try {
        const version = Deno.env.get('WHATSAPP_GRAPH_API_VERSION') || 'v26.0';
        const sendResponse = await fetch('https://graph.facebook.com/' + version + '/' + phoneId + '/messages', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: String(contact.whatsapp).replace(/[^0-9]/g, ''),
            type: 'template',
            template: { name: templateName, language: { code: templateLanguage }, components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 1024) }] }] }
          })
        });
        const sendData = await sendResponse.json();
        if (sendResponse.ok) {
          status = 'sent'; errorMessage = null;
          providerMessageId = sendData.messages?.[0]?.id || null;
        } else { status = 'failed'; errorMessage = sendData.error?.message || 'Échec de l’envoi WhatsApp.'; }
      } catch (error) { status = 'failed'; errorMessage = error instanceof Error ? error.message : 'Erreur WhatsApp.'; }
    }
    const payload = {
      order_id: orderId, supplier_contact_id: contact.id, supplier_name: contact.company_name,
      supplier_whatsapp: contact.whatsapp, message_body: message, ai_generated: aiGenerated,
      status, error_message: errorMessage, provider_message_id: providerMessageId,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    };
    const { error: saveError } = await admin.from('supplier_order_messages')
      .upsert(payload, { onConflict: 'order_id,supplier_contact_id' });
    if (saveError) throw new Error(saveError.message);
    if (status === 'sent') {
      await admin.from('supplier_messages').insert({
        order_id: orderId, supplier_name: contact.company_name, supplier_whatsapp: contact.whatsapp,
        channel: 'whatsapp', direction: 'outbound', message_body: message, sent_at: new Date().toISOString()
      });
    }
    prepared++;
  }
  return { prepared };
}

async function handleIpn(req: Request) {
  const master = env("PAYDUNYA_MASTER_KEY");
  if (!master) return json({ error: "PayDunya non configuré." }, 503);
  let payload: any = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) payload = await req.json();
  else {
    const form = await req.formData();
    const raw = form.get("data");
    if (typeof raw === "string") {
      try { payload = JSON.parse(raw); } catch { return json({ error: "Notification invalide." }, 400); }
    } else return json({ error: "Notification PayDunya invalide." }, 400);
  }
  const data = payload?.data || payload;
  const receivedHash = String(data?.hash || "");
  if (!safeEqual(receivedHash.toLowerCase(), (await sha512(master)).toLowerCase())) {
    return json({ error: "Signature PayDunya invalide." }, 401);
  }
  const token = String(data?.invoice?.token || data?.token || "");
  const providerStatus = String(data?.status || "").toLowerCase();
  const amount = Number(data?.invoice?.total_amount || data?.total_amount || 0);
  if (!token || !["completed", "cancelled", "failed", "pending"].includes(providerStatus)) {
    return json({ error: "Données de paiement incomplètes." }, 400);
  }
  const admin = serviceClient();
  const { data: transaction, error: readError } = await admin.from("payment_transactions")
    .select("id,order_id,amount_xof,status,user_id").eq("provider", "paydunya")
    .eq("provider_invoice_token", token).maybeSingle();
  if (readError || !transaction) return json({ error: "Transaction ChinaGo introuvable." }, 404);
  if (providerStatus === "completed" && Math.round(amount) !== Math.round(Number(transaction.amount_xof))) {
    return json({ error: "Le montant confirmé ne correspond pas à la commande." }, 409);
  }
  const confirmed = providerStatus === "completed";
  const nextStatus = confirmed ? "confirmed" : providerStatus;
  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("payment_transactions").update({
    status: nextStatus, provider_payload: data, confirmed_at: confirmed ? now : null,
    paid_at: confirmed ? now : null, updated_at: now
  }).eq("id", transaction.id);
  if (updateError) return json({ error: updateError.message }, 500);

  if (confirmed) {
    const { error: ledgerError } = await admin.from("platform_cash_ledger").upsert({
      direction: "credit", category: "customer_collection", amount_xof: Number(transaction.amount_xof),
      currency: "XOF", source_type: "payment_transaction", source_id: transaction.id,
      description: "Encaissement PayDunya SoftPay - commande " + transaction.order_id
    }, { onConflict: "source_type,source_id", ignoreDuplicates: true });
    if (ledgerError) return json({ error: "Paiement confirmé, mais écriture de trésorerie impossible : " + ledgerError.message }, 500);
    const { data: order, error: orderReadError } = await admin.from("orders")
      .select("id,order_number,customer_id,status,tracking_code").eq("id", transaction.order_id).maybeSingle();
    if (orderReadError || !order) return json({ error: "Commande liée au paiement introuvable." }, 404);
    if (order.status !== "paid") {
      const { error: orderError } = await admin.from("orders").update({
        status: "paid", updated_at: now
      }).eq("id", transaction.order_id).in("status", ["pending", "awaiting_payment", "quote_requested"]);
      if (orderError) return json({ error: orderError.message }, 500);
      await admin.from("notifications").insert({ user_id: order.customer_id, title: "Paiement confirmé", body: "Votre paiement pour la commande " + order.order_number + " est confirmé. Votre numéro de suivi ChinaGo est " + (order.tracking_code || "en cours de création") + ". Retrouvez les mises à jour dans votre profil ChinaGo.", kind: "order" });
    }
    try { await prepareSupplierOrderMessages(admin, order.id, order.order_number); } catch (automationError) {
      console.error("Supplier automation after PayDunya payment:", automationError);
    }
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

  if (new URL(req.url).searchParams.get("action") === "paydunya_ipn") return await handleIpn(req);
  const body = await req.json().catch(() => ({}));

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Connexion requise." }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Session invalide." }, 401);

  if (body.action === "create_softpay") {
    const master = env("PAYDUNYA_MASTER_KEY");
    const privateKey = env("PAYDUNYA_PRIVATE_KEY");
    const tokenKey = env("PAYDUNYA_TOKEN");
    if (!master || !privateKey || !tokenKey) return json({ error: "PayDunya n'est pas encore configuré. Ajoutez les trois clés API dans les secrets Supabase." }, 503);
    const orderId = String(body.order_id || "");
    const method = String(body.payment_method || "");
    const phone = String(body.phone_number || "").replace(/[\\s+().-]/g, "");
    if (!orderId || !["t-money-togo","moov-togo"].includes(method)) return json({ error: "Commande ou moyen de paiement invalide." }, 400);
    if (!/^\\d{8,15}$/.test(phone)) return json({ error: "Entrez un numéro Mobile Money valide." }, 400);
    const admin = serviceClient();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,order_number,customer_id,status,total_xof,contact_name,contact_phone,contact_email,delivery_city")
      .eq("id", orderId).eq("customer_id", authData.user.id).maybeSingle();
    if (orderError || !order) return json({ error: "Commande introuvable." }, 404);
    if (!["pending", "awaiting_payment", "quote_requested"].includes(order.status)) return json({ error: "Cette commande n'est pas payable dans son état actuel." }, 409);
    const amount = Math.round(Number(order.total_xof || 0));
    if (!Number.isSafeInteger(amount) || amount < 100) return json({ error: "Le montant de la commande est invalide." }, 400);

    const mode = env("PAYDUNYA_MODE").toLowerCase() === "live" ? "live" : "test";
    const base = mode === "live" ? "https://app.paydunya.com/api/v1" : "https://app.paydunya.com/sandbox-api/v1";
    const headers = { "Content-Type": "application/json", "PAYDUNYA-MASTER-KEY": master, "PAYDUNYA-PRIVATE-KEY": privateKey, "PAYDUNYA-TOKEN": tokenKey };
    const invoicePayload = {
      invoice: { total_amount: amount, description: "Commande " + order.order_number + " sur ChinaGo" },
      store: { name: "ChinaGo", tagline: "Achetez en Chine depuis le Togo", website_url: env("CHINAGO_PUBLIC_URL") || "https://chinago-tby6.onrender.com" },
      custom_data: { order_id: order.id, order_number: order.order_number, user_id: authData.user.id },
      actions: { callback_url: env("PAYDUNYA_CALLBACK_URL") || url + "/functions/v1/paydunya-payments?action=paydunya_ipn" }
    };
    const invoiceResponse = await fetch(base + "/checkout-invoice/create", {
      method: "POST", headers, body: JSON.stringify(invoicePayload), signal: AbortSignal.timeout(20000)
    });
    const invoice = await invoiceResponse.json().catch(() => ({}));
    if (!invoiceResponse.ok || invoice.response_code !== "00" || !invoice.token) {
      return json({ error: invoice.response_text || "PayDunya n'a pas pu créer la facture." }, 502);
    }
    const { data: transaction, error: insertError } = await admin.from("payment_transactions").insert({
      order_id: order.id, user_id: authData.user.id, amount_xof: amount,
      payment_method: method, provider: "paydunya", provider_invoice_token: invoice.token,
      status: "pending", notes: "PayDunya SoftPay " + mode
    }).select("id").single();
    if (insertError) return json({ error: "Impossible d'enregistrer la transaction ChinaGo : " + insertError.message }, 500);

    let softpayPayload: Record<string, string> = { payment_token: invoice.token };
    let endpoint = "";
    const name = String(order.contact_name || authData.user.user_metadata?.full_name || "Client ChinaGo");
    const customerEmail = String(order.contact_email || authData.user.email || "");
    if (mode === "test") {
      const testPassword = env("PAYDUNYA_TEST_PASSWORD");
      if (!testPassword) return json({ error: "Mode test : ajoutez PAYDUNYA_TEST_PASSWORD et le compte fictif PayDunya dans les secrets Supabase." }, 503);
      endpoint = base + "/softpay/checkout/make-payment";
      softpayPayload = {
        phone_phone: env("PAYDUNYA_TEST_PHONE") || phone,
        customer_email: env("PAYDUNYA_TEST_EMAIL") || customerEmail,
        password: testPassword,
        invoice_token: invoice.token
      };
    } else if (method === "t-money-togo") {
      endpoint = base + "/softpay/t-money-togo";
      softpayPayload = { name_t_money: name, email_t_money: customerEmail, phone_number: phone, payment_token: invoice.token };
    } else {
      endpoint = base + "/softpay/moov-togo";
      softpayPayload = { moov_togo_customer_fullname: name, moov_togo_email: customerEmail, moov_togo_customer_address: String(order.delivery_city || "Lome"), moov_togo_phone_number: phone, payment_token: invoice.token };
    }
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(softpayPayload), signal: AbortSignal.timeout(30000) });
    const result = await response.json().catch(() => ({}));
    await admin.from("payment_transactions").update({
      provider_payload: result, provider_reference: result?.data?.transactionid || result?.data?.transaction_id || null,
      updated_at: new Date().toISOString(), status: result?.success === false ? "failed" : "pending"
    }).eq("id", transaction.id);
    if (!response.ok || result.success !== true) {
      return json({ error: result.message || "PayDunya n'a pas pu lancer la demande SoftPay.", transaction_id: transaction.id }, 502);
    }
    return json({ ok: true, transaction_id: transaction.id, status: "pending", message: result.message || "Demande envoyée. Validez le paiement sur votre téléphone.", method });
  }

  if (body.action === "get_payment_status") {
    const transactionId = String(body.transaction_id || "");
    const { data: transaction, error } = await serviceClient().from("payment_transactions")
      .select("id,status,amount_xof,provider_reference").eq("id", transactionId)
      .eq("user_id", authData.user.id).maybeSingle();
    if (error || !transaction) return json({ error: "Transaction introuvable." }, 404);
    return json({ ok: true, transaction });
  }

  return json({ error: "Action inconnue." }, 400);
});
