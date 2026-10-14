import {
  MessageCircle,
  Camera,
  FlaskConical,
  Beaker,
  Bell,
  FileText,
  ShieldCheck,
  Sparkles,
  BookOpenCheck,
  Quote,
  ArrowRight,
  Fish,
  Waves,
} from "lucide-react";
import { LinkButton, SectionLabel, Badge, DisclaimerBanner } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { MarketingNav, MarketingFooter } from "@/components/marketing-chrome";

export const metadata = {
  title: "AI Reef Doctor — your AI vet for reef & saltwater tanks",
  description:
    "Diagnose fish disease, coral health, algae & water-chemistry problems from chat and photos. Track parameters, calculate dosing, and get treatment plans — grounded, careful, reef-expert AI.",
};

/* ─────────────────────────── Feature catalog  ─────────────────────────── */
const FEATURES = [
  {
    icon: MessageCircle,
    title: "AI Reef Doctor chat",
    body: "Ask anything — disease, chemistry, compatibility, husbandry. Answers are grounded in a curated marine-science corpus and aware of your tank's context.",
  },
  {
    icon: Camera,
    title: "Photo diagnosis",
    body: "Snap a fish, coral, or algae outbreak. Vision AI returns a ranked, confidence-scored list of likely conditions with evidence and next steps.",
  },
  {
    icon: FlaskConical,
    title: "Parameter intelligence",
    body: "Log salinity, alkalinity, calcium, nitrate and more. See trends, drift, and target-range status classified for your exact tank type.",
  },
  {
    icon: Beaker,
    title: "Dosing & treatment",
    body: "Deterministic 2-part, magnesium, kalkwasser and copper calculators with safe clamps — plus step-by-step treatment protocols.",
  },
  {
    icon: Bell,
    title: "Maintenance & reminders",
    body: "Recurring water changes, testing, dosing and feeding reminders so nothing slips. Build a maintenance rhythm your reef can rely on.",
  },
  {
    icon: FileText,
    title: "Weekly health reports",
    body: "An AI summary of your tank's week — what changed, what to watch, and what to do next, in plain language you can act on.",
  },
] as const;

/* ─────────────────────────── How it works ─────────────────────────── */
const STEPS = [
  {
    n: "01",
    title: "Set up your tank",
    body: "Tell us your system — FOWLR, soft, LPS, SPS, mixed or nano — its volume and what lives in it. That context sharpens every answer.",
  },
  {
    n: "02",
    title: "Log, test, or snap a photo",
    body: "Record parameters, describe a symptom, or upload an image. The Doctor reads your data and the situation together.",
  },
  {
    n: "03",
    title: "Get grounded guidance",
    body: "Receive a careful, confidence-scored read with cited sources and a clear plan — then track it over time as your reef recovers.",
  },
] as const;

/* ─────────────────────────── Trust strip metrics ─────────────────────────── */
const TRUST = [
  { label: "Parameters tracked", value: "11+" },
  { label: "Tank types modeled", value: "6" },
  { label: "Cited knowledge base", value: "Curated" },
  { label: "Disclaimer on every read", value: "Always" },
] as const;

