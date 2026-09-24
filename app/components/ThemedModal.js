"use client";

import styles from "./ThemedModal.module.css";

export default function ThemedModal({
  open,
  title,
  children,
  message,
  tone = "default",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isBusy = false,
  error = "",
  showCancel = false,
}) {
  if (!open) return null;

  const titleId = "themed-modal-title";
  const canCancel = showCancel && !isBusy;

  return (
    <div className={styles.overlay} role="presentation" onClick={canCancel ? onCancel : undefined}>
      <div
        className={`${styles.modal} ${tone === "danger" ? styles.danger : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.hero}>
          <span className={styles.kicker}>{tone === "danger" ? "Confirm action" : "Rogue Rank"}</span>
          <h2 id={titleId} className={styles.title}>{title}</h2>
        </div>

        <div className={styles.body}>
          {children || (message ? <p className={styles.message}>{message}</p> : null)}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.actions}>
          {showCancel ? (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onCancel}
              disabled={isBusy}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.confirmBtn} ${tone === "danger" ? styles.dangerBtn : ""}`}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
