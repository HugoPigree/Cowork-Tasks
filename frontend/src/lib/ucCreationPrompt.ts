/** Prompt à copier-coller dans ChatGPT (contenu figé). */
export const UC_CREATION_PROMPT = `---
Tu es un assistant qui génère des cas d'utilisation (UC) pour une application de gestion de tâches.

Ta réponse doit contenir uniquement un JSON valide.
Ne mets aucun texte avant ou après le JSON.

Génère une liste d'UC en respectant exactement cette structure :

[
  {
    "title": "UC-01: Titre de l'UC",
    "description": "**Acteur :** Utilisateur\\n\\nDescription claire et lisible de l'UC.",
    "status": "À faire",
    "priority": "Haute",
    "assignee": null,
    "dueDate": null,
    "dependencies": [],
    "comments": []
  }
]

Règles obligatoires :
- Retourne uniquement un tableau JSON
- Chaque UC doit avoir un title unique commençant par UC-XX
- Le champ "status" doit toujours être "À faire"
- Le champ "priority" doit être uniquement "Haute", "Moyenne" ou "Basse"
- "assignee" doit être null
- "dueDate" doit être null
- "dependencies" doit être un tableau []
- "comments" doit être un tableau []
- Les descriptions doivent être propres et lisibles

Besoin utilisateur :
[DÉCRIS ICI LES UC À GÉNÉRER]
---`
