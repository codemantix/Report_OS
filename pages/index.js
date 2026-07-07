import Head from 'next/head';
import LandingNavbar from '../components/landing/LandingNavbar';
import LandingHero from '../components/landing/LandingHero';
import LandingDashboardPreview from '../components/landing/LandingDashboardPreview';
import LandingExecutionChain from '../components/landing/LandingExecutionChain';
import LandingWorkflow from '../components/landing/LandingWorkflow';
import LandingAIReview from '../components/landing/LandingAIReview';
import LandingRoles from '../components/landing/LandingRoles';
import LandingBenefits from '../components/landing/LandingBenefits';
import LandingCTA from '../components/landing/LandingCTA';
import '../components/landing/LandingNavbar'; // trigger stylesheet compile
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="bg-surface font-sans antialiased text-surface-dark dark:bg-dark-bg dark:text-dark-text">
      <Head>
        <title>Codemantix Report OS | Reporting &amp; Progress Intelligence</title>
        <meta
          name="description"
          content="Codemantix Report OS helps teams submit structured reports, connect work to tasks and goals, and use AI to understand progress, blockers, and next actions."
        />
        <meta property="og:title" content="Codemantix Report OS | Reporting &amp; Progress Intelligence" />
        <meta
          property="og:description"
          content="Codemantix Report OS helps teams submit structured reports, connect work to tasks and goals, and use AI to understand progress, blockers, and next actions."
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Codemantix Report OS | Reporting &amp; Progress Intelligence" />
        <meta
          name="twitter:description"
          content="Codemantix Report OS helps teams submit structured reports, connect work to tasks and goals, and use AI to understand progress, blockers, and next actions."
        />
      </Head>

      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingDashboardPreview />
        <LandingExecutionChain />
        <LandingWorkflow />
        <LandingAIReview />
        <LandingRoles />
        <LandingBenefits />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
