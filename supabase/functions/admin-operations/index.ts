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

    if (body.action === 'review_seller_application') {
      if (!['approved', 'rejected'].includes(body.status)) return json({ error: 'Statut invalide.' }, 400);
      const { data: application, error } = await admin
        .from('seller_applications')
        .select('id,user_id,account_type,business_name')
        .eq('id', body.application_id)
        .single();
      if (error || !application) return json({ error: 'Candidature introuvable.' }, 404);

      const { error: updateError } = await admin
        .from('seller_applications')
        .update({ status: body.status })
        .eq('id', application.id);
      if (updateError) return json({ error: updateError.message }, 400);

      if (body.status === 'approved') {
        const role = application.account_type === 'dropshipper' ? 'dropshipper' : 'seller';
        const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', application.user_id);
        if (roleError) return json({ error: roleError.message }, 400);
      }

      await admin.from('notifications').insert({
        user_id: application.user_id,
        title: body.status === 'approved' ? 'Candidature acceptée' : 'Candidature non retenue',
        body: body.status === 'approved'
          ? 'Votre espace vendeur/dropshipping ChinaGo est maintenant activé.'
          : 'Votre candidature ChinaGo n’a pas été retenue pour le moment.',
        kind: 'partner',
      });
      return json({ ok: true });
    }

    if (body.action === 'review_supplier_application') {
      if (!['approved', 'rejected'].includes(body.status)) return json({ error: 'Statut invalide.' }, 400);
      const { data: application, error } = await admin
        .from('supplier_applications')
        .select('id,user_id,company_name')
        .eq('id', body.application_id)
        .single();
      if (error || !application) return json({ error: 'Candidature fournisseur introuvable.' }, 404);

      const { error: updateError } = await admin
        .from('supplier_applications')
        .update({ status: body.status })
        .eq('id', application.id);
      if (updateError) return json({ error: updateError.message }, 400);

      if (body.status === 'approved') {
        const { error: roleError } = await admin.from('profiles').update({ role: 'supplier' }).eq('id', application.user_id);
        if (roleError) return json({ error: roleError.message }, 400);
      }

      await admin.from('notifications').insert({
        user_id: application.user_id,
        title: body.status === 'approved' ? 'Candidature fournisseur acceptée' : 'Candidature fournisseur non retenue',
        body: body.status === 'approved'
          ? 'Votre profil fournisseur ChinaGo est activé. Notre équipe vous contactera pour la suite.'
          : 'Votre candidature fournisseur ChinaGo n’a pas été retenue pour le moment.',
        kind: 'partner',
      });
      return json({ ok: true });
    }

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
      if (!['quote_requested', 'pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(body.status)) {
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
      return json({ ok: true });
    }

    if (body.action === 'update_import_request') {
      const allowed = ['submitted', 'needs_details', 'quoted', 'accepted', 'rejected', 'converted'];
      if (!allowed.includes(body.status)) return json({ error: 'Statut d’importation invalide.' }, 400);
      const { data: request, error: readError } = await admin.from('import_requests')
        .select('id,user_id').eq('id', body.request_id).single();
      if (readError || !request) return json({ error: 'Demande d’importation introuvable.' }, 404);
      const updates: Record<string, unknown> = {
        status: body.status,
        product_title: String(body.product_title || '').trim() || null,
        product_description: String(body.product_description || '').trim() || null,
        product_image_url: String(body.product_image_url || '').trim() || null,
        admin_notes: String(body.admin_notes || '').trim() || null,
        quoted_at: body.status === 'quoted' ? new Date().toISOString() : null,
      };
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
