# ChinaGo

Plateforme d'importation, de catalogue et de commerce entre la Chine et l'Afrique de l'Ouest.

## Stack
- React + Vite
- Supabase Auth et PostgreSQL
- Déploiement automatique prévu sur Render

## Configuration
Copier `.env.example` vers `.env.local`, puis renseigner les variables publiques Supabase.
Ne jamais placer de clé `service_role`, clé secrète fournisseur ou secret de paiement dans le frontend.

## État de cette première livraison
- Interface publique et catalogue de présentation
- Authentification Supabase
- Enregistrement sécurisé des demandes d'importation
- Règles RLS actives sur les tables exposées

Les produits de démonstration ne sont pas des offres réelles. L'extraction Alibaba/Amazon/eBay, les paiements, les transferts fournisseurs et le suivi cargo restent désactivés jusqu'à l'obtention des accès et contrats nécessaires.
