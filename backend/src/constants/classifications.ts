export const BUILTIN_CLASSIFICATIONS = [
  'MASON',
  'CARPENTER',
  'ELECTRICIAN',
  'PLUMBER',
  'LABORER',
  'SUPERVISOR',
  'OPERATOR',
] as const

export const OTHER_CLASSIFICATION = 'OTHER'

export function normalizeClassificationName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!name) {
    throw new Error('Classification name is required')
  }
  if (name.length > 100) {
    throw new Error('Classification name must be 100 characters or fewer')
  }
  if (!/^[A-Z0-9][A-Z0-9 \-/]*$/.test(name)) {
    throw new Error('Classification may use letters, numbers, spaces, hyphens, and slashes')
  }
  return name
}

export function sortClassifications(names: string[]): string[] {
  const unique = [
    ...new Set(
      names
        .map(n => n.trim().toUpperCase())
        .filter(n => n && n !== OTHER_CLASSIFICATION)
    ),
  ]
  const builtins = BUILTIN_CLASSIFICATIONS.filter(name => unique.includes(name))
  const custom = unique
    .filter(name => !(BUILTIN_CLASSIFICATIONS as readonly string[]).includes(name))
    .sort((a, b) => a.localeCompare(b))
  return [...builtins, ...custom, OTHER_CLASSIFICATION]
}
