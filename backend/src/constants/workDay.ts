/** Paid workday is 07:00–17:00. Time outside that window does not count toward wages. */
/** Checkout review opens at 18:00 (after the 17:00-18:00 leaving window). */

export const WORK_START_HOUR = 7
export const WORK_START_MINUTE = 0
export const WORK_END_HOUR = 17
export const WORK_END_MINUTE = 0
export const CHECKOUT_REVIEW_HOUR = 18
export const CHECKOUT_REVIEW_MINUTE = 0

export function workStartOn(date: Date): Date {
  const start = new Date(date)
  start.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0)
  return start
}

export function workEndOn(date: Date): Date {
  const end = new Date(date)
  end.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0)
  return end
}

/** 18:00 — opens after the 17:00-18:00 leaving window. */
export function checkoutReviewOn(date: Date): Date {
  const review = new Date(date)
  review.setHours(CHECKOUT_REVIEW_HOUR, CHECKOUT_REVIEW_MINUTE, 0, 0)
  return review
}

/** Minutes after 07:00. Zero if the worker arrived on time or early. */
export function lateMinutesFromWorkStart(entry: Date): number {
  const diffMs = entry.getTime() - workStartOn(entry).getTime()
  if (diffMs <= 0) return 0
  return Math.round(diffMs / 60_000)
}

export function payableStartFromEntry(entry: Date): Date {
  const start = workStartOn(entry)
  return entry > start ? entry : start
}

export function payableEndFromSession(sessionEnd: Date, day: Date): Date {
  const end = workEndOn(day)
  return sessionEnd < end ? sessionEnd : end
}

/** Milliseconds of [start, end] that fall inside [windowStart, windowEnd]. */
export function overlapMs(
  start: Date,
  end: Date,
  windowStart: Date,
  windowEnd: Date
): number {
  const s = Math.max(start.getTime(), windowStart.getTime())
  const e = Math.min(end.getTime(), windowEnd.getTime())
  return Math.max(0, e - s)
}
