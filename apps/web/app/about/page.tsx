import { Compass, HeartHandshake, Microscope, ShieldCheck } from "lucide-react";
import {
  SectionLabel,
  DisclaimerBanner,
  LinkButton,
  SourceList,
} from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { MarketingNav, MarketingFooter } from "@/components/marketing-chrome";

export const metadata = {
  title: "About",
  description:
    "Reef Doctor is a careful, grounded AI companion for saltwater reefkeepers — built to inform, never to replace a qualified aquatic veterinarian.",
};

const VALUES = [
  {
    icon: Microscope,
    title: "Grounded, not guessed",
    body: "Answers retrieve from a curated, citeable marine-science corpus — disease guides, parameter ranges, treatment protocols and species care — so guidance is anchored to real reference material.",
  },
  {
    icon: ShieldCheck,
    title: "Honest about uncertainty",
    body: "Every health read carries an explicit confidence score and urgency level. When confidence is low, we say so — and tell you to gather more evidence before acting.",
  },
  {
    icon: HeartHandshake,
    title: "On the animal's side",
    body: "Living creatures depend on the outcome. We design for caution: deterministic dosing math with safe clamps, dose warnings, and a standing reminder to consult a professional.",
  },
  {
    icon: Compass,
    title: "Made for the long haul",
    body: "Reefs reward patience. Parameter history, trend charts and a maintenance rhythm help you build the steady habits a healthy system depends on.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="relative">
      <MarketingNav />

      <main id="main">
        {/* Story */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-lagoon-500/15 blur-[120px]" />
            <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-coral-500/10 blur-[120px]" />
          </div>

          <div className="mx-auto max-w-3xl px-5 pb-12 pt-20 sm:px-8 sm:pt-24">
            <Reveal>
              <SectionLabel>Our story</SectionLabel>
              <h1 className="text-balance font-display text-5xl font-semibold leading-[1.06] tracking-tight text-abyss-50 sm:text-6xl">
                A second opinion for your reef, any hour
              </h1>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-8 space-y-5 text-lg leading-relaxed text-abyss-100/80">
                <p>
                  A reef tank is a small, living ocean — beautiful, intricate,
                  and unforgiving of guesswork. When a fish starts flashing or a
                  coral pales overnight, the questions come fast and the good
                  answers are scattered across forums, old threads and conflicting
                  advice.
                </p>
                <p>
                  Reef Doctor was built to be the calm, well-read voice in those
                  moments. It reads your tank&rsquo;s parameters and history, looks at
                  your photos, and reasons through the likely causes — grounded in
                  a curated body of marine-science knowledge, and always honest
                  about how confident it is.
                </p>
                <p>
                  It is not here to replace your judgment or your vet. It is here
                  to help you understand what you&rsquo;re seeing, to surface what to
                  check next, and to make the careful, patient husbandry that
                  keeps reefs thriving a little more accessible to everyone.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Values */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <Reveal className="max-w-2xl">
              <SectionLabel>What we believe</SectionLabel>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-abyss-50 sm:text-5xl">
                Careful by design
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {VALUES.map((value, i) => {
                const Icon = value.icon;
                return (
                  <Reveal as="article" key={value.title} delay={(i % 2) * 80}>
                    <div className="reef-card h-full">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-200 ring-1 ring-inset ring-lagoon-400/25">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-4 font-display text-lg font-semibold text-abyss-50">
                        {value.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-abyss-100/70">
                        {value.body}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Medical / educational disclaimer */}
        <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
              The important part
            </h2>
            <p className="mt-4 text-base leading-relaxed text-abyss-100/75">
              Reef Doctor provides educational guidance generated by AI. It is a
              tool to help you learn and decide — not a licensed professional and
              not a guarantee. For valuable or declining livestock, always
              confirm a diagnosis and any treatment with a qualified aquatic
              veterinarian before acting.
            </p>
          </Reveal>

          <Reveal delay={80} className="mt-6">
            <DisclaimerBanner />
          </Reveal>

          <Reveal delay={140} className="mt-6">
            <SourceList
              sources={[
                {
                  title: "Curated reef-knowledge corpus",
                  ref: "reef-knowledge",
                },
                { title: "Parameter target ranges by tank type", ref: "params" },
                { title: "Treatment & dosing protocols", ref: "dosing" },
              ]}
            />
          </Reveal>

          <Reveal delay={200} className="mt-12">
            <div className="reef-card flex flex-col items-start gap-4 !rounded-3xl sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-abyss-50">
                  Ready to care for your reef with confidence?
                </h3>
                <p className="mt-1 text-sm text-abyss-100/70">
                  Start free — no card required.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <LinkButton href="/signup">Get started</LinkButton>
                <LinkButton href="/pricing" variant="secondary">
                  See pricing
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
