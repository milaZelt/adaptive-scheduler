import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <nav className={styles.nav}>
      <a href="#top" className={styles.navLogo}>
        Nextly
      </a>
      <div className={styles.navRight}>
        <ul className={styles.navLinks}>
          <li>
            <a href="#about">About</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
        </ul>
        <a href="#login" className={styles.navLogin}>
          Log In
        </a>
      </div>
    </nav>
  );
}
