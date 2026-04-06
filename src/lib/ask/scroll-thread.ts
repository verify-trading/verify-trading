/** Pixels from bottom of scroll container; 0 = scrolled to end. */
export function getDistanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

/** Default used by Ask thread when deciding whether to auto-scroll after images load. */
export const ASK_PINNED_THRESHOLD_PX = 96;

/** True when the user is close enough to the bottom to treat them as "following" new content. */
export function isPinnedNearBottom(
  el: HTMLElement,
  thresholdPx: number = ASK_PINNED_THRESHOLD_PX,
): boolean {
  return getDistanceFromBottom(el) <= thresholdPx;
}
