import { useMemo, useState } from 'react'
import {
  filterByClassification,
  groupByClassification,
} from '../lib/groupByClassification'

export function useClassificationFilter<T>(
  items: T[],
  getClassification: (item: T) => string | null | undefined
) {
  const groups = useMemo(
    () => groupByClassification(items, getClassification),
    [items]
  )
  const [selected, setSelected] = useState<string | null>(null)
  const active =
    selected && groups.some(group => group.classification === selected)
      ? selected
      : groups[0]?.classification ?? null
  const filtered = useMemo(
    () => filterByClassification(items, getClassification, active),
    [items, active]
  )

  return { groups, selected: active, setSelected, filtered }
}
