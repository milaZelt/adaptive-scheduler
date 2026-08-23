import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import LoginSection from "@/components/marketing/LoginSection";
import AboutSection from "@/components/marketing/AboutSection";
import FaqSection from "@/components/marketing/FaqSection";
import PageBackdrop from "@/components/marketing/PageBackdrop";
import ScrollReveal from "@/components/marketing/ScrollReveal";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <PageBackdrop />
      <ScrollReveal />
      <div className={styles.content}>
        <Navbar />
        <Hero />
        <LoginSection />
        <AboutSection />
        <FaqSection />
        <footer className={styles.footer}>
          <span>Nextly</span>
          <span>Stop deciding. Start doing.</span>
        </footer>
      </div>
    </div>
  );
}