/* ─────────────────────────── AI-safety pillars ─────────────────────────── */
const SAFETY = [
  {
    icon: BookOpenCheck,
    title: "Educational, not a replacement",
    body: "Guidance is designed to inform — never to replace a qualified aquatic veterinarian for valuable or declining livestock.",
  },
  {
    icon: Sparkles,
    title: "Confidence on every read",
    body: "Diagnoses carry an explicit confidence score and urgency. Low-confidence results tell you to gather more evidence first.",
  },
  {
    icon: ShieldCheck,
    title: "Grounded in real sources",
    body: "Answers retrieve from a curated, citeable reef-knowledge corpus — so you can see where the guidance comes from.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative">
      <MarketingNav />

      <main id="main">
        {/* ───────────────────────── Hero ───────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Ambient atmosphere */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-lagoon-500/20 blur-[120px]" />
            <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-coral-500/10 blur-[120px]" />
            <div className="absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-abyss-400/10 blur-[120px]" />
          </div>

          <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28">
            <Reveal className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-lagoon-400/25 bg-lagoon-500/[0.08] px-3.5 py-1.5 text-xs font-medium text-lagoon-200">
                <Waves className="h-3.5 w-3.5" />
                Reef-expert AI, grounded in marine science
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mx-auto mt-7 max-w-4xl text-balance text-center font-display text-5xl font-semibold leading-[1.04] tracking-tight text-abyss-50 sm:text-6xl md:text-7xl">
                The AI veterinarian for your{" "}
                <span className="bg-gradient-to-r from-lagoon-300 via-lagoon-200 to-coral-300 bg-clip-text text-transparent">
                  reef tank
                </span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-center text-lg leading-relaxed text-abyss-100/80">
                Diagnose fish disease, coral health, algae and water-chemistry
                problems from chat and photos. Track parameters, calculate
                dosing, and get treatment plans — careful, confidence-scored,
                and cited.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <LinkButton href="/signup" className="!px-6 !py-3 text-base">
                  Start free <ArrowRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton
                  href="/pricing"
                  variant="secondary"
                  className="!px-6 !py-3 text-base"
                >
                  See pricing
                </LinkButton>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <p className="mt-4 text-center text-xs text-abyss-200/50">
                Free Tide Pool tier · no card required · 7-day trial on paid
                plans
              </p>
            </Reveal>

            {/* Hero visual: stylized "diagnosis" glass panel */}
            <Reveal delay={360}>
              <div className="relative mx-auto mt-16 max-w-3xl">
                <div
                  aria-hidden
                  className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-b from-lagoon-400/30 to-transparent opacity-60 blur-sm"
                />
                <div className="reef-card !rounded-3xl !p-0 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-5 py-3">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-lagoon-400 to-abyss-500">
                      <Fish className="h-4 w-4 text-abyss-950" strokeWidth={2.4} />
                    </span>
                    <span className="text-sm font-medium text-abyss-100/80">
                      Reef Doctor
                    </span>
                    <span className="ml-auto">
                      <Badge tone="caution">Monitor</Badge>
                    </span>
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/[0.04] px-4 py-3 text-sm text-abyss-100/90">
                      My yellow tang has small white spots and is scratching on
                      the rocks. Tank is FOWLR, 300 L.
                    </div>
                    <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm border border-lagoon-400/20 bg-lagoon-500/[0.08] px-4 py-3 text-sm leading-relaxed text-abyss-50">
                      Those signs are consistent with{" "}
                      <span className="font-semibold text-lagoon-200">
                        marine ich (Cryptocaryon)
                      </span>
                      . Confidence is moderate from text alone — a clear photo
                      would help. Start by raising observation frequency and
                      preparing a quarantine plan before treating.
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone="caution">Confidence · 68%</Badge>
                        <Badge tone="brand">Disease guide: Cryptocaryon</Badge>
                      </div>
                    </div>
                    <DisclaimerBanner />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Trust strip ───────────────────────── */}
        <section
          aria-label="At a glance"
          className="border-y border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {/* a11y: each <dl> child is a single <div> that directly wraps a
                  <dt>/<dd> pair, so the definition list stays well-formed. */}
              {TRUST.map((item, i) => (
                <Reveal
                  as="div"
                  key={item.label}
                  delay={i * 60}
                  className="text-center md:text-left"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-abyss-200/55">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-lagoon-200">
                    {item.value}
                  </dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* ───────────────────────── Features ───────────────────────── */}
        <section
          id="features"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8"
        >
          <Reveal className="max-w-2xl">
            <SectionLabel>Everything your reef needs</SectionLabel>
            <h2 className="font-display text-4xl font-semibold tracking-tight text-abyss-50 sm:text-5xl">
              A complete reef-care companion
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-abyss-100/75">
              From the first symptom to a thriving system — diagnosis, chemistry,
              dosing and routine, all in one calm, considered place.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal as="article" key={feature.title} delay={(i % 3) * 80}>
                  <div className="reef-card group h-full transition duration-300 hover:-translate-y-1 hover:border-lagoon-400/30 hover:shadow-glow">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-lagoon-500/20 to-abyss-500/20 text-lagoon-200 ring-1 ring-inset ring-lagoon-400/20 transition group-hover:from-lagoon-400/30">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 font-display text-xl font-semibold text-abyss-50">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-abyss-100/70">
                      {feature.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-8">
            <p className="text-sm text-abyss-200/60">
              Parameter logging, charts, the nitrogen-cycle tracker, the species
              encyclopedia and the compatibility checker are{" "}
              <span className="text-abyss-100/90">free on every plan</span>.
            </p>
          </Reveal>
        </section>

        {/* ───────────────────────── How it works ───────────────────────── */}
        <section
          id="how-it-works"
          className="relative scroll-mt-20 border-y border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
            <Reveal className="max-w-2xl">
              <SectionLabel>How it works</SectionLabel>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-abyss-50 sm:text-5xl">
                From symptom to plan in three steps
              </h2>
            </Reveal>

            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal as="li" key={step.n} delay={i * 100}>
                  <div className="reef-card relative h-full">
                    <span className="font-display text-5xl font-semibold text-lagoon-400/30">
                      {step.n}
                    </span>
                    <h3 className="mt-4 font-display text-xl font-semibold text-abyss-50">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-abyss-100/70">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────────────────────── AI safety band ───────────────────────── */}
        <section
          id="safety"
          className="relative scroll-mt-20 overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute left-1/2 top-1/2 h-72 w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lagoon-500/10 blur-[140px]" />
          </div>

          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-lagoon-400/25 bg-lagoon-500/[0.08] px-3.5 py-1.5 text-xs font-medium text-lagoon-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Built to be trusted
              </span>
              <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight text-abyss-50 sm:text-5xl">
                Careful AI you can rely on
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-abyss-100/75">
                Living creatures depend on the answers. So every health surface
                is honest about uncertainty, shows its sources, and tells you
                when to call a professional.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {SAFETY.map((pillar, i) => {
                const Icon = pillar.icon;
                return (
                  <Reveal as="article" key={pillar.title} delay={i * 90}>
                    <div className="reef-card h-full">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-200 ring-1 ring-inset ring-lagoon-400/25">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-4 font-display text-lg font-semibold text-abyss-50">
                        {pillar.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-abyss-100/70">
                        {pillar.body}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="mx-auto mt-10 max-w-3xl">
              <DisclaimerBanner />
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Pull quote ───────────────────────── */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
            <Reveal>
              <Quote className="mx-auto h-8 w-8 text-lagoon-400/50" />
              <blockquote className="mt-6 text-balance font-display text-2xl font-medium leading-snug text-abyss-50 sm:text-3xl">
                “A reef rewards patience and good information. Reef Doctor gives
                you both — a steady, well-read second opinion, any hour of the
                day.”
              </blockquote>
              <p className="mt-6 text-sm text-abyss-200/60">
                The Reef Doctor philosophy
              </p>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Final CTA ───────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <div className="reef-card relative overflow-hidden !rounded-3xl !p-10 text-center sm:!p-16">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
              >
                <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-coral-500/15 blur-[100px]" />
                <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-lagoon-500/20 blur-[100px]" />
              </div>
              <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight text-abyss-50 sm:text-5xl">
                Give your reef an expert on call
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-abyss-100/75">
                Start free in minutes. Upgrade when you&rsquo;re ready for unlimited
                chat, photo diagnosis, dosing tools and weekly reports.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <LinkButton href="/signup" className="!px-6 !py-3 text-base">
                  Start free <ArrowRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton
                  href="/pricing"
                  variant="secondary"
                  className="!px-6 !py-3 text-base"
                >
                  Compare plans
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
