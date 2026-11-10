import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, Bell, Box, Check, CheckCircle2, ChevronRight, CircleUserRound,
  ClipboardList, ExternalLink, Heart, LayoutDashboard, Link2, LogOut, Menu, Package,
  PackageCheck, Plus, Search, Settings, ShieldCheck, ShoppingBag, Store, Truck, User,
  Users, Wallet, X, TrendingUp, Globe2, Clock3, AlertCircle, SlidersHorizontal, MapPin, MessageCircle, PackagePlus
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const money = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value || 0)) + ' FCFA';
const dateLabel = value => value ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const platformFromUrl = value => {
  const host = new URL(value).hostname.toLowerCase();
  return host.includes('alibaba.') ? 'alibaba' : host.includes('amazon.') ? 'amazon' : host.includes('ebay.') ? 'ebay' : 'other';
};
const roleLabel = role => ({ customer: 'Client', dropshipper: 'Dropshipper', seller: 'E-commerçant', supplier: 'Fournisseur', admin: 'Administrateur' }[role] || 'Client');

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceBand, setPriceBand] = useState('all');
  const [productMode, setProductMode] = useState('all');
  const [cargoPartners, setCargoPartners] = useState([]);
  const [cargoRequests, setCargoRequests] = useState([]);
  const [cargoWhatsAppUrl, setCargoWhatsAppUrl] = useState('');
  const [orderDraft, setOrderDraft] = useState(null);
  const [orderForm, setOrderForm] = useState({ product_title: '', source_url: '', quantity: '1', contact_name: '', contact_phone: '', delivery_city: 'Lomé', delivery_address: '', customer_notes: '', cargo_partner_id: '' });
  const [cargoForm, setCargoForm] = useState({ cargo_partner_id: '', origin_city: 'Guangzhou', destination_city: 'Lomé', package_description: '', package_count: '1', weight_kg: '', dimensions: '', declared_value_xof: '', sender_name: '', sender_phone: '', receiver_name: '', receiver_phone: '', receiver_address: '', customer_notes: '' });
  const [cargoPartnerForm, setCargoPartnerForm] = useState({ name: '', service_type: 'air', origin_cities: 'Guangzhou, Yiwu', destination_cities: 'Lomé', whatsapp_phone: '', contact_phone: '', contact_email: '', pricing_notes: '', estimated_days_min: '', estimated_days_max: '', instructions: '' });
  const [adminProductForm, setAdminProductForm] = useState({ title: '', description: '', category_id: '', source_url: '', price_xof: '', image_url: '', is_winner: false });
  const [favorites, setFavorites] = useState([]);
  const [imports, setImports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [applications, setApplications] = useState([]);
  const [supplierApplications, setSupplierApplications] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [view, setView] = useState('home');
  const [tab, setTab] = useState('overview');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [sellerForm, setSellerForm] = useState({ account_type: 'dropshipper', business_name: '', contact_name: '', email: '', phone: '', store_url: '', message: '' });
  const [supplierForm, setSupplierForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', country: 'China', website_url: '', product_categories: '', message: '' });
  const [storeForm, setStoreForm] = useState({ name: '', description: '', platform: 'chinago', shopify_domain: '' });
  const [storeProductForm, setStoreProductForm] = useState({ title: '', source_url: '', cost_price_xof: '', selling_price_xof: '', description: '' });

  const loadPublicProducts = useCallback(async () => {
    if (!supabase) return;
    const [productResult, categoryResult, cargoResult] = await Promise.all([
      supabase.from('products')
        .select('id,title,description,source_url,price_xof,currency,is_winner,is_featured,category_id,categories(name),product_images(image_url,alt_text)')
        .eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
      supabase.from('cargo_partners').select('id,name,service_type,origin_cities,destination_cities,whatsapp_phone,pricing_notes,estimated_days_min,estimated_days_max,instructions').eq('is_active', true).order('name')
    ]);
    if (productResult.error) console.error('Catalogue:', productResult.error.message);
    if (categoryResult.error) console.error('Catégories:', categoryResult.error.message);
    if (cargoResult.error) console.error('Partenaires cargo:', cargoResult.error.message);
    setProducts(productResult.data || []);
    setCategories(categoryResult.data || []);
    setCargoPartners(cargoResult.data || []);
  }, []);

  const loadMemberData = useCallback(async currentUser => {
    if (!supabase || !currentUser) return;
    const [p, f, i, n, o, a, sa, s, cr] = await Promise.all([
      supabase.from('profiles').select('id,full_name,phone,role').eq('id', currentUser.id).maybeSingle(),
      supabase.from('product_favorites').select('product_id').eq('user_id', currentUser.id),
      supabase.from('import_requests').select('id,source_url,source_platform,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('notifications').select('id,title,body,kind,read_at,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('orders').select('id,order_number,status,total_xof,created_at,store_id,delivery_city,delivery_address,order_items(product_title,quantity)').eq('customer_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('seller_applications').select('id,account_type,business_name,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('supplier_applications').select('id,company_name,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('stores').select('id,name,slug,description,platform,shopify_domain,status,created_at').eq('owner_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('cargo_requests').select('id,order_id,cargo_partner_id,origin_city,destination_city,package_description,package_count,weight_kg,status,tracking_reference,quoted_price_xof,created_at,cargo_partners(name,whatsapp_phone)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50)
    ]);
    if (p.data) { setProfile(p.data); setProfileForm({ full_name: p.data.full_name || '', phone: p.data.phone || '' }); }
    setFavorites((f.data || []).map(x => x.product_id));
    setImports(i.data || []); setNotifications(n.data || []); setOrders(o.data || []);
    setApplications(a.data || []); setSupplierApplications(sa.data || []); setStores(s.data || []);
    if (p.data?.role === 'admin') {
      const { data: allCargo } = await supabase.from('cargo_requests').select('id,user_id,order_id,cargo_partner_id,origin_city,destination_city,package_description,package_count,weight_kg,status,tracking_reference,quoted_price_xof,created_at,cargo_partners(name,whatsapp_phone)').order('created_at', { ascending: false }).limit(100);
      setCargoRequests(allCargo || []);
    } else setCargoRequests(cr.data || []);
    if (s.data?.length) {
      const { data: sp } = await supabase.from('store_products')
        .select('id,store_id,title,description,source_url,source_platform,cost_price_xof,selling_price_xof,status,created_at')
        .in('store_id', s.data.map(x => x.id)).order('created_at', { ascending: false });
      setStoreProducts(sp || []);
    } else setStoreProducts([]);
  }, []);

  useEffect(() => {
    loadPublicProducts();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const current = data.session?.user || null;
      setUser(current);
      if (current) loadMemberData(current);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = session?.user || null;
      setUser(current);
      if (current) loadMemberData(current);
      else {
        setProfile(null); setFavorites([]); setImports([]); setNotifications([]); setOrders([]);
        setApplications([]); setSupplierApplications([]); setStores([]); setStoreProducts([]); setCargoRequests([]);
        setView('home');
      }
    });
    return () => subscription.unsubscribe();
  }, [loadMemberData, loadPublicProducts]);

  const visibleProducts = useMemo(() => products.filter(p => {
    const matchesText = (p.title + ' ' + (p.description || '')).toLowerCase().includes(query.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const price = Number(p.price_xof || 0);
    const matchesPrice = priceBand === 'all' || (price > 0 && (
      priceBand === 'under10' ? price < 10000 :
      priceBand === '10to25' ? price >= 10000 && price < 25000 :
      priceBand === '25to50' ? price >= 25000 && price < 50000 :
      priceBand === '50to100' ? price >= 50000 && price < 100000 : price >= 100000
    ));
    const matchesMode = productMode === 'all' || p.is_winner;
    return matchesText && matchesCategory && matchesPrice && matchesMode;
  }), [products, query, selectedCategory, priceBand, productMode]);
  const unreadCount = notifications.filter(n => !n.read_at).length;
  const pendingApplication = applications.find(a => a.status === 'pending');
  const activeStore = stores.find(s => s.status === 'active') || stores[0];
  const isAdmin = profile?.role === 'admin';

  async function authenticate(event) {
    event.preventDefault();
    if (!supabase) return setNotice('Le service de compte est momentanément indisponible.');
    setBusy(true);
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: '' } } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setNotice(authMode === 'signup' ? 'Compte créé. Vérifiez votre e-mail si une confirmation est demandée.' : 'Connexion réussie. Votre espace est prêt.');
      setAuthOpen(false); setPassword('');
      if (result.data.user) { setUser(result.data.user); await loadMemberData(result.data.user); }
    } catch (error) { setNotice(error.message || 'Une erreur est survenue.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setNotice('Vous êtes déconnecté.');
  }

  async function submitImport(event) {
    event.preventDefault();
    let parsed;
    try { parsed = new URL(importUrl.trim()); if (parsed.protocol !== 'https:') throw new Error(); }
    catch { return setNotice('Collez une adresse complète commençant par https://'); }
    if (!user || !supabase) { setAuthMode('signin'); setAuthOpen(true); return setNotice('Connectez-vous pour enregistrer votre demande.'); }
    setBusy(true);
    try {
      const { error } = await supabase.from('import_requests').insert({
        user_id: user.id, source_url: parsed.toString(), source_platform: platformFromUrl(parsed.toString())
      });
      if (error) throw error;
      setImportUrl(''); setNotice('Votre demande a été enregistrée. Retrouvez son suivi dans « Mes importations ».');
      await loadMemberData(user);
    } catch (error) { setNotice(error.message || 'Impossible d’enregistrer la demande.'); }
    finally { setBusy(false); }
  }

  async function toggleFavorite(productId) {
    if (!user) { setAuthMode('signin'); setAuthOpen(true); return setNotice('Connectez-vous pour sauvegarder vos favoris.'); }
    const exists = favorites.includes(productId);
    const result = exists
      ? await supabase.from('product_favorites').delete().eq('user_id', user.id).eq('product_id', productId)
      : await supabase.from('product_favorites').insert({ user_id: user.id, product_id: productId });
    if (result.error) return setNotice(result.error.message);
    setFavorites(old => exists ? old.filter(id => id !== productId) : [...old, productId]);
  }

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name.trim(), phone: profileForm.phone.trim()
    }).eq('id', user.id);
    setBusy(false);
    if (error) return setNotice(error.message);
    setProfile(old => ({ ...old, ...profileForm })); setNotice('Votre profil a été mis à jour.');
  }

  async function submitSellerApplication(event) {
    event.preventDefault(); setBusy(true);
    const { error } = await supabase.from('seller_applications').insert({
      user_id: user.id, ...sellerForm, business_name: sellerForm.business_name.trim(),
      contact_name: sellerForm.contact_name.trim(), email: (sellerForm.email || user.email || '').trim(), phone: sellerForm.phone.trim()
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice('Candidature envoyée. Vous recevrez une notification après examen.');
    await loadMemberData(user); setTab('applications');
  }

  async function submitSupplierApplication(event) {
    event.preventDefault(); setBusy(true);
    const { error } = await supabase.from('supplier_applications').insert({
      user_id: user.id, ...supplierForm, email: (supplierForm.email || user.email || '').trim(),
      product_categories: supplierForm.product_categories.split(',').map(x => x.trim()).filter(Boolean)
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice('Votre candidature fournisseur a été enregistrée.');
    await loadMemberData(user); setTab('applications');
  }

  async function createStore(event) {
    event.preventDefault();
    if (!['seller','dropshipper','admin'].includes(profile?.role)) return setNotice('La création de boutique sera disponible après validation de votre candidature.');
    setBusy(true);
    const slug = storeForm.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + user.id.slice(0, 6);
    const { data, error } = await supabase.from('stores').insert({
      owner_id: user.id, name: storeForm.name.trim(), slug, description: storeForm.description.trim(),
      platform: storeForm.platform, shopify_domain: storeForm.shopify_domain.trim() || null
    }).select().single();
    setBusy(false);
    if (error) return setNotice(error.message);
    setStores(old => [data, ...old]); setNotice('Votre boutique brouillon a été créée. Vous pourrez ajouter vos produits.');
    setTab('store');
  }

  async function addStoreProduct(event) {
    event.preventDefault();
    if (!activeStore) return setNotice('Créez d’abord votre boutique.');
    setBusy(true);
    let sourcePlatform = null;
    if (storeProductForm.source_url.trim()) {
      try { const u = new URL(storeProductForm.source_url.trim()); if (u.protocol !== 'https:') throw new Error(); sourcePlatform = platformFromUrl(u.toString()); }
      catch { setBusy(false); return setNotice('Le lien source doit commencer par https://'); }
    }
    const { error } = await supabase.from('store_products').insert({
      store_id: activeStore.id, title: storeProductForm.title.trim(), description: storeProductForm.description.trim(),
      source_url: storeProductForm.source_url.trim() || null, source_platform: sourcePlatform,
      cost_price_xof: storeProductForm.cost_price_xof ? Number(storeProductForm.cost_price_xof) : null,
      selling_price_xof: storeProductForm.selling_price_xof ? Number(storeProductForm.selling_price_xof) : null,
      status: 'draft'
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setStoreProductForm({ title: '', source_url: '', cost_price_xof: '', selling_price_xof: '', description: '' });
    setNotice('Produit enregistré comme brouillon dans votre boutique.');
    await loadMemberData(user);
  }

  async function submitOrderRequest(event) {
    event.preventDefault();
    if (!user || !supabase) return setNotice('Connectez-vous pour passer une commande.');
    if (!orderForm.product_title.trim()) return setNotice('Indiquez le nom du produit.');
    setBusy(true);
    const selectedPartner = cargoPartners.find(p => p.id === orderForm.cargo_partner_id);
    const { data, error } = await supabase.rpc('request_order', {
      p_product_id: orderDraft?.id || null,
      p_store_product_id: null,
      p_product_title: orderForm.product_title.trim(),
      p_source_url: orderForm.source_url.trim(),
      p_quantity: Number(orderForm.quantity || 1),
      p_unit_price_xof: Number(orderDraft?.price_xof || 0),
      p_contact_name: orderForm.contact_name.trim(),
      p_contact_phone: orderForm.contact_phone.trim(),
      p_contact_email: user.email || '',
      p_delivery_address: orderForm.delivery_address.trim(),
      p_delivery_city: orderForm.delivery_city.trim(),
      p_customer_notes: orderForm.customer_notes.trim(),
      p_cargo_partner_id: orderForm.cargo_partner_id || null
    });
    setBusy(false);
    if (error) return setNotice(error.message || 'Impossible d’enregistrer cette commande.');
    setNotice('Demande de commande enregistrée. Le prix et le transport seront confirmés avant paiement.');
    setOrderDraft(null);
    setOrderForm({ product_title: '', source_url: '', quantity: '1', contact_name: profile?.full_name || '', contact_phone: profile?.phone || '', delivery_city: 'Lomé', delivery_address: '', customer_notes: '', cargo_partner_id: '' });
    await loadMemberData(user);
    setTab('orders');
  }

  async function submitCargoRequest(event) {
    event.preventDefault();
    if (!user || !supabase) return setNotice('Connectez-vous pour demander un transport.');
    setBusy(true);
    const { data, error } = await supabase.from('cargo_requests').insert({
      user_id: user.id,
      cargo_partner_id: cargoForm.cargo_partner_id || null,
      origin_city: cargoForm.origin_city.trim(),
      destination_city: cargoForm.destination_city.trim(),
      package_description: cargoForm.package_description.trim(),
      package_count: Number(cargoForm.package_count || 1),
      weight_kg: cargoForm.weight_kg ? Number(cargoForm.weight_kg) : null,
      dimensions: cargoForm.dimensions.trim() || null,
      declared_value_xof: cargoForm.declared_value_xof ? Number(cargoForm.declared_value_xof) : null,
      sender_name: cargoForm.sender_name.trim(),
      sender_phone: cargoForm.sender_phone.trim(),
      receiver_name: cargoForm.receiver_name.trim(),
      receiver_phone: cargoForm.receiver_phone.trim(),
      receiver_address: cargoForm.receiver_address.trim(),
      customer_notes: cargoForm.customer_notes.trim() || null
    }).select('id').single();
    setBusy(false);
    if (error) return setNotice(error.message || 'Impossible d’enregistrer la demande cargo.');
    const partner = cargoPartners.find(p => p.id === cargoForm.cargo_partner_id);
    if (partner?.whatsapp_phone) {
      const message = [
        'Bonjour ' + partner.name + ',',
        'Nouvelle demande de transport ChinaGo #' + data.id.slice(0,8).toUpperCase(),
        'Trajet : ' + cargoForm.origin_city + ' → ' + cargoForm.destination_city,
        'Colis : ' + cargoForm.package_description,
        'Quantité : ' + cargoForm.package_count,
        'Poids : ' + (cargoForm.weight_kg || 'À préciser') + ' kg',
        'Expéditeur : ' + cargoForm.sender_name + ' / ' + cargoForm.sender_phone,
        'Destinataire : ' + cargoForm.receiver_name + ' / ' + cargoForm.receiver_phone,
        'Adresse : ' + cargoForm.receiver_address,
        'Notes : ' + (cargoForm.customer_notes || 'Aucune')
      ].join('\n');
      setCargoWhatsAppUrl('https://wa.me/' + partner.whatsapp_phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(message));
    } else setCargoWhatsAppUrl('');
    setNotice('Votre demande cargo est enregistrée. Vous pouvez maintenant contacter le transporteur si un numéro WhatsApp est disponible.');
    setCargoForm({ cargo_partner_id: '', origin_city: 'Guangzhou', destination_city: 'Lomé', package_description: '', package_count: '1', weight_kg: '', dimensions: '', declared_value_xof: '', sender_name: profile?.full_name || '', sender_phone: profile?.phone || '', receiver_name: '', receiver_phone: '', receiver_address: '', customer_notes: '' });
    await loadMemberData(user);
  }

  async function submitCargoPartner(event) {
    event.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    const { error } = await supabase.from('cargo_partners').insert({
      name: cargoPartnerForm.name.trim(), service_type: cargoPartnerForm.service_type,
      origin_countries: ['China'], origin_cities: cargoPartnerForm.origin_cities.split(',').map(x => x.trim()).filter(Boolean),
      destination_countries: ['Togo'], destination_cities: cargoPartnerForm.destination_cities.split(',').map(x => x.trim()).filter(Boolean),
      whatsapp_phone: cargoPartnerForm.whatsapp_phone.trim() || null,
      contact_phone: cargoPartnerForm.contact_phone.trim() || null,
      contact_email: cargoPartnerForm.contact_email.trim() || null,
      pricing_notes: cargoPartnerForm.pricing_notes.trim() || null,
      estimated_days_min: cargoPartnerForm.estimated_days_min ? Number(cargoPartnerForm.estimated_days_min) : null,
      estimated_days_max: cargoPartnerForm.estimated_days_max ? Number(cargoPartnerForm.estimated_days_max) : null,
      instructions: cargoPartnerForm.instructions.trim() || null, is_active: true
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setCargoPartnerForm({ name: '', service_type: 'air', origin_cities: 'Guangzhou, Yiwu', destination_cities: 'Lomé', whatsapp_phone: '', contact_phone: '', contact_email: '', pricing_notes: '', estimated_days_min: '', estimated_days_max: '', instructions: '' });
    setNotice('Transporteur ajouté et publié.');
    await loadPublicProducts();
  }

  async function submitAdminProduct(event) {
    event.preventDefault();
    if (!isAdmin) return;
    if (!adminProductForm.title.trim()) return setNotice('Le nom du produit est obligatoire.');
    setBusy(true);
    const slugBase = adminProductForm.title.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = slugBase + '-' + crypto.randomUUID().slice(0,8);
    const sourceUrl = adminProductForm.source_url.trim();
    let sourcePlatform = null;
    if (sourceUrl) {
      try { const u = new URL(sourceUrl); if (u.protocol !== 'https:') throw new Error(); sourcePlatform = platformFromUrl(u.toString()); }
      catch { setBusy(false); return setNotice('Le lien source doit commencer par https://'); }
    }
    const { data, error } = await supabase.from('products').insert({
      title: adminProductForm.title.trim(), slug, description: adminProductForm.description.trim() || null,
      category_id: adminProductForm.category_id || null, source_url: sourceUrl || null,
      source_platform: sourcePlatform, price_xof: adminProductForm.price_xof ? Number(adminProductForm.price_xof) : null,
      currency: 'XOF', is_winner: adminProductForm.is_winner, is_featured: adminProductForm.is_winner, status: 'active'
    }).select('id').single();
    if (error) { setBusy(false); return setNotice(error.message); }
    if (adminProductForm.image_url.trim()) {
      const { error: imageError } = await supabase.from('product_images').insert({
        product_id: data.id, image_url: adminProductForm.image_url.trim(), alt_text: adminProductForm.title.trim()
      });
      if (imageError) { setBusy(false); return setNotice('Produit publié, mais image non enregistrée : ' + imageError.message); }
    }
    setBusy(false);
    setAdminProductForm({ title: '', description: '', category_id: '', source_url: '', price_xof: '', image_url: '', is_winner: false });
    setNotice('Produit ajouté au catalogue ChinaGo.');
    await loadPublicProducts();
  }

  async function updateCargoStatus(id, status) {
    const { error } = await supabase.from('cargo_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return setNotice(error.message);
    setNotice('Statut cargo mis à jour.');
    await loadMemberData(user);
  }

  async function markNotificationRead(id) {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) return setNotice(error.message);
    setNotifications(old => old.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  function openDashboard(nextTab = 'overview') {
    if (!user) { setAuthMode('signin'); setAuthOpen(true); return setNotice('Connectez-vous pour accéder à votre espace.'); }
    setTab(nextTab); setView('dashboard'); setMenuOpen(false); loadMemberData(user);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const menuItems = [
    { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { id: 'profile', label: 'Mon profil', icon: User },
    { id: 'imports', label: 'Mes importations', icon: Link2 },
    { id: 'favorites', label: 'Mes favoris', icon: Heart },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadCount },
    { id: 'orders', label: 'Mes commandes', icon: ClipboardList },
    { id: 'cargo', label: 'Transport & cargo', icon: Truck },
    { id: 'dropshipping', label: 'Dropshipping', icon: TrendingUp },
    { id: 'store', label: 'Ma boutique', icon: Store },
    { id: 'supplier', label: 'Devenir fournisseur', icon: PackageCheck },
    { id: 'applications', label: 'Mes candidatures', icon: Users },
    ...(isAdmin ? [{ id: 'admin', label: 'Administration', icon: ShieldCheck }] : [])
  ];

  const productCard = p => {
    const image = p.product_images?.[0]?.image_url;
    return <article className="cg-product" key={p.id}>
      <button className="cg-product-image" onClick={() => setSelectedProduct(p)} aria-label={'Voir ' + p.title}>
        {image ? <img src={image} alt={p.product_images?.[0]?.alt_text || p.title}/> : <span className="cg-no-image"><Package size={38}/></span>}
        {p.is_winner && <span className="cg-product-tag">Produit tendance</span>}
      </button>
      <div className="cg-product-body">
        <h3>{p.title}</h3><p>{p.description || 'Produit sélectionné par ChinaGo.'}</p>
        <div className="cg-product-bottom"><strong>{p.price_xof ? money(p.price_xof) : 'Prix sur demande'}</strong>
          <button className="cg-icon-button" onClick={() => toggleFavorite(p.id)} aria-label="Ajouter aux favoris"><Heart size={18} fill={favorites.includes(p.id) ? 'currentColor' : 'none'}/></button>
        </div>
        <button className="cg-text-button" onClick={() => setSelectedProduct(p)}>Voir les détails <ArrowRight size={15}/></button>
      </div>
    </article>;
  };

  return <div className="app">
    <div className="topbar"><div className="wrap topbar-inner"><span>Votre passerelle commerciale entre la Chine et l’Afrique</span><span><Globe2 size={14}/> Afrique de l’Ouest · FCFA</span></div></div>
    <header className="header"><div className="wrap nav">
      <button className="brand" onClick={() => setView('home')}><span className="brand-icon">C<span>G</span></span><span>China<span>Go</span><small>IMPORT · SHOP · SELL</small></span></button>
      <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X/> : <Menu/>}</button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <a href="#products" onClick={() => {setView('home');setMenuOpen(false);}}>Produits</a>
        <a href="#import" onClick={() => {setView('home');setMenuOpen(false);}}>Importer un lien</a>
        <a href="#how" onClick={() => {setView('home');setMenuOpen(false);}}>Comment ça marche</a>
        <a href="#partners" onClick={() => {setView('home');setMenuOpen(false);}}>Partenaires</a>
      </nav>
      <div className="nav-actions">{user ? <><button className="btn btn-ghost" onClick={() => openDashboard()}><CircleUserRound size={17}/> Mon espace {unreadCount > 0 && <i className="cg-count">{unreadCount}</i>}</button><button className="btn btn-ghost cg-logout" onClick={signOut}><LogOut size={16}/></button></> : <><button className="btn btn-ghost" onClick={() => {setAuthMode('signin');setAuthOpen(true);}}>Connexion</button><button className="btn btn-primary" onClick={() => {setAuthMode('signup');setAuthOpen(true);}}>Créer un compte</button></>}</div>
    </div></header>

    {notice && <div className="wrap notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fermer"><X size={17}/></button></div>}

    {authOpen && <div className="overlay" onClick={() => setAuthOpen(false)}><section className="auth-card" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setAuthOpen(false)}><X/></button><span className="eyebrow">ESPACE CLIENT CHINAGO</span><h2>{authMode === 'signup' ? 'Créer votre compte' : 'Bienvenue de nouveau'}</h2><p>Accédez à vos demandes, vos commandes et votre espace personnel.</p><form onSubmit={authenticate}><label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com"/></label><label>Mot de passe<input type="password" minLength="8" required value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum"/></label><button className="btn btn-primary full" disabled={busy}>{busy ? 'Patientez…' : authMode === 'signup' ? 'Créer mon compte' : 'Me connecter'}</button></form><button className="switch" onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}>{authMode === 'signup' ? 'Déjà inscrit ? Se connecter' : 'Créer un compte'}</button></section></div>}

    {selectedProduct && <div className="overlay" onClick={() => setSelectedProduct(null)}><section className="cg-product-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelectedProduct(null)}><X/></button><div className="cg-modal-image">{selectedProduct.product_images?.[0]?.image_url ? <img src={selectedProduct.product_images[0].image_url} alt={selectedProduct.title}/> : <Package size={55}/>}</div><div><span className="eyebrow">CATALOGUE CHINAGO</span><h2>{selectedProduct.title}</h2><strong>{selectedProduct.price_xof ? money(selectedProduct.price_xof) : 'Prix sur demande'}</strong><p>{selectedProduct.description || 'Contactez ChinaGo pour obtenir les détails et les disponibilités de ce produit.'}</p><button className="btn btn-primary full" onClick={() => {if (!user) {setSelectedProduct(null);setAuthMode('signin');setAuthOpen(true);return setNotice('Connectez-vous pour demander ce produit.');}setOrderDraft(selectedProduct);setOrderForm(old => ({...old,product_title:selectedProduct.title,source_url:selectedProduct.source_url || '',quantity:'1'}));setSelectedProduct(null);setView('dashboard');setTab('orders');}}>Passer commande <ArrowRight size={16}/></button></div></section></div>}

    {view === 'home' ? <main>
      <section className="hero" id="home"><div className="wrap hero-grid"><div><span className="eyebrow">ACHETER · IMPORTER · DÉVELOPPER</span><h1>Achetez en Chine depuis le Togo,<br/><em>simplement !</em></h1><p className="lead">Découvrez des produits, partagez un lien et préparez votre importation. ChinaGo coordonne votre parcours entre fournisseur et cargo.</p>
        <form className="import-card" id="import" onSubmit={submitImport}><label><Link2 size={17}/> Vous avez déjà un lien produit ?</label><div className="input-row"><input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Collez un lien Alibaba, Amazon, eBay…" required/><button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Obtenir un devis'} <ArrowRight size={16}/></button></div><small>Votre demande sera enregistrée dans votre espace personnel.</small></form>
        <div className="hero-points"><span><CheckCircle2/> Demandes suivies dans votre compte</span><span><ShieldCheck/> Validation avant paiement fournisseur</span></div>
      </div><div className="hero-visual"><div className="halo"></div><div className="hero-box"><div className="box-label">CHINAGO LOGISTICS <b>CG</b></div><div className="box-art">📦</div><strong>Votre commerce,<br/>sans frontières.</strong><small>CHINE → AFRIQUE</small></div><div className="float float-one"><PackageCheck/><span><b>Commande suivie</b><small>À chaque étape</small></span></div><div className="float float-two"><Truck/><span><b>Coordination cargo</b><small>Chine vers le Togo</small></span></div></div></div></section>
      <section className="trust"><div className="wrap trust-grid"><div><ShieldCheck/><b>Parcours encadré</b><small>Validation à chaque étape</small></div><div><ShoppingBag/><b>Prix en FCFA</b><small>Devis clair et local</small></div><div><Store/><b>Espace vendeur</b><small>Votre boutique en ligne</small></div><div><Truck/><b>Suivi cargo</b><small>Du dépôt à la livraison</small></div></div></section>
      <section className="section" id="products"><div className="wrap"><div className="section-head"><div><span className="eyebrow">INSPIRATION & OPPORTUNITÉS</span><h2>Catalogue <em>ChinaGo</em></h2><p>Explorez par catégorie, budget ou tendance. Les produits affichés sont ceux réellement publiés dans le catalogue.</p></div><div className="search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un produit"/></div></div>
        <div className="cg-discovery-tools">
          <div className="cg-mode-switch"><button className={productMode === 'all' ? 'active' : ''} onClick={() => setProductMode('all')}>Tous les produits</button><button className={productMode === 'winners' ? 'active' : ''} onClick={() => setProductMode('winners')}>Produits tendances</button></div>
          <div className="cg-filter-row"><label><SlidersHorizontal size={16}/> Catégorie<select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option value="all">Toutes les catégories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Budget<select value={priceBand} onChange={e => setPriceBand(e.target.value)}><option value="all">Tous les prix</option><option value="under10">Moins de 10 000 FCFA</option><option value="10to25">10 000 à 25 000 FCFA</option><option value="25to50">25 000 à 50 000 FCFA</option><option value="50to100">50 000 à 100 000 FCFA</option><option value="over100">Plus de 100 000 FCFA</option></select></label><button className="cg-clear-filters" onClick={() => {setQuery('');setSelectedCategory('all');setPriceBand('all');setProductMode('all');}}>Réinitialiser</button></div>
          <div className="cg-category-chips"><button className={selectedCategory === 'all' ? 'active' : ''} onClick={() => setSelectedCategory('all')}>Tout</button>{categories.map(c => <button key={c.id} className={selectedCategory === c.id ? 'active' : ''} onClick={() => setSelectedCategory(c.id)}>{c.name}</button>)}</div>
        </div>
        {visibleProducts.length ? <div className="product-grid">{visibleProducts.map(productCard)}</div> : <div className="cg-empty-public"><Package size={34}/><h3>{query ? 'Aucun produit trouvé' : 'Le catalogue se prépare'}</h3><p>{query ? 'Essayez un autre mot-clé.' : 'Les produits réels apparaîtront ici dès leur validation. Vous pouvez déjà envoyer un lien produit pour demander un devis.'}</p></div>}
      </div></section>
      <section className="how section" id="how"><div className="wrap"><div className="section-head centered"><div><span className="eyebrow">UN PARCOURS CLAIR</span><h2>Comment fonctionne <em>ChinaGo ?</em></h2><p>Un processus progressif avec validation des étapes sensibles.</p></div></div><div className="steps"><article><b>01</b><Link2/><h3>Vous choisissez</h3><p>Parcourez le catalogue ou partagez le lien de votre produit.</p></article><article><b>02</b><Box/><h3>Nous préparons le devis</h3><p>Le produit, les options et les frais sont vérifiés avant validation.</p></article><article><b>03</b><Store/><h3>Le fournisseur confirme</h3><p>Disponibilité, prix et délai sont contrôlés avant engagement.</p></article><article><b>04</b><Truck/><h3>Le cargo livre</h3><p>Votre colis est suivi jusqu’à sa réception au Togo.</p></article></div></div></section>
      <section className="partners section" id="partners"><div className="wrap partner-grid"><div><span className="eyebrow">ESPACE PARTENAIRE</span><h2>Développez votre activité avec <em>ChinaGo</em></h2><p>Vous souhaitez vendre vos produits, lancer une boutique ou faire du dropshipping ? Créez votre compte puis envoyez votre candidature depuis votre espace membre.</p><button className="btn btn-primary" onClick={() => user ? openDashboard('dropshipping') : (setAuthMode('signup'),setAuthOpen(true))}>Rejoindre ChinaGo <ArrowRight/></button></div><div className="partner-card"><span className="partner-icon"><Store/></span><h3>Trois façons de participer</h3><p>Choisissez votre activité. Notre équipe étudiera votre candidature.</p><div><CheckCircle2/> Dropshipping et vente en ligne</div><div><CheckCircle2/> Boutique ChinaGo ou Shopify</div><div><CheckCircle2/> Fournisseurs et partenaires</div></div></div></section>
    </main> : <main className="cg-dashboard-wrap"><div className="wrap cg-dashboard">
      <aside className="cg-sidebar"><div className="cg-member"><div className="cg-avatar">{(profile?.full_name || user?.email || 'C').slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name || 'Mon compte'}</b><small>{roleLabel(profile?.role)}</small></div></div><nav>{menuItems.map(item => {const Icon = item.icon;return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={18}/><span>{item.label}</span>{item.count > 0 && <i>{item.count}</i>}</button>;})}</nav><button className="cg-back-home" onClick={() => setView('home')}><ArrowLeft size={16}/> Retour au site</button></aside>
      <section className="cg-dashboard-content"><div className="cg-dash-heading"><div><span className="eyebrow">ESPACE PERSONNEL</span><h1>{menuItems.find(x => x.id === tab)?.label || 'Mon espace'}</h1><p>Bienvenue {profile?.full_name || user?.email}. Gérez vos activités ChinaGo ici.</p></div><button className="cg-notif-shortcut" onClick={() => setTab('notifications')}><Bell/>{unreadCount > 0 && <i>{unreadCount}</i>}</button></div>

      {tab === 'overview' && <><div className="cg-stats"><div><span><Link2/></span><small>Importations</small><b>{imports.length}</b></div><div><span><ClipboardList/></span><small>Commandes</small><b>{orders.length}</b></div><div><span><Heart/></span><small>Favoris</small><b>{favorites.length}</b></div><div><span><Bell/></span><small>Non lues</small><b>{unreadCount}</b></div></div><div className="cg-panel"><div className="cg-panel-head"><div><h2>Accès rapides</h2><p>Choisissez ce que vous souhaitez faire.</p></div></div><div className="cg-quick-grid"><button onClick={() => setTab('imports')}><Link2/><b>Importer un produit</b><small>Envoyer un lien pour devis</small></button><button onClick={() => setTab('dropshipping')}><TrendingUp/><b>Faire du dropshipping</b><small>Créer votre activité</small></button><button onClick={() => setTab('store')}><Store/><b>Ma boutique e-commerce</b><small>Gérer vos produits</small></button><button onClick={() => setTab('supplier')}><PackageCheck/><b>Devenir fournisseur</b><small>Proposer vos produits</small></button></div></div><div className="cg-panel"><div className="cg-panel-head"><div><h2>Activité récente</h2><p>Vos dernières demandes et notifications.</p></div><button className="cg-text-button" onClick={() => setTab('notifications')}>Tout voir <ArrowRight size={15}/></button></div>{notifications.slice(0,3).length ? notifications.slice(0,3).map(n => <div className="cg-list-row" key={n.id}><span className="cg-list-icon"><Bell size={17}/></span><div><b>{n.title}</b><small>{n.body}</small></div><time>{dateLabel(n.created_at)}</time></div>) : <p className="cg-muted">Aucune notification pour le moment.</p>}</div></>}

      {tab === 'profile' && <div className="cg-panel"><h2>Informations personnelles</h2><p>Modifiez les informations de votre compte.</p><form className="cg-form" onSubmit={saveProfile}><label>Nom complet<input value={profileForm.full_name} onChange={e => setProfileForm({...profileForm,full_name:e.target.value})} placeholder="Votre nom complet"/></label><label>Adresse e-mail<input value={user?.email || ''} disabled/></label><label>Téléphone<input value={profileForm.phone} onChange={e => setProfileForm({...profileForm,phone:e.target.value})} placeholder="+228 ..."/></label><label>Type de compte<input value={roleLabel(profile?.role)} disabled/></label><button className="btn btn-primary" disabled={busy}>Enregistrer les modifications</button></form></div>}

      {tab === 'imports' && <div className="cg-panel"><div className="cg-panel-head"><div><h2>Nouvelle demande d’importation</h2><p>Collez le lien du produit que vous souhaitez acheter.</p></div></div><form className="cg-inline-form" onSubmit={submitImport}><input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://www.alibaba.com/..." required/><button className="btn btn-primary" disabled={busy}>Envoyer le lien <ArrowRight size={16}/></button></form><h3 className="cg-subtitle">Historique des importations</h3>{imports.length ? imports.map(i => <div className="cg-list-row" key={i.id}><span className="cg-list-icon"><Link2 size={17}/></span><div><b>{i.source_platform.toUpperCase()}</b><a href={i.source_url} target="_blank" rel="noreferrer">{i.source_url}</a><small>Statut : {i.status}</small></div><time>{dateLabel(i.created_at)}</time></div>) : <p className="cg-muted">Vous n’avez pas encore envoyé de demande.</p>}</div>}

      {tab === 'favorites' && <div className="cg-panel"><h2>Mes produits favoris</h2><p>Vos produits sauvegardés depuis le catalogue.</p>{products.filter(p => favorites.includes(p.id)).length ? <div className="product-grid">{products.filter(p => favorites.includes(p.id)).map(productCard)}</div> : <p className="cg-muted">Aucun favori enregistré. Explorez le catalogue et appuyez sur le cœur d’un produit.</p>}</div>}

      {tab === 'notifications' && <div className="cg-panel"><div className="cg-panel-head"><div><h2>Centre de notifications</h2><p>Les mises à jour de vos demandes et candidatures.</p></div><span className="cg-status">{unreadCount} non lue(s)</span></div>{notifications.length ? notifications.map(n => <div className={'cg-notification '+(!n.read_at?'unread':'')} key={n.id}><span className="cg-list-icon"><Bell size={18}/></span><div><b>{n.title}</b><p>{n.body}</p><small>{dateLabel(n.created_at)}</small></div>{!n.read_at && <button className="cg-text-button" onClick={() => markNotificationRead(n.id)}><Check size={15}/> Marquer comme lue</button>}</div>) : <p className="cg-muted">Aucune notification pour le moment.</p>}</div>}

      {tab === 'orders' && <><div className="cg-panel"><div className="cg-panel-head"><div><h2>Préparer une commande</h2><p>La demande est vérifiée par ChinaGo. Aucun paiement n’est prélevé à cette étape.</p></div></div><form className="cg-form" onSubmit={submitOrderRequest}><label>Produit à commander<input required value={orderForm.product_title} onChange={e => setOrderForm({...orderForm,product_title:e.target.value})} placeholder="Nom du produit"/></label><label>Lien du produit (facultatif)<input value={orderForm.source_url} onChange={e => setOrderForm({...orderForm,source_url:e.target.value})} placeholder="https://..."/></label><div className="cg-two-fields"><label>Quantité<input type="number" min="1" max="1000" required value={orderForm.quantity} onChange={e => setOrderForm({...orderForm,quantity:e.target.value})}/></label><label>Transporteur souhaité<select value={orderForm.cargo_partner_id} onChange={e => setOrderForm({...orderForm,cargo_partner_id:e.target.value})}><option value="">ChinaGo me conseille un cargo</option>{cargoPartners.map(p => <option key={p.id} value={p.id}>{p.name} · {p.service_type === 'air' ? 'Aérien' : p.service_type === 'sea' ? 'Maritime' : p.service_type}</option>)}</select></label></div>{orderDraft?.price_xof ? <p className="cg-price-hint">Prix catalogue indicatif : {money(orderDraft.price_xof)} par unité. Le montant final sera confirmé après vérification.</p> : <p className="cg-price-hint">Le prix sera confirmé après vérification du lien et des options du fournisseur.</p>}<h3 className="cg-subtitle">Coordonnées et livraison</h3><div className="cg-two-fields"><label>Nom du destinataire<input required value={orderForm.contact_name} onChange={e => setOrderForm({...orderForm,contact_name:e.target.value})}/></label><label>Téléphone<input required value={orderForm.contact_phone} onChange={e => setOrderForm({...orderForm,contact_phone:e.target.value})} placeholder="+228 ..."/></label></div><div className="cg-two-fields"><label>Ville de livraison<input required value={orderForm.delivery_city} onChange={e => setOrderForm({...orderForm,delivery_city:e.target.value})}/></label><label>Adresse de livraison<input required value={orderForm.delivery_address} onChange={e => setOrderForm({...orderForm,delivery_address:e.target.value})}/></label></div><label>Précisions<textarea value={orderForm.customer_notes} onChange={e => setOrderForm({...orderForm,customer_notes:e.target.value})} placeholder="Couleur, taille, modèle, lien d’option…"/></label><button className="btn btn-primary" disabled={busy}>Envoyer ma demande de commande <ArrowRight/></button></form></div><div className="cg-panel"><h2>Historique de mes commandes</h2>{orders.length ? orders.map(o => <div className="cg-list-row" key={o.id}><span className="cg-list-icon"><PackageCheck/></span><div><b>{o.order_number}</b><small>Statut : {o.status === 'quote_requested' ? 'Devis demandé' : o.status}</small><small>{money(o.total_xof)} · {o.delivery_city || 'Livraison à confirmer'}</small>{o.order_items?.map((it,idx) => <small key={idx}>{it.product_title} × {it.quantity}</small>)}</div><time>{dateLabel(o.created_at)}</time></div>) : <div className="cg-empty"><ClipboardList/><b>Aucune commande pour le moment</b><small>Vos demandes apparaîtront ici après envoi.</small></div>}</div></>}

      {tab === 'dropshipping' && <><div className="cg-panel cg-feature-panel"><span className="cg-feature-icon"><TrendingUp/></span><div><span className="eyebrow">ESPACE DROPSHIPPING</span><h2>Construisez votre activité de vente</h2><p>Importez des produits, fixez votre prix de vente, suivez vos marges et gérez vos commandes depuis ChinaGo.</p></div></div>{pendingApplication ? <div className="cg-status-box"><Clock3/><div><b>Votre candidature est en cours d’examen</b><p>Nous vous informerons lorsque votre espace dropshipping sera activé.</p></div></div> : profile?.role === 'dropshipper' || profile?.role === 'seller' || profile?.role === 'admin' ? <div className="cg-panel"><h2>Votre activité dropshipping</h2><div className="cg-stats"><div><span><Store/></span><small>Boutiques</small><b>{stores.length}</b></div><div><span><Package/></span><small>Produits</small><b>{storeProducts.length}</b></div><div><span><Wallet/></span><small>Ventes</small><b>0</b></div><div><span><ClipboardList/></span><small>Commandes</small><b>0</b></div></div><button className="btn btn-primary" onClick={() => setTab('store')}>Gérer ma boutique <ArrowRight/></button></div> : <div className="cg-panel"><h2>Devenir dropshipper</h2><p>Envoyez votre candidature. Après validation, vous pourrez créer une boutique et y ajouter des produits.</p><form className="cg-form" onSubmit={submitSellerApplication}><input type="hidden" value="dropshipper"/><label>Nom de votre activité<input required value={sellerForm.business_name} onChange={e => setSellerForm({...sellerForm,business_name:e.target.value})} placeholder="Ex. Ma boutique en ligne"/></label><label>Nom du responsable<input required value={sellerForm.contact_name} onChange={e => setSellerForm({...sellerForm,contact_name:e.target.value})} placeholder="Votre nom"/></label><label>E-mail<input type="email" required value={sellerForm.email || user?.email || ''} onChange={e => setSellerForm({...sellerForm,email:e.target.value})}/></label><label>Téléphone<input required value={sellerForm.phone} onChange={e => setSellerForm({...sellerForm,phone:e.target.value})} placeholder="+228 ..."/></label><label>Lien de votre boutique (facultatif)<input value={sellerForm.store_url} onChange={e => setSellerForm({...sellerForm,store_url:e.target.value})} placeholder="https://..."/></label><label>Présentez votre projet<textarea value={sellerForm.message} onChange={e => setSellerForm({...sellerForm,message:e.target.value})} placeholder="Parlez-nous de votre projet"/></label><button className="btn btn-primary" disabled={busy}>Envoyer ma candidature <ArrowRight/></button></form></div>}</>}

      {tab === 'store' && <><div className="cg-panel"><div className="cg-panel-head"><div><h2>Ma boutique</h2><p>Votre espace e-commerce ChinaGo.</p></div></div>{stores.length ? stores.map(s => <div className="cg-store-card" key={s.id}><span><Store/></span><div><b>{s.name}</b><small>{s.platform === 'shopify' ? 'Shopify' : 'ChinaGo'} · {s.status}</small><small>{s.slug}</small></div></div>) : <p className="cg-muted">Vous n’avez pas encore de boutique.</p>}{['seller','dropshipper','admin'].includes(profile?.role) ? <form className="cg-form cg-divider-top" onSubmit={createStore}><h3>Créer une boutique</h3><label>Nom de la boutique<input required value={storeForm.name} onChange={e => setStoreForm({...storeForm,name:e.target.value})} placeholder="Ma boutique"/></label><label>Description<textarea value={storeForm.description} onChange={e => setStoreForm({...storeForm,description:e.target.value})}/></label><label>Plateforme<select value={storeForm.platform} onChange={e => setStoreForm({...storeForm,platform:e.target.value})}><option value="chinago">Boutique ChinaGo</option><option value="shopify">Boutique Shopify (connexion à venir)</option></select></label>{storeForm.platform === 'shopify' && <label>Domaine Shopify<input value={storeForm.shopify_domain} onChange={e => setStoreForm({...storeForm,shopify_domain:e.target.value})} placeholder="ma-boutique.myshopify.com"/></label>}<button className="btn btn-primary" disabled={busy}>Créer ma boutique <Plus/></button></form> : <div className="cg-status-box"><ShieldCheck/><div><b>Accès réservé aux vendeurs validés</b><p>Envoyez votre candidature dans l’onglet Dropshipping. La boutique sera activée après validation.</p><button className="cg-text-button" onClick={() => setTab('dropshipping')}>Faire une candidature <ArrowRight size={15}/></button></div></div>}</div>
        {activeStore && <div className="cg-panel"><h2>Produits de ma boutique</h2><p>Ajoutez vos fiches produits. Elles restent en brouillon jusqu’à leur publication.</p><form className="cg-form" onSubmit={addStoreProduct}><label>Nom du produit<input required value={storeProductForm.title} onChange={e => setStoreProductForm({...storeProductForm,title:e.target.value})}/></label><label>Lien fournisseur (facultatif)<input value={storeProductForm.source_url} onChange={e => setStoreProductForm({...storeProductForm,source_url:e.target.value})} placeholder="https://www.alibaba.com/..."/></label><div className="cg-two-fields"><label>Prix d’achat (FCFA)<input type="number" min="0" value={storeProductForm.cost_price_xof} onChange={e => setStoreProductForm({...storeProductForm,cost_price_xof:e.target.value})}/></label><label>Prix de vente (FCFA)<input type="number" min="0" value={storeProductForm.selling_price_xof} onChange={e => setStoreProductForm({...storeProductForm,selling_price_xof:e.target.value})}/></label></div><label>Description<textarea value={storeProductForm.description} onChange={e => setStoreProductForm({...storeProductForm,description:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Enregistrer le produit <Plus/></button></form>{storeProducts.map(p => <div className="cg-list-row" key={p.id}><span className="cg-list-icon"><Package/></span><div><b>{p.title}</b><small>{p.status} · Achat : {p.cost_price_xof ? money(p.cost_price_xof) : '—'} · Vente : {p.selling_price_xof ? money(p.selling_price_xof) : '—'}</small></div><time>{dateLabel(p.created_at)}</time></div>)}</div>}</>}

      {tab === 'supplier' && <div className="cg-panel"><h2>Devenir fournisseur ChinaGo</h2><p>Vous êtes fabricant, grossiste ou fournisseur ? Présentez votre entreprise à notre équipe.</p><form className="cg-form" onSubmit={submitSupplierApplication}><label>Nom de l’entreprise<input required value={supplierForm.company_name} onChange={e => setSupplierForm({...supplierForm,company_name:e.target.value})}/></label><label>Nom du contact<input required value={supplierForm.contact_name} onChange={e => setSupplierForm({...supplierForm,contact_name:e.target.value})}/></label><label>E-mail<input type="email" required value={supplierForm.email || user?.email || ''} onChange={e => setSupplierForm({...supplierForm,email:e.target.value})}/></label><label>Téléphone<input required value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm,phone:e.target.value})}/></label><label>Pays<input required value={supplierForm.country} onChange={e => setSupplierForm({...supplierForm,country:e.target.value})}/></label><label>Site web (facultatif)<input value={supplierForm.website_url} onChange={e => setSupplierForm({...supplierForm,website_url:e.target.value})}/></label><label>Catégories de produits (séparées par des virgules)<input value={supplierForm.product_categories} onChange={e => setSupplierForm({...supplierForm,product_categories:e.target.value})} placeholder="Électronique, maison, mode..."/></label><label>Présentation<textarea value={supplierForm.message} onChange={e => setSupplierForm({...supplierForm,message:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Envoyer ma candidature <ArrowRight/></button></form></div>}

      {tab === 'cargo' && <><div className="cg-panel"><div className="cg-panel-head"><div><h2>Organiser un transport</h2><p>Choisissez un partenaire cargo ou laissez ChinaGo vous en proposer un. Le suivi sera mis à jour manuellement au départ.</p></div></div>{cargoPartners.length ? <div className="cg-carrier-grid">{cargoPartners.map(p => <article className="cg-carrier-card" key={p.id}><span><Truck/></span><div><b>{p.name}</b><small>{p.service_type === 'air' ? 'Transport aérien' : p.service_type === 'sea' ? 'Transport maritime' : p.service_type === 'express' ? 'Express' : p.service_type === 'road' ? 'Routier' : 'Transport mixte'}</small><small>{(p.origin_cities || []).join(', ') || 'Chine'} → {(p.destination_cities || []).join(', ') || 'Togo'}</small>{p.estimated_days_min && <small>Délai indicatif : {p.estimated_days_min}–{p.estimated_days_max || p.estimated_days_min} jours</small>}{p.pricing_notes && <small>{p.pricing_notes}</small>}</div><button className="btn btn-ghost" onClick={() => setCargoForm(old => ({...old,cargo_partner_id:p.id}))}>{cargoForm.cargo_partner_id === p.id ? 'Sélectionné' : 'Choisir'}</button></article>)}</div> : <div className="cg-empty"><Truck/><b>Les transporteurs seront bientôt disponibles</b><small>Vous pouvez tout de même déposer une demande : ChinaGo vous attribuera un partenaire manuellement.</small></div>}<form className="cg-form cg-divider-top" onSubmit={submitCargoRequest}><h3>Informations sur le colis</h3><label>Transporteur<select value={cargoForm.cargo_partner_id} onChange={e => setCargoForm({...cargoForm,cargo_partner_id:e.target.value})}><option value="">Laisser ChinaGo choisir</option>{cargoPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="cg-two-fields"><label>Ville de départ<input required value={cargoForm.origin_city} onChange={e => setCargoForm({...cargoForm,origin_city:e.target.value})}/></label><label>Ville d’arrivée<input required value={cargoForm.destination_city} onChange={e => setCargoForm({...cargoForm,destination_city:e.target.value})}/></label></div><label>Description du colis<input required value={cargoForm.package_description} onChange={e => setCargoForm({...cargoForm,package_description:e.target.value})} placeholder="Ex. 2 cartons de vêtements"/></label><div className="cg-three-fields"><label>Nombre de colis<input type="number" min="1" required value={cargoForm.package_count} onChange={e => setCargoForm({...cargoForm,package_count:e.target.value})}/></label><label>Poids (kg)<input type="number" min="0.1" step="0.1" value={cargoForm.weight_kg} onChange={e => setCargoForm({...cargoForm,weight_kg:e.target.value})}/></label><label>Dimensions<input value={cargoForm.dimensions} onChange={e => setCargoForm({...cargoForm,dimensions:e.target.value})} placeholder="L × l × H"/></label></div><label>Valeur déclarée (FCFA)<input type="number" min="0" value={cargoForm.declared_value_xof} onChange={e => setCargoForm({...cargoForm,declared_value_xof:e.target.value})}/></label><h3 className="cg-subtitle">Expéditeur et destinataire</h3><div className="cg-two-fields"><label>Nom de l’expéditeur<input required value={cargoForm.sender_name} onChange={e => setCargoForm({...cargoForm,sender_name:e.target.value})}/></label><label>Téléphone expéditeur<input required value={cargoForm.sender_phone} onChange={e => setCargoForm({...cargoForm,sender_phone:e.target.value})}/></label></div><div className="cg-two-fields"><label>Nom du destinataire<input required value={cargoForm.receiver_name} onChange={e => setCargoForm({...cargoForm,receiver_name:e.target.value})}/></label><label>Téléphone destinataire<input required value={cargoForm.receiver_phone} onChange={e => setCargoForm({...cargoForm,receiver_phone:e.target.value})}/></label></div><label>Adresse de livraison<input required value={cargoForm.receiver_address} onChange={e => setCargoForm({...cargoForm,receiver_address:e.target.value})}/></label><label>Informations complémentaires<textarea value={cargoForm.customer_notes} onChange={e => setCargoForm({...cargoForm,customer_notes:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Enregistrer ma demande cargo <Truck/></button></form>{cargoWhatsAppUrl && <a className="btn btn-primary cg-whatsapp-link" href={cargoWhatsAppUrl} target="_blank" rel="noreferrer"><MessageCircle/> Envoyer les détails au transporteur sur WhatsApp</a>}</div><div className="cg-panel"><h2>Suivi de mes demandes cargo</h2>{cargoRequests.filter(x => x.user_id === undefined || x.user_id === user?.id).length ? cargoRequests.filter(x => x.user_id === undefined || x.user_id === user?.id).map(c => <div className="cg-list-row" key={c.id}><span className="cg-list-icon"><Truck/></span><div><b>{c.cargo_partners?.name || 'Transporteur à attribuer'}</b><small>{c.origin_city} → {c.destination_city} · {c.package_description}</small><small>Statut : {c.status === 'submitted' ? 'Demande reçue' : c.status}</small>{c.tracking_reference && <small>Suivi : {c.tracking_reference}</small>}{c.quoted_price_xof && <small>Devis : {money(c.quoted_price_xof)}</small>}</div><time>{dateLabel(c.created_at)}</time></div>) : <p className="cg-muted">Aucune demande cargo pour le moment.</p>}</div></>}
      {tab === 'admin' && isAdmin && <><div className="cg-panel"><h2>Publier un produit dans le catalogue</h2><p>Ajoutez une fiche vérifiée à partir des informations et photos fournies par le fournisseur. Cochez « Produit gagnant » uniquement après vérification des données.</p><form className="cg-form" onSubmit={submitAdminProduct}><label>Nom du produit<input required value={adminProductForm.title} onChange={e => setAdminProductForm({...adminProductForm,title:e.target.value})}/></label><label>Catégorie<select value={adminProductForm.category_id} onChange={e => setAdminProductForm({...adminProductForm,category_id:e.target.value})}><option value="">Sans catégorie</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Description<textarea value={adminProductForm.description} onChange={e => setAdminProductForm({...adminProductForm,description:e.target.value})}/></label><label>Lien fournisseur<input value={adminProductForm.source_url} onChange={e => setAdminProductForm({...adminProductForm,source_url:e.target.value})} placeholder="https://www.alibaba.com/..."/></label><label>Prix indicatif en FCFA<input type="number" min="0" value={adminProductForm.price_xof} onChange={e => setAdminProductForm({...adminProductForm,price_xof:e.target.value})}/></label><label>URL de l’image produit<input value={adminProductForm.image_url} onChange={e => setAdminProductForm({...adminProductForm,image_url:e.target.value})} placeholder="https://..."/></label><label className="cg-check-label"><input type="checkbox" checked={adminProductForm.is_winner} onChange={e => setAdminProductForm({...adminProductForm,is_winner:e.target.checked})}/> Produit tendance / gagnant vérifié</label><button className="btn btn-primary" disabled={busy}>Publier le produit <Plus/></button></form></div><div className="cg-panel"><h2>Ajouter un transporteur manuel</h2><p>Renseignez les coordonnées communiquées par le transporteur. Aucun logiciel ni API n’est nécessaire.</p><form className="cg-form" onSubmit={submitCargoPartner}><label>Nom du transporteur<input required value={cargoPartnerForm.name} onChange={e => setCargoPartnerForm({...cargoPartnerForm,name:e.target.value})}/></label><label>Type de transport<select value={cargoPartnerForm.service_type} onChange={e => setCargoPartnerForm({...cargoPartnerForm,service_type:e.target.value})}><option value="air">Aérien</option><option value="sea">Maritime</option><option value="road">Routier</option><option value="express">Express</option><option value="mixed">Mixte</option></select></label><div className="cg-two-fields"><label>Villes de départ<input value={cargoPartnerForm.origin_cities} onChange={e => setCargoPartnerForm({...cargoPartnerForm,origin_cities:e.target.value})}/></label><label>Villes de destination<input value={cargoPartnerForm.destination_cities} onChange={e => setCargoPartnerForm({...cargoPartnerForm,destination_cities:e.target.value})}/></label></div><label>WhatsApp du transporteur<input value={cargoPartnerForm.whatsapp_phone} onChange={e => setCargoPartnerForm({...cargoPartnerForm,whatsapp_phone:e.target.value})} placeholder="+86... ou +228..."/></label><div className="cg-two-fields"><label>Téléphone<input value={cargoPartnerForm.contact_phone} onChange={e => setCargoPartnerForm({...cargoPartnerForm,contact_phone:e.target.value})}/></label><label>E-mail<input type="email" value={cargoPartnerForm.contact_email} onChange={e => setCargoPartnerForm({...cargoPartnerForm,contact_email:e.target.value})}/></label></div><div className="cg-two-fields"><label>Délai minimum (jours)<input type="number" min="1" value={cargoPartnerForm.estimated_days_min} onChange={e => setCargoPartnerForm({...cargoPartnerForm,estimated_days_min:e.target.value})}/></label><label>Délai maximum (jours)<input type="number" min="1" value={cargoPartnerForm.estimated_days_max} onChange={e => setCargoPartnerForm({...cargoPartnerForm,estimated_days_max:e.target.value})}/></label></div><label>Tarifs / conditions<textarea value={cargoPartnerForm.pricing_notes} onChange={e => setCargoPartnerForm({...cargoPartnerForm,pricing_notes:e.target.value})} placeholder="Ex. tarif au kg, minimum facturable, frais locaux…"/></label><label>Instructions<textarea value={cargoPartnerForm.instructions} onChange={e => setCargoPartnerForm({...cargoPartnerForm,instructions:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Ajouter le transporteur <Plus/></button></form></div><div className="cg-panel"><h2>Toutes les demandes cargo</h2>{cargoRequests.map(c => <div className="cg-list-row" key={c.id}><span className="cg-list-icon"><Truck/></span><div><b>{c.cargo_partners?.name || 'À attribuer'} · {c.origin_city} → {c.destination_city}</b><small>{c.package_description} · {c.status}</small><small>{c.user_id}</small></div><select value={c.status} onChange={e => updateCargoStatus(c.id,e.target.value)}><option value="submitted">Reçue</option><option value="partner_contacted">Transporteur contacté</option><option value="quoted">Devis envoyé</option><option value="accepted">Acceptée</option><option value="in_transit">En transit</option><option value="arrived">Arrivée</option><option value="delivered">Livrée</option><option value="cancelled">Annulée</option></select></div>)}</div></>}
      {tab === 'applications' && <div className="cg-panel"><h2>Mes candidatures</h2><p>Suivez les demandes envoyées à l’équipe ChinaGo.</p>{applications.map(a => <div className="cg-list-row" key={a.id}><span className="cg-list-icon"><TrendingUp/></span><div><b>{a.account_type === 'dropshipper' ? 'Candidature dropshipping' : 'Candidature e-commerce'}</b><small>{a.business_name} · {a.status}</small></div><time>{dateLabel(a.created_at)}</time></div>)}{supplierApplications.map(a => <div className="cg-list-row" key={a.id}><span className="cg-list-icon"><PackageCheck/></span><div><b>Candidature fournisseur</b><small>{a.company_name} · {a.status}</small></div><time>{dateLabel(a.created_at)}</time></div>)}{!applications.length && !supplierApplications.length && <p className="cg-muted">Aucune candidature envoyée.</p>}</div>}
      </section>
    </div></main>}

    <footer className="footer"><div className="wrap footer-inner"><a className="brand footer-brand" href="#home"><span className="brand-icon">C<span>G</span></span><span>China<span>Go</span><small>IMPORT · SHOP · SELL</small></span></a><p>Votre partenaire pour acheter, importer et développer votre commerce entre la Chine et l’Afrique.</p><small>© 2026 ChinaGo. Les intégrations fournisseurs et paiements seront activées après validation des accès officiels.</small></div></footer>
  </div>;
}
