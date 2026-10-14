import type { Metadata } from "next";
import { LegalPage, Section } from "../legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AI Reef Doctor collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 25, 2026">
      <p>
        This Privacy Policy explains how AI Reef Doctor (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, and shares information when you use our
        web and iOS apps (the &ldquo;Service&rdquo;). Questions:{" "}
        <strong>[contact@example.invalid]</strong>.
      </p>

      <Section heading="Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account:</strong> email, name, and authentication identifiers (incl. Sign in with Apple / Google).</li>
          <li><strong>Tank data you enter:</strong> tanks, livestock, water parameters, notes, reminders.</li>
          <li><strong>Photos:</strong> images you upload or capture for AI diagnosis.</li>
          <li><strong>Usage:</strong> feature usage counts (e.g. AI chats, photo diagnoses) to enforce plan limits.</li>
          <li><strong>Device:</strong> push-notification token (if you enable reminders); basic diagnostics.</li>
          <li><strong>Billing:</strong> handled by Stripe; we store your subscription tier/status, not card numbers.</li>
        </ul>
      </Section>

      <Section heading="How we use information">
        <p>
          To provide and improve the Service: run AI diagnosis and guidance,
          track parameters, send reminders/reports you request, manage your
          subscription and plan limits, and secure your account.
        </p>
      </Section>

      <Section heading="AI processing">
        <p>
          When you use chat or photo diagnosis, the relevant text and images are
          sent to our AI provider (Anthropic) to generate a response. Outputs are
          educational and not a substitute for a qualified aquatic veterinarian.
          We do not use your content to train third-party models, and our AI
          provider processes API data under its commercial terms.
        </p>
      </Section>

      <Section heading="Service providers we share with">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong> — authentication, database, and private photo storage.</li>
          <li><strong>Stripe</strong> — subscription billing.</li>
          <li><strong>Anthropic</strong> — AI processing of your chat/photo requests.</li>
          <li><strong>Resend</strong> — transactional email (if enabled).</li>
          <li><strong>Vercel</strong> — application hosting.</li>
        </ul>
        <p>We do not sell your personal information and we do not use third-party advertising or cross-app tracking.</p>
      </Section>

      <Section heading="Your photos">
        <p>
          Photos are stored in private, access-controlled storage and used only
          to fulfill the diagnosis you request. You can delete diagnoses and
          your account at any time.
        </p>
      </Section>

      <Section heading="Data retention &amp; account deletion">
        <p>
          We keep your data while your account is active. You can delete your
          account from <strong>Account &rarr; Delete account</strong> in the app
          (or by emailing us); this permanently removes your tanks, livestock,
          parameters, photos, diagnoses, and profile, subject to limited legal
          retention.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Depending on your location (e.g. GDPR/UK GDPR, CCPA/CPRA), you may have
          rights to access, correct, export, or delete your data, and to object
          to certain processing. Contact us to exercise these rights.
        </p>
      </Section>

      <Section heading="Children">
        <p>The Service is not directed to children under 13 (or the minimum age in your region) and we do not knowingly collect their data.</p>
      </Section>

      <Section heading="Security &amp; international transfers">
        <p>
          We use industry-standard safeguards (encryption in transit, row-level
          access controls). Data may be processed in the United States and other
          countries where our providers operate.
        </p>
      </Section>

      <Section heading="Changes &amp; contact">
        <p>
          We may update this policy and will revise the date above. Contact:{" "}
          <strong>[contact@example.invalid]</strong>, <strong>[Company legal name &amp; address]</strong>.
        </p>
      </Section>
    </LegalPage>
  );
}
