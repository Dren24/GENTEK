// ── AppSidebar — left navigation sidebar for logged-in users ──────────────────
// Renders only when user is authenticated (returns null for guests).
// Two states: expanded (w-64) and collapsed (w-12, icon rail).
// Collapsed state shows flyout popups for search, pinned, recent, and user menu.

import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, ClockCounterClockwise, Lightning, FileText,
  Gear, Question, SignOut, SidebarSimple, Sun, Moon,
  PushPin, MagnifyingGlass, X, PencilSimple, Trash,
} from '@phosphor-icons/react'
import GentekMark, { GentekWordmark } from './GentekLogo'
import { useAuth } from '../../context/AuthContext'
import { useDarkMode } from '../../hooks/useDarkMode'
import ConfirmModal from './ConfirmModal'

// ── CollapsedPopup — flyout popup wrapper used in collapsed sidebar ────────────
// Closes when the user clicks outside it (mousedown listener on document).
function CollapsedPopup({ onClose, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div
      ref={ref}
      className={`absolute left-full top-0 ml-2 z-50 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden ${className}`}
      style={{ animation: 'fadeIn 0.15s ease' }}
    >
      {children}
    </div>
  )
}

// ── SearchPopup — flyout with fuzzy search over history and New Analysis button ──
function SearchPopup({ items, onClose, onNew, onSelect }) {
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? items.filter(r => r.label.toLowerCase().includes(q.toLowerCase()))
    : items
  const groups = ['Today', 'Yesterday', 'Previous 7 Days']

  return (
    <CollapsedPopup onClose={onClose} className="w-72">
      {/* Search input row with clear X */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700">
        <MagnifyingGlass size={14} className="text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search analyses..."
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
        />
        {/* Close search popup button */}
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X size={13} weight="bold" />
        </button>
      </div>

      {/* New Analysis shortcut button at top of results */}
      <button
        onClick={() => { onNew(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors border-b border-gray-700"
      >
        <PencilSimple size={14} className="text-gray-400" />
        New Analysis
      </button>

      {/* History results grouped by Today / Yesterday / Previous 7 Days */}
      <div className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-500 px-4 py-3">{items.length === 0 ? 'No analyses yet.' : 'No results found.'}</p>
        ) : (
          groups.map(g => {
            const groupItems = filtered.filter(r => r.group === g)
            if (!groupItems.length) return null
            return (
              <div key={g}>
                {/* Group label — e.g. "TODAY" */}
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{g}</p>
                {groupItems.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { onSelect(r); onClose() }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-700 transition-colors"
                  >
                    {/* Color dot indicates bias level */}
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                    <span className="text-sm text-gray-200 truncate flex-1">{r.label}</span>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{r.score}%</span>
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>
    </CollapsedPopup>
  )
}

// ── PinnedPopup — flyout showing only pinned analyses (pushpin fill icon) ─────
function PinnedPopup({ pinnedItems, onClose, onSelect }) {
  return (
    <CollapsedPopup onClose={onClose} className="w-60">
      <div className="p-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Pinned</p>
        {pinnedItems.length === 0 ? (
          <p className="text-xs text-gray-500 px-1 py-2">No pinned analyses yet.</p>
        ) : (
          <div className="space-y-0.5">
            {pinnedItems.map(r => (
              <button key={r.id} onClick={() => { onSelect(r); onClose() }} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left hover:bg-gray-700 transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                <span className="text-sm text-gray-200 truncate flex-1">{r.label}</span>
                <span className="text-[10px] text-gray-500">{r.score}%</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </CollapsedPopup>
  )
}

// ── RecentPopup — flyout showing all (non-pinned) recent analyses ──────────────
function RecentPopup({ items, onClose, onSelect }) {
  return (
    <CollapsedPopup onClose={onClose} className="w-64">
      <div className="p-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Recents</p>
        {items.length === 0 ? (
          <p className="text-xs text-gray-500 px-1 py-2">No analyses yet. Run one to see history.</p>
        ) : (
          <div className="space-y-0.5 max-h-80 overflow-y-auto">
            {items.map(r => (
              <button key={r.id} onClick={() => { onSelect(r); onClose() }} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left hover:bg-gray-700 transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                <span className="text-sm text-gray-200 truncate flex-1">{r.label}</span>
                <span className="text-[10px] text-gray-500 flex-shrink-0">{r.score}%</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </CollapsedPopup>
  )
}

// ── UserPopup — bottom-left flyout showing user name, email, and quick nav ────
// Appears when clicking the avatar circle in the collapsed sidebar footer.
function UserPopup({ user, logout, onClose, onNavigate, onHelp }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div
      ref={ref}
      className="absolute left-full bottom-0 ml-2 z-50 w-52 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
      style={{ animation: 'fadeIn 0.15s ease' }}
    >
      {/* User name + email header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2.5">
          {/* Avatar circle with first letter of name */}
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
      <div className="p-1.5">
        {/* Settings — navigate to /settings */}
        <button onClick={() => { onNavigate('/settings'); onClose() }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-gray-700 transition-colors">
          <Gear size={14} />Settings
        </button>
        {/* Help — navigate to /about */}
        <button onClick={() => { onNavigate('/about'); onClose() }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-gray-700 transition-colors">
          <Question size={14} />Help
        </button>
        {/* Sign out — red destructive action */}
        <button
          onClick={() => { logout(); onNavigate('/') }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-900/30 transition-colors"
        >
          <SignOut size={14} />Sign out
        </button>
      </div>
    </div>
  )
}

// ════════════════════════ SIDEBAR ════════════════════════════════════════════
export default function AppSidebar() {
  const { user, logout, history, sidebarOpen, toggleSidebar, openPricing, deleteHistory } = useAuth()
  const [dark, setDark] = useDarkMode()
  const navigate = useNavigate()

  const [pinned, setPinned]               = useState([])
  const [activePopup, setActivePopup]     = useState(null)   // 'search' | 'pinned' | 'recent' | 'user' | null
  const [logoHover, setLogoHover]         = useState(false)  // swap GENTEK mark → expand icon on hover
  const [confirmDeleteId, setConfirmDeleteId] = useState(null) // id of item pending delete confirmation

  // ── Hidden for guests — they use the top Navbar instead ──────────────────
  if (!user) return null

  const go        = (path, state)  => { navigate(path, state ? { state } : undefined); setActivePopup(null) }
  const loadText  = (item)         => go('/', { loadText: item.text, historyId: item.id })
  const togglePin = (id)           => setPinned(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggle    = (name)         => setActivePopup(p => p === name ? null : name)

  const pinnedItems = history.filter(r => pinned.includes(r.id))
  const recentItems = history.filter(r => !pinned.includes(r.id))
  const itemToDelete = confirmDeleteId !== null ? history.find(h => h.id === confirmDeleteId) : null

  return (
    <>
    <aside
      className={`
        fixed top-0 left-0 bottom-0 z-40 flex flex-col
        bg-gray-50 dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 ease-in-out overflow-visible
        ${sidebarOpen ? 'w-64' : 'w-12'}
      `}
    >
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ── HEADER — GENTEK logo + collapse/expand toggle ────────────────── */}
      <div className={`flex items-center h-14 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 ${sidebarOpen ? 'px-2' : 'px-1.5'}`}>
        {sidebarOpen ? (
          <>
            {/* GENTEK wordmark links home */}
            <Link to="/" className="flex-1 min-w-0 pl-1">
              <GentekWordmark size={30} textSize="text-sm" />
            </Link>
            {/* Collapse sidebar button — SidebarSimple icon */}
            <button onClick={toggleSidebar} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0" title="Collapse sidebar">
              <SidebarSimple size={17} weight="bold" />
            </button>
          </>
        ) : (
          // Collapsed: hover swaps GENTEK mark for expand icon
          <button
            onClick={toggleSidebar}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            title="Expand sidebar"
            className="w-full flex items-center justify-center py-1 transition-all"
          >
            {logoHover
              ? <SidebarSimple size={18} weight="bold" className="text-gray-500 dark:text-gray-400" />
              : <GentekMark size={28} />
            }
          </button>
        )}
      </div>

      {/* ── BODY — scrollable content area ───────────────────────────────── */}
      <div className={`flex-1 overflow-y-auto overflow-x-visible py-2 editor-scroll ${!sidebarOpen ? 'overflow-visible' : ''}`}>

        {/* New Analysis button — always visible in both states */}
        <div className={`mb-1 ${sidebarOpen ? 'px-2' : 'px-1.5'}`}>
          <button
            onClick={() => { navigate('/', { state: { newAnalysis: true } }); setActivePopup(null) }}
            title={!sidebarOpen ? 'New Analysis' : undefined}
            className={`w-full flex items-center gap-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl transition-all shadow-btn ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center p-2.5'}`}
          >
            <Plus size={15} weight="bold" className="flex-shrink-0" />
            {sidebarOpen && 'New Analysis'}
          </button>
        </div>

        {/* ── EXPANDED sidebar content ────────────────────────────────────── */}
        {sidebarOpen && (
          <>
            {/* Pinned section — only shown if user has pinned items */}
            {pinnedItems.length > 0 && (
              <>
                <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Pinned</p>
                <div className="px-2 space-y-0.5 mb-3">
                  {pinnedItems.map(r => (
                    <div key={r.id} className="group relative">
                      <button onClick={() => loadText(r)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors text-left pr-8">
                        <FileText size={14} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{r.label}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{r.score}% bias</p>
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                      </button>
                      {/* Unpin button — appears on row hover */}
                      <button onClick={() => togglePin(r.id)} title="Unpin" className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-brand-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                        <PushPin size={12} weight="fill" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Recent section — all non-pinned history items */}
            <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Recent</p>
            <div className="px-2 space-y-0.5 mb-4">
              {recentItems.length === 0 && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 px-3 py-2">No analyses yet.</p>
              )}
              {recentItems.map(r => (
                <div key={r.id} className="group relative">
                  <button onClick={() => { setConfirmDeleteId(null); loadText(r) }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors text-left pr-14">
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{r.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{r.score}% bias</p>
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                  </button>
                  {/* Pin + Delete action buttons — appear on row hover */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                    <button onClick={() => togglePin(r.id)} title="Pin" className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <PushPin size={11} weight="regular" />
                    </button>
                    {/* Trash icon — opens ConfirmModal before actually deleting */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id) }}
                      title="Delete"
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <Trash size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Upgrade box — "Go Pro" nudge with lightning icon */}
            <div className="mx-3 p-3 rounded-xl bg-white dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 shadow-sm dark:shadow-none mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightning size={12} weight="fill" className="text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-bold text-brand-700 dark:text-brand-300">Go Pro</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-brand-400 leading-relaxed mb-2">Unlimited analyses, exports, API access and history.</p>
              {/* Upgrade button — opens PricingModal */}
              <button onClick={openPricing} className="block w-full text-center text-[11px] font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-1.5 transition-colors">
                Upgrade →
              </button>
            </div>
          </>
        )}

        {/* ── COLLAPSED sidebar icon rail — each icon opens a flyout popup ── */}
        {!sidebarOpen && (
          <div className="px-1.5 space-y-0.5 mt-1">

            {/* Search icon — opens SearchPopup flyout */}
            <div className="relative">
              <button
                title="Search"
                onClick={() => toggle('search')}
                className={`w-full flex justify-center p-2.5 rounded-xl transition-colors ${activePopup === 'search' ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800'}`}
              >
                <MagnifyingGlass size={18} />
              </button>
              {activePopup === 'search' && (
                <SearchPopup
                  items={history}
                  onClose={() => setActivePopup(null)}
                  onNew={() => { navigate('/', { state: { newAnalysis: true } }); setActivePopup(null) }}
                  onSelect={loadText}
                />
              )}
            </div>

            {/* Pushpin icon — opens PinnedPopup flyout (fill when items exist) */}
            <div className="relative">
              <button
                title="Pinned"
                onClick={() => toggle('pinned')}
                className={`w-full flex justify-center p-2.5 rounded-xl transition-colors ${activePopup === 'pinned' ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800'}`}
              >
                <PushPin size={18} weight={pinnedItems.length > 0 ? 'fill' : 'regular'} />
              </button>
              {activePopup === 'pinned' && (
                <PinnedPopup pinnedItems={pinnedItems} onClose={() => setActivePopup(null)} onSelect={loadText} />
              )}
            </div>

            {/* Clock icon — opens RecentPopup flyout */}
            <div className="relative">
              <button
                title="Recent"
                onClick={() => toggle('recent')}
                className={`w-full flex justify-center p-2.5 rounded-xl transition-colors ${activePopup === 'recent' ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800'}`}
              >
                <ClockCounterClockwise size={18} />
              </button>
              {activePopup === 'recent' && (
                <RecentPopup items={history} onClose={() => setActivePopup(null)} onSelect={loadText} />
              )}
            </div>

            {/* Lightning icon — opens PricingModal upgrade popup */}
            <button
              title="Upgrade"
              onClick={openPricing}
              className="w-full flex justify-center p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              <Lightning size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── FOOTER — dark mode, settings, help, sign out ─────────────────── */}
      <div className={`border-t border-gray-200 dark:border-gray-800 flex-shrink-0 ${sidebarOpen ? 'px-2 py-2 space-y-0.5' : 'px-1.5 py-2 space-y-0.5'}`}>
        {/* Dark mode toggle — Sun in dark mode, Moon in light mode */}
        <button
          onClick={() => setDark(d => !d)}
          title={dark ? 'Light mode' : 'Dark mode'}
          className={`flex items-center gap-2.5 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors text-xs font-medium ${sidebarOpen ? 'w-full px-3 py-2' : 'w-full justify-center p-2.5'}`}
        >
          {dark ? <Sun size={16} weight="fill" className="flex-shrink-0 text-accent-400" /> : <Moon size={16} weight="fill" className="flex-shrink-0" />}
          {sidebarOpen && (dark ? 'Light mode' : 'Dark mode')}
        </button>

        {/* Settings, Help, Sign out — inline labels when expanded, icons when collapsed */}
        {sidebarOpen ? (
          <>
            {/* Settings — navigate to /settings page */}
            <button onClick={() => go('/settings')} className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors text-xs font-medium">
              <Gear size={16} className="flex-shrink-0" />Settings
            </button>
            {/* Help — navigate to /about page */}
            <button onClick={() => go('/about')} className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors text-xs font-medium">
              <Question size={16} className="flex-shrink-0" />Help
            </button>
            {/* Sign out — rose-colored destructive action */}
            <button onClick={() => { logout(); navigate('/') }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-xs font-medium">
              <SignOut size={16} className="flex-shrink-0" />
              Sign out
            </button>
          </>
        ) : (
          <>
            {/* Gear icon — settings */}
            <button title="Settings" onClick={() => go('/settings')} className="w-full flex justify-center p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 transition-colors">
              <Gear size={16} />
            </button>
            {/* Question mark icon — help / about */}
            <button title="Help" onClick={() => go('/about')} className="w-full flex justify-center p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 transition-colors">
              <Question size={16} />
            </button>

            {/* User avatar button — opens UserPopup flyout */}
            <div className="relative w-full flex justify-center pt-1 pb-0.5">
              <button
                onClick={() => toggle('user')}
                title={user?.name}
                className={`w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center transition-all ${activePopup === 'user' ? 'ring-2 ring-brand-400' : 'hover:ring-2 hover:ring-brand-300'}`}
              >
                <span className="text-xs font-bold text-white">{user?.name?.charAt(0).toUpperCase()}</span>
              </button>
              {activePopup === 'user' && (
                <UserPopup user={user} logout={logout} onClose={() => setActivePopup(null)} onNavigate={go} onHelp={() => go('/about')} />
              )}
            </div>
          </>
        )}
      </div>
    </aside>

    {/* ── ConfirmModal — shown when trash icon is clicked on a history item ── */}
    {itemToDelete && (
      <ConfirmModal
        title="Delete analysis?"
        description={`This will delete "${itemToDelete.label}".`}
        onConfirm={() => { deleteHistory(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    )}

</>
  )
}
