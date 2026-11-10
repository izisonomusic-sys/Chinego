import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, Box, CheckCircle2, Globe2, Heart, Link2, Menu, PackageCheck, Search, ShieldCheck, ShoppingBag, Store, Truck, X } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const products = [
  { id: 1, name: 'Écouteurs sans fil Pro', category: 'Électronique', price: 6500, icon: '🎧', tag: 'Tendance' },
  { id: 2, name: 'Montre connectée Active', category: 'Électronique', price: 12500, icon: '⌚', tag: 'Populaire' },
  { id: 3, name: 'Mini blender portable', category: 'Maison', price: 8900, icon: '🥤', tag: 'Nouveau' },
  { id: 4, name: 'Sac urbain polyvalent', category: 'Mode', price: 7500, icon: '🎒', tag: 'Sélection' },
];
const money = value => new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';

export default function App() {
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  async function authenticate(event) {
    event.preventDefault();
    if (!supabase) return setNotice('Le service de compte est momentanément indisponible.');
    setBusy(true);
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setNotice(authMode === 'signup' ? 'Compte créé. Vérifiez votre e-mail si une confirmation est demandée.' : 'Connexion réussie.');
      setAuthOpen(false);
      setPassword('');
    } catch (error) {
      setNotice(error.message || 'Une erreur est survenue.');
    } finally { setBusy(false); }
  }

  async function submitImport(event) {
    event.preventDefault();
    let parsed;
    try {
      parsed = new URL(link.trim());
      if (parsed.protocol !== 'https:') throw new Error();
    } catch {
      return setNotice('Veuillez coller une adresse complète commençant par https://');
    }
    if (!user || !supabase) {
      setNotice('Connectez-vous pour enregistrer votre demande d’importation.');
      setAuthMode('signin');
      setAuthOpen(true);
      return;
    }
    const host = parsed.hostname.toLowerCase();
    const platform = host.includes('alibaba.') ? 'alibaba' : host.includes('amazon.') ? 'amazon' : host.includes('ebay.') ? 'ebay' : 'other';
    setBusy(true);
    try {
      const { error } = await supabase.from('import_requests').insert({
        user_id: user.id, source_url: parsed.toString(), source_platform: platform
      });
      if (error) throw error;
      setNotice('Demande enregistrée ! Notre équipe pourra vérifier le lien et préparer votre devis. L’extraction automatique sera activée après les intégrations API autorisées.');
      setLink('');
    } catch (error) {
      setNotice(error.message || 'Impossible d’enregistrer la demande.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setNotice('Vous êtes déconnecté.');
  }

  const visibleProducts = products.filter(p => (p.name + ' ' + p.category).toLowerCase().includes(query.toLowerCase()));

  return <div className="app">
    <div className="topbar"><div className="wrap topbar-inner"><span>Votre passerelle commerciale entre la Chine et l’Afrique</span><span><Globe2 size={14}/> Afrique de l’Ouest · FCFA</span></div></div>
    <header className="header"><div className="wrap nav">
      <a className="brand" href="#home"><span className="brand-icon">C<span>G</span></span><span>China<span>Go</span><small>IMPORT · SHOP · SELL</small></span></a>
      <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X/> : <Menu/>}</button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}><a href="#products" onClick={() => setMenuOpen(false)}>Produits</a><a href="#import" onClick={() => setMenuOpen(false)}>Importer un lien</a><a href="#how" onClick={() => setMenuOpen(false)}>Comment ça marche</a><a href="#partners" onClick={() => setMenuOpen(false)}>Fournisseurs</a></nav>
      <div className="nav-actions">{user ? <button className="btn btn-ghost" onClick={signOut}>Déconnexion</button> : <><button className="btn btn-ghost" onClick={() => {setAuthMode('signin');setAuthOpen(true);}}>Connexion</button><button className="btn btn-primary" onClick={() => {setAuthMode('signup');setAuthOpen(true);}}>Créer un compte</button></>}</div>
    </div></header>

    {notice && <div className="wrap notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fermer"><X size={17}/></button></div>}

    {authOpen && <div className="overlay" onClick={() => setAuthOpen(false)}><section className="auth-card" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setAuthOpen(false)}><X/></button><span className="eyebrow">ESPACE CLIENT CHINAGO</span><h2>{authMode === 'signup' ? 'Créer votre compte' : 'Bienvenue de nouveau'}</h2><p>Accédez à vos demandes d’importation et à votre espace personnel.</p><form onSubmit={authenticate}><label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com"/></label><label>Mot de passe<input type="password" minLength="8" required value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum"/></label><button className="btn btn-primary full" disabled={busy}>{busy ? 'Patientez…' : authMode === 'signup' ? 'Créer mon compte' : 'Me connecter'}</button></form><button className="switch" onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}>{authMode === 'signup' ? 'Déjà inscrit ? Se connecter' : 'Créer un compte'}</button></section></div>}

    <main>
      <section className="hero" id="home"><div className="wrap hero-grid"><div><span className="eyebrow">ACHETER · IMPORTER · DÉVELOPPER</span><h1>Achetez en Chine depuis le Togo,<br/><em>simplement !</em></h1><p className="lead">Découvrez des produits, partagez un lien et préparez votre importation. ChinaGo coordonne votre parcours entre fournisseur et cargo.</p>
        <form className="import-card" id="import" onSubmit={submitImport}><label><Link2 size={17}/> Vous avez déjà un lien produit ?</label><div className="input-row"><input value={link} onChange={e => setLink(e.target.value)} placeholder="Collez un lien Alibaba, Amazon, eBay…"/><button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Obtenir un devis'} <ArrowRight size={16}/></button></div><small>Alibaba · Amazon · eBay · autres sources compatibles</small></form>
        <div className="hero-points"><span><CheckCircle2/> Demande enregistrée dans votre compte</span><span><ShieldCheck/> Validation avant paiement fournisseur</span></div>
      </div><div className="hero-visual"><div className="halo"></div><div className="hero-box"><div className="box-label">CHINAGO LOGISTICS <b>CG</b></div><div className="box-art">📦</div><strong>Votre commerce,<br/>sans frontières.</strong><small>CHINE → AFRIQUE</small></div><div className="float float-one"><PackageCheck/><span><b>Commande suivie</b><small>À chaque étape</small></span></div><div className="float float-two"><Truck/><span><b>Coordination cargo</b><small>Chine vers le Togo</small></span></div></div></div></section>

      <section className="trust"><div className="wrap trust-grid"><div><ShieldCheck/><b>Parcours encadré</b><small>Validation à chaque étape</small></div><div><ShoppingBag/><b>Prix en FCFA</b><small>Devis clair et local</small></div><div><Store/><b>Espace fournisseur</b><small>Demandes centralisées</small></div><div><Truck/><b>Suivi cargo</b><small>Du dépôt à la livraison</small></div></div></section>

      <section className="section" id="products"><div className="wrap"><div className="section-head"><div><span className="eyebrow">INSPIRATION & OPPORTUNITÉS</span><h2>Produits <em>gagnants du moment</em></h2><p>Une sélection de démonstration. Les offres réelles seront publiées après validation.</p></div><div className="search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un produit"/></div></div><div className="product-grid">{visibleProducts.map(p => <article className="product" key={p.id}><div className="product-art"><span>{p.tag}</span><button onClick={() => setFavorites(old => old.includes(p.id) ? old.filter(x => x !== p.id) : [...old,p.id])} aria-label="Favori"><Heart fill={favorites.includes(p.id) ? 'currentColor' : 'none'}/></button><b>{p.icon}</b></div><div className="product-info"><small>{p.category} · Exemple</small><h3>{p.name}</h3><strong>{money(p.price)}</strong><button className="product-link" onClick={() => document.getElementById('import')?.scrollIntoView({behavior:'smooth'})}>Demander un devis <ArrowRight size={15}/></button></div></article>)}</div></div></section>

      <section className="how section" id="how"><div className="wrap"><div className="section-head centered"><div><span className="eyebrow">UN PARCOURS CLAIR</span><h2>Comment fonctionne <em>ChinaGo ?</em></h2><p>Un processus progressif avec validation des étapes sensibles.</p></div></div><div className="steps"><article><b>01</b><Link2/><h3>Vous choisissez</h3><p>Parcourez le catalogue ou partagez le lien de votre produit.</p></article><article><b>02</b><Box/><h3>Nous préparons le devis</h3><p>Le produit, les options et les frais sont vérifiés avant validation.</p></article><article><b>03</b><Store/><h3>Le fournisseur confirme</h3><p>Disponibilité, prix et délai sont contrôlés avant engagement.</p></article><article><b>04</b><Truck/><h3>Le cargo livre</h3><p>Votre colis est suivi jusqu’à sa réception au Togo.</p></article></div></div></section>

      <section className="partners section" id="partners"><div className="wrap partner-grid"><div><span className="eyebrow">ESPACE PARTENAIRE</span><h2>Un espace dédié aux <em>fournisseurs</em></h2><p>Les fournisseurs pourront proposer leurs produits, confirmer les demandes et suivre les commandes qui leur sont attribuées. Les comptes partenaires seront activés après validation par ChinaGo.</p><button className="btn btn-primary" onClick={() => {setAuthMode('signup');setAuthOpen(true);}}>Créer un compte <ArrowRight/></button></div><div className="partner-card"><span className="partner-icon"><Store/></span><h3>ChinaGo Partner</h3><p>Un espace centralisé pour les produits, les demandes et la coordination des commandes.</p><div><CheckCircle2/> Validation des fournisseurs</div><div><CheckCircle2/> Suivi des demandes</div><div><CheckCircle2/> Notifications sécurisées</div></div></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><a className="brand footer-brand" href="#home"><span className="brand-icon">C<span>G</span></span><span>China<span>Go</span><small>IMPORT · SHOP · SELL</small></span></a><p>Votre partenaire pour acheter, importer et développer votre commerce entre la Chine et l’Afrique.</p><small>© 2026 ChinaGo. Catalogue de présentation · Intégrations API en préparation.</small></div></footer>
  </div>;
}
