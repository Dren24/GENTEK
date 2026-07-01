// ── ConfirmModal — generic delete confirmation dialog ─────────────────────────
// Centered overlay with backdrop blur. Used in two places:
//   • HomePage editor — "Delete analysis?" when user clicks the Delete button
//   • AppSidebar recent list — "Delete analysis?" on the trash icon per item
// Clicking the backdrop calls onCancel (same as the Cancel button).

export default function ConfirmModal({ title, description, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      {/* ── Backdrop — click to cancel ──────────────────────────────────── */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* ── Dialog card ─────────────────────────────────────────────────── */}
      <div className="relative bg-white dark:bg-[#2d2d2d] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        {/* Title */}
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h2>

        {/* Description — what will be deleted */}
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">{description}</p>

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>

          {/* Confirm delete button — rose/red to signal destructive action */}
          <button
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-full transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
