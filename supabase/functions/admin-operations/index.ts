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
      const { error } = await admin.from('orders')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', body.order_id);
      if (error) return json({ error: error.message }, 400);
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
