import { Fish } from "lucide-react";
import { getActiveTank } from "@/lib/data";
import { SectionLabel, DisclaimerBanner, Badge } from "@/components/ui";
import { DoctorChat } from "./doctor-chat";

/**
 * Reef Doctor chat . Server Component: resolve the active tank, then
 * hand a polished streaming chat surface to the client. A persistent disclaimer
 * and a context chip keep the trust signals (/) visible at all times.
 */
export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const tank = await getActiveTank(tankParam);

  return (
    <section className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-6rem)]">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>Reef Doctor</SectionLabel>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-abyss-50 sm:text-3xl">
              Ask the Doctor
            </h1>
          </div>
          {tank ? (
            <Badge tone="brand" className="gap-1.5">
              <Fish className="h-3.5 w-3.5" aria-hidden />
              Advising on: {tank.name}
            </Badge>
          ) : (
            <Badge tone="neutral">No tank selected</Badge>
          )}
        </div>
        <DisclaimerBanner />
      </header>

      <DoctorChat tankId={tank?.id} activeTankName={tank?.name ?? null} />
    </section>
  );
}
