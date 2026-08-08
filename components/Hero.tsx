import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.heroInner}>
        <span className={styles.heroTag}>Welcome!</span>
        <h1 className={styles.heroTitle}>
          Nextly
          <br />
        </h1>
        <p className={styles.heroSub}>
          Stop deciding. Start doing.
        </p>
        <div className={styles.heroCtas}>
          <a href="#login" className={styles.btnPrimary}>
            Log In
          </a>
          <a href="#about" className={styles.btnGhost}>
            Learn More
          </a>
        </div>
      </div>
      <div className={styles.scrollHint}>Scroll to explore</div>
    </section>
  );
}
