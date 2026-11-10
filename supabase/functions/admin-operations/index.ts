import { withSupabase } from 'npm:@supabase/server@^1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });


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
        : 'Brouillon IA prêt. Configurez les identifiants WhatsApp Business et un modèle approuvé par Meta.');
    let providerMessageId = null;
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
    const templateLanguage = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'en';
    if (contact.whatsapp_opt_in && contact.whatsapp && token && phoneId && templateName) {
      try {
        const version = Deno.env.get('WHATSAPP_GRAPH_API_VERSION') || 'v22.0';
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

const adminHandler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  try {
    const userId = ctx.userClaims?.sub;
    if (!userId) return json({ error: 'Authentification requise.' }, 401);

    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return json({ error: 'Accès administrateur requis.' }, 403);
    }

    const body = await req.json();
    const admin = ctx.supabaseAdmin;

    if (body.action === 'set_store_status') {
      if (!['draft', 'active', 'suspended'].includes(body.status)) return json({ error: 'Statut de boutique invalide.' }, 400);
      const { error } = await admin.from('stores')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', body.store_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'publish_store_product') {
      if (!['draft', 'published', 'archived'].includes(body.status)) return json({ error: 'Statut de produit invalide.' }, 400);
      const { error } = await admin.from('store_products')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', body.product_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'update_order_status') {
      if (!['quote_requested', 'pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(body.status)) {
        return json({ error: 'Statut de commande invalide.' }, 400);
      }
      const { data: order, error: orderReadError } = await admin.from('orders')
        .select('id,customer_id,order_number').eq('id', body.order_id).single();
      if (orderReadError || !order) return json({ error: 'Commande introuvable.' }, 404);
      const updates: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() };
      for (const field of ['subtotal_xof', 'shipping_xof', 'total_xof']) {
        if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
          const amount = Number(body[field]);
          if (!Number.isFinite(amount) || amount < 0) return json({ error: 'Montant de commande invalide.' }, 400);
          updates[field] = amount;
        }
      }
      const { error } = await admin.from('orders').update(updates).eq('id', body.order_id);
      if (error) return json({ error: error.message }, 400);
      await admin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Mise à jour de votre commande ' + order.order_number,
        body: body.status === 'awaiting_payment'
          ? 'Votre devis est prêt. Consultez votre espace ChinaGo pour voir le montant confirmé.'
          : 'Le statut de votre commande a été mis à jour : ' + body.status,
        kind: 'order',
      });
      let supplierAutomation = null;
      if (body.status === 'paid') {
        try { supplierAutomation = await prepareSupplierOrderMessages(admin, order.id, order.order_number); }
        catch (automationError) { supplierAutomation = { error: automationError instanceof Error ? automationError.message : 'Préparation fournisseur impossible.' }; }
      }
      return json({ ok: true, supplierAutomation });
    }

    if (body.action === 'update_import_request') {
      const allowed = ['submitted', 'needs_details', 'quoted', 'accepted', 'rejected', 'converted'];
      if (!allowed.includes(body.status)) return json({ error: 'Statut d’importation invalide.' }, 400);
      const { data: request, error: readError } = await admin.from('import_requests')
        .select('id,user_id').eq('id', body.request_id).single();
      if (readError || !request) return json({ error: 'Demande d’importation introuvable.' }, 404);
      const parseJsonArray = (value: unknown, field: string) => {
        if (value === undefined || value === null || value === '') return [];
        try {
          const parsed = typeof value === 'string' ? JSON.parse(value) : value;
          if (!Array.isArray(parsed)) throw new Error();
          return parsed;
        } catch {
          throw new Error('Le champ ' + field + ' doit être un tableau JSON valide.');
        }
      };
      const updates: Record<string, unknown> = {
        status: body.status,
        product_title: String(body.product_title || '').trim() || null,
        product_description: String(body.product_description || '').trim() || null,
        product_image_url: String(body.product_image_url || '').trim() || null,
        product_images: parseJsonArray(body.product_images_json, 'photos'),
        product_variants: parseJsonArray(body.product_variants_json, 'variantes'),
        product_options: parseJsonArray(body.product_options_json, 'options'),
        supplier_company: String(body.supplier_company || '').trim() || null,
        supplier_contact_name: String(body.supplier_contact_name || '').trim() || null,
        supplier_phone: String(body.supplier_phone || '').trim() || null,
        supplier_whatsapp: String(body.supplier_whatsapp || '').trim() || null,
        supplier_email: String(body.supplier_email || '').trim() || null,
        supplier_profile_url: String(body.supplier_profile_url || '').trim() || null,
        original_currency: String(body.original_currency || '').trim() || null,
        extraction_status: 'admin_verified',
        extraction_source: 'admin_manual_review',
        admin_notes: String(body.admin_notes || '').trim() || null,
        quoted_at: body.status === 'quoted' ? new Date().toISOString() : null,
      };
      if (body.minimum_order_quantity !== undefined && body.minimum_order_quantity !== '') {
        const minimum = Number(body.minimum_order_quantity);
        if (!Number.isInteger(minimum) || minimum < 1) return json({ error: 'Quantité minimale invalide.' }, 400);
        updates.minimum_order_quantity = minimum;
      } else updates.minimum_order_quantity = null;
      for (const field of ['original_price_min', 'original_price_max']) {
        if (body[field] !== undefined && body[field] !== '') {
          const amount = Number(body[field]);
          if (!Number.isFinite(amount) || amount < 0) return json({ error: 'Prix source invalide.' }, 400);
          updates[field] = amount;
        } else updates[field] = null;
      }
      const quantity = Number(body.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1) return json({ error: 'Quantité invalide.' }, 400);
      updates.quantity = quantity;
      for (const field of ['unit_price_xof', 'shipping_estimate_xof']) {
        if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
          const amount = Number(body[field]);
          if (!Number.isFinite(amount) || amount < 0) return json({ error: 'Montant du devis invalide.' }, 400);
          updates[field] = amount;
        } else updates[field] = null;
      }
      const { error } = await admin.from('import_requests').update(updates).eq('id', body.request_id);
      if (error) return json({ error: error.message }, 400);
      await admin.from('notifications').insert({
        user_id: request.user_id,
        title: body.status === 'quoted' ? 'Votre devis d’importation est prêt' : 'Mise à jour de votre importation',
        body: body.status === 'quoted'
          ? 'Le devis de votre produit est disponible dans votre espace ChinaGo.'
          : 'Votre demande d’importation a été mise à jour : ' + body.status,
        kind: 'import',
      });
      return json({ ok: true });
    }

    if (body.action === 'update_cargo_request') {
      const allowed = ['submitted', 'partner_contacted', 'quoted', 'accepted', 'in_transit', 'arrived', 'delivered', 'cancelled'];
      if (!allowed.includes(body.status)) return json({ error: 'Statut cargo invalide.' }, 400);
      const { error } = await admin.from('cargo_requests').update({
        status: body.status,
        cargo_partner_id: body.cargo_partner_id || null,
        quoted_price_xof: body.quoted_price_xof === '' || body.quoted_price_xof == null ? null : Number(body.quoted_price_xof),
        tracking_reference: body.tracking_reference || null,
        partner_notes: body.partner_notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', body.request_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'dashboard_data') {
      const [usersResult, ordersResult, importsResult, cargoResult, sellerResult, supplierResult, storesResult, storeProductsResult, supplierPaymentsResult, supplierContactsResult, supplierOrderMessagesResult, supplierMessagesResult, transactionsResult, conversationsResult, supportMessagesResult, productsResult, authUsersResult] = await Promise.all([
        admin.from('profiles').select('id,full_name,phone,role,created_at').order('created_at', { ascending: false }).limit(500),
        admin.from('orders').select('id,order_number,tracking_code,customer_id,status,subtotal_xof,shipping_xof,total_xof,created_at,contact_name,contact_phone,delivery_city,delivery_address,order_items(product_title,quantity)').order('created_at', { ascending: false }).limit(300),
        admin.from('import_requests').select('id,user_id,source_url,source_platform,status,created_at,product_title,product_description,product_image_url,product_images,product_variants,product_options,minimum_order_quantity,original_currency,original_price_min,original_price_max,supplier_company,supplier_contact_name,supplier_phone,supplier_whatsapp,supplier_email,supplier_profile_url,extraction_status,quantity,unit_price_xof,shipping_estimate_xof,admin_notes').order('created_at', { ascending: false }).limit(300),
        admin.from('cargo_requests').select('id,user_id,order_id,cargo_partner_id,origin_city,destination_city,package_description,package_count,weight_kg,status,tracking_reference,quoted_price_xof,created_at,sender_name,sender_phone,receiver_name,receiver_phone,receiver_address,customer_notes,cargo_partners(name,whatsapp_phone)').order('created_at', { ascending: false }).limit(300),
        admin.from('seller_applications').select('id,user_id,account_type,business_name,contact_name,email,phone,status,created_at').order('created_at', { ascending: false }).limit(200),
        admin.from('supplier_applications').select('id,user_id,company_name,contact_name,email,phone,country,status,created_at').order('created_at', { ascending: false }).limit(200),
        admin.from('stores').select('id,owner_id,name,slug,platform,status,created_at').order('created_at', { ascending: false }).limit(200),
        admin.from('store_products').select('id,store_id,title,status,created_at,stores(name)').order('created_at', { ascending: false }).limit(300),
        admin.from('supplier_payments').select('*').order('created_at', { ascending: false }).limit(300),
        admin.from('supplier_contacts').select('*').order('company_name').limit(500),
        admin.from('supplier_order_messages').select('*').order('created_at', { ascending: false }).limit(300),
        admin.from('supplier_messages').select('*').order('created_at', { ascending: false }).limit(300),
        admin.from('payment_transactions').select('*').order('created_at', { ascending: false }).limit(300),
        admin.from('support_conversations').select('*').order('updated_at', { ascending: false }).limit(300),
        admin.from('support_messages').select('*').order('created_at', { ascending: true }).limit(1000),
        admin.from('products').select('id,title,description,price_xof,is_winner,is_featured,status,created_at,product_variants,product_options,minimum_order_quantity,original_currency,original_price_min,original_price_max,supplier_company,supplier_contact_id,brand,sku,model_number,origin_country,material,color,size,stock_quantity,product_condition,package_dimensions,package_weight,warranty,certifications,product_specs,product_images(image_url)').order('created_at', { ascending: false }).limit(300),
        admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      ]);
      const errors = [usersResult,ordersResult,importsResult,cargoResult,sellerResult,supplierResult,storesResult,storeProductsResult,supplierPaymentsResult,supplierContactsResult,supplierOrderMessagesResult,supplierMessagesResult,transactionsResult,conversationsResult,supportMessagesResult,productsResult].filter(x => x.error);
      if (errors.length) return json({ error: errors[0].error.message }, 400);
      const { data: categoriesData, error: categoriesError } = await admin.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order');
      if (categoriesError) return json({ error: categoriesError.message }, 400);
      const authUsers = authUsersResult.data?.users || [];
      const authById = new Map(authUsers.map(u => [u.id, { email: u.email || '', last_sign_in_at: u.last_sign_in_at || null }]));
      const users = (usersResult.data || []).map(u => ({ ...u, ...(authById.get(u.id) || {}) }));
      const userMap = new Map(users.map(u => [u.id, u]));
      return json({
        users, orders: ordersResult.data || [], imports: importsResult.data || [],
        cargo: cargoResult.data || [], sellerApplications: sellerResult.data || [],
        supplierApplications: supplierResult.data || [], stores: storesResult.data || [],
        storeProducts: storeProductsResult.data || [], supplierPayments: supplierPaymentsResult.data || [], supplierContacts: supplierContactsResult.data || [], supplierOrderMessages: supplierOrderMessagesResult.data || [], automationConfig: { aiConfigured: Boolean(Deno.env.get('OPENAI_API_KEY')), whatsappConfigured: Boolean(Deno.env.get('WHATSAPP_ACCESS_TOKEN') && Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') && Deno.env.get('WHATSAPP_TEMPLATE_NAME')) },
        supplierMessages: supplierMessagesResult.data || [], transactions: transactionsResult.data || [],
        conversations: (conversationsResult.data || []).map(c => ({ ...c, customer: userMap.get(c.user_id) || null })),
        supportMessages: supportMessagesResult.data || [], products: productsResult.data || [], categories: categoriesData || [],
        counts: {
          users: users.length, customers: users.filter(u => u.role === 'customer').length,
          sellers: users.filter(u => ['seller','dropshipper'].includes(u.role)).length,
          suppliers: users.filter(u => u.role === 'supplier').length,
          orders: (ordersResult.data || []).length,
          pendingOrders: (ordersResult.data || []).filter(o => !['delivered','cancelled','refunded'].includes(o.status)).length,
          deliveredOrders: (ordersResult.data || []).filter(o => o.status === 'delivered').length,
          revenueTrackedXof: (transactionsResult.data || []).filter(t => t.status === 'confirmed').reduce((sum,t) => sum + Number(t.amount_xof || 0), 0),
          openSupport: (conversationsResult.data || []).filter(c => c.status !== 'closed').length,
          pendingSupplierPayments: (supplierPaymentsResult.data || []).filter(p => p.status === 'due').length,
        }
      });
    }

    if (body.action === 'update_customer_payment_status') {
      if (!['pending','confirmed','failed','refunded'].includes(body.status)) return json({ error: 'Statut de paiement invalide.' }, 400);
      const { data: payment, error: paymentReadError } = await admin.from('payment_transactions')
        .select('id,user_id,order_id,amount_xof').eq('id', body.payment_id).single();
      if (paymentReadError || !payment) return json({ error: 'Paiement introuvable.' }, 404);
      const { error: paymentUpdateError } = await admin.from('payment_transactions').update({
        status: body.status, paid_at: body.status === 'confirmed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }).eq('id', payment.id);
      if (paymentUpdateError) return json({ error: paymentUpdateError.message }, 400);
      let supplierAutomation = null;
      if (body.status === 'confirmed' && payment.order_id) {
        const { data: order, error: orderError } = await admin.from('orders').select('id,order_number,customer_id').eq('id', payment.order_id).single();
        if (!orderError && order) {
          await admin.from('orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', order.id);
          await admin.from('notifications').insert({ user_id: order.customer_id, title: 'Paiement confirmé', body: 'Votre paiement pour la commande ' + order.order_number + ' est confirmé. ChinaGo prépare la commande auprès du fournisseur.', kind: 'order' });
          try { supplierAutomation = await prepareSupplierOrderMessages(admin, order.id, order.order_number); }
          catch (automationError) { supplierAutomation = { error: automationError instanceof Error ? automationError.message : 'Préparation fournisseur impossible.' }; }
        }
      }
      return json({ ok: true, supplierAutomation });
    }

    if (body.action === 'retry_supplier_order_messages') {
      const { data: order, error: orderError } = await admin.from('orders').select('id,order_number,status').eq('id', body.order_id).single();
      if (orderError || !order) return json({ error: 'Commande introuvable.' }, 404);
      if (order.status !== 'paid') return json({ error: 'Le message fournisseur ne peut être préparé qu’après confirmation du paiement.' }, 409);
      try {
        const supplierAutomation = await prepareSupplierOrderMessages(admin, order.id, order.order_number);
        return json({ ok: true, supplierAutomation });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Impossible de préparer le message fournisseur.' }, 400);
      }
    }

    if (body.action === 'save_supplier_contact') {
      const companyName = String(body.company_name || '').trim();
      if (!companyName) return json({ error: 'Le nom du fournisseur est obligatoire.' }, 400);
      const { data, error } = await admin.from('supplier_contacts').insert({
        company_name: companyName, contact_name: String(body.contact_name || '').trim() || null,
        email: String(body.email || '').trim() || null, phone: String(body.phone || '').trim() || null,
        whatsapp: String(body.whatsapp || '').trim() || null, country: String(body.country || 'China').trim(),
        website_url: String(body.website_url || '').trim() || null,
        payment_method: String(body.payment_method || '').trim() || null,
        payment_account_name: String(body.payment_account_name || '').trim() || null,
        payment_account_number: String(body.payment_account_number || '').trim() || null,
        payment_bank: String(body.payment_bank || '').trim() || null, payment_wallet: String(body.payment_wallet || '').trim() || null,
        payment_currency: String(body.payment_currency || 'CNY').trim().toUpperCase(),
        whatsapp_opt_in: body.whatsapp_opt_in === true, notes: String(body.notes || '').trim() || null, created_by: userId
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, supplier: data });
    }

    if (body.action === 'update_supplier_contact') {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.whatsapp_opt_in === 'boolean') updates.whatsapp_opt_in = body.whatsapp_opt_in;
      if (['active','inactive'].includes(body.status)) updates.status = body.status;
      const { error } = await admin.from('supplier_contacts').update(updates).eq('id', body.supplier_contact_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'save_supplier_payment') {
      const amount = Number(body.amount);
      if (!String(body.supplier_name || '').trim() || !Number.isFinite(amount) || amount < 0) return json({ error: 'Fournisseur et montant valides obligatoires.' }, 400);
      const status = ['due','paid','cancelled'].includes(body.status) ? body.status : 'due';
      const { data, error } = await admin.from('supplier_payments').insert({
        import_request_id: body.import_request_id || null, order_id: body.order_id || null,
        supplier_contact_id: body.supplier_contact_id || null,
        supplier_name: String(body.supplier_name).trim(), amount, currency: String(body.currency || 'CNY'),
        status, payment_method: body.payment_method || null, payment_reference: body.payment_reference || null,
        proof_url: body.proof_url || null, notes: body.notes || null, created_by: userId,
        paid_at: status === 'paid' ? new Date().toISOString() : null
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, payment: data });
    }

    if (body.action === 'update_supplier_payment') {
      if (!['due','paid','cancelled'].includes(body.status)) return json({ error: 'Statut de paiement invalide.' }, 400);
      const updates: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString(), paid_at: body.status === 'paid' ? new Date().toISOString() : null };
      if (body.payment_reference !== undefined) updates.payment_reference = String(body.payment_reference || '').trim() || null;
      if (body.notes !== undefined) updates.notes = String(body.notes || '').trim() || null;
      const { error } = await admin.from('supplier_payments').update(updates).eq('id', body.payment_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'reply_support_message') {
      const conversationId = String(body.conversation_id || '');
      const message = String(body.message || '').trim();
      if (!conversationId || !message) return json({ error: 'Conversation et message obligatoires.' }, 400);
      const { data: conversation, error: conversationError } = await admin.from('support_conversations').select('id,user_id').eq('id', conversationId).single();
      if (conversationError || !conversation) return json({ error: 'Conversation introuvable.' }, 404);
      const { error: messageError } = await admin.from('support_messages').insert({ conversation_id: conversationId, sender_id: userId, sender_role: 'admin', body: message });
      if (messageError) return json({ error: messageError.message }, 400);
      await admin.from('support_conversations').update({ status: 'waiting', updated_at: new Date().toISOString() }).eq('id', conversationId);
      await admin.from('notifications').insert({ user_id: conversation.user_id, title: 'Réponse de l’assistance ChinaGo', body: message.slice(0, 220), kind: 'support' });
      return json({ ok: true });
    }

    if (body.action === 'log_supplier_message') {
      const message = String(body.message_body || '').trim();
      if (!message || (!body.order_id && !body.import_request_id)) return json({ error: 'Message et commande ou importation obligatoires.' }, 400);
      const { error } = await admin.from('supplier_messages').insert({
        import_request_id: body.import_request_id || null, order_id: body.order_id || null,
        supplier_name: String(body.supplier_name || '').trim() || null,
        supplier_whatsapp: String(body.supplier_whatsapp || '').trim() || null,
        channel: body.channel === 'email' ? 'email' : body.channel === 'internal' ? 'internal' : 'whatsapp',
        direction: 'outbound', message_body: message, created_by: userId,
        sent_at: body.channel === 'internal' ? null : new Date().toISOString()
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Action non reconnue.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erreur interne.' }, 500);
  }
});

export default {
  fetch: async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
    return adminHandler(req);
  },
};
