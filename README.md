# SYBEM Academia_2 - Plateforme SaaS de Gestion Scolaire Intégrée

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Django](https://img.shields.io/badge/Django-4.2+-092E20.svg?logo=django)
![DRF](https://img.shields.io/badge/DRF-3.14+-red.svg)
![Status](https://img.shields.io/badge/status-En%20d%C3%A9veloppement-success.svg)

> [!IMPORTANT]
> **Évolution du projet :** Ce dépôt représente la **version 2.0 (SaaS & Multi-tenant)**. 
> Il s'agit d'une refonte complète du projet initial [school_project](https://github.com/FORTU03-S/school_project) (MVP). 
> Contrairement à la version précédente qui était monolithique, cette V2 introduit une **architecture modulaire**, un **refactoring total du code** (passage de fichiers denses à des apps Django spécialisées) et une isolation stricte des données pour supporter plusieurs écoles.

---

**SYBEM Academia** est un système d'information de gestion de l'éducation (SIGE) moderne. Il permet de digitaliser, d'automatiser et d'optimiser la gestion administrative, académique et financière des établissements scolaires.

##  Table des matières
1. [À propos du projet](#-à-propos-du-projet)
2.  [Architecture & Technologies](#-architecture--technologies)
3. [Fonctionnalités Principales](#-fonctionnalités-principales)
4. [Feuille de route (Roadmap)](#-feuille-de-route-roadmap)
5. [Installation & Déploiement](#-installation--déploiement)

---

##  À propos du projet
SYBEM Academia_2 résout le problème de la fragmentation des données en centralisant toutes les opérations. Conçu pour répondre aux réalités locales et internationales, le système offre une interface intuitive avec des tableaux de bord analytiques en temps réel.

---

##  Architecture & Technologies
Le projet utilise des standards industriels pour garantir scalabilité et sécurité :

* **Backend :** Python, Django, Django Rest Framework (DRF)
* **Base de données :** PostgreSQL (optimisé pour les requêtes complexes)
* **Authentification :** JSON Web Tokens (JWT) & RBAC (Permissions par rôles)
* **Frontend :** Vanilla JavaScript ES6+, Tailwind CSS / Bootstrap
* **Architecture SaaS :** Gestion multi-écoles (multi-tenancy) avec isolation logique.

---

##  Fonctionnalités Principales

###  1. Administration SaaS (Super Admin)
* **Onboarding automatisé :** Création d'écoles via transactions atomiques (`transaction.atomic`).
* **Gestion des Abonnements :** Plans dynamiques limitant l'accès aux modules.
* **Tableau de bord global :** Statistiques de revenus et monitoring des écoles actives.

###  2. Gestion Académique & Scolarité
* **Périodes Académiques :** Gestion des cycles, horaires de cours et analyses de performance.
* **Suivi Élèves :** Inscriptions, affectations, historique scolaire et disciplinaire.
* **Gestion du Personnel :** Profils et affectation des rôles (Enseignants, Admin).

###  3. Module Financier Avancé (ERP)
* **Multi-devises :** Support natif (ex: USD/CDF) avec taux de change configurables par école.
* **Workflows de Validation :** Suivi des transactions (En attente, Audité, Validé, Rejeté).
* **Reporting :** Génération de reçus uniques et tableaux de bord de trésorerie.

---

##  Feuille de route (Roadmap)
- [ ] **Portail Parents / Élèves :** Consultation des notes et paiements en ligne.
- [ ] **Intégration Mobile Money :** Paiement direct des frais de scolarité.
- [ ] **Générateur d'Emplois du Temps :** Algorithme d'automatisation des horaires.

---

## Installation & Déploiement (Local)

### Prérequis
* Python 3.10+ | PostgreSQL | Git

### Étapes d'installation
1. **Cloner le dépôt :**
   ```bash
   git clone https://github.com/FORTU03-S/sybem_academia_2.git.
   cd sybem_academia_2

# 1. Créer l'environnement virtuel
python -m venv venv

# 2. L'activer
source venv/bin/activate  # Sur Mac/Linux
# OU
venv\Scripts\activate     # Sur Windows

# 3. Installer les outils nécessaires
pip install -r requirements.txt

# 4. Préparer la base de données et lancer
python manage.py migrate
python manage.py runserver

## Technical Highlights

- Modular Django architecture (10 independent apps)
- Clear separation of concerns (business logic isolated by domain)
- Role-Based Access Control (RBAC) with granular permissions
- RESTful API structure using Django REST Framework
- Optimized PostgreSQL queries and indexed fields
- Transaction-safe operations using `transaction.atomic`
- Multi-tenant logic with data isolation per school


## System Design Overview

The platform follows a layered architecture:

- Presentation Layer (Frontend – JS / Tailwind)
- API Layer (DRF)
- Business Logic Layer (Django Apps)
- Data Layer (PostgreSQL)

Each domain (Finance, Academic, Users, Subscription, etc.) is encapsulated in independent Django applications to improve maintainability and scalability.
