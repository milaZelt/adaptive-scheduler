import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import LoginSection from "@/components/marketing/LoginSection";
import AboutSection from "@/components/marketing/AboutSection";
import FaqSection from "@/components/marketing/FaqSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <LoginSection />
      <AboutSection />
      <FaqSection />
    </>
  );
}
