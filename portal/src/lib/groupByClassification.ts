const BUILTIN_ORDER = [
  'MASON',
  'CARPENTER',
  'ELECTRICIAN',
  'PLUMBER',
  'LABORER',
  'SUPERVISOR',
  'OPERATOR',
]

export type ClassificationGroup<T> = {
  classification: string
  items: T[]
}

export function normalizeClassification(raw: string | null | undefined): string {
  return (raw || 'UNCLASSIFIED').trim().toUpperCase() || 'UNCLASSIFIED'
}

export function formatClassificationLabel(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s\-/])(\w)/g, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`)
}

export function groupByClassification<T>(
  items: T[],
  getClassification: (item: T) => string | null | undefined
): ClassificationGroup<T>[] {
  const map = new Map<string, T[]>()

  for (const item of items) {
    const key = normalizeClassification(getClassification(item))
    const list = map.get(key)
    if (list) {
      list.push(item)
    } else {
      map.set(key, [item])
    }
  }

  return [...map.keys()]
    .sort(compareClassifications)
    .map(classification => ({
      classification,
      items: map.get(classification)!,
    }))
}

export function filterByClassification<T>(
  items: T[],
  getClassification: (item: T) => string | null | undefined,
  selected: string | null
): T[] {
  if (!selected) return items
  return items.filter(item => normalizeClassification(getClassification(item)) === selected)
}

function compareClassifications(a: string, b: string): number {
  if (a === b) return 0
  if (a === 'OTHER' || a === 'UNCLASSIFIED') return 1
  if (b === 'OTHER' || b === 'UNCLASSIFIED') return -1
  const ia = BUILTIN_ORDER.indexOf(a)
  const ib = BUILTIN_ORDER.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}
