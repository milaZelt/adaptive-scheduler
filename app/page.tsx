import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import LoginSection from "@/components/LoginSection";
import AboutSection from "@/components/AboutSection";
import FaqSection from "@/components/FaqSection";

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
