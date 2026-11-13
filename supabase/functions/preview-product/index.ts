const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const allowedHosts = [
  'alibaba.com','aliexpress.com','amazon.com','amazon.fr','amazon.co.uk','amazon.de',
  'amazon.es','amazon.it','amazon.ca','amazon.co.jp','ebay.com','ebay.fr','ebay.de',
  'ebay.co.uk','ebay.ca','ebay.es','ebay.it','ebay.com.au','myshopify.com'
];
function allowedUrl(value: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Utilisez un lien HTTPS public et valide.');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || !allowedHosts.some(domain => host === domain || host.endsWith('.' + domain))) {
    throw new Error('Cette plateforme n’est pas encore prise en charge. Utilisez Alibaba, AliExpress, Amazon ou eBay.');
  }
  return u;
}
function decodeHtml(value: string) {
  return value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}
function clean(value: unknown) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === 'object' && value !== null) return (value as Record<string,unknown>).url || (value as Record<string,unknown>).contentUrl || null;
  return typeof value === 'string' ? decodeHtml(value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()) : null;
}
function meta(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (name !== key.toLowerCase()) continue;
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return decodeHtml(content.trim());
  }
  return null;
}
function jsonLdProducts(html: string) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const all: Record<string, any>[] = [];
  const walk = (v: any) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v !== 'object') return;
    const types = Array.isArray(v['@type']) ? v['@type'] : [v['@type']];
    if (types.some((t: string) => String(t).toLowerCase().includes('product'))) all.push(v);
    if (v['@graph']) walk(v['@graph']);
    if (v.itemListElement) walk(v.itemListElement);
  };
  for (const script of scripts) { try { walk(JSON.parse(script[1])); } catch { /* malformed structured data */ } }
  return all[0] || null;
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  try {
    const body = await req.json();
    const source = allowedUrl(String(body.url || ''));
    let response: Response | null = null;
    let target = source;
    for (let hop = 0; hop < 4; hop++) {
      response = await fetch(target.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(14000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ChinaGoProductPreview/1.0; +https://chinago-tby6.onrender.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      });
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) break;
        target = allowedUrl(new URL(location, target).toString());
        continue;
      }
      break;
    }
    if (!response) return json({ error: 'Le site fournisseur n’a pas répondu.' }, 502);
    if (!response.ok) return json({ error: 'Le site fournisseur a refusé la lecture automatique (HTTP ' + response.status + '). Vous pouvez conserver le lien et compléter les détails manuellement.', message: 'Le site fournisseur bloque la lecture automatique. ChinaGo conservera le lien et vérifiera la fiche manuellement.', blocked: true, extraction_status: 'blocked' }, 200);
    const html = (await response.text()).slice(0, 5_000_000);
    const product = jsonLdProducts(html);
    const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
    const seller = offers?.seller || product?.seller || {};
    const contactPoint = Array.isArray(seller?.contactPoint) ? seller.contactPoint[0] : (seller?.contactPoint || {});
    const sellerName = clean(seller?.name) || meta(html,'seller') || meta(html,'og:site_name');
    const supplierContactName = clean(contactPoint?.name) || clean(seller?.contactName) || null;
    const supplierPhone = clean(contactPoint?.telephone) || clean(seller?.telephone) || clean(seller?.phone) || null;
    const supplierEmail = clean(contactPoint?.email) || clean(seller?.email) || null;
    const supplierWhatsApp = clean(contactPoint?.whatsapp) || clean(seller?.whatsapp) || null;
    let supplierProfileUrl = clean(seller?.url) || clean(seller?.sameAs) || null;
    if (supplierProfileUrl) { try { supplierProfileUrl = new URL(supplierProfileUrl, target).toString(); } catch { supplierProfileUrl = null; } }
    const rawImages = [
      ...(Array.isArray(product?.image) ? product.image : product?.image ? [product.image] : []),
      meta(html,'og:image'), meta(html,'twitter:image'), meta(html,'og:image:url')
    ];
    const images = [...new Set(rawImages.map(x => typeof x === 'string' ? x : x?.url || x?.contentUrl).filter((x): x is string => typeof x === 'string' && x.startsWith('https://')))].slice(0,20);
    const title = clean(product?.name) || meta(html,'og:title') || meta(html,'twitter:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const description = clean(product?.description) || meta(html,'og:description') || meta(html,'description');
    const price = offers?.price ?? offers?.lowPrice ?? meta(html,'product:price:amount');
    const currency = offers?.priceCurrency || meta(html,'product:price:currency') || null;
    const variants = Array.isArray(product?.hasVariant) ? product.hasVariant.map((v: any) => ({
      name: clean(v.name), sku: clean(v.sku), price: v.offers?.price ?? null,
      image: typeof v.image === 'string' ? v.image : v.image?.url || null
    })) : [];
    const options = Array.isArray(product?.additionalProperty) ? product.additionalProperty.map((v: any) => ({
      name: clean(v.name), value: clean(v.value)
    })) : [];
    const brand = clean(product?.brand?.name || product?.brand);
    const availability = clean(offers?.availability);
    const specifications = Array.isArray(product?.additionalProperty) ? product.additionalProperty.reduce((acc: Record<string,string>, item: any) => {
      const name = clean(item?.name);
      const value = clean(item?.value);
      if (name && value) acc[name] = value;
      return acc;
    }, {}) : {};
    const weight = product?.weight?.value ?? product?.weight ?? null;
    const dimensions = product?.size || product?.dimensions || null;
    const condition = clean(offers?.itemCondition || product?.itemCondition);
    const platform = target.hostname.includes('alibaba') ? 'alibaba' : target.hostname.includes('aliexpress') ? 'aliexpress' : target.hostname.includes('amazon') ? 'amazon' : target.hostname.includes('ebay') ? 'ebay' : 'shopify';
    const found = Boolean(title || images.length || description);
    return json({
      ok: found, source_url: target.toString(), source_platform: platform,
      product_title: title || null, product_description: description || null,
      product_images: images, product_image_url: images[0] || null,
      product_variants: variants, product_options: options,
      original_price_min: offers?.lowPrice !== undefined ? Number(offers.lowPrice) : (price === null || price === undefined ? null : Number(price)),
      original_price_max: offers?.highPrice !== undefined ? Number(offers.highPrice) : (price === null || price === undefined ? null : Number(price)),
      original_currency: currency,
      supplier_company: sellerName || null,
      supplier_contact_name: supplierContactName,
      supplier_phone: supplierPhone,
      supplier_whatsapp: supplierWhatsApp,
      supplier_email: supplierEmail,
      supplier_profile_url: supplierProfileUrl,
      brand,
      sku: clean(product?.sku), model_number: clean(product?.mpn || product?.model),
      origin_country: clean(product?.countryOfOrigin?.name || product?.countryOfOrigin),
      material: clean(product?.material), color: clean(product?.color), size: clean(product?.size),
      stock_quantity: null, product_condition: condition,
      package_dimensions: typeof dimensions === 'string' ? clean(dimensions) : null,
      package_weight: typeof weight === 'number' ? weight : (typeof weight === 'string' ? Number(weight) || null : null),
      warranty: clean(product?.warranty), certifications: [],
      minimum_order_quantity: Number(product?.minimumOrderQuantity || specifications['Minimum Order Quantity'] || 0) || null,
      product_specs: specifications,
      extraction_status: found ? (title && images.length ? 'extracted' : 'partial') : 'blocked',
      extraction_source: 'open_graph_jsonld',
      message: found ? 'Informations publiques récupérées. Vérifiez les variantes et le prix avec le fournisseur.' : 'Le site n’a pas exposé de fiche produit lisible automatiquement. La demande peut être vérifiée manuellement.'
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Impossible de lire ce lien.' }, 400);
  }
});
