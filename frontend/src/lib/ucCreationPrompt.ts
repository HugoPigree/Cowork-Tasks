/** Prompt à copier-coller dans ChatGPT (contenu figé). */
export const UC_CREATION_PROMPT = `---
Tu es un assistant qui génère des cas d'utilisation (UC) pour une application de gestion de tâches.

Ta réponse doit contenir uniquement un JSON valide.
Ne mets aucun texte avant ou après le JSON.

Génère une liste d'UC en respectant exactement cette structure (exemple avec prérequis) :

[
  {
    "title": "UC-01: Titre de la première UC",
    "description": "**Acteur :** Utilisateur\\n\\nDescription…",
    "status": "À faire",
    "priority": "Haute",
    "assignee": null,
    "dueDate": null,
    "dependencies": [],
    "comments": []
  },
  {
    "title": "UC-02: Titre de la seconde UC",
    "description": "**Acteur :** Utilisateur\\n\\n…",
    "status": "À faire",
    "priority": "Moyenne",
    "assignee": null,
    "dueDate": null,
    "dependencies": ["UC-01"],
    "comments": []
  }
]

Règles obligatoires :
- Retourne uniquement un tableau JSON
- Chaque UC doit avoir un title unique ; le préfixe avant ":" doit être unique (ex. UC-01, UC-02)
- Le champ "status" doit toujours être "À faire"
- Le champ "priority" doit être uniquement "Haute", "Moyenne" ou "Basse"
- "assignee" doit être null
- "dueDate" doit être null
- "dependencies" : tableau de chaînes référençant d'autres UC du même JSON :
  - par code titre : "UC-01" pour une entrée dont le title commence par "UC-01:"
  - par position : "T-1" = 1re UC du tableau, "T-2" = 2e, etc.
  - optionnel : ajoute "ref": "T-01" sur une entrée et utilise "T-01" dans les dependencies des autres
- "dependencies" peut être [] s'il n'y a pas de prérequis
- Pas de cycle (A ne doit pas dépendre de B si B dépend déjà de A, directement ou en chaîne)
- "comments" doit être un tableau []
- Les descriptions doivent être propres et lisibles

Besoin utilisateur :
[DÉCRIS ICI LES UC À GÉNÉRER]
---`
