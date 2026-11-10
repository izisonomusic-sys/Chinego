import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Activity, BadgeCheck, Bell, Box, CheckCircle2, ClipboardList, CreditCard, Headset,
  LayoutDashboard, LogOut, MessageCircle, Package, PackageCheck, RefreshCw, Search,
  ShieldCheck, Store, Truck, Users, Wallet, X
} from 'lucide-react';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;
const money = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value || 0)) + ' FCFA';
const date = value => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const imageList = item => {
  const values = Array.isArray(item?.product_images) ? item.product_images : [];
  const urls = values.map(v => typeof v === 'string' ? v : v?.image_url || v?.url).filter(Boolean);
  if (item?.product_image_url && !urls.includes(item.product_image_url)) urls.unshift(item.product_image_url);
  return urls;
};

const nav = [
  ['overview','Vue d’ensemble',LayoutDashboard], ['users','Utilisateurs',Users],
  ['orders','Commandes',ClipboardList], ['imports','Importations',Package],
  ['payments','Paiements',CreditCard], ['support','Assistance clients',Headset],
  ['suppliers','Fournisseurs',Store], ['cargo','Livraisons & cargo',Truck], ['stores','Boutiques',Store],
  ['products','Catalogue & gagnants',BadgeCheck]
];

export default function AdminPortal() {
  const [session,setSession] = useState(null);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [data,setData] = useState(null);
  const [tab,setTab] = useState('overview');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [search,setSearch] = useState('');
  const [selectedConversation,setSelectedConversation] = useState('');
  const [reply,setReply] = useState('');
  const [supplierPayment,setSupplierPayment] = useState({supplier_name:'',amount:'',currency:'CNY',order_id:'',import_request_id:'',payment_method:'Virement',payment_reference:'',notes:''});
  const [customerPayment,setCustomerPayment] = useState({user_id:'',order_id:'',amount_xof:'',payment_method:'',provider:'',provider_reference:'',notes:''});
  const [supplierMessage,setSupplierMessage] = useState({order_id:'',import_request_id:'',supplier_name:'',supplier_whatsapp:'',message_body:'',channel:'whatsapp'});
  const [productUrl,setProductUrl] = useState('');
  const [productPreview,setProductPreview] = useState(null);
  const [productPriceXof,setProductPriceXof] = useState('');
  const [productCategory,setProductCategory] = useState('');
  const [productWinner,setProductWinner] = useState(true);
  const [productSupplierContact,setProductSupplierContact] = useState('');
  const [supplierForm,setSupplierForm] = useState({company_name:'',contact_name:'',email:'',phone:'',whatsapp:'',country:'China',website_url:'',payment_method:'Bank transfer',payment_account_name:'',payment_account_number:'',payment_bank:'',payment_wallet:'',payment_currency:'CNY',whatsapp_opt_in:false,notes:''});
  const [manualProduct,setManualProduct] = useState({title:'',description:'',sku:'',brand:'',model_number:'',category_id:'',origin_country:'China',material:'',color:'',size:'',stock_quantity:'',product_condition:'New',package_dimensions:'',package_weight:'',warranty:'',certifications:'',minimum_order_quantity:'',original_currency:'CNY',original_price_min:'',original_price_max:'',price_xof:'',price_cny:'',supplier_contact_id:'',source_url:'',is_winner:false,product_specs:'{}'});
  const [manualImages,setManualImages] = useState([]);
  const [manualProductOpen,setManualProductOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError('');
    const {data:result,error:invokeError} = await supabase.functions.invoke('admin-operations',{body:{action:'dashboard_data'}});
    if (invokeError || result?.error) setError(invokeError?.message || result.error);
    else {
      setData(result);
      if (!selectedConversation && result.conversations?.length) setSelectedConversation(result.conversations[0].id);
    }
    setLoading(false);
  },[selectedConversation]);

  const verifySession = useCallback(async current => {
    if (!current || !supabase) { setSession(null); setData(null); return; }
    const {data:profile,error:profileError} = await supabase.from('profiles').select('role,full_name').eq('id',current.user.id).maybeSingle();
    if (profileError || profile?.role !== 'admin') {
      await supabase.auth.signOut();
      setSession(null); setData(null);
      setError('Ce compte ne possède pas les droits administrateur.');
      return;
    }
    setSession(current);
    await loadData();
  },[loadData]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data:result}) => verifySession(result.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => {
      if (!next) { setSession(null); setData(null); }
      else setSession(next);
    });
    return () => subscription.unsubscribe();
  },[verifySession]);

  async function signIn(e) {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    if (!supabase) { setError('Connexion Supabase indisponible.'); setLoading(false); return; }
    const {data:result,error:authError} = await supabase.auth.signInWithPassword({email,password});
    if (authError) { setError(authError.message); setLoading(false); return; }
    setPassword('');
    await verifySession(result.session);
    setLoading(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setData(null); setSuccess('');
  }

  async function action(body, message) {
    setLoading(true); setError(''); setSuccess('');
    const {data:result,error:invokeError} = await supabase.functions.invoke('admin-operations',{body});
    if (invokeError || result?.error) setError(invokeError?.message || result.error);
    else { setSuccess(message); await loadData(); }
    setLoading(false);
  }


  async function saveSupplierContact(e) {
    e.preventDefault();
    await action({action:'save_supplier_contact',...supplierForm},'Fournisseur enregistré dans votre répertoire.');
    setSupplierForm({company_name:'',contact_name:'',email:'',phone:'',whatsapp:'',country:'China',website_url:'',payment_method:'Bank transfer',payment_account_name:'',payment_account_number:'',payment_bank:'',payment_wallet:'',payment_currency:'CNY',whatsapp_opt_in:false,notes:''});
  }

  async function saveManualProduct(e) {
    e.preventDefault();
    if (!manualProduct.title.trim()) { setError('Le nom du produit est obligatoire.'); return; }
    setLoading(true); setError(''); setSuccess('');
    const slug=manualProduct.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomUUID().slice(0,8);
    const uploaded=[];
    for (const file of manualImages) {
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
      const path='admin/'+Date.now()+'-'+crypto.randomUUID()+'-'+safe;
      const {error:uploadError}=await supabase.storage.from('chinago-product-images').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError){setError('Échec du téléversement de '+file.name+' : '+uploadError.message);setLoading(false);return;}
      uploaded.push(supabase.storage.from('chinago-product-images').getPublicUrl(path).data.publicUrl);
    }
    let specs={};
    try { specs=JSON.parse(manualProduct.product_specs||'{}'); if(!specs||Array.isArray(specs)||typeof specs!=='object') throw new Error(); }
    catch { setError('Les caractéristiques complémentaires doivent être un objet JSON valide.');setLoading(false);return; }
    const {data:created,error:createError}=await supabase.from('products').insert({
      title:manualProduct.title.trim(),slug,description:manualProduct.description||null,category_id:manualProduct.category_id||null,
      source_url:manualProduct.source_url||null,source_platform:manualProduct.source_url?'other':null,
      sku:manualProduct.sku||null,brand:manualProduct.brand||null,model_number:manualProduct.model_number||null,
      origin_country:manualProduct.origin_country||null,material:manualProduct.material||null,color:manualProduct.color||null,size:manualProduct.size||null,
      stock_quantity:manualProduct.stock_quantity===''?null:Number(manualProduct.stock_quantity),product_condition:manualProduct.product_condition||'New',
      package_dimensions:manualProduct.package_dimensions||null,package_weight:manualProduct.package_weight===''?null:Number(manualProduct.package_weight),
      warranty:manualProduct.warranty||null,certifications:manualProduct.certifications.split(',').map(x=>x.trim()).filter(Boolean),
      product_specs:specs,minimum_order_quantity:manualProduct.minimum_order_quantity===''?null:Number(manualProduct.minimum_order_quantity),
      original_currency:manualProduct.original_currency||'CNY',original_price_min:manualProduct.original_price_min===''?null:Number(manualProduct.original_price_min),
      original_price_max:manualProduct.original_price_max===''?null:Number(manualProduct.original_price_max),
      price_xof:manualProduct.price_xof===''?null:Number(manualProduct.price_xof),price_cny:manualProduct.price_cny===''?null:Number(manualProduct.price_cny),
      currency:'XOF',supplier_contact_id:manualProduct.supplier_contact_id||null,
      supplier_company:(data?.supplierContacts||[]).find(x=>x.id===manualProduct.supplier_contact_id)?.company_name||null,
      is_winner:manualProduct.is_winner,is_featured:manualProduct.is_winner,status:'active'
    }).select('id').single();
    if(createError){setError(createError.message);setLoading(false);return;}
    if(uploaded.length){
      const {error:imageError}=await supabase.from('product_images').insert(uploaded.map((image_url,index)=>({product_id:created.id,image_url,alt_text:manualProduct.title+' '+(index+1),sort_order:index})));
      if(imageError){setError('Produit enregistré, mais les images n’ont pas toutes été associées : '+imageError.message);setLoading(false);await loadData();return;}
    }
    setManualProduct({title:'',description:'',sku:'',brand:'',model_number:'',category_id:'',origin_country:'China',material:'',color:'',size:'',stock_quantity:'',product_condition:'New',package_dimensions:'',package_weight:'',warranty:'',certifications:'',minimum_order_quantity:'',original_currency:'CNY',original_price_min:'',original_price_max:'',price_xof:'',price_cny:'',supplier_contact_id:'',source_url:'',is_winner:false,product_specs:'{}'});
    setManualImages([]);setManualProductOpen(false);setSuccess('Produit ajouté au catalogue avec ses images.');await loadData();setLoading(false);
  }

  async function saveSupplierPayment(e) {
    e.preventDefault();
    await action({action:'save_supplier_payment',...supplierPayment,supplier_name:data?.supplierContacts?.find(x=>x.id===supplierPayment.supplier_contact_id)?.company_name||supplierPayment.supplier_name,amount:Number(supplierPayment.amount)},'Paiement fournisseur enregistré.');
    setSupplierPayment({supplier_contact_id:'',supplier_name:'',amount:'',currency:'CNY',order_id:'',import_request_id:'',payment_method:'Virement',payment_reference:'',notes:''});
  }

  async function addCustomerPayment(e) {
    e.preventDefault();
    if (!customerPayment.user_id || Number(customerPayment.amount_xof)<0) { setError('Sélectionnez un client et un montant valide.'); return; }
    setLoading(true); setError(''); setSuccess('');
    const {error:insertError} = await supabase.from('payment_transactions').insert({
      ...customerPayment, amount_xof:Number(customerPayment.amount_xof), order_id:customerPayment.order_id || null,
      status:'pending', created_by:session.user.id
    });
    if (insertError) setError(insertError.message);
    else { setSuccess('Paiement client ajouté au registre.'); setCustomerPayment({user_id:'',order_id:'',amount_xof:'',payment_method:'',provider:'',provider_reference:'',notes:''}); await loadData(); }
    setLoading(false);
  }

  async function replySupport(e) {
    e.preventDefault();
    if (!selectedConversation || !reply.trim()) return;
    await action({action:'reply_support_message',conversation_id:selectedConversation,message:reply.trim()},'Réponse envoyée au client.');
    setReply('');
  }

  async function logSupplierMessage(e) {
    e.preventDefault();
    await action({action:'log_supplier_message',...supplierMessage},'Message fournisseur enregistré dans l’historique.');
    setSupplierMessage({order_id:'',import_request_id:'',supplier_name:'',supplier_whatsapp:'',message_body:'',channel:'whatsapp'});
  }


  async function analyzeCatalogProduct(e) {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    const {data:result,error:invokeError} = await supabase.functions.invoke('preview-product',{body:{url:productUrl}});
    if (invokeError || result?.error) setError(invokeError?.message || result.error);
    else { setProductPreview(result); setSuccess(result.message || 'Analyse terminée. Vérifiez les données avant publication.'); }
    setLoading(false);
  }

  async function publishCatalogProduct(e) {
    e.preventDefault();
    if (!productPreview?.product_title) { setError('Le lien ne fournit pas de nom de produit. Complétez ou vérifiez les informations avant publication.'); return; }
    setLoading(true); setError(''); setSuccess('');
    const title = productPreview.product_title.trim();
    const slug = title.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + crypto.randomUUID().slice(0,8);
    const {data:created,error:createError} = await supabase.from('products').insert({
      title,slug,description:productPreview.product_description || null,category_id:productCategory || null,
      source_url:productPreview.source_url || productUrl,source_platform:productPreview.source_platform || 'other',
      price_cny:productPreview.original_currency === 'CNY' ? productPreview.original_price_min : null,
      price_xof:productPriceXof ? Number(productPriceXof) : null,currency:'XOF',
      is_winner:productWinner,is_featured:productWinner,status:'active',
      product_variants:productPreview.product_variants || [],product_options:productPreview.product_options || [],
      minimum_order_quantity:productPreview.minimum_order_quantity || null,
      original_currency:productPreview.original_currency || null,
      original_price_min:productPreview.original_price_min ?? null,
      original_price_max:productPreview.original_price_max ?? null,
      supplier_company:productPreview.supplier_company || null,supplier_contact_id:productSupplierContact || null,
      brand:productPreview.brand || null,sku:productPreview.sku || null,model_number:productPreview.model_number || null,
      origin_country:productPreview.origin_country || null,material:productPreview.material || null,color:productPreview.color || null,
      size:productPreview.size || null,stock_quantity:productPreview.stock_quantity ?? null,product_condition:productPreview.product_condition || null,
      package_dimensions:productPreview.package_dimensions || null,package_weight:productPreview.package_weight ?? null,
      warranty:productPreview.warranty || null,certifications:productPreview.certifications || [],product_specs:productPreview.product_specs || {}
    }).select('id').single();
    if (createError) { setError(createError.message); setLoading(false); return; }
    const images = (productPreview.product_images || []).map(v=>typeof v==='string'?v:v?.image_url||v?.url).filter(Boolean);
    if (images.length) {
      const {error:imageError} = await supabase.from('product_images').insert(images.map((image_url,index)=>({product_id:created.id,image_url,alt_text:title+' '+(index+1),sort_order:index})));
      if (imageError) { setError('Produit créé, mais une partie des images n’a pas été enregistrée : '+imageError.message); setLoading(false); await loadData(); return; }
    }
    setProductUrl('');setProductPreview(null);setProductPriceXof('');setProductCategory('');setProductWinner(true);setProductSupplierContact('');
    setSuccess('Produit publié dans le catalogue ChinaGo.');await loadData();setLoading(false);
  }

  const counts = data?.counts || {};
  const filteredUsers = useMemo(() => (data?.users || []).filter(u => [u.full_name,u.email,u.phone,u.role].join(' ').toLowerCase().includes(search.toLowerCase())),[data,search]);
  const activeConversation = data?.conversations?.find(c => c.id === selectedConversation);
  const activeMessages = (data?.supportMessages || []).filter(m => m.conversation_id === selectedConversation);
  const customerName = id => { const u=data?.users?.find(x=>x.id===id); return u?.full_name || u?.email || id?.slice(0,8) || 'Client'; };

  if (!session) return <div className="ca-login-shell">
    <section className="ca-login-card">
      <div className="ca-brand-mark">CG</div>
      <span className="ca-eyebrow">ZONE PRIVÉE · CHINAGO</span>
      <h1>Administration</h1>
      <p>Connectez-vous avec votre compte administrateur. Cet espace est séparé du site client.</p>
      {error && <div className="ca-alert ca-alert-error">{error}</div>}
      <form onSubmit={signIn}>
        <label>Adresse e-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@chinago.tg"/></label>
        <label>Mot de passe<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Votre mot de passe"/></label>
        <button className="ca-primary" disabled={loading}>{loading?'Vérification…':'Ouvrir le tableau de bord'}</button>
      </form>
      <small>Accès réservé aux comptes dont le rôle administrateur est confirmé dans ChinaGo.</small>
    </section>
  </div>;

  return <div className="ca-shell">
    <aside className="ca-sidebar">
      <div className="ca-logo"><span>CG</span><div><b>ChinaGo</b><small>ADMINISTRATION</small></div></div>
      <div className="ca-admin-profile"><span><ShieldCheck/></span><div><b>Administrateur</b><small>{session.user.email}</small></div></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={18}/>{label}{id==='support'&&counts.openSupport>0&&<i>{counts.openSupport}</i>}</button>)}</nav>
      <button className="ca-logout" onClick={signOut}><LogOut size={17}/> Déconnexion</button>
    </aside>
    <main className="ca-main">
      <header className="ca-topbar"><div><span className="ca-eyebrow">CENTRE DE CONTRÔLE</span><h1>{nav.find(n=>n[0]===tab)?.[1] || 'Administration'}</h1></div><div><button className="ca-refresh" onClick={loadData} disabled={loading}><RefreshCw size={16}/> Actualiser</button><span className="ca-secure"><ShieldCheck size={15}/> Session sécurisée</span></div></header>
      {error&&<div className="ca-alert ca-alert-error">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}
      {success&&<div className="ca-alert ca-alert-success">{success}<button onClick={()=>setSuccess('')}><X size={15}/></button></div>}
      {loading&&!data&&<div className="ca-loading">Chargement des données ChinaGo…</div>}
      {tab==='overview'&&<>
        <div className="ca-welcome"><div><h2>Bienvenue dans votre centre de contrôle.</h2><p>Suivez l’activité de ChinaGo depuis un espace réservé à l’administration.</p></div><span><Activity size={27}/></span></div>
        <div className="ca-stats">
          <article><Users/><small>Utilisateurs inscrits</small><b>{counts.users||0}</b></article>
          <article><ClipboardList/><small>Total des commandes</small><b>{counts.orders||0}</b></article>
          <article><PackageCheck/><small>Commandes en cours</small><b>{counts.pendingOrders||0}</b></article>
          <article><Truck/><small>Commandes livrées</small><b>{counts.deliveredOrders||0}</b></article>
          <article><Wallet/><small>Paiements confirmés suivis</small><b>{money(counts.revenueTrackedXof)}</b></article>
          <article><Headset/><small>Conversations ouvertes</small><b>{counts.openSupport||0}</b></article>
          <article><CreditCard/><small>Paiements fournisseurs dus</small><b>{counts.pendingSupplierPayments||0}</b></article>
          <article><Store/><small>Fournisseurs inscrits</small><b>{data?.supplierApplications?.length||0}</b></article>
        </div>
        <div className="ca-grid-two"><section className="ca-card"><h2>Commandes récentes</h2>{(data?.orders||[]).slice(0,6).map(o=><div className="ca-row" key={o.id}><div><b>{o.order_number}</b><small>{o.contact_name||customerName(o.customer_id)} · {o.status}</small></div><strong>{money(o.total_xof)}</strong></div>)}</section><section className="ca-card"><h2>Dernières demandes d’importation</h2>{(data?.imports||[]).slice(0,6).map(i=><div className="ca-row" key={i.id}><div><b>{i.product_title||i.source_platform}</b><small>{customerName(i.user_id)} · {i.status}</small></div><a href={i.source_url} target="_blank" rel="noreferrer">Ouvrir ↗</a></div>)}</section></div>
      </>}
      {tab==='users'&&<section className="ca-card"><div className="ca-card-head"><div><h2>Comptes inscrits</h2><p>{filteredUsers.length} résultat(s) · {counts.users||0} comptes connus</p></div><label className="ca-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, e-mail, téléphone…"/></label></div><div className="ca-table-wrap"><table><thead><tr><th>Utilisateur</th><th>Téléphone</th><th>Rôle</th><th>Inscription</th><th>Dernière connexion</th></tr></thead><tbody>{filteredUsers.map(u=><tr key={u.id}><td><b>{u.full_name||'Sans nom'}</b><small>{u.email||u.id}</small></td><td>{u.phone||'—'}</td><td><span className="ca-pill">{u.role}</span></td><td>{date(u.created_at)}</td><td>{date(u.last_sign_in_at)}</td></tr>)}</tbody></table></div></section>}
      {tab==='orders'&&<section className="ca-card"><h2>Gestion des commandes</h2><p>Changez le statut et enregistrez les montants validés avant de demander le paiement au client.</p>{(data?.orders||[]).map(o=><form className="ca-order" key={o.id} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);action({action:'update_order_status',order_id:o.id,status:f.get('status'),subtotal_xof:Number(f.get('subtotal')),shipping_xof:Number(f.get('shipping')),total_xof:Number(f.get('subtotal'))+Number(f.get('shipping'))},'Commande mise à jour et client notifié.')}}><div><b>{o.order_number} · {customerName(o.customer_id)}</b><small>{o.order_items?.map(x=>x.product_title+' × '+x.quantity).join(', ')||'Commande sans détail'} · {o.tracking_code||'Suivi à générer'}</small><small>{o.delivery_city||''} {o.delivery_address||''}</small></div><label>Statut<select name="status" defaultValue={o.status}>{['quote_requested','pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded'].map(s=><option key={s} value={s}>{s}</option>)}</select></label><label>Produits FCFA<input name="subtotal" type="number" min="0" defaultValue={o.subtotal_xof||0}/></label><label>Transport FCFA<input name="shipping" type="number" min="0" defaultValue={o.shipping_xof||0}/></label><strong>{money(o.total_xof)}</strong><button className="ca-primary">Enregistrer</button></form>)}</section>}
      {tab==='imports'&&<section className="ca-card"><h2>Importations et aperçu produit</h2><p>Les données ci-dessous sont celles enregistrées ou vérifiées par l’équipe ChinaGo.</p>{(data?.imports||[]).map(i=><article className="ca-import" key={i.id}><div className="ca-import-head"><div><b>{i.product_title||'Produit à identifier'}</b><small>{customerName(i.user_id)} · {i.source_platform} · {i.status}</small><a href={i.source_url} target="_blank" rel="noreferrer">{i.source_url}</a></div><span className="ca-pill">{i.extraction_status||'À vérifier'}</span></div>{imageList(i).length>0&&<div className="ca-gallery">{imageList(i).slice(0,6).map((src,n)=><img key={n} src={src} alt={i.product_title||'Produit importé'}/>)}</div>}<div className="ca-import-meta"><span>Prix source : {i.original_price_min??'—'} {i.original_currency||''}</span><span>MOQ : {i.minimum_order_quantity||'—'}</span><span>Prix client : {money(i.unit_price_xof)}</span><span>Fournisseur : {i.supplier_company||'Non renseigné'}</span></div>{i.product_description&&<p>{i.product_description}</p>}<details><summary>Variantes et options</summary><pre>{JSON.stringify({variants:i.product_variants||[],options:i.product_options||[]},null,2)}</pre></details><details className="ca-import-edit"><summary>Modifier la fiche et le devis</summary><form className="ca-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);action({action:'update_import_request',request_id:i.id,status:f.get('status'),product_title:f.get('title'),product_description:f.get('description'),product_image_url:f.get('image'),product_images_json:f.get('images'),product_variants_json:f.get('variants'),product_options_json:f.get('options'),minimum_order_quantity:f.get('moq'),original_currency:f.get('currency'),original_price_min:f.get('source_min'),original_price_max:f.get('source_max'),supplier_company:f.get('supplier'),supplier_contact_name:f.get('contact'),supplier_phone:f.get('phone'),supplier_whatsapp:f.get('whatsapp'),supplier_email:f.get('email'),supplier_profile_url:f.get('profile'),quantity:f.get('quantity'),unit_price_xof:f.get('unit_price'),shipping_estimate_xof:f.get('shipping'),admin_notes:f.get('notes')},'Fiche d’importation mise à jour et client notifié.')}}><label>Statut<select name="status" defaultValue={i.status}>{['submitted','needs_details','quoted','accepted','rejected','converted'].map(s=><option key={s}>{s}</option>)}</select></label><label>Nom du produit<input name="title" defaultValue={i.product_title||''}/></label><label>Description<textarea name="description" defaultValue={i.product_description||''}/></label><label>Image principale<input name="image" defaultValue={i.product_image_url||''}/></label><label>Galerie JSON<textarea name="images" defaultValue={JSON.stringify(i.product_images||[],null,2)}/></label><label>Variantes JSON<textarea name="variants" defaultValue={JSON.stringify(i.product_variants||[],null,2)}/></label><label>Options JSON<textarea name="options" defaultValue={JSON.stringify(i.product_options||[],null,2)}/></label><div className="ca-form-row"><label>Quantité minimale<input name="moq" type="number" min="1" defaultValue={i.minimum_order_quantity||''}/></label><label>Devise source<input name="currency" defaultValue={i.original_currency||'CNY'}/></label></div><div className="ca-form-row"><label>Prix source min<input name="source_min" type="number" min="0" step="0.01" defaultValue={i.original_price_min??''}/></label><label>Prix source max<input name="source_max" type="number" min="0" step="0.01" defaultValue={i.original_price_max??''}/></label></div><label>Entreprise fournisseur<input name="supplier" defaultValue={i.supplier_company||''}/></label><label>Contact fournisseur<input name="contact" defaultValue={i.supplier_contact_name||''}/></label><div className="ca-form-row"><label>Téléphone<input name="phone" defaultValue={i.supplier_phone||''}/></label><label>WhatsApp<input name="whatsapp" defaultValue={i.supplier_whatsapp||''}/></label></div><div className="ca-form-row"><label>E-mail<input name="email" defaultValue={i.supplier_email||''}/></label><label>Profil fournisseur<input name="profile" defaultValue={i.supplier_profile_url||''}/></label></div><div className="ca-form-row"><label>Quantité client<input name="quantity" type="number" min="1" defaultValue={i.quantity||1}/></label><label>Prix unitaire client FCFA<input name="unit_price" type="number" min="0" defaultValue={i.unit_price_xof??''}/></label></div><label>Transport estimé FCFA<input name="shipping" type="number" min="0" defaultValue={i.shipping_estimate_xof??''}/></label><label>Note client<textarea name="notes" defaultValue={i.admin_notes||''}/></label><button className="ca-primary">Enregistrer et notifier</button></form></details></article>)}</section>}
      {tab==='payments'&&<div className="ca-grid-two">
        <section className="ca-card"><h2>Enregistrer un paiement fournisseur</h2><p>Registre de suivi. L’envoi réel de l’argent doit être effectué via votre banque ou prestataire.</p><form className="ca-form" onSubmit={saveSupplierPayment}><label>Fournisseur enregistré<select required value={supplierPayment.supplier_contact_id||''} onChange={e=>{const s=(data?.supplierContacts||[]).find(x=>x.id===e.target.value);setSupplierPayment({...supplierPayment,supplier_contact_id:e.target.value,supplier_name:s?.company_name||'',currency:s?.payment_currency||'CNY'})}}><option value="">Choisir un fournisseur</option>{(data?.supplierContacts||[]).map(s=><option key={s.id} value={s.id}>{s.company_name} · {s.country}</option>)}</select></label><div className="ca-form-row"><label>Montant<input required type="number" min="0" step="0.01" value={supplierPayment.amount} onChange={e=>setSupplierPayment({...supplierPayment,amount:e.target.value})}/></label><label>Devise<input value={supplierPayment.currency} onChange={e=>setSupplierPayment({...supplierPayment,currency:e.target.value.toUpperCase()})}/></label></div><label>Commande liée<select value={supplierPayment.order_id} onChange={e=>setSupplierPayment({...supplierPayment,order_id:e.target.value})}><option value="">Aucune</option>{(data?.orders||[]).map(o=><option key={o.id} value={o.id}>{o.order_number}</option>)}</select></label><label>Référence de paiement<input value={supplierPayment.payment_reference} onChange={e=>setSupplierPayment({...supplierPayment,payment_reference:e.target.value})}/></label><label>Notes<textarea value={supplierPayment.notes} onChange={e=>setSupplierPayment({...supplierPayment,notes:e.target.value})}/></label><button className="ca-primary">Ajouter le paiement</button></form></section>
        <section className="ca-card"><h2>Registre des paiements clients</h2><p>Ajoutez une trace lorsqu’un paiement est reçu hors plateforme. Ce registre ne déclenche aucun prélèvement.</p><form className="ca-form" onSubmit={addCustomerPayment}><label>Client<select required value={customerPayment.user_id} onChange={e=>setCustomerPayment({...customerPayment,user_id:e.target.value})}><option value="">Sélectionner un client</option>{(data?.users||[]).map(u=><option key={u.id} value={u.id}>{u.full_name||u.email||u.id}</option>)}</select></label><label>Commande liée<select value={customerPayment.order_id} onChange={e=>setCustomerPayment({...customerPayment,order_id:e.target.value})}><option value="">Aucune</option>{(data?.orders||[]).map(o=><option key={o.id} value={o.id}>{o.order_number}</option>)}</select></label><label>Montant reçu (FCFA)<input required type="number" min="0" value={customerPayment.amount_xof} onChange={e=>setCustomerPayment({...customerPayment,amount_xof:e.target.value})}/></label><label>Moyen de paiement<input value={customerPayment.payment_method} onChange={e=>setCustomerPayment({...customerPayment,payment_method:e.target.value})} placeholder="TMoney, Flooz, virement…"/></label><label>Référence<input value={customerPayment.provider_reference} onChange={e=>setCustomerPayment({...customerPayment,provider_reference:e.target.value})}/></label><button className="ca-primary">Enregistrer le paiement reçu</button></form></section>
        <section className="ca-card"><h2>Paiements fournisseurs</h2>{(data?.supplierPayments||[]).map(p=><div className="ca-row" key={p.id}><div><b>{p.supplier_name}</b><small>{p.currency} {p.amount} · {p.payment_reference||'Sans référence'} · {p.status}</small></div><select value={p.status} onChange={e=>action({action:'update_supplier_payment',payment_id:p.id,status:e.target.value},'Statut du paiement fournisseur modifié.')}><option value="due">À payer</option><option value="paid">Payé</option><option value="cancelled">Annulé</option></select></div>)}</section>
        <section className="ca-card"><h2>Paiements clients suivis</h2>{(data?.transactions||[]).map(p=><div className="ca-row" key={p.id}><div><b>{customerName(p.user_id)}</b><small>{money(p.amount_xof)} · {p.payment_method||'Moyen non précisé'} · {p.status}</small></div><select value={p.status} onChange={e=>action({action:'update_customer_payment_status',payment_id:p.id,status:e.target.value},'Statut du paiement mis à jour.')}><option value="pending">En attente</option><option value="confirmed">Confirmé</option><option value="failed">Échoué</option><option value="refunded">Remboursé</option></select></div>)}</section>
      </div>}
      {tab==='support'&&<div className="ca-support-layout"><section className="ca-card ca-inbox"><h2>Conversations clients</h2>{(data?.conversations||[]).map(c=><button key={c.id} className={selectedConversation===c.id?'active':''} onClick={()=>setSelectedConversation(c.id)}><b>{c.customer?.full_name||c.customer?.email||'Client'}</b><small>{c.subject} · {c.status}</small></button>)}</section><section className="ca-card ca-chat"><h2>{activeConversation?.customer?.full_name||activeConversation?.customer?.email||'Sélectionnez une conversation'}</h2><div className="ca-chat-history">{activeMessages.map(m=><div className={'ca-bubble '+(m.sender_role==='admin'?'mine':'')} key={m.id}><small>{m.sender_role==='admin'?'ChinaGo':'Client'} · {date(m.created_at)}</small><p>{m.body}</p></div>)}</div>{activeConversation&&<form className="ca-reply" onSubmit={replySupport}><textarea required value={reply} onChange={e=>setReply(e.target.value)} placeholder="Écrire une réponse au client…"/><button className="ca-primary">Envoyer la réponse <MessageCircle size={16}/></button></form>}</section></div>}
      {tab==='suppliers'&&<div className="ca-grid-two">
        <section className="ca-card"><h2>Répertoire des fournisseurs</h2><p>Enregistrez les coordonnées et les informations de paiement de vos fournisseurs pour les retrouver dans le registre.</p><form className="ca-form" onSubmit={saveSupplierContact}><label>Entreprise / fournisseur *<input required value={supplierForm.company_name} onChange={e=>setSupplierForm({...supplierForm,company_name:e.target.value})}/></label><div className="ca-form-row"><label>Contact<input value={supplierForm.contact_name} onChange={e=>setSupplierForm({...supplierForm,contact_name:e.target.value})}/></label><label>Pays<input value={supplierForm.country} onChange={e=>setSupplierForm({...supplierForm,country:e.target.value})}/></label></div><div className="ca-form-row"><label>E-mail<input type="email" value={supplierForm.email} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})}/></label><label>Téléphone<input value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm,phone:e.target.value})}/></label></div><label>WhatsApp<input value={supplierForm.whatsapp} onChange={e=>setSupplierForm({...supplierForm,whatsapp:e.target.value})}/></label><label>Site / profil fournisseur<input type="url" value={supplierForm.website_url} onChange={e=>setSupplierForm({...supplierForm,website_url:e.target.value})}/></label><h3>Coordonnées de paiement</h3><label>Moyen de paiement<input value={supplierForm.payment_method} onChange={e=>setSupplierForm({...supplierForm,payment_method:e.target.value})} placeholder="Virement bancaire, Alipay…"/></label><div className="ca-form-row"><label>Nom du bénéficiaire<input value={supplierForm.payment_account_name} onChange={e=>setSupplierForm({...supplierForm,payment_account_name:e.target.value})}/></label><label>Devise<input value={supplierForm.payment_currency} onChange={e=>setSupplierForm({...supplierForm,payment_currency:e.target.value.toUpperCase()})}/></label></div><label>Numéro de compte / identifiant<input value={supplierForm.payment_account_number} onChange={e=>setSupplierForm({...supplierForm,payment_account_number:e.target.value})}/></label><div className="ca-form-row"><label>Banque<input value={supplierForm.payment_bank} onChange={e=>setSupplierForm({...supplierForm,payment_bank:e.target.value})}/></label><label>Wallet / Alipay / WeChat Pay<input value={supplierForm.payment_wallet} onChange={e=>setSupplierForm({...supplierForm,payment_wallet:e.target.value})}/></label></div><label className="ca-winner-check"><input type="checkbox" checked={supplierForm.whatsapp_opt_in} onChange={e=>setSupplierForm({...supplierForm,whatsapp_opt_in:e.target.checked})}/> Le fournisseur accepte les messages WhatsApp ChinaGo</label><label>Notes<textarea value={supplierForm.notes} onChange={e=>setSupplierForm({...supplierForm,notes:e.target.value})}/></label><button className="ca-primary">Enregistrer ce fournisseur</button></form></section>
        <section className="ca-card"><h2>Fournisseurs enregistrés ({(data?.supplierContacts||[]).length})</h2>{(data?.supplierContacts||[]).map(s=><article className="ca-supplier-card" key={s.id}><b>{s.company_name}</b><small>{s.contact_name||'Contact non renseigné'} · {s.country} · {s.status}</small><small>{s.email||'Sans e-mail'} · {s.phone||'Sans téléphone'} · WhatsApp : {s.whatsapp||'—'}</small><small>Paiement : {s.payment_method||'—'} · {s.payment_currency} · {s.payment_account_name||'—'} · {s.payment_account_number||s.payment_wallet||'—'}</small><small>WhatsApp autorisé : {s.whatsapp_opt_in?'Oui':'Non'}</small></article>)}</section>
        <section className="ca-card"><h2>Messages automatiques liés aux commandes</h2><p>Les messages sont préparés lorsque la commande passe au statut « payé ». L’envoi réel attend la configuration officielle WhatsApp.</p>{(data?.supplierOrderMessages||[]).map(m=><article className="ca-row" key={m.id}><div><b>{m.supplier_name} · {m.status}</b><small>{m.message_body}</small><small>{m.error_message||'Message préparé automatiquement'}</small></div>{m.status!=='sent'&&<button className="ca-secondary" onClick={()=>action({action:'retry_supplier_order_messages',order_id:m.order_id},'Préparation du message fournisseur relancée.')}>Relancer</button>}</article>)}</section>
        <section className="ca-card"><h2>Historique des échanges fournisseur</h2>{(data?.supplierMessages||[]).map(m=><div className="ca-row" key={m.id}><div><b>{m.supplier_name||'Fournisseur'} · {m.channel}</b><small>{m.message_body}</small></div></div>)}</section>
        <section className="ca-card"><h2>Préparer un message fournisseur</h2><form className="ca-form" onSubmit={logSupplierMessage}><label>Commande<select value={supplierMessage.order_id} onChange={e=>setSupplierMessage({...supplierMessage,order_id:e.target.value,import_request_id:''})}><option value="">Aucune</option>{(data?.orders||[]).map(o=><option key={o.id} value={o.id}>{o.order_number}</option>)}</select></label><label>Importation<select value={supplierMessage.import_request_id} onChange={e=>setSupplierMessage({...supplierMessage,import_request_id:e.target.value,order_id:''})}><option value="">Aucune</option>{(data?.imports||[]).map(i=><option key={i.id} value={i.id}>{i.product_title||i.source_platform}</option>)}</select></label><label>Nom fournisseur<input value={supplierMessage.supplier_name} onChange={e=>setSupplierMessage({...supplierMessage,supplier_name:e.target.value})}/></label><label>WhatsApp fournisseur<input value={supplierMessage.supplier_whatsapp} onChange={e=>setSupplierMessage({...supplierMessage,supplier_whatsapp:e.target.value})}/></label><label>Message<textarea required value={supplierMessage.message_body} onChange={e=>setSupplierMessage({...supplierMessage,message_body:e.target.value})}/></label><label>Canal<select value={supplierMessage.channel} onChange={e=>setSupplierMessage({...supplierMessage,channel:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="internal">Note interne</option></select></label><button className="ca-primary">Enregistrer l’échange</button>{supplierMessage.supplier_whatsapp&&<a target="_blank" rel="noreferrer" href={'https://wa.me/'+supplierMessage.supplier_whatsapp.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(supplierMessage.message_body)}>Ouvrir WhatsApp avec ce message ↗</a>}</form></section>
      </div>}{tab==='stores'&&<div className="ca-grid-two"><section className="ca-card"><h2>Boutiques des vendeurs</h2>{(data?.stores||[]).map(s=><div className="ca-row" key={s.id}><div><b>{s.name}</b><small>{s.platform} · {s.slug} · {s.status}</small></div><select value={s.status} onChange={e=>action({action:'set_store_status',store_id:s.id,status:e.target.value},'Statut de la boutique mis à jour.')}><option value="draft">Brouillon</option><option value="active">Active</option><option value="suspended">Suspendue</option></select></div>)}</section><section className="ca-card"><h2>Produits des boutiques</h2>{(data?.storeProducts||[]).map(p=><div className="ca-row" key={p.id}><div><b>{p.title}</b><small>{p.stores?.name||'Boutique'} · {p.status}</small></div><select value={p.status} onChange={e=>action({action:'publish_store_product',product_id:p.id,status:e.target.value},'Publication du produit mise à jour.')}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select></div>)}</section></div>}
      {tab==='cargo'&&<section className="ca-card"><h2>Suivi des colis et livraisons</h2>{(data?.cargo||[]).map(c=><form className="ca-order" key={c.id} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);action({action:'update_cargo_request',request_id:c.id,status:f.get('status'),cargo_partner_id:f.get('partner')||null,quoted_price_xof:f.get('price')||'',tracking_reference:f.get('tracking')||'',partner_notes:f.get('notes')||''},'Suivi cargo mis à jour.')}}><div><b>{customerName(c.user_id)} · {c.origin_city} → {c.destination_city}</b><small>{c.package_description} · {c.package_count} colis · {c.receiver_name} · {c.receiver_phone}</small></div><label>Statut<select name="status" defaultValue={c.status}>{['submitted','partner_contacted','quoted','accepted','in_transit','arrived','delivered','cancelled'].map(s=><option key={s}>{s}</option>)}</select></label><label>Prix FCFA<input name="price" type="number" min="0" defaultValue={c.quoted_price_xof||''}/></label><label>Suivi<input name="tracking" defaultValue={c.tracking_reference||''}/></label><label>Note<textarea name="notes" defaultValue={c.partner_notes||''}/></label><button className="ca-primary">Enregistrer</button></form>)}</section>}
      {tab==='products'&&<>
        <section className="ca-card ca-manual-product-toggle"><div><h2>Ajouter un produit manuellement</h2><p>Créez une fiche complète comme sur une marketplace : photos, marque, référence, prix, stock, variantes, emballage et fournisseur.</p></div><button className="ca-primary" type="button" onClick={()=>setManualProductOpen(!manualProductOpen)}>{manualProductOpen?'Fermer':'＋ Ajouter mon produit'}</button>
        {manualProductOpen&&<form className="ca-form ca-manual-product-form" onSubmit={saveManualProduct}>
          <h3>Informations principales</h3><label>Nom du produit *<input required value={manualProduct.title} onChange={e=>setManualProduct({...manualProduct,title:e.target.value})}/></label>
          <div className="ca-form-row"><label>Marque<input value={manualProduct.brand} onChange={e=>setManualProduct({...manualProduct,brand:e.target.value})}/></label><label>Référence / SKU<input value={manualProduct.sku} onChange={e=>setManualProduct({...manualProduct,sku:e.target.value})}/></label></div>
          <div className="ca-form-row"><label>Modèle<input value={manualProduct.model_number} onChange={e=>setManualProduct({...manualProduct,model_number:e.target.value})}/></label><label>Catégorie<select value={manualProduct.category_id} onChange={e=>setManualProduct({...manualProduct,category_id:e.target.value})}><option value="">Sans catégorie</option>{(data?.categories||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
          <label>Description complète<textarea rows="5" value={manualProduct.description} onChange={e=>setManualProduct({...manualProduct,description:e.target.value})}/></label>
          <label>Photos du produit (plusieurs images)<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e=>setManualImages(Array.from(e.target.files||[]))}/></label><small>{manualImages.length} image(s) sélectionnée(s) · 10 Mo maximum par image</small>
          <h3>Prix et quantité</h3><div className="ca-form-row"><label>Prix de vente (FCFA)<input type="number" min="0" value={manualProduct.price_xof} onChange={e=>setManualProduct({...manualProduct,price_xof:e.target.value})}/></label><label>Prix fournisseur<input type="number" min="0" step="0.01" value={manualProduct.original_price_min} onChange={e=>setManualProduct({...manualProduct,original_price_min:e.target.value,original_price_max:e.target.value})}/></label></div>
          <div className="ca-form-row"><label>Devise fournisseur<input value={manualProduct.original_currency} onChange={e=>setManualProduct({...manualProduct,original_currency:e.target.value.toUpperCase()})}/></label><label>Prix fournisseur (CNY)<input type="number" min="0" step="0.01" value={manualProduct.price_cny} onChange={e=>setManualProduct({...manualProduct,price_cny:e.target.value})}/></label></div>
          <div className="ca-form-row"><label>Quantité minimale de commande<input type="number" min="1" value={manualProduct.minimum_order_quantity} onChange={e=>setManualProduct({...manualProduct,minimum_order_quantity:e.target.value})}/></label><label>Stock disponible<input type="number" min="0" value={manualProduct.stock_quantity} onChange={e=>setManualProduct({...manualProduct,stock_quantity:e.target.value})}/></label></div>
          <h3>Caractéristiques et spécifications</h3><div className="ca-form-row"><label>Matière<input value={manualProduct.material} onChange={e=>setManualProduct({...manualProduct,material:e.target.value})}/></label><label>Couleur<input value={manualProduct.color} onChange={e=>setManualProduct({...manualProduct,color:e.target.value})}/></label></div>
          <div className="ca-form-row"><label>Taille / dimensions produit<input value={manualProduct.size} onChange={e=>setManualProduct({...manualProduct,size:e.target.value})}/></label><label>État<select value={manualProduct.product_condition} onChange={e=>setManualProduct({...manualProduct,product_condition:e.target.value})}><option value="New">Neuf</option><option value="Used">Occasion</option><option value="Refurbished">Reconditionné</option></select></label></div>
          <div className="ca-form-row"><label>Pays d’origine<input value={manualProduct.origin_country} onChange={e=>setManualProduct({...manualProduct,origin_country:e.target.value})}/></label><label>Garantie<input value={manualProduct.warranty} onChange={e=>setManualProduct({...manualProduct,warranty:e.target.value})}/></label></div>
          <div className="ca-form-row"><label>Dimensions du colis<input value={manualProduct.package_dimensions} onChange={e=>setManualProduct({...manualProduct,package_dimensions:e.target.value})} placeholder="Longueur × largeur × hauteur"/></label><label>Poids du colis (kg)<input type="number" min="0" step="0.001" value={manualProduct.package_weight} onChange={e=>setManualProduct({...manualProduct,package_weight:e.target.value})}/></label></div>
          <label>Certifications (séparées par des virgules)<input value={manualProduct.certifications} onChange={e=>setManualProduct({...manualProduct,certifications:e.target.value})}/></label>
          <label>Autres spécifications techniques (JSON)<textarea rows="4" value={manualProduct.product_specs} onChange={e=>setManualProduct({...manualProduct,product_specs:e.target.value})}/></label>
          <h3>Fournisseur et publication</h3><label>Fournisseur associé<select value={manualProduct.supplier_contact_id} onChange={e=>setManualProduct({...manualProduct,supplier_contact_id:e.target.value})}><option value="">Aucun fournisseur associé</option>{(data?.supplierContacts||[]).filter(x=>x.status==='active').map(x=><option key={x.id} value={x.id}>{x.company_name} · {x.country}</option>)}</select></label>
          <label>Lien source fournisseur<input type="url" value={manualProduct.source_url} onChange={e=>setManualProduct({...manualProduct,source_url:e.target.value})} placeholder="https://..."/></label>
          <label className="ca-winner-check"><input type="checkbox" checked={manualProduct.is_winner} onChange={e=>setManualProduct({...manualProduct,is_winner:e.target.checked})}/> Ajouter aux produits gagnants</label>
          <button className="ca-primary" disabled={loading}>Enregistrer et publier le produit</button>
        </form>}
        </section>
        <section className="ca-card"><h2>Importer depuis Alibaba et les marketplaces</h2><p>Collez un lien pour tenter de récupérer les photos et les caractéristiques publiques.</p><form className="ca-form ca-product-import-form" onSubmit={analyzeCatalogProduct}><label>Lien Alibaba, AliExpress, Amazon ou eBay<input type="url" required value={productUrl} onChange={e=>setProductUrl(e.target.value)} placeholder="https://…"/></label><button className="ca-primary" disabled={loading}>Analyser le produit <Search size={16}/></button></form>
          {productPreview&&<div className="ca-product-review"><div className="ca-gallery">{(productPreview.product_images||[]).map((src,i)=><img key={i} src={typeof src==='string'?src:src?.image_url||src?.url} alt={productPreview.product_title||'Produit'}/>)}</div><h3>{productPreview.product_title||'Titre non récupéré'}</h3><p>{productPreview.product_description||'Description non disponible automatiquement.'}</p><div className="ca-form-row"><label>Prix de vente ChinaGo (FCFA)<input type="number" min="0" value={productPriceXof} onChange={e=>setProductPriceXof(e.target.value)} placeholder="Prix en FCFA"/></label><label>Catégorie<select value={productCategory} onChange={e=>setProductCategory(e.target.value)}><option value="">Sans catégorie</option>{(data?.categories||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><label>Associer à un fournisseur<select value={productSupplierContact} onChange={e=>setProductSupplierContact(e.target.value)}><option value="">Aucun fournisseur associé</option>{(data?.supplierContacts||[]).filter(x=>x.status==='active').map(x=><option key={x.id} value={x.id}>{x.company_name}</option>)}</select></label><label className="ca-winner-check"><input type="checkbox" checked={productWinner} onChange={e=>setProductWinner(e.target.checked)}/> Mettre en avant dans « Produits gagnants »</label><small>Source : {productPreview.source_platform} · Extraction : {productPreview.extraction_status} · Prix fournisseur : {productPreview.original_price_min??'—'} {productPreview.original_currency||''} · Photos : {(productPreview.product_images||[]).length}</small><button className="ca-primary" onClick={publishCatalogProduct} disabled={loading||!productPreview.product_title}>Publier dans le catalogue</button></div>}
        </section><div className="ca-grid-two"><section className="ca-card"><h2>Produits gagnants</h2><p>Produits vérifiés et mis en avant dans le catalogue.</p>{(data?.products||[]).filter(p=>p.is_winner).map(p=><div className="ca-row" key={p.id}><div><b>{p.title}</b><small>{money(p.price_xof)} · {p.status}</small></div><span className="ca-pill">Gagnant</span></div>)}</section><section className="ca-card"><h2>Produits du catalogue</h2>{(data?.products||[]).map(p=><div className="ca-row" key={p.id}><div><b>{p.title}</b><small>{money(p.price_xof)} · {p.status} · {p.is_winner?'Produit gagnant':'Standard'}</small></div></div>)}</section></div>
      </>}
    </main>
  </div>;
}
