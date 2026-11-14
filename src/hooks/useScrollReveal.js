// ── useScrollReveal — fade-in animation for sections as they scroll into view ──
// Any element with the CSS class "reveal" starts hidden (see index.css); this
// hook watches them with an IntersectionObserver and adds "visible" when they
// enter the screen, which plays the fade/slide-in transition.
// Called once in App.jsx. Re-runs whenever the page (pathname) or the logged-in
// user changes, so sections that only appear after navigating, logging in or
// logging out are watched too.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useScrollReveal(user) {
  const { pathname } = useLocation()
  useEffect(() => {
    const run = () => {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible') }),
        { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
      )
      document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
      return observer
    }
    // Small delay so the new page's sections exist in the DOM before observing
    let obs
    const timer = setTimeout(() => { obs = run() }, 100)
    return () => { clearTimeout(timer); obs?.disconnect() }
  }, [pathname, user])
}
