import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { SectionLabel, DisclaimerBanner } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { MarketingNav, MarketingFooter } from "@/components/marketing-chrome";
import { PricingCards } from "./pricing-cards";

export const metadata = {
  title: "Pricing",
  description:
    "Simple plans for every reefer — start free, upgrade for unlimited AI chat, photo diagnosis, dosing tools and weekly reports. 7-day free trial on paid plans.",
};

const FAQ = [
  {
    q: "Is there really a free plan?",
    a: "Yes. The Tide Pool tier is free forever — one tank, parameter logging and charts, the cycle tracker, species encyclopedia, plus a few AI Doctor chats each month and a trial photo diagnosis. No card required.",
  },
  {
    q: "What happens after the 7-day trial?",
    a: "Paid plans (Reef Keeper and Reef Master) start with a 7-day free trial. You won't be charged until the trial ends, and you can cancel any time from the billing portal.",
  },
  {
    q: "Can I switch plans later?",
    a: "Absolutely. Upgrade, downgrade, or cancel whenever you like — changes take effect through your secure billing portal and your entitlements update automatically.",
  },
  {
    q: "Are dosing calculations safe?",
    a: "Dosing math runs deterministically with safe clamps — it never comes free-text from the AI. Even so, every dose ships with a warning to verify against your product before adding anything.",
  },
] as const;

export default function PricingPage() {
  return (
    <div className="relative">
      <MarketingNav />

      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-lagoon-500/12 blur-[130px]" />
          </div>

          <div className="mx-auto max-w-6xl px-5 pb-12 pt-20 sm:px-8 sm:pt-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <SectionLabel>Pricing</SectionLabel>
              <h1 className="font-display text-5xl font-semibold tracking-tight text-abyss-50 sm:text-6xl">
                Plans that grow with your reef
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-abyss-100/75">
                Start free and stay free for the essentials. Upgrade when you
                want unlimited diagnosis, dosing tools, reminders and reports.
              </p>
            </Reveal>

            <Reveal delay={120} className="mt-14">
              <PricingCards />
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
              Questions, answered
            </h2>
          </Reveal>

          {/* a11y: each <dl> child is a single <div> directly wrapping its
              <dt>/<dd> pair, keeping the definition list well-formed. */}
          <dl className="mt-12 space-y-4">
            {FAQ.map((item, i) => (
              <Reveal as="div" key={item.q} delay={i * 60} className="reef-card">
                <dt className="flex items-start gap-2.5 font-display text-lg font-semibold text-abyss-50">
                  <HelpCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-lagoon-300"
                    aria-hidden
                  />
                  {item.q}
                </dt>
                <dd className="mt-2 pl-7 text-sm leading-relaxed text-abyss-100/75">
                  {item.a}
                </dd>
              </Reveal>
            ))}
          </dl>

          <Reveal className="mt-10">
            <DisclaimerBanner />
          </Reveal>

          <Reveal className="mt-8 text-center">
            <p className="text-sm text-abyss-200/65">
              Ready to dive in?{" "}
              <Link
                href="/signup"
                className="font-semibold text-lagoon-200 underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                Create your free account
              </Link>
              .
            </p>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
