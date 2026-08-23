import styles from "./PageBackdrop.module.css";

export default function PageBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.blobPink} />
      <div className={styles.blobAmber} />
      <div className={styles.blobWhite} />
      <div className={styles.cool} data-cool-layer="" />
    </div>
  );
}
