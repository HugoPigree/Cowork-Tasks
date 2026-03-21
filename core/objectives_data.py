"""
Predefined product objectives and suggested task templates (title + description).

Used by GET /api/objectives/ and POST /api/objectives/generate/.
Titles are short labels; the client prefixes UC-01, UC-02, … for display and backlog.
"""

from __future__ import annotations

OBJECTIVES: list[dict] = [
    {
        "id": "authentication",
        "title": "Authentification",
        "description": "Inscription, connexion, session, mot de passe oublié.",
        "suggestions": [
            {
                "title": "Créer un compte",
                "description": "**Acteur :** Visiteur\n\nInscription email / mot de passe ; validation et premier accès.",
            },
            {
                "title": "Se connecter et maintenir la session",
                "description": "**Acteur :** Utilisateur\n\nLogin, refresh token ou cookie sécurisé ; déconnexion explicite.",
            },
            {
                "title": "Réinitialiser le mot de passe",
                "description": "**Acteur :** Utilisateur\n\nLien par email, nouveau mot de passe conforme aux règles.",
            },
            {
                "title": "Activer l’authentification à deux facteurs",
                "description": "**Acteur :** Utilisateur\n\nEnrôlement TOTP / SMS ; codes de secours.",
            },
        ],
    },
    {
        "id": "crud",
        "title": "CRUD",
        "description": "Création, lecture, mise à jour, suppression de ressources.",
        "suggestions": [
            {
                "title": "Créer une ressource",
                "description": "**Acteur :** Utilisateur autorisé\n\nFormulaire validé ; persistance et retour 201 / message de succès.",
            },
            {
                "title": "Lister et paginer les ressources",
                "description": "**Acteur :** Utilisateur\n\nListe paginée, tri optionnel, état vide géré.",
            },
            {
                "title": "Modifier une ressource",
                "description": "**Acteur :** Utilisateur autorisé\n\nPréremplissage, validation, conflits optimistes éventuels.",
            },
            {
                "title": "Supprimer une ressource",
                "description": "**Acteur :** Utilisateur autorisé\n\nConfirmation ; cascade ou soft-delete selon règles métier.",
            },
        ],
    },
    {
        "id": "api_rest",
        "title": "API REST",
        "description": "Endpoints, versions, erreurs, limites et documentation.",
        "suggestions": [
            {
                "title": "Exposer des routes REST versionnées",
                "description": "**Acteur :** Intégrateur\n\nPréfixe /v1, compatibilité annoncée, dépréciation documentée.",
            },
            {
                "title": "Authentifier les appels API",
                "description": "**Acteur :** Intégrateur\n\nJWT ou clé API ; scopes et expiration.",
            },
            {
                "title": "Normaliser les réponses d’erreur",
                "description": "**Acteur :** Intégrateur\n\nCodes HTTP, corps JSON structuré, correlation id.",
            },
            {
                "title": "Appliquer le rate limiting",
                "description": "**Acteur :** Système\n\n429, en-têtes Retry-After ; pas de perte silencieuse.",
            },
        ],
    },
    {
        "id": "dashboard",
        "title": "Dashboard",
        "description": "Vue d’ensemble, widgets et indicateurs clés.",
        "suggestions": [
            {
                "title": "Afficher un tableau de bord synthétique",
                "description": "**Acteur :** Utilisateur\n\nCartes KPI, période sélectionnable, chargement et erreurs gérés.",
            },
            {
                "title": "Actualiser les données en temps quasi réel",
                "description": "**Acteur :** Utilisateur\n\nPolling ou push léger ; indicateur de fraîcheur.",
            },
            {
                "title": "Personnaliser les widgets visibles",
                "description": "**Acteur :** Utilisateur\n\nRéordonnancement ou masquage persisté par utilisateur.",
            },
        ],
    },
    {
        "id": "notifications",
        "title": "Notifications",
        "description": "Canaux, préférences et messages métier.",
        "suggestions": [
            {
                "title": "Configurer les canaux de notification",
                "description": "**Acteur :** Utilisateur\n\nEmail, in-app ; opt-in par type d’événement.",
            },
            {
                "title": "Recevoir une notification contextuelle",
                "description": "**Acteur :** Utilisateur\n\nMessage avec lien direct vers l’entité concernée.",
            },
            {
                "title": "Marquer comme lu / archiver",
                "description": "**Acteur :** Utilisateur\n\nCentre de notifications cohérent sur les appareils.",
            },
        ],
    },
    {
        "id": "collaboration",
        "title": "Collaboration",
        "description": "Espace partagé, rôles, activité d’équipe.",
        "suggestions": [
            {
                "title": "Inviter un collaborateur",
                "description": "**Acteur :** Admin / Owner\n\nInvitation par email ou identifiant ; rôle assigné.",
            },
            {
                "title": "Voir l’activité récente du projet",
                "description": "**Acteur :** Membre\n\nFil d’événements (créations, déplacements, commentaires).",
            },
            {
                "title": "Gérer les rôles dans l’espace",
                "description": "**Acteur :** Owner\n\nPromouvoir / rétrograder sans casser les accès critiques.",
            },
        ],
    },
    {
        "id": "file_upload",
        "title": "Upload fichiers",
        "description": "Import, types MIME, taille, stockage et prévisualisation.",
        "suggestions": [
            {
                "title": "Uploader un fichier avec barre de progression",
                "description": "**Acteur :** Utilisateur\n\nDrag-drop ou file picker ; annulation possible.",
            },
            {
                "title": "Valider type et taille du fichier",
                "description": "**Acteur :** Système\n\nRejet clair si hors limites ; scan basique si requis.",
            },
            {
                "title": "Prévisualiser ou télécharger un fichier",
                "description": "**Acteur :** Utilisateur autorisé\n\nURL signée ou contrôle d’accès sur le média.",
            },
        ],
    },
    {
        "id": "search_filters",
        "title": "Recherche & filtres",
        "description": "Requêtes texte, facettes, sauvegarde de vues.",
        "suggestions": [
            {
                "title": "Recherche full-text sur les entités",
                "description": "**Acteur :** Utilisateur\n\nDebounced input, surlignage optionnel, aucun résultat explicite.",
            },
            {
                "title": "Combiner plusieurs filtres",
                "description": "**Acteur :** Utilisateur\n\nET / OU documentés ; reset rapide.",
            },
            {
                "title": "Sauvegarder une vue filtrée",
                "description": "**Acteur :** Utilisateur\n\nNommage et rappel en un clic.",
            },
        ],
    },
    {
        "id": "user_profile",
        "title": "Profil utilisateur",
        "description": "Identité, avatar, préférences d’affichage.",
        "suggestions": [
            {
                "title": "Consulter et éditer le profil",
                "description": "**Acteur :** Utilisateur\n\nNom, email, timezone, langue.",
            },
            {
                "title": "Changer la photo de profil",
                "description": "**Acteur :** Utilisateur\n\nRecadrage léger ; taille max et formats acceptés.",
            },
            {
                "title": "Exporter ses données personnelles",
                "description": "**Acteur :** Utilisateur\n\nPackage téléchargeable conforme aux engagements RGPD.",
            },
        ],
    },
    {
        "id": "security",
        "title": "Sécurité",
        "description": "Durcissement, audit, politique de mots de passe.",
        "suggestions": [
            {
                "title": "Appliquer une politique de mots de passe",
                "description": "**Acteur :** Système\n\nLongueur, complexité, liste de mots interdits.",
            },
            {
                "title": "Journaliser les actions sensibles",
                "description": "**Acteur :** Auditeur\n\nQui, quoi, quand ; rétention définie.",
            },
            {
                "title": "Limiter les tentatives de connexion",
                "description": "**Acteur :** Système\n\nVerrouillage progressif ou captcha après échecs.",
            },
        ],
    },
    {
        "id": "testing",
        "title": "Tests",
        "description": "Stratégie de tests, CI, qualité de régression.",
        "suggestions": [
            {
                "title": "Couvrir les parcours critiques en e2e",
                "description": "**Acteur :** Équipe dev\n\nScénarios stables, données de test isolées.",
            },
            {
                "title": "Tests unitaires sur la logique métier",
                "description": "**Acteur :** Développeur\n\nCas limites et erreurs attendues.",
            },
            {
                "title": "Intégrer les tests dans la CI",
                "description": "**Acteur :** Pipeline\n\nBlocage de merge si régression ; rapports lisibles.",
            },
        ],
    },
    {
        "id": "drag_drop",
        "title": "Drag & Drop",
        "description": "Glisser-déposer, zones de dépôt, accessibilité.",
        "suggestions": [
            {
                "title": "Réordonner des éléments par glisser-déposer",
                "description": "**Acteur :** Utilisateur\n\nFeedback visuel ; ordre persisté.",
            },
            {
                "title": "Déplacer entre colonnes ou listes",
                "description": "**Acteur :** Utilisateur\n\nRègles métier respectées (ex. statuts autorisés).",
            },
            {
                "title": "Alternative clavier pour le réordonnancement",
                "description": "**Acteur :** Utilisateur\n\nAccessibilité sans souris.",
            },
        ],
    },
    {
        "id": "dependencies",
        "title": "Dépendances",
        "description": "Liens entre tâches, blocages, déblocage.",
        "suggestions": [
            {
                "title": "Lier une tâche à des prérequis",
                "description": "**Acteur :** Membre\n\nSélection de bloquants ; détection de cycles.",
            },
            {
                "title": "Empêcher la clôture si prérequis incomplets",
                "description": "**Acteur :** Système\n\nMessage explicite listant les blocages.",
            },
            {
                "title": "Visualiser le graphe de dépendances",
                "description": "**Acteur :** Membre\n\nVue simplifiée ou liste à plat hiérarchisée.",
            },
        ],
    },
    {
        "id": "settings",
        "title": "Paramètres",
        "description": "Configuration app, espaces, fonctionnalités.",
        "suggestions": [
            {
                "title": "Modifier les paramètres de l’espace",
                "description": "**Acteur :** Admin\n\nNom, description, options visibles par tous.",
            },
            {
                "title": "Gérer les fonctionnalités activables",
                "description": "**Acteur :** Admin\n\nFeature flags simples avec effet immédiat ou planifié.",
            },
            {
                "title": "Réinitialiser aux valeurs par défaut",
                "description": "**Acteur :** Admin\n\nConfirmation forte avant perte de config.",
            },
        ],
    },
    {
        "id": "analytics",
        "title": "Analytics",
        "description": "Métriques d’usage, entonnoirs, exports.",
        "suggestions": [
            {
                "title": "Suivre les événements produit clés",
                "description": "**Acteur :** Product\n\nÉvénements nommés, propriétés cohérentes.",
            },
            {
                "title": "Construire un entonnoir de conversion",
                "description": "**Acteur :** Product\n\nÉtapes définies ; taux par étape sur une période.",
            },
            {
                "title": "Exporter les métriques brutes",
                "description": "**Acteur :** Analyste\n\nCSV avec plage de dates ; limite de volume.",
            },
        ],
    },
    {
        "id": "ecommerce",
        "title": "E-commerce",
        "description": "Catalogue, panier, commande, paiement.",
        "suggestions": [
            {
                "title": "Parcourir le catalogue produits",
                "description": "**Acteur :** Client\n\nFiltres, fiche détail, stock affiché.",
            },
            {
                "title": "Gérer le panier",
                "description": "**Acteur :** Client\n\nQuantités, recalcul des totaux, codes promo.",
            },
            {
                "title": "Passer au paiement",
                "description": "**Acteur :** Client\n\nTunnel court ; états d’échec récupérables.",
            },
        ],
    },
    {
        "id": "team_workspace",
        "title": "Équipe & espaces",
        "description": "Membres, invitations, multi-espaces.",
        "suggestions": [
            {
                "title": "Créer un espace de travail",
                "description": "**Acteur :** Utilisateur\n\nNom, description ; créateur devient owner.",
            },
            {
                "title": "Basculer entre espaces",
                "description": "**Acteur :** Utilisateur\n\nSélecteur rapide ; contexte préservé.",
            },
            {
                "title": "Retirer un membre",
                "description": "**Acteur :** Owner / Admin\n\nRévocation immédiate des accès.",
            },
        ],
    },
    {
        "id": "payments",
        "title": "Paiements & abonnements",
        "description": "Préstataire, factures, renouvellement.",
        "suggestions": [
            {
                "title": "Souscrire à un plan payant",
                "description": "**Acteur :** Client\n\nChoix du plan ; redirection prestataire sécurisée.",
            },
            {
                "title": "Télécharger une facture",
                "description": "**Acteur :** Client\n\nHistorique des paiements PDF ou équivalent.",
            },
            {
                "title": "Gérer l’échec de paiement",
                "description": "**Acteur :** Système\n\nRelances, grace period, downgrade contrôlé.",
            },
        ],
    },
]


def objective_by_id(objective_id: str) -> dict | None:
    for o in OBJECTIVES:
        if o["id"] == objective_id:
            return o
    return None


def list_objectives_public() -> list[dict]:
    """Strip suggestions for list endpoint."""
    return [
        {"id": o["id"], "title": o["title"], "description": o["description"]}
        for o in OBJECTIVES
    ]
