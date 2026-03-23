/** Carte UC / T identifiée par le préfixe du titre (UC-01:, T-05:, …). */
export type UcLinkMapping = Record<string, string[]>

const UC_CODE = /^UC-\d+$/i
const TASK_CODE = /^(UC|T)-\d+$/i

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function normalizeCode(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  if (!TASK_CODE.test(t)) return null
  return t
}

/**
 * Valide un JSON du type :
 * `{ "UC-01": ["T-01", "T-02"], "UC-02": ["T-05"] }`
 * Les clés sont des codes UC ; les valeurs listent des codes T (ou UC) présents en titre de tâche racine.
 */
export function validateUcLinkMappingJson(raw: string):
  | { ok: true; mapping: UcLinkMapping }
  | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, message: "Collez un objet JSON (correspondances UC → tâches)." }
  }
  let data: unknown
  try {
    data = JSON.parse(trimmed) as unknown
  } catch {
    return {
      ok: false,
      message:
        "JSON invalide : vérifiez la syntaxe (guillemets doubles, virgules, pas de texte autour).",
    }
  }
  if (!isPlainObject(data)) {
    return { ok: false, message: "Le JSON doit être un objet { \"UC-01\": [\"T-01\", …], … }." }
  }
  const mapping: UcLinkMapping = {}
  for (const [k, v] of Object.entries(data)) {
    const ucKey = k.trim().toUpperCase()
    if (!UC_CODE.test(ucKey)) {
      return {
        ok: false,
        message: `Clé invalide ${JSON.stringify(k)} : chaque clé doit être un code UC (ex. \"UC-01\").`,
      }
    }
    if (!Array.isArray(v)) {
      return {
        ok: false,
        message: `La valeur pour ${JSON.stringify(k)} doit être un tableau de chaînes.`,
      }
    }
    const refs: string[] = []
    const seenRef = new Set<string>()
    for (let i = 0; i < v.length; i++) {
      const el = v[i]
      if (typeof el !== "string") {
        return {
          ok: false,
          message: `${ucKey} : l’élément d’index ${i} doit être une chaîne (ex. \"T-01\").`,
        }
      }
      const code = normalizeCode(el)
      if (!code) {
        return {
          ok: false,
          message: `${ucKey} : référence invalide ${JSON.stringify(el)} (attendu ex. T-05 ou UC-02).`,
        }
      }
      if (seenRef.has(code)) continue
      seenRef.add(code)
      refs.push(code)
    }
    mapping[ucKey] = refs
  }
  if (Object.keys(mapping).length === 0) {
    return { ok: false, message: "L’objet ne contient aucune entrée UC." }
  }
  return { ok: true, mapping }
}

/** Exemple à copier (flipper / monorepo). */
export const UC_LINK_MAPPING_EXAMPLE: UcLinkMapping = {
  "UC-01": ["T-01", "T-02", "T-03", "T-04"],
  "UC-02": ["T-05"],
  "UC-03": ["T-06"],
  "UC-04": ["T-07", "T-08", "T-09"],
  "UC-05": ["T-10", "T-11", "T-12", "T-13"],
  "UC-06": ["T-14", "T-15", "T-16", "T-17"],
  "UC-07": ["T-18", "T-19", "T-20"],
  "UC-08": ["T-21", "T-22", "T-23"],
  "UC-09": ["T-24", "T-25", "T-26"],
  "UC-10": ["T-27", "T-28", "T-29"],
  "UC-11": ["T-30", "T-31", "T-32"],
  "UC-12": ["T-33", "T-34", "T-35"],
  "UC-13": ["T-36", "T-37"],
  "UC-14": ["T-38", "T-39"],
  "UC-15": ["T-40", "T-41", "T-42"],
}
