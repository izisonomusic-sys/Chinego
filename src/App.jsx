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
  return host.includes('alibaba.') ? 'alibaba' : host.includes('aliexpress.') ? 'aliexpress' : host.includes('amazon.') ? 'amazon' : host.includes('ebay.') ? 'ebay' : 'other';
};
const storefrontSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null;
const storefrontDomain = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
const storefrontMode = Boolean(storefrontSlug || (storefrontDomain && !['chinago-tby6.onrender.com','localhost','127.0.0.1'].includes(storefrontDomain)));
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
  const [orderWhatsAppUrl, setOrderWhatsAppUrl] = useState('');
  const [orderDraft, setOrderDraft] = useState(null);
  const [orderForm, setOrderForm] = useState({ product_title: '', source_url: '', quantity: '1', contact_name: '', contact_phone: '', delivery_city: 'Lomé', delivery_address: '', customer_notes: '', cargo_partner_id: '' });
  const [cargoForm, setCargoForm] = useState({ cargo_partner_id: '', origin_city: 'Guangzhou', destination_city: 'Lomé', package_description: '', package_count: '1', weight_kg: '', dimensions: '', declared_value_xof: '', sender_name: '', sender_phone: '', receiver_name: '', receiver_phone: '', receiver_address: '', customer_notes: '' });
  const [cargoPartnerForm, setCargoPartnerForm] = useState({ name: '', service_type: 'air', origin_cities: 'Guangzhou, Yiwu', destination_cities: 'Lomé', whatsapp_phone: '', contact_phone: '', contact_email: '', pricing_notes: '', estimated_days_min: '', estimated_days_max: '', instructions: '' });
  const [adminProductForm, setAdminProductForm] = useState({ title: '', description: '', category_id: '', source_url: '', price_xof: '', image_url: '', is_winner: false });
  const [favorites, setFavorites] = useState([]);
  const [imports, setImports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [supportConversations, setSupportConversations] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const [activeSupportConversation, setActiveSupportConversation] = useState('');
  const [supportDraft, setSupportDraft] = useState('');
  const [orders, setOrders] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminImportRequests, setAdminImportRequests] = useState([]);
  const [adminStores, setAdminStores] = useState([]);
  const [adminStoreProducts, setAdminStoreProducts] = useState([]);
  const [adminSellerApplications, setAdminSellerApplications] = useState([]);
  const [adminSupplierApplications, setAdminSupplierApplications] = useState([]);
  const [applications, setApplications] = useState([]);
  const [supplierApplications, setSupplierApplications] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [view, setView] = useState(storefrontMode ? 'storefront' : 'home');
  const [publicStorefront, setPublicStorefront] = useState(null);
  const [storefrontLoading, setStorefrontLoading] = useState(storefrontMode);
  const [tab, setTab] = useState('overview');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState('');
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('t-money-togo');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importOrderOpen, setImportOrderOpen] = useState(false);
  const [importSelection, setImportSelection] = useState({quantity:1,color:'',size:''});
  const [importOrderDetails, setImportOrderDetails] = useState({contact_name:'',phone:'',whatsapp:'',country:'Togo',city:'',neighborhood:'',street:'',instructions:''});
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [sellerForm, setSellerForm] = useState({ account_type: 'dropshipper', business_name: '', contact_name: '', email: '', phone: '', store_url: '', message: '' });
  const [supplierForm, setSupplierForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', whatsapp:'', whatsapp_opt_in:false, country: 'China', website_url: '', product_categories: '', message: '' });
  const [storeForm, setStoreForm] = useState({ name: '', description: '', platform: 'chinago', shopify_domain: '' });
  const [storeProductForm, setStoreProductForm] = useState({ title: '', source_url: '', image_url: '', cost_price_xof: '', selling_price_xof: '', description: '', inventory_quantity: '' });
  const [storeCollections, setStoreCollections] = useState([]);
  const [storePages, setStorePages] = useState([]);
  const [storeDiscounts, setStoreDiscounts] = useState([]);
  const [storeCollectionForm, setStoreCollectionForm] = useState({title:'',description:''});
  const [storePageForm, setStorePageForm] = useState({title:'',content:''});
  const [storeDiscountForm, setStoreDiscountForm] = useState({code:'',discount_type:'percentage',value:'',minimum_order_xof:''});
  const [storeThemeForm, setStoreThemeForm] = useState({primary:'#0B2D5B',accent:'#FF8A00',store_email:'',store_phone:'',return_policy:'',shipping_policy:''});
  const [storefrontCart, setStorefrontCart] = useState([]);
  const [checkoutDetails, setCheckoutDetails] = useState({contact_name:'',contact_phone:'',delivery_address:'',delivery_city:'Lomé',customer_notes:''});
  const [walletAccounts, setWalletAccounts] = useState([]);
  const [walletEntries, setWalletEntries] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [payoutForm, setPayoutForm] = useState({amount:'',payout_method:'T-Money',beneficiary_name:'',beneficiary_phone:'',beneficiary_account:'',beneficiary_bank:''});
  const [storeMembers, setStoreMembers] = useState([]);
  const [storeOrders, setStoreOrders] = useState([]);
  const [stockDrafts, setStockDrafts] = useState({});
  const [teamUserId, setTeamUserId] = useState('');
  const [teamPermissions, setTeamPermissions] = useState({view_products:true,manage_products:false,view_orders:true,manage_orders:false,manage_pages:false,manage_discounts:false});
  const [customDomainForm, setCustomDomainForm] = useState('');

  useEffect(() => {
    if (!storefrontMode || !supabase) return;
    let cancelled = false;
    async function loadStorefront() {
      setStorefrontLoading(true);
      let storeQuery=supabase.from('stores').select('id,name,slug,description,theme_config,store_settings,currency,custom_domain').eq('status','active');
      storeQuery=storefrontSlug?storeQuery.eq('slug',storefrontSlug):storeQuery.eq('custom_domain',storefrontDomain);
      const {data:store,error:storeError} = await storeQuery.maybeSingle();
      if (storeError || !store) {
        if (!cancelled) { setPublicStorefront(null); setNotice('Cette boutique est introuvable ou momentanément indisponible.'); setStorefrontLoading(false); }
        return;
      }
      const [productsResult,collectionsResult,pagesResult] = await Promise.all([
        supabase.from('store_products').select('*').eq('store_id',store.id).eq('status','published').order('created_at',{ascending:false}),
        supabase.from('store_collections').select('*').eq('store_id',store.id).eq('status','active').order('sort_order'),
        supabase.from('store_pages').select('*').eq('store_id',store.id).eq('status','published').order('created_at')
      ]);
      if (!cancelled) {
        setPublicStorefront({store,products:productsResult.data||[],collections:collectionsResult.data||[],pages:pagesResult.data||[]});
        setStorefrontLoading(false);
      }
    }
    loadStorefront();
    return () => { cancelled = true; };
  }, []);

  const loadPublicProducts = useCallback(async () => {
    if (!supabase) return;
    const [productResult, categoryResult, cargoResult, storeProductResult] = await Promise.all([
      supabase.from('products')
        .select('id,title,description,source_url,price_xof,currency,is_winner,is_featured,category_id,product_variants,product_options,minimum_order_quantity,original_currency,original_price_min,original_price_max,supplier_company,brand,sku,model_number,origin_country,material,color,size,stock_quantity,product_condition,package_dimensions,package_weight,warranty,certifications,product_specs,categories(name),product_images(image_url,alt_text,sort_order)')
        .eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
      supabase.from('cargo_partners').select('id,name,service_type,origin_cities,destination_cities,whatsapp_phone,pricing_notes,estimated_days_min,estimated_days_max,instructions').eq('is_active', true).order('name'),
      supabase.from('store_products').select('id,title,description,source_url,image_url,selling_price_xof,store_id,stores(name)').eq('status', 'published').order('created_at', { ascending: false })
    ]);
    if (productResult.error) console.error('Catalogue:', productResult.error.message);
    if (categoryResult.error) console.error('Catégories:', categoryResult.error.message);
    if (cargoResult.error) console.error('Partenaires cargo:', cargoResult.error.message);
    if (storeProductResult.error) console.error('Produits des boutiques:', storeProductResult.error.message);
    const storeListings = (storeProductResult.data || []).map(item => ({
      id: 'store-' + item.id, store_product_id: item.id, store_name: item.stores?.name || 'Boutique partenaire',
      title: item.title, description: item.description, source_url: item.source_url,
      price_xof: item.selling_price_xof, currency: 'XOF', is_winner: false, is_featured: false,
      category_id: null, product_images: item.image_url ? [{ image_url: item.image_url, alt_text: item.title }] : []
    }));
    setProducts([...(productResult.data || []), ...storeListings]);
    setCategories(categoryResult.data || []);
    setCargoPartners(cargoResult.data || []);
  }, []);

  const loadMemberData = useCallback(async currentUser => {
    if (!supabase || !currentUser) return;
    const [p, f, i, n, o, a, sa, s, cr] = await Promise.all([
      supabase.from('profiles').select('id,full_name,phone,role').eq('id', currentUser.id).maybeSingle(),
      supabase.from('product_favorites').select('product_id').eq('user_id', currentUser.id),
      supabase.from('import_requests').select('id,source_url,source_platform,status,created_at,product_title,product_description,product_image_url,product_images,product_variants,product_options,minimum_order_quantity,original_currency,original_price_min,original_price_max,supplier_company,supplier_contact_name,supplier_phone,supplier_whatsapp,supplier_email,supplier_profile_url,extraction_status,quantity,unit_price_xof,shipping_estimate_xof,admin_notes,quoted_at,selected_options,order_id,customer_contact_name,customer_phone,customer_whatsapp,delivery_country,delivery_city,delivery_neighborhood,delivery_street').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('notifications').select('id,title,body,kind,read_at,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('orders').select('id,order_number,tracking_code,status,total_xof,created_at,store_id,delivery_city,delivery_address,order_items(product_title,quantity)').eq('customer_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('seller_applications').select('id,account_type,business_name,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('supplier_applications').select('id,company_name,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('stores').select('id,owner_id,name,slug,description,platform,shopify_domain,custom_domain,custom_domain_status,status,created_at').eq('owner_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('cargo_requests').select('id,order_id,cargo_partner_id,origin_city,destination_city,package_description,package_count,weight_kg,status,tracking_reference,quoted_price_xof,created_at,cargo_partners(name,whatsapp_phone)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50)
    ]);
    if (p.data) {
      setProfile(p.data);
      setProfileForm({ full_name: p.data.full_name || '', phone: p.data.phone || '' });
      if (p.data.role === 'admin' && new URLSearchParams(window.location.search).get('admin') !== '1') {
        window.location.replace('/?admin=1');
        return;
      }
    }
    setFavorites((f.data || []).map(x => x.product_id));
    setImports(i.data || []); setNotifications(n.data || []); setOrders(o.data || []);
    const { data: conversations } = await supabase.from('support_conversations').select('id,subject,status,created_at,updated_at').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
    setSupportConversations(conversations || []);
    if (conversations?.length) {
      const activeId = conversations.some(x => x.id === activeSupportConversation) ? activeSupportConversation : conversations[0].id;
      setActiveSupportConversation(activeId);
      const { data: messages } = await supabase.from('support_messages').select('id,conversation_id,sender_id,sender_role,body,created_at').in('conversation_id', conversations.map(x => x.id)).order('created_at', { ascending: true });
      setSupportMessages(messages || []);
    } else { setActiveSupportConversation(''); setSupportMessages([]); }
    setApplications(a.data || []); setSupplierApplications(sa.data || []);
    const [walletResult,ledgerResult,payoutResult] = await Promise.all([
      supabase.from('wallet_accounts').select('*').eq('owner_user_id',currentUser.id).eq('status','active'),
      supabase.from('wallet_ledger').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(50),
      supabase.from('payout_requests').select('*').eq('user_id',currentUser.id).order('requested_at',{ascending:false}).limit(30)
    ]);
    setWalletAccounts(walletResult.data||[]); setWalletEntries(ledgerResult.data||[]); setPayoutRequests(payoutResult.data||[]);
    const {data:memberIds} = await supabase.from('store_members').select('store_id').eq('user_id',currentUser.id).eq('status','active');
    const allStoreIds=[...(s.data||[]).map(x=>x.id),...(memberIds||[]).map(x=>x.store_id)];
    const {data:memberRows} = allStoreIds.length ? await supabase.from('store_members').select('*').in('store_id',allStoreIds) : {data:[]};
    setStoreMembers(memberRows||[]);
    const memberStoreIds=(memberRows||[]).filter(x=>x.status==='active').map(x=>x.store_id).filter(id=>!(s.data||[]).some(st=>st.id===id));
    let memberStores=[];
    if(memberStoreIds.length){const {data:ms}=await supabase.from('stores').select('id,owner_id,name,slug,description,platform,shopify_domain,custom_domain,custom_domain_status,status,created_at').in('id',memberStoreIds);memberStores=ms||[];}
    setStores([...(s.data||[]),...memberStores]);
    if(allStoreIds.length){const {data:merchantOrders}=await supabase.from('orders').select('id,order_number,status,total_xof,created_at,contact_name,contact_phone,delivery_city,delivery_address,order_items(product_title,quantity)').in('store_id',allStoreIds).order('created_at',{ascending:false}).limit(100);setStoreOrders(merchantOrders||[]);}else setStoreOrders([]);
    const ownedStoreIds = allStoreIds;
    if (ownedStoreIds.length) {
      const [sp, sc, pg, dc] = await Promise.all([
        supabase.from('store_products').select('*').in('store_id', ownedStoreIds).order('created_at',{ascending:false}),
        supabase.from('store_collections').select('*').in('store_id', ownedStoreIds).order('created_at',{ascending:false}),
        supabase.from('store_pages').select('*').in('store_id', ownedStoreIds).order('created_at',{ascending:false}),
        supabase.from('store_discounts').select('*').in('store_id', ownedStoreIds).order('created_at',{ascending:false})
      ]);
      setStoreProducts(sp.data || []); setStoreCollections(sc.data || []); setStorePages(pg.data || []); setStoreDiscounts(dc.data || []);
      const config = (s.data || [])[0]?.theme_config || {};
      setStoreThemeForm(old => ({...old,...config,store_email:config.store_email||'',store_phone:config.store_phone||'',return_policy:config.return_policy||'',shipping_policy:config.shipping_policy||''}));
    } else { setStoreProducts([]); setStoreCollections([]); setStorePages([]); setStoreDiscounts([]); }
    if (p.data?.role === 'admin') {
      const [allCargo, allOrders, allSellerApps, allSupplierApps, allStores, allStoreProducts, allImports] = await Promise.all([
        supabase.from('cargo_requests').select('id,user_id,order_id,cargo_partner_id,origin_city,destination_city,package_description,package_count,weight_kg,status,tracking_reference,quoted_price_xof,created_at,sender_name,sender_phone,receiver_name,receiver_phone,receiver_address,customer_notes,cargo_partners(name,whatsapp_phone)').order('created_at', { ascending: false }).limit(100),
        supabase.from('orders').select('id,order_number,tracking_code,customer_id,status,subtotal_xof,shipping_xof,total_xof,created_at,contact_name,contact_phone,delivery_city,delivery_address,order_items(product_title,quantity)').order('created_at', { ascending: false }).limit(100),
        supabase.from('seller_applications').select('id,user_id,account_type,business_name,contact_name,email,phone,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('supplier_applications').select('id,user_id,company_name,contact_name,email,phone,country,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('stores').select('id,owner_id,name,slug,platform,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('store_products').select('id,store_id,title,status,created_at,stores(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('import_requests').select('id,user_id,source_url,source_platform,status,created_at,product_title,product_description,product_image_url,product_images,product_variants,product_options,minimum_order_quantity,original_currency,original_price_min,original_price_max,supplier_company,supplier_contact_name,supplier_phone,supplier_whatsapp,supplier_email,supplier_profile_url,extraction_status,quantity,unit_price_xof,shipping_estimate_xof,admin_notes').order('created_at', { ascending: false }).limit(100)
      ]);
      setCargoRequests(allCargo.data || []);
      setAdminOrders(allOrders.data || []);
      setAdminSellerApplications(allSellerApps.data || []);
      setAdminSupplierApplications(allSupplierApps.data || []);
      setAdminStores(allStores.data || []);
      setAdminStoreProducts(allStoreProducts.data || []);
      setAdminImportRequests(allImports.data || []);
    } else {
      setCargoRequests(cr.data || []);
      setAdminOrders([]); setAdminSellerApplications([]); setAdminSupplierApplications([]);
      setAdminStores([]); setAdminStoreProducts([]); setAdminImportRequests([]);
    }
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
        setSupportConversations([]); setSupportMessages([]); setActiveSupportConversation('');
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

  async function startPaydunyaCheckout(order) {
    if (!supabase || !user) { setAuthMode('signin'); setAuthOpen(true); return; }
    setPaymentMethod('t-money-togo');
    setPaymentPhone(profile?.phone || '');
    setPaymentModal({ order, stage: 'choose', transactionId: '', message: '' });
  }

  async function submitSoftPay(event) {
    event.preventDefault();
    if (!paymentModal?.order || !paymentPhone.trim()) return;
    setPaymentBusy(true); setNotice('');
    const { data, error } = await supabase.functions.invoke('paydunya-payments', {
      body: { action: 'create_softpay', order_id: paymentModal.order.id, payment_method: paymentMethod, phone_number: paymentPhone.trim() }
    });
    setPaymentBusy(false);
    if (error || data?.error) {
      setPaymentModal(current => ({ ...current, stage: 'choose', message: data?.error || error?.message || 'Impossible de lancer le paiement.' }));
      return;
    }
    setPaymentModal(current => ({ ...current, stage: 'pending', transactionId: data.transaction_id, message: data.message || 'Validez la demande sur votre téléphone.' }));
  }

  async function checkSoftPayStatus() {
    if (!paymentModal?.transactionId) return;
    setPaymentBusy(true);
    const { data, error } = await supabase.functions.invoke('paydunya-payments', {
      body: { action: 'get_payment_status', transaction_id: paymentModal.transactionId }
    });
    setPaymentBusy(false);
    if (error || data?.error) { setNotice(data?.error || error?.message || 'Vérification impossible.'); return; }
    if (data.transaction.status === 'confirmed') {
      setNotice('Paiement confirmé. Votre commande est maintenant prise en charge par ChinaGo.');
      setPaymentModal(null);
      await loadMemberData(user);
    } else if (['failed','cancelled'].includes(data.transaction.status)) {
      setPaymentModal(current => ({ ...current, stage: 'choose', message: 'Le paiement n’a pas abouti. Vérifiez le numéro et réessayez.' }));
    } else {
      setPaymentModal(current => ({ ...current, message: 'Paiement toujours en attente. Validez la demande sur votre téléphone, puis vérifiez à nouveau.' }));
    }
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
    if (!user || !supabase) { setAuthMode('signin'); setAuthOpen(true); return setNotice('Connectez-vous pour continuer votre demande.'); }
    setBusy(true);
    try {
      let preview = null;
      let previewMessage = '';
      const { data: extracted, error: extractionError } = await supabase.functions.invoke('preview-product', { body: { url: parsed.toString() } });
      if (!extractionError && extracted) { preview = extracted; previewMessage = extracted.message || extracted.error || ''; }
      else previewMessage = extractionError?.message || 'Le site ne permet pas encore la lecture automatique. Vous pourrez compléter les informations manquantes.';
      const sourcePlatform = ['alibaba','aliexpress','amazon','ebay'].includes(preview?.source_platform) ? preview.source_platform : platformFromUrl(parsed.toString());
      const normalized = {
        ...(preview || {}),
        source_url: preview?.source_url || parsed.toString(),
        source_platform: sourcePlatform,
        product_title: preview?.product_title || null,
        product_description: preview?.product_description || null,
        product_image_url: preview?.product_image_url || null,
        product_images: preview?.product_images || [],
        product_variants: preview?.product_variants || [],
        product_options: preview?.product_options || [],
        original_price_min: preview?.original_price_min ?? null,
        original_price_max: preview?.original_price_max ?? null,
        original_currency: preview?.original_currency || null,
        supplier_company: preview?.supplier_company || null,
        extraction_status: preview?.extraction_status || 'manual_review',
        extraction_source: preview?.extraction_source || 'manual_review',
        message: previewMessage
      };
      setImportPreview(normalized);
      setImportSelection({quantity:Math.max(1,Number(normalized.minimum_order_quantity||1)),color:normalized.color||'',size:normalized.size||''});
      setImportOrderDetails({contact_name:profile?.full_name||'',phone:profile?.phone||'',whatsapp:profile?.phone||'',country:'Togo',city:'',neighborhood:'',street:'',instructions:''});
      setImportUrl('');
      setNotice(normalized.ok ? 'Fiche produit récupérée. Vérifiez les options et les informations.' : 'Le lien est reconnu, mais certaines informations devront être confirmées manuellement.');
    } catch (error) { setNotice(error.message || 'Impossible de vérifier ce produit.'); }
    finally { setBusy(false); }
  }

  async function confirmImportRequest(event) {
    event.preventDefault();
    if (!user || !supabase || !importPreview) return;
    if (!importOrderDetails.contact_name.trim() || !importOrderDetails.phone.trim() || !importOrderDetails.whatsapp.trim() ||
        !importOrderDetails.country.trim() || !importOrderDetails.city.trim() || !importOrderDetails.neighborhood.trim() || !importOrderDetails.street.trim()) {
      return setNotice('Complétez votre nom, vos téléphones et toute votre adresse de livraison.');
    }
    setBusy(true);
    try {
      const payload = {
        user_id:user.id,
        source_url:importPreview.source_url,
        source_platform:importPreview.source_platform,
        product_title:importPreview.product_title,
        product_description:importPreview.product_description,
        product_image_url:importPreview.product_image_url,
        product_images:importPreview.product_images||[],
        product_variants:importPreview.product_variants||[],
        product_options:importPreview.product_options||[],
        original_price_min:importPreview.original_price_min??null,
        original_price_max:importPreview.original_price_max??null,
        original_currency:importPreview.original_currency||null,
        supplier_company:importPreview.supplier_company||null,
        extraction_status:importPreview.extraction_status||'manual_review',
        extraction_source:importPreview.extraction_source||'manual_review',
        quantity:Math.max(1,Math.min(10000,Number(importSelection.quantity)||1)),
        selected_options:{color:importSelection.color||null,size:importSelection.size||null},
        customer_contact_name:importOrderDetails.contact_name.trim(),
        customer_phone:importOrderDetails.phone.trim(),
        customer_whatsapp:importOrderDetails.whatsapp.trim(),
        delivery_country:importOrderDetails.country.trim(),
        delivery_city:importOrderDetails.city.trim(),
        delivery_neighborhood:importOrderDetails.neighborhood.trim(),
        delivery_street:importOrderDetails.street.trim(),
        delivery_instructions:importOrderDetails.instructions.trim()||null
      };
      const {data:saved,error}=await supabase.from('import_requests').insert(payload).select('id').single();
      if(error)throw error;
      setImportOrderOpen(false);
      setImportPreview(null);
      setTab('imports');
      setNotice('Votre demande ChinaGo a été enregistrée. Notre équipe va vérifier le prix final, la disponibilité et le transport avant de vous envoyer le récapitulatif de paiement.');
      await loadMemberData(user);
    } catch(error) { setNotice(error.message||'Impossible d’enregistrer votre demande.'); }
    finally { setBusy(false); }
  }

  async function acceptImportQuote(item) {
    if (!user || !supabase) return;
    setBusy(true);
    try {
      const {data:orderId,error}=await supabase.rpc('accept_import_quote',{p_import_request_id:item.id});
      if(error)throw error;
      const {data:order,error:orderError}=await supabase.from('orders').select('id,order_number,total_xof,status,tracking_code,contact_phone').eq('id',orderId).single();
      if(orderError)throw orderError;
      setPaymentPhone(order.contact_phone||profile?.phone||'');
      setPaymentModal({order,stage:'choose',message:'Votre devis est accepté. Vérifiez le montant et choisissez T-Money ou Moov Money pour payer.'});
      await loadMemberData(user);
    } catch(error) { setNotice(error.message||'Impossible de préparer le paiement du devis.'); }
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
    setNotice('Votre espace vendeur est activé immédiatement. Vous pouvez créer votre boutique et publier vos produits.');
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
    setNotice('Votre profil fournisseur est activé immédiatement.');
    await loadMemberData(user); setTab('applications');
  }

  async function createStore(event) {
    event.preventDefault();
    setBusy(true);
    const slug = storeForm.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + user.id.slice(0, 6);
    const { data, error } = await supabase.from('stores').insert({
      owner_id: user.id, name: storeForm.name.trim(), slug, description: storeForm.description.trim(),
      platform: storeForm.platform, shopify_domain: storeForm.shopify_domain.trim() || null, status: 'active'
    }).select().single();
    setBusy(false);
    if (error) return setNotice(error.message);
    setStores(old => [data, ...old]);
    
    setNotice('Votre boutique est créée et active. Le portefeuille vendeur est prêt.');
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
    let imageUrl = storeProductForm.image_url.trim();
    if (imageUrl) {
      try { const image = new URL(imageUrl); if (image.protocol !== 'https:') throw new Error(); }
      catch { setBusy(false); return setNotice('L’image doit utiliser une adresse https:// valide.'); }
    }
    const { error } = await supabase.from('store_products').insert({
      store_id: activeStore.id, title: storeProductForm.title.trim(), description: storeProductForm.description.trim(),
      source_url: storeProductForm.source_url.trim() || null, image_url: imageUrl || null, source_platform: sourcePlatform,
      cost_price_xof: storeProductForm.cost_price_xof ? Number(storeProductForm.cost_price_xof) : null,
      selling_price_xof: storeProductForm.selling_price_xof ? Number(storeProductForm.selling_price_xof) : null,
      status: 'published', inventory_quantity:storeProductForm.inventory_quantity?Number(storeProductForm.inventory_quantity):0, track_inventory:Boolean(storeProductForm.inventory_quantity)
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setStoreProductForm({ title: '', source_url: '', image_url: '', cost_price_xof: '', selling_price_xof: '', description: '', inventory_quantity:'' });
    setNotice('Produit publié immédiatement dans votre boutique.');
    await loadMemberData(user);
  }

  async function createStoreCollection(event) {
    event.preventDefault();
    if (!activeStore || !storeCollectionForm.title.trim()) return;
    const slug = storeCollectionForm.title.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    setBusy(true);
    const {error} = await supabase.from('store_collections').insert({store_id:activeStore.id,title:storeCollectionForm.title.trim(),slug,description:storeCollectionForm.description.trim(),status:'active'});
    setBusy(false);
    if (error) return setNotice(error.message);
    setStoreCollectionForm({title:'',description:''}); setNotice('Collection créée.'); await loadMemberData(user);
  }

  async function createStorePage(event) {
    event.preventDefault();
    if (!activeStore || !storePageForm.title.trim()) return;
    const slug = storePageForm.title.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    setBusy(true);
    const {error} = await supabase.from('store_pages').insert({store_id:activeStore.id,title:storePageForm.title.trim(),slug,content:storePageForm.content,status:'draft'});
    setBusy(false);
    if (error) return setNotice(error.message);
    setStorePageForm({title:'',content:''}); setNotice('Page enregistrée en brouillon.'); await loadMemberData(user);
  }

  async function createStoreDiscount(event) {
    event.preventDefault();
    if (!activeStore || !storeDiscountForm.code.trim() || Number(storeDiscountForm.value)<=0) return;
    setBusy(true);
    const {error} = await supabase.from('store_discounts').insert({store_id:activeStore.id,code:storeDiscountForm.code.trim().toUpperCase(),discount_type:storeDiscountForm.discount_type,value:Number(storeDiscountForm.value),minimum_order_xof:storeDiscountForm.minimum_order_xof?Number(storeDiscountForm.minimum_order_xof):null});
    setBusy(false);
    if (error) return setNotice(error.message);
    setStoreDiscountForm({code:'',discount_type:'percentage',value:'',minimum_order_xof:''}); setNotice('Code promotionnel créé.'); await loadMemberData(user);
  }

  async function saveStoreTheme(event) {
    event.preventDefault();
    if (!activeStore) return;
    setBusy(true);
    const {error} = await supabase.from('stores').update({theme_config:storeThemeForm,store_settings:{email:storeThemeForm.store_email,phone:storeThemeForm.store_phone,return_policy:storeThemeForm.return_policy,shipping_policy:storeThemeForm.shipping_policy},updated_at:new Date().toISOString()}).eq('id',activeStore.id).eq('owner_id',user.id);
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice('Paramètres de la boutique enregistrés.'); await loadMemberData(user);
  }

  function addStorefrontCartItem(product) {
    if(!Number(product.selling_price_xof||0))return setNotice('Le prix de ce produit doit être confirmé par la boutique avant de pouvoir l’ajouter au panier.');
    setStorefrontCart(old => { const found=old.find(x=>x.id===product.id); return found?old.map(x=>x.id===product.id?{...x,quantity:x.quantity+1}:x):[...old,{...product,quantity:1}]; });
    setNotice('Produit ajouté au panier.');
  }

  async function checkoutStoreCart(event) {
    event.preventDefault();
    if(!user){setAuthMode('signin');setAuthOpen(true);return setNotice('Connectez-vous pour valider votre panier.');}
    if(!publicStorefront||!storefrontCart.length)return;
    setBusy(true);
    const {data:orderId,error}=await supabase.rpc('create_store_cart_order',{p_store_id:publicStorefront.store.id,p_items:storefrontCart.map(x=>({product_id:x.id,quantity:x.quantity})),p_contact_name:checkoutDetails.contact_name,p_contact_phone:checkoutDetails.contact_phone,p_contact_email:user.email||'',p_delivery_address:checkoutDetails.delivery_address,p_delivery_city:checkoutDetails.delivery_city,p_customer_notes:checkoutDetails.customer_notes});
    setBusy(false);
    if(error)return setNotice(error.message||'Impossible de créer la commande.');
    const {data:order,error:orderError}=await supabase.from('orders').select('id,order_number,total_xof,status').eq('id',orderId).single();
    if(orderError)return setNotice('Commande créée. Ouvrez votre espace pour retrouver le paiement.');
    setStorefrontCart([]);setPaymentModal({order,stage:'choose',transactionId:'',message:''});setNotice('Commande créée. Vous pouvez maintenant payer avec T-Money ou Moov Money.');
  }

  async function requestWalletPayout(event) {
    event.preventDefault(); const wallet=walletAccounts.find(w=>w.id===payoutForm.wallet_account_id)||walletAccounts[0];
    if(!wallet)return setNotice('Votre portefeuille vendeur sera créé avec votre boutique.');
    setBusy(true);
    const {data,error}=await supabase.functions.invoke('paydunya-payouts',{body:{action:'create_payout',wallet_account_id:wallet.id,amount:Number(payoutForm.amount),payout_method:payoutForm.payout_method,beneficiary_name:payoutForm.beneficiary_name,beneficiary_phone:payoutForm.beneficiary_phone}});
    setBusy(false);if(error||data?.error)return setNotice(data?.error||error?.message||'Impossible de lancer le retrait.');
    setPayoutForm({amount:'',payout_method:'T-Money',beneficiary_name:'',beneficiary_phone:'',beneficiary_account:'',beneficiary_bank:''});setNotice(data.message||'Demande de retrait transmise.');await loadMemberData(user);
  }

  async function updateStoreOrderStatus(orderId,status) {
    setBusy(true);const {error}=await supabase.rpc('update_store_order_status',{p_order_id:orderId,p_status:status});setBusy(false);
    if(error)return setNotice(error.message);setNotice('Statut de commande mis à jour.');await loadMemberData(user);
  }

  async function updateProductStock(productId) {
    const quantity=Number(stockDrafts[productId]);
    if(!Number.isInteger(quantity)||quantity<0)return setNotice('Stock invalide.');
    setBusy(true);const {error}=await supabase.rpc('update_store_product_inventory',{p_product_id:productId,p_quantity:quantity});setBusy(false);
    if(error)return setNotice(error.message);setNotice('Stock mis à jour.');await loadMemberData(user);
  }

  async function saveCustomDomain(event) {
    event.preventDefault();if(!activeStore)return;
    const domain=customDomainForm.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');
    if(!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain))return setNotice('Saisissez un nom de domaine valide, par exemple boutique.mondomaine.com.');
    setBusy(true);const {error}=await supabase.from('stores').update({custom_domain:domain,custom_domain_status:'pending'}).eq('id',activeStore.id).eq('owner_id',user.id);setBusy(false);
    if(error)return setNotice(error.message);setNotice('Domaine enregistré. Ajoutez-le aussi dans les paramètres Render puis configurez le DNS indiqué ci-dessous.');await loadMemberData(user);
  }

  async function saveTeamMember(event) {
    event.preventDefault();if(!activeStore)return;
    if(!/^[0-9a-f-]{36}$/i.test(teamUserId.trim()))return setNotice('Saisissez l’identifiant UUID du compte ChinaGo du membre.');
    setBusy(true);const {error}=await supabase.rpc('manage_store_member',{p_store_id:activeStore.id,p_member_user_id:teamUserId.trim(),p_permissions:teamPermissions,p_status:'active'});setBusy(false);
    if(error)return setNotice(error.message);setTeamUserId('');setNotice('Membre ajouté avec les permissions sélectionnées.');await loadMemberData(user);
  }

  async function submitOrderRequest(event) {
    event.preventDefault();
    if (!user || !supabase) return setNotice('Connectez-vous pour passer une commande.');
    if (!orderForm.product_title.trim()) return setNotice('Indiquez le nom du produit.');
    setBusy(true);
    const selectedPartner = cargoPartners.find(p => p.id === orderForm.cargo_partner_id);
    const { data, error } = await supabase.rpc('request_order', {
      p_product_id: orderDraft?.store_product_id ? null : orderDraft?.id || null,
      p_store_product_id: orderDraft?.store_product_id || null,
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
    if (selectedPartner?.whatsapp_phone) {
      const message = [
        'Bonjour ' + selectedPartner.name + ',',
        'Nouvelle demande de commande ChinaGo #' + String(data).slice(0,8).toUpperCase(),
        'Produit : ' + orderForm.product_title,
        'Lien : ' + (orderForm.source_url || 'À confirmer'),
        'Quantité : ' + orderForm.quantity,
        'Destinataire : ' + orderForm.contact_name + ' / ' + orderForm.contact_phone,
        'Livraison : ' + orderForm.delivery_city + ' — ' + orderForm.delivery_address,
        'Merci de confirmer les modalités de transport et votre devis.'
      ].join('\\n');
      setOrderWhatsAppUrl('https://wa.me/' + selectedPartner.whatsapp_phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(message));
    } else setOrderWhatsAppUrl('');
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

  async function updateStoreStatus(id, status) {
    const { error } = await supabase.functions.invoke('admin-operations', { body: { action: 'set_store_status', store_id: id, status } });
    if (error) return setNotice(error.message);
    setNotice('Statut de la boutique mis à jour.');
    await loadMemberData(user);
  }

  async function updateAdminStoreProduct(id, status) {
    const { error } = await supabase.functions.invoke('admin-operations', { body: { action: 'publish_store_product', product_id: id, status } });
    if (error) return setNotice(error.message);
    setNotice('Publication du produit mise à jour.');
    await loadMemberData(user);
  }

  async function saveAdminOrderQuote(id, event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subtotal = Number(form.get('subtotal_xof') || 0);
    const shipping = Number(form.get('shipping_xof') || 0);
    const { error } = await supabase.functions.invoke('admin-operations', { body: {
      action: 'update_order_status', order_id: id, status: String(form.get('status') || 'quote_requested'),
      subtotal_xof: subtotal, shipping_xof: shipping, total_xof: subtotal + shipping
    }});
    if (error) return setNotice(error.message);
    setNotice('Devis de commande enregistré et notification envoyée au client.');
    await loadMemberData(user);
  }

  async function saveImportAdminDetails(id, event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.functions.invoke('admin-operations', { body: {
      action: 'update_import_request', request_id: id,
      status: String(form.get('status') || 'submitted'),
      product_title: String(form.get('product_title') || ''),
      product_description: String(form.get('product_description') || ''),
      product_image_url: String(form.get('product_image_url') || ''),
      quantity: Number(form.get('quantity') || 1),
      unit_price_xof: String(form.get('unit_price_xof') || ''),
      shipping_estimate_xof: String(form.get('shipping_estimate_xof') || ''),
      admin_notes: String(form.get('admin_notes') || ''),
      product_images_json: String(form.get('product_images_json') || '[]'),
      product_variants_json: String(form.get('product_variants_json') || '[]'),
      product_options_json: String(form.get('product_options_json') || '[]'),
      minimum_order_quantity: String(form.get('minimum_order_quantity') || ''),
      original_currency: String(form.get('original_currency') || ''),
      original_price_min: String(form.get('original_price_min') || ''),
      original_price_max: String(form.get('original_price_max') || ''),
      supplier_company: String(form.get('supplier_company') || ''),
      supplier_contact_name: String(form.get('supplier_contact_name') || ''),
      supplier_phone: String(form.get('supplier_phone') || ''),
      supplier_whatsapp: String(form.get('supplier_whatsapp') || ''),
      supplier_email: String(form.get('supplier_email') || ''),
      supplier_profile_url: String(form.get('supplier_profile_url') || '')
    }});
    if (error) return setNotice(error.message);
    setNotice('Détails et devis d’importation enregistrés. Le client sera notifié.');
    await loadMemberData(user);
  }

  async function saveCargoAdminDetails(id, event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.functions.invoke('admin-operations', { body: {
      action: 'update_cargo_request', request_id: id,
      status: String(form.get('status') || 'submitted'),
      cargo_partner_id: String(form.get('cargo_partner_id') || '') || null,
      quoted_price_xof: String(form.get('quoted_price_xof') || ''),
      tracking_reference: String(form.get('tracking_reference') || '').trim(),
      partner_notes: String(form.get('partner_notes') || '').trim()
    }});
    if (error) return setNotice(error.message);
    setNotice('Informations de transport mises à jour.');
    await loadMemberData(user);
  }

  async function sendSupportMessage(event) {
    event.preventDefault();
    if (!user || !supportDraft.trim()) return;
    setBusy(true);
    try {
      let conversationId = activeSupportConversation;
      if (!conversationId) {
        const { data: conversation, error: conversationError } = await supabase.from('support_conversations').insert({ user_id: user.id, subject: 'Assistance ChinaGo', status: 'open' }).select('id,subject,status,created_at,updated_at').single();
        if (conversationError) throw conversationError;
        conversationId = conversation.id;
        setActiveSupportConversation(conversationId);
        setSupportConversations(old => [conversation, ...old]);
      }
      const { data: message, error } = await supabase.from('support_messages').insert({ conversation_id: conversationId, sender_id: user.id, sender_role: 'customer', body: supportDraft.trim() }).select('id,conversation_id,sender_id,sender_role,body,created_at').single();
      if (error) throw error;
      await supabase.from('support_conversations').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', conversationId);
      setSupportMessages(old => [...old, message]); setSupportDraft('');
      setNotice('Votre message a été envoyé à l’assistance ChinaGo.');
      await loadMemberData(user);
    } catch (error) { setNotice(error.message || 'Impossible d’envoyer votre message.'); }
    finally { setBusy(false); }
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
    { id: 'support', label: 'Assistance ChinaGo', icon: MessageCircle },
    { id: 'orders', label: 'Mes commandes', icon: ClipboardList },
    { id: 'cargo', label: 'Transport & cargo', icon: Truck },
    { id: 'dropshipping', label: 'Dropshipping', icon: TrendingUp },
    { id: 'store', label: 'Ma boutique', icon: Store },
    { id: 'wallet', label: 'Mon portefeuille', icon: Wallet },
    { id: 'store-orders', label: 'Commandes de ma boutique', icon: ClipboardList },
    { id: 'team', label: 'Personnel & permissions', icon: Users },
    { id: 'supplier', label: 'Devenir fournisseur', icon: PackageCheck },
    { id: 'applications', label: 'Mes candidatures', icon: Users },
    ...(isAdmin ? [{ id: 'admin', label: 'Administration', icon: ShieldCheck }] : [])
  ];

  const productCard = p => {
    const image = p.product_images?.[0]?.image_url;
    return <article className="cg-product" key={p.id}>
      <button className="cg-product-image" onClick={() => setSelectedProduct(p)} aria-label={'Voir ' + p.title}>
        {image ? <img src={image} alt={p.product_images?.[0]?.alt_text || p.title}/> : <span className="cg-no-image"><Package size={38}/></span>}
        {p.is_winner ? <span className="cg-product-tag">Produit tendance</span> : p.store_product_id ? <span className="cg-product-tag">Boutique partenaire</span> : null}
      </button>
      <div className="cg-product-body">
        <h3>{p.title}</h3><p>{p.description || 'Produit sélectionné par ChinaGo.'}</p>
        <div className="cg-product-bottom"><strong>{p.price_xof ? money(p.price_xof) : 'Prix sur demande'}</strong>
          {!p.store_product_id && <button className="cg-icon-button" onClick={() => toggleFavorite(p.id)} aria-label="Ajouter aux favoris"><Heart size={18} fill={favorites.includes(p.id) ? 'currentColor' : 'none'}/></button>}
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

    {paymentModal && <div className="overlay" onClick={() => !paymentBusy && setPaymentModal(null)}><section className="auth-card" onClick={e => e.stopPropagation()}><button className="close" onClick={() => !paymentBusy && setPaymentModal(null)}><X/></button><span className="eyebrow">PAIEMENT SÉCURISÉ · CHINAGO</span><h2>Payer votre commande</h2><p>Commande {paymentModal.order.order_number} · <b>{money(paymentModal.order.total_xof)}</b></p>{paymentModal.stage === 'choose' ? <form onSubmit={submitSoftPay}><label>Moyen de paiement<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="t-money-togo">TMoney (Togocom)</option><option value="moov-togo">Moov Money Togo</option></select></label><label>Numéro Mobile Money<input required inputMode="tel" autoComplete="tel" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="Ex. 90 00 00 00"/></label>{paymentModal.message && <p role="alert">{paymentModal.message}</p>}<button className="btn btn-primary full" disabled={paymentBusy}>{paymentBusy ? 'Connexion à PayDunya…' : 'Confirmer et recevoir la demande sur mon téléphone'}</button><small>Le paiement est initié depuis ChinaGo. Ne communiquez jamais votre code secret à qui que ce soit.</small></form> : <><p>{paymentModal.message}</p><div className="cg-panel"><b>Étape suivante</b><p>Regardez votre téléphone et validez la demande TMoney ou Moov Money. Revenez ensuite ici pour vérifier la confirmation.</p></div><button className="btn btn-primary full" disabled={paymentBusy} onClick={checkSoftPayStatus}>{paymentBusy ? 'Vérification…' : 'J’ai validé : vérifier mon paiement'}</button><button className="btn btn-secondary full" onClick={() => setPaymentModal(current => ({...current,stage:'choose',message:''}))}>Changer de moyen ou de numéro</button></>}</section></div>}
    {authOpen && <div className="overlay" onClick={() => setAuthOpen(false)}><section className="auth-card" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setAuthOpen(false)}><X/></button><span className="eyebrow">ESPACE CLIENT CHINAGO</span><h2>{authMode === 'signup' ? 'Créer votre compte' : 'Bienvenue de nouveau'}</h2><p>Accédez à vos demandes, vos commandes et votre espace personnel.</p><form onSubmit={authenticate}><label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com"/></label><label>Mot de passe<input type="password" minLength="8" required value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum"/></label><button className="btn btn-primary full" disabled={busy}>{busy ? 'Patientez…' : authMode === 'signup' ? 'Créer mon compte' : 'Me connecter'}</button></form><button className="switch" onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}>{authMode === 'signup' ? 'Déjà inscrit ? Se connecter' : 'Créer un compte'}</button></section></div>}

    {selectedProduct && <div className="overlay" onClick={() => setSelectedProduct(null)}><section className="cg-product-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelectedProduct(null)}><X/></button><div className="cg-modal-gallery">{selectedProduct.product_images?.length ? selectedProduct.product_images.map((img,i)=><img key={i} src={img.image_url} alt={img.alt_text || selectedProduct.title+' '+(i+1)}/>) : <div className="cg-modal-image"><Package size={55}/></div>}</div><div><span className="eyebrow">CATALOGUE CHINAGO</span><h2>{selectedProduct.title}</h2><strong>{selectedProduct.price_xof ? money(selectedProduct.price_xof) : 'Prix sur demande'}</strong><p>{selectedProduct.description || 'Contactez ChinaGo pour obtenir les détails et les disponibilités de ce produit.'}</p>{selectedProduct.minimum_order_quantity && <p>Quantité minimale fournisseur : {selectedProduct.minimum_order_quantity}</p>}{(selectedProduct.brand||selectedProduct.sku||selectedProduct.model_number||selectedProduct.origin_country||selectedProduct.material||selectedProduct.color||selectedProduct.size||selectedProduct.stock_quantity!==null||selectedProduct.package_dimensions||selectedProduct.package_weight||selectedProduct.warranty||selectedProduct.certifications?.length||Object.keys(selectedProduct.product_specs||{}).length>0)&&<div className="cg-product-specs"><b>Caractéristiques du produit</b><div className="cg-product-spec-grid">{[['Marque',selectedProduct.brand],['Référence',selectedProduct.sku],['Modèle',selectedProduct.model_number],['Origine',selectedProduct.origin_country],['Matière',selectedProduct.material],['Couleur',selectedProduct.color],['Taille',selectedProduct.size],['Stock',selectedProduct.stock_quantity],['État',selectedProduct.product_condition],['Dimensions colis',selectedProduct.package_dimensions],['Poids colis',selectedProduct.package_weight?selectedProduct.package_weight+' kg':null],['Garantie',selectedProduct.warranty]].filter(x=>x[1]!==null&&x[1]!==undefined&&x[1]!=='').map(([label,value])=><span key={label}>{label}<b>{String(value)}</b></span>)}</div>{selectedProduct.certifications?.length>0&&<p>Certifications : {selectedProduct.certifications.join(', ')}</p>}{Object.keys(selectedProduct.product_specs||{}).length>0&&<ul>{Object.entries(selectedProduct.product_specs).map(([key,value])=><li key={key}>{key} : {String(value)}</li>)}</ul>}</div>}{selectedProduct.product_variants?.length>0 && <div><b>Variantes disponibles</b><ul>{selectedProduct.product_variants.map((v,i)=><li key={i}>{typeof v==='string'?v:JSON.stringify(v)}</li>)}</ul></div>}{selectedProduct.product_options?.length>0 && <div><b>Options du produit</b><ul>{selectedProduct.product_options.map((v,i)=><li key={i}>{typeof v==='string'?v:(v.name||'Option')+' : '+(v.value||'')}</li>)}</ul></div>}<button className="btn btn-primary full" onClick={() => {if (!user) {setSelectedProduct(null);setAuthMode('signin');setAuthOpen(true);return setNotice('Connectez-vous pour demander ce produit.');}setOrderDraft(selectedProduct);setOrderForm(old => ({...old,product_title:selectedProduct.title,source_url:selectedProduct.source_url || '',quantity:'1',contact_name:profile?.full_name || '',contact_phone:profile?.phone || ''}));setSelectedProduct(null);setView('dashboard');setTab('orders');}}>Passer commande <ArrowRight size={16}/></button></div></section></div>}
    {importPreview && !importOrderOpen && <div className="overlay cg-import-preview-overlay" onClick={() => setImportPreview(null)}><section className="cg-import-preview" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setImportPreview(null)}><X/></button><div className="cg-preview-heading"><span className="eyebrow">APERÇU DU PRODUIT · CHINAGO</span><h2>{importPreview.product_title || 'Fiche produit à vérifier'}</h2><p>{importPreview.message}</p></div><div className="cg-preview-layout"><div><div className="cg-preview-gallery">{(importPreview.product_images || []).length ? importPreview.product_images.map((src,i)=><img key={i} src={typeof src === 'string' ? src : src.image_url || src.url} alt={importPreview.product_title || 'Photo produit'}/>) : importPreview.product_image_url ? <img src={importPreview.product_image_url} alt={importPreview.product_title || 'Produit'}/> : <div className="cg-preview-no-image"><Package size={48}/><span>Photos non disponibles automatiquement</span></div>}</div></div><div className="cg-preview-details"><div className="cg-preview-price"><small>Prix affiché par la source</small><b>{importPreview.original_price_min != null ? importPreview.original_price_min + ' ' + (importPreview.original_currency || '') : 'À confirmer auprès du fournisseur'}</b></div>{importPreview.product_description && <p>{importPreview.product_description}</p>}<div className="cg-preview-facts"><span>Plateforme<b>{String(importPreview.source_platform || 'autre').toUpperCase()}</b></span><span>Extraction<b>{importPreview.extraction_status || 'À vérifier'}</b></span><span>Quantité minimale<b>{importPreview.minimum_order_quantity || 'À confirmer'}</b></span><span>Fournisseur / marque<b>{importPreview.supplier_company || 'À confirmer'}</b></span></div>{(importPreview.product_variants || []).length>0&&<div><h3>Variantes</h3><ul>{importPreview.product_variants.map((v,i)=><li key={i}>{typeof v==='string'?v:JSON.stringify(v)}</li>)}</ul></div>}{(importPreview.product_options || []).length>0&&<div><h3>Options</h3><ul>{importPreview.product_options.map((v,i)=><li key={i}>{typeof v==='string'?v:(v.name||'Option')+' : '+(v.value||'')}</li>)}</ul></div>}<div className="cg-preview-facts"><span>Couleur choisie<b>{importSelection.color||'À choisir'}</b></span><span>Taille choisie<b>{importSelection.size||'À choisir'}</b></span><span>Quantité<b>{importSelection.quantity}</b></span></div><div className="cg-form"><label>Couleur<input value={importSelection.color} onChange={e=>setImportSelection(v=>({...v,color:e.target.value}))} placeholder={importPreview.color||'Ex. noir, blanc, bleu'}/></label><label>Taille<input value={importSelection.size} onChange={e=>setImportSelection(v=>({...v,size:e.target.value}))} placeholder={importPreview.size||'Ex. S, M, L, XL'}/></label><label>Quantité souhaitée<input type="number" min={Math.max(1,Number(importPreview.minimum_order_quantity||1))} max="10000" value={importSelection.quantity} onChange={e=>setImportSelection(v=>({...v,quantity:Math.max(1,Number(e.target.value)||1)}))}/><small>Quantité minimale annoncée : {importPreview.minimum_order_quantity||'à confirmer'}</small></label></div><div className="cg-preview-facts"><span>Contact vendeur<b>{importPreview.supplier_contact_name||'Non communiqué par la plateforme'}</b></span><span>WhatsApp vendeur<b>{importPreview.supplier_whatsapp||'À vérifier sur la fiche source'}</b></span><span>E-mail vendeur<b>{importPreview.supplier_email||'À vérifier sur la fiche source'}</b></span></div><a href={importPreview.source_url} target="_blank" rel="noreferrer" className="cg-preview-source">Ouvrir la fiche fournisseur et consulter ses coordonnées ↗</a><button className="btn btn-primary full" onClick={() => setImportOrderOpen(true)}>Continuer vers mes coordonnées <ArrowRight size={16}/></button></div></div></section></div>}

    {importPreview && importOrderOpen && <div className="overlay cg-import-preview-overlay" onClick={()=>setImportOrderOpen(false)}><section className="cg-import-preview" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setImportOrderOpen(false)}><X/></button><div className="cg-preview-heading"><span className="eyebrow">COMMANDE · COORDONNÉES DE LIVRAISON</span><h2>Vérifiez vos informations</h2><p>La demande sera envoyée à ChinaGo. Le prix final et le transport seront confirmés avant paiement.</p></div><div className="cg-panel"><h3>Récapitulatif du produit</h3><div className="cg-list-row"><div><b>{importPreview.product_title||'Produit à identifier'}</b><small>{String(importPreview.source_platform||'').toUpperCase()} · Quantité : {importSelection.quantity} · Couleur : {importSelection.color||'Non précisée'} · Taille : {importSelection.size||'Non précisée'}</small><a href={importPreview.source_url} target="_blank" rel="noreferrer">Lien original du produit ↗</a></div></div></div><form className="cg-form" onSubmit={confirmImportRequest}><label>Nom complet<input required value={importOrderDetails.contact_name} onChange={e=>setImportOrderDetails(v=>({...v,contact_name:e.target.value}))} placeholder="Votre nom et prénom"/></label><label>Numéro de téléphone<input required value={importOrderDetails.phone} onChange={e=>setImportOrderDetails(v=>({...v,phone:e.target.value}))} placeholder="+228…"/></label><label>Numéro WhatsApp<input required value={importOrderDetails.whatsapp} onChange={e=>setImportOrderDetails(v=>({...v,whatsapp:e.target.value}))} placeholder="+228…"/></label><label>Pays<input required value={importOrderDetails.country} onChange={e=>setImportOrderDetails(v=>({...v,country:e.target.value}))}/></label><label>Ville<input required value={importOrderDetails.city} onChange={e=>setImportOrderDetails(v=>({...v,city:e.target.value}))} placeholder="Ex. Lomé"/></label><label>Quartier<input required value={importOrderDetails.neighborhood} onChange={e=>setImportOrderDetails(v=>({...v,neighborhood:e.target.value}))} placeholder="Votre quartier"/></label><label>Rue / repère / adresse précise<input required value={importOrderDetails.street} onChange={e=>setImportOrderDetails(v=>({...v,street:e.target.value}))} placeholder="Rue, maison, repère…"/></label><label>Instructions complémentaires<textarea value={importOrderDetails.instructions} onChange={e=>setImportOrderDetails(v=>({...v,instructions:e.target.value}))} placeholder="Précisions utiles pour la livraison"/></label><button className="btn btn-primary full" disabled={busy}>{busy?'Enregistrement…':'Confirmer et envoyer ma demande'} <ArrowRight size={16}/></button><button type="button" className="btn btn-ghost full" onClick={()=>setImportOrderOpen(false)}>Retour à la fiche produit</button></form></section></div>}

    {view === 'storefront' ? <main className="cg-storefront-page"><div className="wrap">{storefrontLoading ? <div className="cg-panel">Chargement de la boutique…</div> : publicStorefront ? <><section className="cg-panel" style={{borderTop:'6px solid '+(publicStorefront.store.theme_config?.primary||'#0B2D5B')}}><span className="eyebrow">BOUTIQUE EN LIGNE · CHINAGO</span><h1>{publicStorefront.store.name}</h1><p>{publicStorefront.store.description || 'Découvrez notre sélection de produits.'}</p><small>{publicStorefront.store.store_settings?.phone || ''} {publicStorefront.store.store_settings?.email || ''}</small></section>{publicStorefront.collections.length>0&&<section className="cg-panel"><h2>Collections</h2><div className="cg-quick-grid">{publicStorefront.collections.map(c=><div key={c.id}><b>{c.title}</b><small>{c.description}</small></div>)}</div></section>}<section className="cg-panel"><h2>Nos produits</h2>{publicStorefront.products.length ? <div className="product-grid">{publicStorefront.products.map(p=><article className="cg-product" key={p.id}><button className="cg-product-image" onClick={()=>setSelectedProduct({id:p.id,store_product_id:p.id,title:p.title,description:p.description,source_url:p.source_url,price_xof:p.selling_price_xof,product_images:p.image_url?[{image_url:p.image_url,alt_text:p.title}]:[],product_variants:p.variants||[]})}>{p.image_url?<img src={p.image_url} alt={p.title}/>:<span className="cg-no-image"><Package size={38}/></span>}</button><div className="cg-product-body"><h3>{p.title}</h3><p>{p.description||'Produit disponible dans cette boutique.'}</p><div className="cg-product-bottom"><strong>{p.selling_price_xof?money(p.selling_price_xof):'Prix sur demande'}</strong></div><button className="cg-text-button" onClick={()=>addStorefrontCartItem(p)}>Ajouter au panier <Plus size={15}/></button></div></article>)}</div> : <p className="cg-muted">Cette boutique n'a pas encore publié de produit.</p>}</section>
        <section className="cg-panel"><div className="cg-panel-head"><div><h2>Mon panier ({storefrontCart.reduce((n,x)=>n+x.quantity,0)})</h2><p>Total estimé : <b>{money(storefrontCart.reduce((n,x)=>n+Number(x.selling_price_xof||0)*x.quantity,0))}</b></p></div></div>{storefrontCart.length===0?<p className="cg-muted">Votre panier est vide.</p>:<><div>{storefrontCart.map(item=><div className="cg-list-row" key={item.id}><div><b>{item.title}</b><small>{money(item.selling_price_xof)} × {item.quantity}</small></div><button className="btn btn-ghost" onClick={()=>setStorefrontCart(old=>old.filter(x=>x.id!==item.id))}>Retirer</button><div><button className="btn btn-ghost" onClick={()=>setStorefrontCart(old=>old.map(x=>x.id===item.id?{...x,quantity:Math.max(1,x.quantity-1)}:x))}>−</button> {item.quantity} <button className="btn btn-ghost" onClick={()=>setStorefrontCart(old=>old.map(x=>x.id===item.id?{...x,quantity:x.quantity+1}:x))}>+</button></div></div>)}</div><form className="cg-form" onSubmit={checkoutStoreCart}><h3>Livraison et paiement</h3><label>Nom complet<input required value={checkoutDetails.contact_name} onChange={e=>setCheckoutDetails({...checkoutDetails,contact_name:e.target.value})}/></label><label>Téléphone<input required value={checkoutDetails.contact_phone} onChange={e=>setCheckoutDetails({...checkoutDetails,contact_phone:e.target.value})} placeholder="+228…"/></label><label>Adresse de livraison<input required value={checkoutDetails.delivery_address} onChange={e=>setCheckoutDetails({...checkoutDetails,delivery_address:e.target.value})}/></label><label>Ville<input required value={checkoutDetails.delivery_city} onChange={e=>setCheckoutDetails({...checkoutDetails,delivery_city:e.target.value})}/></label><label>Note<textarea value={checkoutDetails.customer_notes} onChange={e=>setCheckoutDetails({...checkoutDetails,customer_notes:e.target.value})}/></label><button className="btn btn-primary full" disabled={busy}>Valider la commande et payer <ArrowRight/></button></form></>}</section>
        {publicStorefront.pages.length>0&&<section className="cg-panel"><h2>Informations de la boutique</h2>{publicStorefront.pages.map(p=><article key={p.id}><h3>{p.title}</h3><p>{p.content}</p></article>)}</section>}<button className="btn btn-ghost" onClick={()=>{window.location.href='/';}}>Découvrir ChinaGo</button></> : <div className="cg-panel"><h2>Boutique indisponible</h2><p>Cette boutique n'est pas publiée ou son adresse est incorrecte.</p><button className="btn btn-primary" onClick={()=>{window.location.href='/';}}>Retour à ChinaGo</button></div>}</div></main> : view === 'home' ? <main>
      <section className="hero" id="home"><div className="wrap hero-grid"><div><span className="eyebrow">ACHETER · IMPORTER · DÉVELOPPER</span><h1>Achetez en Chine depuis le Togo,<br/><em>simplement !</em></h1><p className="lead">Découvrez des produits, partagez un lien et préparez votre importation. ChinaGo coordonne votre parcours entre fournisseur et cargo.</p>
        <form className="import-card" id="import" onSubmit={submitImport}><label><Link2 size={17}/> Vous avez déjà un lien produit ?</label><div className="input-row"><input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Collez un lien Alibaba, Amazon, eBay…" required/><button className="btn btn-primary" disabled={busy}>{busy ? 'Analyse du produit…' : 'Vérifier le produit'} <ArrowRight size={16}/></button></div><small>Votre demande sera enregistrée dans votre espace personnel.</small></form>
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

      {tab === 'imports' && <div className="cg-panel"><div className="cg-panel-head"><div><h2>Nouvelle demande d’importation</h2><p>Collez le lien du produit que vous souhaitez acheter.</p></div></div><form className="cg-inline-form" onSubmit={submitImport}><input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Collez un lien Alibaba, AliExpress, Amazon ou eBay…" required/><button className="btn btn-primary" disabled={busy}>Vérifier le produit <ArrowRight size={16}/></button></form><h3 className="cg-subtitle">Historique des importations</h3>{imports.length ? imports.map(i => <div className="cg-list-row" key={i.id}><span className="cg-list-icon"><Link2 size={17}/></span><div><b>{i.product_title || i.source_platform.toUpperCase()}</b><a href={i.source_url} target="_blank" rel="noreferrer">{i.source_url}</a><small>Statut : {i.status === 'quoted' ? 'Devis prêt – paiement disponible' : i.status === 'converted' ? 'Commande créée' : i.status}</small>{(i.unit_price_xof != null || i.shipping_estimate_xof != null) && <small>Produit : {money(Number(i.unit_price_xof||0)*Number(i.quantity||1))} · Transport : {money(i.shipping_estimate_xof)} · Total : {money(Number(i.unit_price_xof||0)*Number(i.quantity||1)+Number(i.shipping_estimate_xof||0))}</small>}{i.order_id && <small>Commande : {orders.find(o=>o.id===i.order_id)?.order_number||'créée'} · Suivi : {orders.find(o=>o.id===i.order_id)?.tracking_code||'en préparation'}</small>}{i.admin_notes && <small>Note ChinaGo : {i.admin_notes}</small>}{i.status==='quoted' && <button className="btn btn-primary" disabled={busy} onClick={()=>acceptImportQuote(i)}>Accepter le devis et payer <ArrowRight size={15}/></button>}</div><time>{dateLabel(i.created_at)}</time></div>) : <p className="cg-muted">Vous n’avez pas encore envoyé de demande.</p>}</div>}

      {tab === 'favorites' && <div className="cg-panel"><h2>Mes produits favoris</h2><p>Vos produits sauvegardés depuis le catalogue.</p>{products.filter(p => favorites.includes(p.id)).length ? <div className="product-grid">{products.filter(p => favorites.includes(p.id)).map(productCard)}</div> : <p className="cg-muted">Aucun favori enregistré. Explorez le catalogue et appuyez sur le cœur d’un produit.</p>}</div>}

      {tab === 'support' && <div className="cg-panel"><div className="cg-panel-head"><div><h2>Assistance ChinaGo</h2><p>Posez vos questions ou signalez un problème. Notre équipe vous répondra ici.</p></div></div><div className="cg-support-thread">{supportMessages.filter(m => m.conversation_id === activeSupportConversation).map(m => <div className={'cg-support-bubble '+(m.sender_role === 'customer' ? 'mine' : '')} key={m.id}><small>{m.sender_role === 'admin' ? 'Équipe ChinaGo' : 'Vous'} · {dateLabel(m.created_at)}</small><p>{m.body}</p></div>)}{!supportMessages.filter(m => m.conversation_id === activeSupportConversation).length && <p className="cg-muted">Aucun échange pour le moment. Envoyez votre premier message à l’équipe.</p>}</div><form className="cg-form" onSubmit={sendSupportMessage}><label>Votre message<textarea required value={supportDraft} onChange={e => setSupportDraft(e.target.value)} placeholder="Décrivez votre problème ou votre question…"/></label><button className="btn btn-primary" disabled={busy}>Envoyer à l’assistance <MessageCircle size={16}/></button></form></div>}

      {tab === 'notifications' && <div className="cg-panel"><div className="cg-panel-head"><div><h2>Centre de notifications</h2><p>Les mises à jour de vos demandes et candidatures.</p></div><span className="cg-status">{unreadCount} non lue(s)</span></div>{notifications.length ? notifications.map(n => <div className={'cg-notification '+(!n.read_at?'unread':'')} key={n.id}><span className="cg-list-icon"><Bell size={18}/></span><div><b>{n.title}</b><p>{n.body}</p><small>{dateLabel(n.created_at)}</small></div>{!n.read_at && <button className="cg-text-button" onClick={() => markNotificationRead(n.id)}><Check size={15}/> Marquer comme lue</button>}</div>) : <p className="cg-muted">Aucune notification pour le moment.</p>}</div>}

      {tab === 'orders' && <><div className="cg-panel"><div className="cg-panel-head"><div><h2>Préparer une commande</h2><p>La demande est vérifiée par ChinaGo. Aucun paiement n’est prélevé à cette étape.</p></div></div><form className="cg-form" onSubmit={submitOrderRequest}><label>Produit à commander<input required value={orderForm.product_title} onChange={e => setOrderForm({...orderForm,product_title:e.target.value})} placeholder="Nom du produit"/></label><label>Lien du produit (facultatif)<input value={orderForm.source_url} onChange={e => setOrderForm({...orderForm,source_url:e.target.value})} placeholder="https://..."/></label><div className="cg-two-fields"><label>Quantité<input type="number" min="1" max="1000" required value={orderForm.quantity} onChange={e => setOrderForm({...orderForm,quantity:e.target.value})}/></label><label>Transporteur souhaité<select value={orderForm.cargo_partner_id} onChange={e => setOrderForm({...orderForm,cargo_partner_id:e.target.value})}><option value="">ChinaGo me conseille un cargo</option>{cargoPartners.map(p => <option key={p.id} value={p.id}>{p.name} · {p.service_type === 'air' ? 'Aérien' : p.service_type === 'sea' ? 'Maritime' : p.service_type}</option>)}</select></label></div>{orderDraft?.price_xof ? <p className="cg-price-hint">Prix catalogue indicatif : {money(orderDraft.price_xof)} par unité. Le montant final sera confirmé après vérification.</p> : <p className="cg-price-hint">Le prix sera confirmé après vérification du lien et des options du fournisseur.</p>}<h3 className="cg-subtitle">Coordonnées et livraison</h3><div className="cg-two-fields"><label>Nom du destinataire<input required value={orderForm.contact_name} onChange={e => setOrderForm({...orderForm,contact_name:e.target.value})}/></label><label>Téléphone<input required value={orderForm.contact_phone} onChange={e => setOrderForm({...orderForm,contact_phone:e.target.value})} placeholder="+228 ..."/></label></div><div className="cg-two-fields"><label>Ville de livraison<input required value={orderForm.delivery_city} onChange={e => setOrderForm({...orderForm,delivery_city:e.target.value})}/></label><label>Adresse de livraison<input required value={orderForm.delivery_address} onChange={e => setOrderForm({...orderForm,delivery_address:e.target.value})}/></label></div><label>Précisions<textarea value={orderForm.customer_notes} onChange={e => setOrderForm({...orderForm,customer_notes:e.target.value})} placeholder="Couleur, taille, modèle, lien d’option…"/></label><button className="btn btn-primary" disabled={busy}>Envoyer ma demande de commande <ArrowRight/></button></form>{orderWhatsAppUrl && <a className="btn btn-primary cg-whatsapp-link" href={orderWhatsAppUrl} target="_blank" rel="noreferrer"><MessageCircle/> Transmettre la demande au cargo sur WhatsApp</a>}</div><div className="cg-panel"><h2>Historique de mes commandes</h2>{orders.length ? orders.map(o => <div className="cg-list-row" key={o.id}><span className="cg-list-icon"><PackageCheck/></span><div><b>{o.order_number}</b><small>Statut : {o.status === 'quote_requested' ? 'Devis demandé' : o.status}</small><small>Suivi ChinaGo : {o.tracking_code || 'En cours de génération'}</small><small>{Number(o.total_xof || 0) > 0 ? money(o.total_xof) : 'Devis à confirmer'} · {o.delivery_city || 'Livraison à confirmer'}</small>{o.order_items?.map((it,idx) => <small key={idx}>{it.product_title} × {it.quantity}</small>)}{['pending','awaiting_payment','quote_requested'].includes(o.status) && Number(o.total_xof || 0) >= 100 && <button className="btn btn-primary" disabled={payingOrderId === o.id} onClick={() => startPaydunyaCheckout(o)}>{payingOrderId === o.id ? 'Préparation du paiement…' : 'Payer avec TMoney / Moov Money'}</button>}</div><time>{dateLabel(o.created_at)}</time></div>) : <div className="cg-empty"><ClipboardList/><b>Aucune commande pour le moment</b><small>Vos demandes apparaîtront ici après envoi.</small></div>}</div></>}

      {tab === 'dropshipping' && <><div className="cg-panel cg-feature-panel"><span className="cg-feature-icon"><TrendingUp/></span><div><span className="eyebrow">ESPACE DROPSHIPPING</span><h2>Construisez votre activité de vente</h2><p>Importez des produits, fixez votre prix de vente, suivez vos marges et gérez vos commandes depuis ChinaGo.</p></div></div>{profile?.role === 'dropshipper' || profile?.role === 'seller' || profile?.role === 'admin' ? <div className="cg-panel"><h2>Votre activité dropshipping</h2><div className="cg-stats"><div><span><Store/></span><small>Boutiques</small><b>{stores.length}</b></div><div><span><Package/></span><small>Produits</small><b>{storeProducts.length}</b></div><div><span><Wallet/></span><small>Ventes</small><b>0</b></div><div><span><ClipboardList/></span><small>Commandes</small><b>0</b></div></div><button className="btn btn-primary" onClick={() => setTab('store')}>Gérer ma boutique <ArrowRight/></button></div> : <div className="cg-panel"><h2>Rejoindre ChinaGo comme vendeur</h2><p>Choisissez votre modèle d’activité. Votre espace est activé dès l’envoi du formulaire. Vous pourrez créer une boutique et gérer vos produits immédiatement.</p><form className="cg-form" onSubmit={submitSellerApplication}><label>Type d’activité<select value={sellerForm.account_type} onChange={e => setSellerForm({...sellerForm,account_type:e.target.value})}><option value="dropshipper">Dropshipping — vendre sans stock</option><option value="ecommerce">E-commerce — gérer ma propre boutique</option></select></label><label>Nom de votre activité<input required value={sellerForm.business_name} onChange={e => setSellerForm({...sellerForm,business_name:e.target.value})} placeholder="Ex. Ma boutique en ligne"/></label><label>Nom du responsable<input required value={sellerForm.contact_name} onChange={e => setSellerForm({...sellerForm,contact_name:e.target.value})} placeholder="Votre nom"/></label><label>E-mail<input type="email" required value={sellerForm.email || user?.email || ''} onChange={e => setSellerForm({...sellerForm,email:e.target.value})}/></label><label>Téléphone<input required value={sellerForm.phone} onChange={e => setSellerForm({...sellerForm,phone:e.target.value})} placeholder="+228 ..."/></label><label>Lien de votre boutique (facultatif)<input value={sellerForm.store_url} onChange={e => setSellerForm({...sellerForm,store_url:e.target.value})} placeholder="https://..."/></label><label>Présentez votre projet<textarea value={sellerForm.message} onChange={e => setSellerForm({...sellerForm,message:e.target.value})} placeholder="Parlez-nous de votre projet"/></label><button className="btn btn-primary" disabled={busy}>Créer mon espace vendeur <ArrowRight/></button></form></div>}</>}

      {tab === 'store' && <><div className="cg-panel"><div className="cg-panel-head"><div><h2>Ma boutique</h2><p>Votre espace e-commerce ChinaGo.</p></div></div>{stores.length ? stores.map(s => <div className="cg-store-card" key={s.id}><span><Store/></span><div><b>{s.name}</b><small>{s.platform === 'shopify' ? 'Shopify' : 'ChinaGo'} · {s.status}</small><small>{s.slug}</small><a href={'/?store='+s.slug} target="_blank" rel="noreferrer">Voir la boutique publique ↗</a></div></div>) : <p className="cg-muted">Vous n’avez pas encore de boutique.</p>}<form className="cg-form cg-divider-top" onSubmit={createStore}><h3>Créer une boutique</h3><label>Nom de la boutique<input required value={storeForm.name} onChange={e => setStoreForm({...storeForm,name:e.target.value})} placeholder="Ma boutique"/></label><label>Description<textarea value={storeForm.description} onChange={e => setStoreForm({...storeForm,description:e.target.value})}/></label><label>Plateforme<select value={storeForm.platform} onChange={e => setStoreForm({...storeForm,platform:e.target.value})}><option value="chinago">Boutique ChinaGo</option><option value="shopify">Boutique Shopify (connexion à venir)</option></select></label>{storeForm.platform === 'shopify' && <label>Domaine Shopify<input value={storeForm.shopify_domain} onChange={e => setStoreForm({...storeForm,shopify_domain:e.target.value})} placeholder="ma-boutique.myshopify.com"/></label>}<button className="btn btn-primary" disabled={busy}>Créer ma boutique <Plus/></button></form></div>
        {activeStore && activeStore.owner_id===user?.id && <div className="cg-panel"><h2>Domaine personnalisé</h2><p>Reliez votre propre adresse à votre boutique. Ajoutez d’abord ce domaine dans Render, puis configurez le DNS chez votre fournisseur.</p><form className="cg-form" onSubmit={saveCustomDomain}><label>Nom de domaine<input value={customDomainForm||activeStore.custom_domain||''} onChange={e=>setCustomDomainForm(e.target.value)} placeholder="boutique.mondomaine.com"/></label><button className="btn btn-primary" disabled={busy}>Enregistrer le domaine</button></form><p><b>DNS :</b> pour un sous-domaine, créez un CNAME vers <code>chinago-tby6.onrender.com</code>. Pour un domaine racine, utilisez ALIAS/ANAME ou la cible indiquée par Render. Ajoutez exactement le même domaine dans Render → Settings → Custom Domains et attendez la validation DNS et le certificat HTTPS. État : {activeStore.custom_domain_status||'non configuré'}.</p><a href="https://dashboard.render.com/static/srv-dbpct5ff3r2c73fqajo0/settings" target="_blank" rel="noreferrer">Ouvrir les paramètres Render ↗</a></div>}
        {activeStore && <div className="cg-panel"><h2>Paramètres de la boutique</h2><p>Personnalisez l'identité de votre boutique et les informations visibles par vos clients.</p><form className="cg-form" onSubmit={saveStoreTheme}><div className="cg-two-fields"><label>Couleur principale<input type="color" value={storeThemeForm.primary} onChange={e=>setStoreThemeForm({...storeThemeForm,primary:e.target.value})}/></label><label>Couleur secondaire<input type="color" value={storeThemeForm.accent} onChange={e=>setStoreThemeForm({...storeThemeForm,accent:e.target.value})}/></label></div><label>E-mail commercial<input type="email" value={storeThemeForm.store_email} onChange={e=>setStoreThemeForm({...storeThemeForm,store_email:e.target.value})}/></label><label>Téléphone commercial<input value={storeThemeForm.store_phone} onChange={e=>setStoreThemeForm({...storeThemeForm,store_phone:e.target.value})}/></label><label>Politique de livraison<textarea value={storeThemeForm.shipping_policy} onChange={e=>setStoreThemeForm({...storeThemeForm,shipping_policy:e.target.value})}/></label><label>Politique de retour<textarea value={storeThemeForm.return_policy} onChange={e=>setStoreThemeForm({...storeThemeForm,return_policy:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Enregistrer les paramètres</button></form></div>}
        {activeStore && <div className="cg-panel"><h2>Collections de produits</h2><p>Regroupez vos articles par catégories, comme sur Shopify.</p><form className="cg-form" onSubmit={createStoreCollection}><label>Nom de la collection<input required value={storeCollectionForm.title} onChange={e=>setStoreCollectionForm({...storeCollectionForm,title:e.target.value})}/></label><label>Description<textarea value={storeCollectionForm.description} onChange={e=>setStoreCollectionForm({...storeCollectionForm,description:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Créer une collection <Plus/></button></form>{storeCollections.filter(c=>c.store_id===activeStore.id).map(c=><div className="cg-list-row" key={c.id}><div><b>{c.title}</b><small>{c.status} · /collections/{c.slug}</small></div></div>)}</div>}
        {activeStore && <div className="cg-panel"><h2>Pages de la boutique</h2><p>Créez vos pages À propos, Contact, Livraison et Conditions de vente.</p><form className="cg-form" onSubmit={createStorePage}><label>Titre de la page<input required value={storePageForm.title} onChange={e=>setStorePageForm({...storePageForm,title:e.target.value})}/></label><label>Contenu<textarea required value={storePageForm.content} onChange={e=>setStorePageForm({...storePageForm,content:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Enregistrer la page <Plus/></button></form>{storePages.filter(p=>p.store_id===activeStore.id).map(p=><div className="cg-list-row" key={p.id}><div><b>{p.title}</b><small>{p.status} · /pages/{p.slug}</small></div></div>)}</div>}
        {activeStore && <div className="cg-panel"><h2>Codes de réduction</h2><p>Créez des promotions pour attirer les clients.</p><form className="cg-form" onSubmit={createStoreDiscount}><label>Code promotionnel<input required value={storeDiscountForm.code} onChange={e=>setStoreDiscountForm({...storeDiscountForm,code:e.target.value.toUpperCase()})} placeholder="BIENVENUE10"/></label><div className="cg-two-fields"><label>Type<select value={storeDiscountForm.discount_type} onChange={e=>setStoreDiscountForm({...storeDiscountForm,discount_type:e.target.value})}><option value="percentage">Pourcentage (%)</option><option value="fixed">Montant fixe (FCFA)</option></select></label><label>Valeur<input type="number" min="1" required value={storeDiscountForm.value} onChange={e=>setStoreDiscountForm({...storeDiscountForm,value:e.target.value})}/></label></div><label>Commande minimum (FCFA)<input type="number" min="0" value={storeDiscountForm.minimum_order_xof} onChange={e=>setStoreDiscountForm({...storeDiscountForm,minimum_order_xof:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Créer le code</button></form>{storeDiscounts.filter(d=>d.store_id===activeStore.id).map(d=><div className="cg-list-row" key={d.id}><div><b>{d.code}</b><small>{d.discount_type==='percentage'?d.value+' %':money(d.value)} · {d.status}</small></div></div>)}</div>}
        {activeStore && <div className="cg-panel"><h2>Produits de ma boutique</h2><p>Ajoutez vos fiches produits. Elles sont publiées immédiatement dans votre boutique.</p><form className="cg-form" onSubmit={addStoreProduct}><label>Nom du produit<input required value={storeProductForm.title} onChange={e => setStoreProductForm({...storeProductForm,title:e.target.value})}/></label><label>Lien fournisseur (facultatif)<input value={storeProductForm.source_url} onChange={e => setStoreProductForm({...storeProductForm,source_url:e.target.value})} placeholder="https://www.alibaba.com/..."/></label><label>URL de l’image du produit<input value={storeProductForm.image_url} onChange={e => setStoreProductForm({...storeProductForm,image_url:e.target.value})} placeholder="https://..."/></label><div className="cg-two-fields"><label>Prix d’achat (FCFA)<input type="number" min="0" value={storeProductForm.cost_price_xof} onChange={e => setStoreProductForm({...storeProductForm,cost_price_xof:e.target.value})}/></label><label>Prix de vente (FCFA)<input type="number" min="0" value={storeProductForm.selling_price_xof} onChange={e => setStoreProductForm({...storeProductForm,selling_price_xof:e.target.value})}/></label></div><label>Description<textarea value={storeProductForm.description} onChange={e => setStoreProductForm({...storeProductForm,description:e.target.value})}/></label><label>Stock initial (laisser vide pour ne pas suivre le stock)<input type="number" min="0" value={storeProductForm.inventory_quantity} onChange={e=>setStoreProductForm({...storeProductForm,inventory_quantity:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Enregistrer le produit <Plus/></button></form>{storeProducts.map(p => <div className="cg-list-row" key={p.id}><span className="cg-list-icon"><Package/></span><div><b>{p.title}</b><small>{p.status} · Achat : {p.cost_price_xof ? money(p.cost_price_xof) : '—'} · Vente : {p.selling_price_xof ? money(p.selling_price_xof) : '—'} · Stock : {p.track_inventory?p.inventory_quantity:'non suivi'}</small><input type="number" min="0" value={stockDrafts[p.id]??p.inventory_quantity??0} onChange={e=>setStockDrafts(old=>({...old,[p.id]:e.target.value}))} aria-label="Stock"/><button className="btn btn-ghost" onClick={()=>updateProductStock(p.id)}>Mettre à jour le stock</button></div><time>{dateLabel(p.created_at)}</time></div>)}</div>}</>}

      {tab === 'store-orders' && <div className="cg-panel"><h2>Commandes de ma boutique</h2><p>Suivez les ventes, les coordonnées de livraison et faites avancer chaque commande.</p>{storeOrders.length?storeOrders.map(o=><article className="cg-list-row" key={o.id}><div><b>{o.order_number} · {money(o.total_xof)}</b><small>{o.contact_name} · {o.contact_phone} · {o.delivery_city} · {dateLabel(o.created_at)}</small><small>{(o.order_items||[]).map(i=>i.product_title+' × '+i.quantity).join(' · ')}</small></div><select value={o.status} disabled={busy||['delivered','completed','cancelled'].includes(o.status)} onChange={e=>updateStoreOrderStatus(o.id,e.target.value)}><option value={o.status}>{o.status}</option><option value="processing">En préparation</option><option value="shipped">Expédiée</option><option value="delivered">Livrée</option><option value="cancelled">Annulée</option></select></article>):<p>Aucune commande reçue pour cette boutique.</p>}</div>}
      {tab === 'wallet' && <><div className="cg-panel"><h2>Mon portefeuille vendeur</h2><p>Les gains sont crédités après livraison, sur la marge connue des produits et après la commission configurée.</p><div className="cg-stats"><div><span><Wallet/></span><small>Solde disponible</small><b>{money(walletAccounts.reduce((n,w)=>n+Number(w.available_balance||0),0))}</b></div><div><span><Clock3/></span><small>En attente</small><b>{money(walletAccounts.reduce((n,w)=>n+Number(w.pending_balance||0),0))}</b></div><div><span><TrendingUp/></span><small>Transactions</small><b>{walletEntries.length}</b></div></div>{walletAccounts.length===0?<p>Créez d’abord votre boutique pour activer le portefeuille.</p>:<form className="cg-form" onSubmit={requestWalletPayout}><h3>Demander un retrait</h3><label>Montant (minimum 1 000 FCFA)<input required type="number" min="1000" max={walletAccounts[0].available_balance} value={payoutForm.amount} onChange={e=>setPayoutForm({...payoutForm,amount:e.target.value})}/></label><label>Moyen de retrait<select value={payoutForm.payout_method} onChange={e=>setPayoutForm({...payoutForm,payout_method:e.target.value})}><option>T-Money</option><option>Moov Money</option></select></label><label>Nom du bénéficiaire<input required value={payoutForm.beneficiary_name} onChange={e=>setPayoutForm({...payoutForm,beneficiary_name:e.target.value})}/></label><label>Téléphone du bénéficiaire<input value={payoutForm.beneficiary_phone} onChange={e=>setPayoutForm({...payoutForm,beneficiary_phone:e.target.value})}/></label><label>Compte / IBAN<input value={payoutForm.beneficiary_account} onChange={e=>setPayoutForm({...payoutForm,beneficiary_account:e.target.value})}/></label><label>Banque / opérateur<input value={payoutForm.beneficiary_bank} onChange={e=>setPayoutForm({...payoutForm,beneficiary_bank:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Envoyer la demande</button></form>}</div><div className="cg-panel"><h2>Historique du portefeuille</h2>{walletEntries.map(e=><div className="cg-list-row" key={e.id}><div><b>{e.description||e.entry_type}</b><small>{dateLabel(e.created_at)} · {e.entry_type}</small></div><strong>{e.direction==='credit'?'+':'−'}{money(e.amount)}</strong></div>)}<h3>Mes retraits</h3>{payoutRequests.map(p=><div className="cg-list-row" key={p.id}><div><b>{money(p.amount)} · {p.payout_method}</b><small>{p.beneficiary_name} · {p.status} · {dateLabel(p.requested_at)}</small></div>{!['paid','rejected'].includes(p.status)&&<button className="btn btn-ghost" onClick={async()=>{setBusy(true);const {data,error}=await supabase.functions.invoke('paydunya-payouts',{body:{action:'check_payout',payout_request_id:p.id}});setBusy(false);if(error||data?.error)setNotice(data?.error||error?.message);else{setNotice('Statut du retrait : '+data.status);await loadMemberData(user);}}}>Vérifier le statut</button>}</div>)}</div></>}
      {tab === 'team' && <div className="cg-panel"><h2>Personnel et permissions</h2><p>Ajoutez un utilisateur ChinaGo déjà inscrit à votre boutique. Le membre doit vous communiquer l’identifiant UUID de son compte.</p><p>Votre identifiant ChinaGo : <code>{user?.id}</code> (partagez-le au propriétaire si vous êtes invité dans une autre boutique).</p>{activeStore?.owner_id===user?.id?<><form className="cg-form" onSubmit={saveTeamMember}><label>Identifiant du compte ChinaGo (UUID)<input required value={teamUserId} onChange={e=>setTeamUserId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/></label><div className="cg-check-grid">{Object.entries({view_products:'Voir les produits',manage_products:'Gérer les produits',view_orders:'Voir les commandes',manage_orders:'Gérer les commandes',manage_pages:'Gérer les pages',manage_discounts:'Gérer les promotions',manage_inventory:'Gérer le stock'}).map(([key,label])=><label key={key}><input type="checkbox" checked={!!teamPermissions[key]} onChange={e=>setTeamPermissions(old=>({...old,[key]:e.target.checked}))}/> {label}</label>)}</div><button className="btn btn-primary" disabled={busy}>Ajouter / mettre à jour le membre</button></form><h3>Équipe actuelle</h3>{storeMembers.filter(m=>m.store_id===activeStore.id).map(m=><div className="cg-list-row" key={m.id}><div><b>{m.user_id}</b><small>{m.member_role} · {m.status} · {Object.keys(m.permissions||{}).filter(k=>m.permissions[k]).join(', ')||'Aucune permission'}</small></div><button className="btn btn-ghost" onClick={async()=>{const {error}=await supabase.rpc('manage_store_member',{p_store_id:activeStore.id,p_member_user_id:m.user_id,p_permissions:m.permissions,p_status:'revoked'});if(error)setNotice(error.message);else{setNotice('Accès du membre révoqué.');loadMemberData(user);}}}>Révoquer</button></div>)}</>:<p>Seul le propriétaire de la boutique peut gérer son équipe.</p>}</div>}
      
      {tab === 'supplier' && <div className="cg-panel"><h2>Devenir fournisseur ChinaGo</h2><p>Vous êtes fabricant, grossiste ou fournisseur ? Présentez votre entreprise à notre équipe.</p><form className="cg-form" onSubmit={submitSupplierApplication}><label>Nom de l’entreprise<input required value={supplierForm.company_name} onChange={e => setSupplierForm({...supplierForm,company_name:e.target.value})}/></label><label>Nom du contact<input required value={supplierForm.contact_name} onChange={e => setSupplierForm({...supplierForm,contact_name:e.target.value})}/></label><label>E-mail<input type="email" required value={supplierForm.email || user?.email || ''} onChange={e => setSupplierForm({...supplierForm,email:e.target.value})}/></label><label>Téléphone<input required value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm,phone:e.target.value})}/></label><label>WhatsApp fournisseur<input value={supplierForm.whatsapp} onChange={e => setSupplierForm({...supplierForm,whatsapp:e.target.value})} placeholder="+86..."/></label><label className="cg-check-label"><input type="checkbox" checked={supplierForm.whatsapp_opt_in} onChange={e=>setSupplierForm({...supplierForm,whatsapp_opt_in:e.target.checked})}/> J’accepte de recevoir les messages de suivi de commande ChinaGo sur WhatsApp.</label><label>Pays<input required value={supplierForm.country} onChange={e => setSupplierForm({...supplierForm,country:e.target.value})}/></label><label>Site web (facultatif)<input value={supplierForm.website_url} onChange={e => setSupplierForm({...supplierForm,website_url:e.target.value})}/></label><label>Catégories de produits (séparées par des virgules)<input value={supplierForm.product_categories} onChange={e => setSupplierForm({...supplierForm,product_categories:e.target.value})} placeholder="Électronique, maison, mode..."/></label><label>Présentation<textarea value={supplierForm.message} onChange={e => setSupplierForm({...supplierForm,message:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Créer mon espace fournisseur <ArrowRight/></button></form></div>}

      {tab === 'cargo' && <><div className="cg-panel"><div className="cg-panel-head"><div><h2>Organiser un transport</h2><p>Choisissez un partenaire cargo ou laissez ChinaGo vous en proposer un. Le suivi sera mis à jour manuellement au départ.</p></div></div>{cargoPartners.length ? <div className="cg-carrier-grid">{cargoPartners.map(p => <article className="cg-carrier-card" key={p.id}><span><Truck/></span><div><b>{p.name}</b><small>{p.service_type === 'air' ? 'Transport aérien' : p.service_type === 'sea' ? 'Transport maritime' : p.service_type === 'express' ? 'Express' : p.service_type === 'road' ? 'Routier' : 'Transport mixte'}</small><small>{(p.origin_cities || []).join(', ') || 'Chine'} → {(p.destination_cities || []).join(', ') || 'Togo'}</small>{p.estimated_days_min && <small>Délai indicatif : {p.estimated_days_min}–{p.estimated_days_max || p.estimated_days_min} jours</small>}{p.pricing_notes && <small>{p.pricing_notes}</small>}</div><button className="btn btn-ghost" onClick={() => setCargoForm(old => ({...old,cargo_partner_id:p.id}))}>{cargoForm.cargo_partner_id === p.id ? 'Sélectionné' : 'Choisir'}</button></article>)}</div> : <div className="cg-empty"><Truck/><b>Les transporteurs seront bientôt disponibles</b><small>Vous pouvez tout de même déposer une demande : ChinaGo vous attribuera un partenaire manuellement.</small></div>}<form className="cg-form cg-divider-top" onSubmit={submitCargoRequest}><h3>Informations sur le colis</h3><label>Transporteur<select value={cargoForm.cargo_partner_id} onChange={e => setCargoForm({...cargoForm,cargo_partner_id:e.target.value})}><option value="">Laisser ChinaGo choisir</option>{cargoPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="cg-two-fields"><label>Ville de départ<input required value={cargoForm.origin_city} onChange={e => setCargoForm({...cargoForm,origin_city:e.target.value})}/></label><label>Ville d’arrivée<input required value={cargoForm.destination_city} onChange={e => setCargoForm({...cargoForm,destination_city:e.target.value})}/></label></div><label>Description du colis<input required value={cargoForm.package_description} onChange={e => setCargoForm({...cargoForm,package_description:e.target.value})} placeholder="Ex. 2 cartons de vêtements"/></label><div className="cg-three-fields"><label>Nombre de colis<input type="number" min="1" required value={cargoForm.package_count} onChange={e => setCargoForm({...cargoForm,package_count:e.target.value})}/></label><label>Poids (kg)<input type="number" min="0.1" step="0.1" value={cargoForm.weight_kg} onChange={e => setCargoForm({...cargoForm,weight_kg:e.target.value})}/></label><label>Dimensions<input value={cargoForm.dimensions} onChange={e => setCargoForm({...cargoForm,dimensions:e.target.value})} placeholder="L × l × H"/></label></div><label>Valeur déclarée (FCFA)<input type="number" min="0" value={cargoForm.declared_value_xof} onChange={e => setCargoForm({...cargoForm,declared_value_xof:e.target.value})}/></label><h3 className="cg-subtitle">Expéditeur et destinataire</h3><div className="cg-two-fields"><label>Nom de l’expéditeur<input required value={cargoForm.sender_name} onChange={e => setCargoForm({...cargoForm,sender_name:e.target.value})}/></label><label>Téléphone expéditeur<input required value={cargoForm.sender_phone} onChange={e => setCargoForm({...cargoForm,sender_phone:e.target.value})}/></label></div><div className="cg-two-fields"><label>Nom du destinataire<input required value={cargoForm.receiver_name} onChange={e => setCargoForm({...cargoForm,receiver_name:e.target.value})}/></label><label>Téléphone destinataire<input required value={cargoForm.receiver_phone} onChange={e => setCargoForm({...cargoForm,receiver_phone:e.target.value})}/></label></div><label>Adresse de livraison<input required value={cargoForm.receiver_address} onChange={e => setCargoForm({...cargoForm,receiver_address:e.target.value})}/></label><label>Informations complémentaires<textarea value={cargoForm.customer_notes} onChange={e => setCargoForm({...cargoForm,customer_notes:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Enregistrer ma demande cargo <Truck/></button></form>{cargoWhatsAppUrl && <a className="btn btn-primary cg-whatsapp-link" href={cargoWhatsAppUrl} target="_blank" rel="noreferrer"><MessageCircle/> Envoyer les détails au transporteur sur WhatsApp</a>}</div><div className="cg-panel"><h2>Suivi de mes demandes cargo</h2>{cargoRequests.filter(x => x.user_id === undefined || x.user_id === user?.id).length ? cargoRequests.filter(x => x.user_id === undefined || x.user_id === user?.id).map(c => <div className="cg-list-row" key={c.id}><span className="cg-list-icon"><Truck/></span><div><b>{c.cargo_partners?.name || 'Transporteur à attribuer'}</b><small>{c.origin_city} → {c.destination_city} · {c.package_description}</small><small>Statut : {c.status === 'submitted' ? 'Demande reçue' : c.status}</small>{c.tracking_reference && <small>Suivi : {c.tracking_reference}</small>}{c.quoted_price_xof && <small>Devis : {money(c.quoted_price_xof)}</small>}</div><time>{dateLabel(c.created_at)}</time></div>) : <p className="cg-muted">Aucune demande cargo pour le moment.</p>}</div></>}
      {tab === 'admin' && isAdmin && <><div className="cg-panel"><h2>Publier un produit dans le catalogue</h2><p>Ajoutez une fiche vérifiée à partir des informations et photos fournies par le fournisseur. Cochez « Produit gagnant » uniquement après vérification des données.</p><form className="cg-form" onSubmit={submitAdminProduct}><label>Nom du produit<input required value={adminProductForm.title} onChange={e => setAdminProductForm({...adminProductForm,title:e.target.value})}/></label><label>Catégorie<select value={adminProductForm.category_id} onChange={e => setAdminProductForm({...adminProductForm,category_id:e.target.value})}><option value="">Sans catégorie</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Description<textarea value={adminProductForm.description} onChange={e => setAdminProductForm({...adminProductForm,description:e.target.value})}/></label><label>Lien fournisseur<input value={adminProductForm.source_url} onChange={e => setAdminProductForm({...adminProductForm,source_url:e.target.value})} placeholder="https://www.alibaba.com/..."/></label><label>Prix indicatif en FCFA<input type="number" min="0" value={adminProductForm.price_xof} onChange={e => setAdminProductForm({...adminProductForm,price_xof:e.target.value})}/></label><label>URL de l’image produit<input value={adminProductForm.image_url} onChange={e => setAdminProductForm({...adminProductForm,image_url:e.target.value})} placeholder="https://..."/></label><label className="cg-check-label"><input type="checkbox" checked={adminProductForm.is_winner} onChange={e => setAdminProductForm({...adminProductForm,is_winner:e.target.checked})}/> Produit tendance / gagnant vérifié</label><button className="btn btn-primary" disabled={busy}>Publier le produit <Plus/></button></form></div><div className="cg-panel"><h2>Ajouter un transporteur manuel</h2><p>Renseignez les coordonnées communiquées par le transporteur. Aucun logiciel ni API n’est nécessaire.</p><form className="cg-form" onSubmit={submitCargoPartner}><label>Nom du transporteur<input required value={cargoPartnerForm.name} onChange={e => setCargoPartnerForm({...cargoPartnerForm,name:e.target.value})}/></label><label>Type de transport<select value={cargoPartnerForm.service_type} onChange={e => setCargoPartnerForm({...cargoPartnerForm,service_type:e.target.value})}><option value="air">Aérien</option><option value="sea">Maritime</option><option value="road">Routier</option><option value="express">Express</option><option value="mixed">Mixte</option></select></label><div className="cg-two-fields"><label>Villes de départ<input value={cargoPartnerForm.origin_cities} onChange={e => setCargoPartnerForm({...cargoPartnerForm,origin_cities:e.target.value})}/></label><label>Villes de destination<input value={cargoPartnerForm.destination_cities} onChange={e => setCargoPartnerForm({...cargoPartnerForm,destination_cities:e.target.value})}/></label></div><label>WhatsApp du transporteur<input value={cargoPartnerForm.whatsapp_phone} onChange={e => setCargoPartnerForm({...cargoPartnerForm,whatsapp_phone:e.target.value})} placeholder="+86... ou +228..."/></label><div className="cg-two-fields"><label>Téléphone<input value={cargoPartnerForm.contact_phone} onChange={e => setCargoPartnerForm({...cargoPartnerForm,contact_phone:e.target.value})}/></label><label>E-mail<input type="email" value={cargoPartnerForm.contact_email} onChange={e => setCargoPartnerForm({...cargoPartnerForm,contact_email:e.target.value})}/></label></div><div className="cg-two-fields"><label>Délai minimum (jours)<input type="number" min="1" value={cargoPartnerForm.estimated_days_min} onChange={e => setCargoPartnerForm({...cargoPartnerForm,estimated_days_min:e.target.value})}/></label><label>Délai maximum (jours)<input type="number" min="1" value={cargoPartnerForm.estimated_days_max} onChange={e => setCargoPartnerForm({...cargoPartnerForm,estimated_days_max:e.target.value})}/></label></div><label>Tarifs / conditions<textarea value={cargoPartnerForm.pricing_notes} onChange={e => setCargoPartnerForm({...cargoPartnerForm,pricing_notes:e.target.value})} placeholder="Ex. tarif au kg, minimum facturable, frais locaux…"/></label><label>Instructions<textarea value={cargoPartnerForm.instructions} onChange={e => setCargoPartnerForm({...cargoPartnerForm,instructions:e.target.value})}/></label><button className="btn btn-primary" disabled={busy}>Ajouter le transporteur <Plus/></button></form></div><div className="cg-panel"><h2>Boutiques à valider</h2>{adminStores.length ? adminStores.map(st => <div className="cg-admin-order-row" key={st.id}><div><b>{st.name}</b><small>{st.platform} · {st.slug} · propriétaire : {st.owner_id}</small><small>Statut : {st.status}</small></div><select value={st.status} onChange={e => updateStoreStatus(st.id,e.target.value)}><option value="draft">Brouillon</option><option value="active">Activer</option><option value="suspended">Suspendre</option></select></div>) : <p className="cg-muted">Aucune boutique à valider.</p>}</div><div className="cg-panel"><h2>Produits des boutiques</h2>{adminStoreProducts.length ? adminStoreProducts.map(sp => <div className="cg-admin-order-row" key={sp.id}><div><b>{sp.title}</b><small>{sp.stores?.name || 'Boutique'} · {sp.status}</small></div><select value={sp.status} onChange={e => updateAdminStoreProduct(sp.id,e.target.value)}><option value="draft">Brouillon</option><option value="published">Publier</option><option value="archived">Archiver</option></select></div>) : <p className="cg-muted">Aucun produit de boutique.</p>}</div><div className="cg-panel"><h2>Demandes d’importation à traiter</h2>{adminImportRequests.length ? adminImportRequests.map(i => <div className="cg-admin-import-row" key={i.id}><div><b>{i.source_platform.toUpperCase()} · {i.product_title || 'Produit à identifier'}</b><small><a href={i.source_url} target="_blank" rel="noreferrer">{i.source_url}</a></small><small>Client : {i.user_id} · {i.status}</small></div><form className="cg-admin-import-form" onSubmit={e => saveImportAdminDetails(i.id,e)}><label>Statut<select name="status" defaultValue={i.status}><option value="submitted">Reçue</option><option value="needs_details">Informations nécessaires</option><option value="quoted">Devis prêt</option><option value="accepted">Acceptée</option><option value="rejected">Refusée</option><option value="converted">Convertie en commande</option></select></label><label>Nom du produit<input name="product_title" defaultValue={i.product_title || ''}/></label><label>Description<textarea name="product_description" defaultValue={i.product_description || ''}/></label><label>URL image<input name="product_image_url" defaultValue={i.product_image_url || ''}/></label><label>Galerie d’images (JSON, tableau d’URL)<textarea name="product_images_json" defaultValue={JSON.stringify(i.product_images || [], null, 2)} placeholder='["https://..."]'/></label>
<label>Variantes (JSON)<textarea name="product_variants_json" defaultValue={JSON.stringify(i.product_variants || [], null, 2)} placeholder='[{"name":"Couleur","values":["Noir","Blanc"]}]'/></label>
<label>Options (JSON)<textarea name="product_options_json" defaultValue={JSON.stringify(i.product_options || [], null, 2)}/></label>
<div className="cg-two-fields"><label>Quantité minimale<input type="number" min="1" name="minimum_order_quantity" defaultValue={i.minimum_order_quantity || ''}/></label><label>Devise fournisseur<input name="original_currency" defaultValue={i.original_currency || 'CNY'}/></label></div>
<div className="cg-two-fields"><label>Prix source min<input type="number" min="0" step="0.01" name="original_price_min" defaultValue={i.original_price_min ?? ''}/></label><label>Prix source max<input type="number" min="0" step="0.01" name="original_price_max" defaultValue={i.original_price_max ?? ''}/></label></div>
<h4>Coordonnées du fournisseur (conservées dans l’administration)</h4>
<label>Entreprise<input name="supplier_company" defaultValue={i.supplier_company || ''}/></label>
<label>Contact<input name="supplier_contact_name" defaultValue={i.supplier_contact_name || ''}/></label>
<div className="cg-two-fields"><label>Téléphone<input name="supplier_phone" defaultValue={i.supplier_phone || ''}/></label><label>WhatsApp<input name="supplier_whatsapp" defaultValue={i.supplier_whatsapp || ''}/></label></div>
<div className="cg-two-fields"><label>E-mail<input type="email" name="supplier_email" defaultValue={i.supplier_email || ''}/></label><label>Profil fournisseur<input name="supplier_profile_url" defaultValue={i.supplier_profile_url || ''}/></label></div>
<small>Extraction : {i.extraction_status || 'À vérifier'} · Source : {i.extraction_source || 'saisie manuelle'}</small><div className="cg-two-fields"><label>Quantité<input type="number" min="1" name="quantity" defaultValue={i.quantity || 1}/></label><label>Prix produit (FCFA)<input type="number" min="0" name="unit_price_xof" defaultValue={i.unit_price_xof ?? ''}/></label></div><label>Transport estimé (FCFA)<input type="number" min="0" name="shipping_estimate_xof" defaultValue={i.shipping_estimate_xof ?? ''}/></label><label>Note client<textarea name="admin_notes" defaultValue={i.admin_notes || ''}/></label><button className="btn btn-primary">Enregistrer et notifier</button></form></div>) : <p className="cg-muted">Aucune demande d’importation.</p>}</div><div className="cg-panel"><h2>Demandes de commande à traiter</h2>{adminOrders.length ? adminOrders.map(o => <div className="cg-admin-order-row" key={o.id}><div><b>{o.order_number}</b><small>{o.contact_name} · {o.contact_phone}</small><small>{o.order_items?.map(it => it.product_title + ' × ' + it.quantity).join(', ')}</small><small>{o.delivery_city} · {o.delivery_address}</small></div><form className="cg-admin-quote-form" onSubmit={e => saveAdminOrderQuote(o.id,e)}><label>Statut<select name="status" defaultValue={o.status}><option value="quote_requested">Devis demandé</option><option value="pending">En attente</option><option value="awaiting_payment">Devis envoyé / paiement attendu</option><option value="processing">En préparation</option><option value="shipped">Expédiée</option><option value="delivered">Livrée</option><option value="cancelled">Annulée</option><option value="refunded">Remboursée</option></select></label><div className="cg-two-fields"><label>Produits (FCFA)<input type="number" min="0" name="subtotal_xof" defaultValue={o.subtotal_xof || 0}/></label><label>Transport (FCFA)<input type="number" min="0" name="shipping_xof" defaultValue={o.shipping_xof || 0}/></label></div><small>Total calculé : {money(o.total_xof)}</small><button className="btn btn-primary">Enregistrer le devis</button></form></div>) : <p className="cg-muted">Aucune demande de commande.</p>}</div><div className="cg-panel"><h2>Toutes les demandes cargo</h2>{cargoRequests.map(c => <div className="cg-admin-cargo-row" key={c.id}><div className="cg-list-row"><span className="cg-list-icon"><Truck/></span><div><b>{c.cargo_partners?.name || 'À attribuer'} · {c.origin_city} → {c.destination_city}</b><small>{c.package_description} · {c.package_count} colis · {c.weight_kg || 'Poids à préciser'} kg</small><small>Expéditeur : {c.sender_name} ({c.sender_phone})</small><small>Destinataire : {c.receiver_name} ({c.receiver_phone}) · {c.receiver_address}</small><small>Client ID : {c.user_id}</small></div></div><form className="cg-admin-cargo-form" onSubmit={e => saveCargoAdminDetails(c.id,e)}><label>Transporteur<select name="cargo_partner_id" defaultValue={c.cargo_partner_id || ''}><option value="">À attribuer</option>{cargoPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Statut<select name="status" defaultValue={c.status}><option value="submitted">Reçue</option><option value="partner_contacted">Transporteur contacté</option><option value="quoted">Devis envoyé</option><option value="accepted">Acceptée</option><option value="in_transit">En transit</option><option value="arrived">Arrivée</option><option value="delivered">Livrée</option><option value="cancelled">Annulée</option></select></label><label>Prix du transport (FCFA)<input type="number" min="0" name="quoted_price_xof" defaultValue={c.quoted_price_xof || ''}/></label><label>Numéro de suivi<input name="tracking_reference" defaultValue={c.tracking_reference || ''}/></label><label>Note interne<textarea name="partner_notes" defaultValue={c.partner_notes || ''}/></label><button className="btn btn-primary">Enregistrer le suivi</button>{c.cargo_partners?.whatsapp_phone && <a className="btn btn-ghost cg-admin-wa" href={'https://wa.me/' + c.cargo_partners.whatsapp_phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Bonjour ' + c.cargo_partners.name + ', demande cargo ChinaGo. Trajet : ' + c.origin_city + ' vers ' + c.destination_city + '. Colis : ' + c.package_description + '. Quantité : ' + c.package_count + '. Expéditeur : ' + c.sender_name + ' / ' + c.sender_phone + '. Destinataire : ' + c.receiver_name + ' / ' + c.receiver_phone + '. Adresse : ' + c.receiver_address + '. Merci de confirmer le devis et les délais.')} target="_blank" rel="noreferrer"><MessageCircle/> Contacter ce cargo sur WhatsApp</a>}</form></div>)}</div></>}
      {tab === 'applications' && <div className="cg-panel"><h2>Mes espaces professionnels</h2><p>Vos espaces vendeur, dropshipping et fournisseur sont activés sans approbation manuelle.</p>{applications.map(a => <div className="cg-list-row" key={a.id}><span className="cg-list-icon"><TrendingUp/></span><div><b>{a.account_type === 'dropshipper' ? 'Candidature dropshipping' : 'Candidature e-commerce'}</b><small>{a.business_name} · {a.status}</small></div><time>{dateLabel(a.created_at)}</time></div>)}{supplierApplications.map(a => <div className="cg-list-row" key={a.id}><span className="cg-list-icon"><PackageCheck/></span><div><b>Candidature fournisseur</b><small>{a.company_name} · {a.status}</small></div><time>{dateLabel(a.created_at)}</time></div>)}{!applications.length && !supplierApplications.length && <p className="cg-muted">Aucune candidature envoyée.</p>}</div>}
      </section>
    </div></main>}

    <footer className="footer"><div className="wrap footer-inner"><a className="brand footer-brand" href="#home"><span className="brand-icon">C<span>G</span></span><span>China<span>Go</span><small>IMPORT · SHOP · SELL</small></span></a><p>Votre partenaire pour acheter, importer et développer votre commerce entre la Chine et l’Afrique.</p><small>© 2026 ChinaGo. Les intégrations fournisseurs et paiements seront activées après validation des accès officiels.</small><a className="cg-admin-access" href="/?admin=1">Accès administration</a></div></footer>
  </div>;
}
