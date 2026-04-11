import HeroSection from "./hero-section";
import StatsSection from "./stats-section";
import MissionSection from "./mission-section";
import ValuesSection from "./values-section";
import CultureSection from "./culture-section";
import CTASection from "./cta-section";

export default function AboutPage() {
  return (
    <main className="bg-[#f3f4f6] text-[#22324b]">
      <HeroSection />
      <StatsSection />
      <MissionSection />
      <ValuesSection />
      <CultureSection />
      <CTASection />
    </main>
  );
}
