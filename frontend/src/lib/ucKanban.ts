/** Carte « cas d’usage » : titre du type UC-01, UC-12, etc. */
export function isUcTitle(title: string): boolean {
  return /^UC-\d+/i.test(title.trim())
}
