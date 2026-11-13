import { useEffect, useState } from 'react'

// ── useIsMobile — true below Tailwind's `md` breakpoint (768px) ───────────────
// Used where layout must change in JS, not just CSS: on phones the sidebar is
// an overlay drawer over a fixed icon rail instead of pushing the page aside.
export const MOBILE_QUERY = '(max-width: 767px)'

export const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches

export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobileViewport)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}
