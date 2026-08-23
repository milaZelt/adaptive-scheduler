import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.heroInner}>
        <span className={styles.heroTag} data-reveal="1">
          Welcome!
        </span>
        <h1 className={styles.heroTitle} data-reveal="2">
          Nextly
        </h1>
        <p className={styles.heroSub} data-reveal="3">
          Stop deciding. Start doing.
        </p>
        <div className={styles.heroCtas} data-reveal="4">
          <a href="#login" className={styles.btnPrimary}>
            Log In
          </a>
          <a href="#about" className={styles.btnGhost}>
            Learn More
          </a>
        </div>
      </div>
      <div className={styles.scrollHint} data-reveal="5">
        <span className={styles.scrollRule} aria-hidden="true" />
        Scroll to explore
      </div>
    </section>
  );
}
