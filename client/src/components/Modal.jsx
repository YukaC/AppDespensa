export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`modal-panel max-h-[92dvh] w-full overflow-auto rounded-t-2xl border border-slate-600/80 bg-slate-800/95 shadow-2xl shadow-black/50 sm:max-h-[90vh] sm:rounded-2xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="sheet-handle" aria-hidden />
        <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id="modal-title" className="pr-4 text-lg font-semibold text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0 text-lg"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
