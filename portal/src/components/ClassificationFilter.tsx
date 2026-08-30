import {
  formatClassificationLabel,
  type ClassificationGroup,
} from '../lib/groupByClassification'

type ClassificationFilterProps = {
  groups: ClassificationGroup<unknown>[]
  selected: string | null
  onSelect: (classification: string) => void
  className?: string
}

export function ClassificationFilter({
  groups,
  selected,
  onSelect,
  className,
}: ClassificationFilterProps) {
  if (groups.length === 0) return null

  return (
    <div
      className={`classification-filter${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label="Work classification"
    >
      {groups.map(group => {
        const active = selected === group.classification
        return (
          <button
            key={group.classification}
            type="button"
            role="tab"
            aria-selected={active}
            className={`classification-filter__btn${active ? ' is-active' : ''}`}
            onClick={() => onSelect(group.classification)}
          >
            {formatClassificationLabel(group.classification)}
            <span className="classification-filter__count">{group.items.length}</span>
          </button>
        )
      })}
    </div>
  )
}
