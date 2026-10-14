import * as React from "react";
import {
  Bell,
  Droplets,
  FlaskConical,
  Pipette,
  Wrench,
  Replace,
  Lock,
  CalendarClock,
  Repeat,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import {
  getActiveTank,
  listReminders,
  listTanks,
  getSessionEntitlements,
} from "@/lib/data";
import {
  canUse,
  type Reminder,
  type Tank,
} from "@reef/shared";
import {
  Card,
  SectionLabel,
  Badge,
  LinkButton,
  EmptyState,
  DisclaimerBanner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { NewReminderForm, ReminderActions } from "./reminder-pieces";

export const metadata = {
  title: "Reminders · Reef Doctor",
  description:
    "Stay on top of water changes, testing, dosing and maintenance with reef care reminders and routine checklists.",
};

/* ─────────────────────────── Reminder kinds ─────────────────────────── */

const KIND_META: Record<
  string,
  { label: string; icon: LucideIcon; tone: "healthy" | "caution" | "danger" | "brand" | "neutral" }
> = {
  "water-change": { label: "Water change", icon: Droplets, tone: "brand" },
  test: { label: "Test", icon: FlaskConical, tone: "healthy" },
  dose: { label: "Dose", icon: Pipette, tone: "caution" },
  maintenance: { label: "Maintenance", icon: Wrench, tone: "neutral" },
  "media-swap": { label: "Media swap", icon: Replace, tone: "neutral" },
};

const RECURRENCE_LABEL: Record<string, string> = {
  none: "One-time",
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

function kindMeta(kind: string) {
  return (
    KIND_META[kind] ?? {
      label: kind,
      icon: Bell,
      tone: "neutral" as const,
    }
  );
}

/* ─────────────────────────── Date grouping ─────────────────────────── */

type Bucket = "overdue" | "week" | "later";

const START_OF_DAY = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function bucketFor(dueIso: string, now: Date): Bucket {
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return "later";
  if (due.getTime() < now.getTime()) return "overdue";
  const weekFromNow = START_OF_DAY(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  return due.getTime() <= weekFromNow.getTime() ? "week" : "later";
}

function formatDue(dueIso: string, now: Date): string {
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return dueIso;
  const dateLabel = due.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = due.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const days = Math.round(
    (START_OF_DAY(due).getTime() - START_OF_DAY(now).getTime()) / 86_400_000,
  );
  let relative = "";
  if (days === 0) relative = "Today";
  else if (days === 1) relative = "Tomorrow";
  else if (days === -1) relative = "Yesterday";
  else if (days < 0) relative = `${Math.abs(days)} days ago`;
  else relative = `In ${days} days`;
  return `${relative} · ${dateLabel}, ${timeLabel}`;
}

/* ─────────────────────────── Routine checklist data ─────────────────────────── */

const WEEKLY_TASKS: string[] = [
  "Test alkalinity, calcium and magnesium — log the numbers",
  "Top off evaporation and check salinity",
  "20% water change with fresh, matched-temperature saltwater",
  "Clean the skimmer cup and protein skimmer neck",
  "Glass / acrylic wipe and inspect for nuisance algae",
  "Scan livestock for behavior changes, spots or recession",
];

const MONTHLY_TASKS: string[] = [
  "Full parameter panel (Nitrate, Phosphate, pH trend)",
  "Rinse or swap filter socks / floss and clean media reactors",
  "Calibrate probes (pH, salinity) and refractometer",
  "Clean pumps, powerheads and return — clear impellers",
  "Blow detritus off rockwork during a water change",
  "Inspect heaters, controllers and ATO float switches",
];

/* ─────────────────────────── Page ─────────────────────────── */

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const [entitlements, tanks, activeTank] = await Promise.all([
    getSessionEntitlements(),
    listTanks(),
    getActiveTank(tankParam),
  ]);

  const allowed = canUse(entitlements, "reminders");

  return (
    <div className="space-y-8">
      <PageHeader />

      {!allowed ? (
        <UpgradePrompt />
      ) : (
        <RemindersBody tanks={tanks} activeTank={activeTank} />
      )}

      <RoutineChecklists />

      <ScopedMotion />
    </div>
  );
}

/* ─────────────────────────── Header ─────────────────────────── */

function PageHeader() {
  return (
    <header className="space-y-2">
      <SectionLabel>Care schedule</SectionLabel>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
          Reminders
        </h1>
        <Badge tone="brand">
          <Bell className="h-3.5 w-3.5" /> Reef Keeper feature
        </Badge>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
        Reefs reward consistency. Schedule water changes, tests, dosing and
        maintenance so nothing slips — stability is what keeps coral and fish
        thriving.
      </p>
    </header>
  );
}

/* ─────────────────────────── Upgrade prompt (free tier) ─────────────────────────── */

function UpgradePrompt() {
  return (
    <Card className="reef-reveal border-lagoon-400/25 bg-gradient-to-br from-lagoon-500/[0.08] to-transparent">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-lagoon-500/15 text-lagoon-200 ring-1 ring-inset ring-lagoon-400/30"
          aria-hidden
        >
          <Lock className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-xl font-semibold text-abyss-50">
            Reminders are a Reef Keeper feature
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-abyss-200/75">
            Upgrade to <span className="font-medium text-abyss-100">Reef Keeper</span>{" "}
            to schedule recurring water changes, tests, dosing and maintenance
            with due-date tracking. You can still use the routine checklists
            below on any plan.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <LinkButton href="/account">Upgrade to Reef Keeper</LinkButton>
            <LinkButton href="/account" variant="secondary">
              Compare plans
            </LinkButton>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────── Reminders list + form ─────────────────────────── */

function RemindersBody({
  tanks,
  activeTank,
}: {
  tanks: Tank[];
  activeTank: Tank | null;
}) {
  if (tanks.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No tank yet"
        description="Create a tank first — reminders are scheduled per system so you can track care for each one."
        action={<LinkButton href="/tanks">Add a tank</LinkButton>}
      />
    );
  }

  return (
    <RemindersList tanks={tanks} activeTank={activeTank} />
  );
}

async function RemindersList({
  tanks,
  activeTank,
}: {
  tanks: Tank[];
  activeTank: Tank | null;
}) {
  const reminders = await listReminders();
  const now = new Date();
  const tankName = new Map(tanks.map((t) => [t.id, t.name]));

  const groups: Record<Bucket, Reminder[]> = {
    overdue: [],
    week: [],
    later: [],
  };
  for (const r of reminders) groups[bucketFor(r.due_at, now)].push(r);

  const sections: { bucket: Bucket; label: string; hint: string }[] = [
    { bucket: "overdue", label: "Overdue", hint: "Past due — do these first" },
    { bucket: "week", label: "This week", hint: "Due within 7 days" },
    { bucket: "later", label: "Later", hint: "Coming up" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="upcoming-heading" className="space-y-6">
        <h2 id="upcoming-heading" className="sr-only">
          Upcoming reminders
        </h2>

        {reminders.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No reminders scheduled"
            description="Add your first reminder to start tracking recurring reef care. Use the routine checklists below for ideas."
          />
        ) : (
          sections.map(({ bucket, label, hint }) => {
            const items = groups[bucket];
            if (items.length === 0) return null;
            return (
              <div key={bucket}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <SectionLabel>
                    {label}
                    {bucket === "overdue" && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-coral-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-coral-200 ring-1 ring-inset ring-coral-400/30">
                        {items.length}
                      </span>
                    )}
                  </SectionLabel>
                  <span className="text-xs text-abyss-200/50">{hint}</span>
                </div>
                <ul className="space-y-3">
                  {items.map((r, i) => (
                    <li
                      key={r.id}
                      className="reef-reveal"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <ReminderRow
                        reminder={r}
                        tankName={tankName.get(r.tank_id)}
                        overdue={bucket === "overdue"}
                        now={now}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <aside aria-label="Schedule a reminder">
        <NewReminderForm
          tanks={tanks.map((t) => ({ id: t.id, name: t.name }))}
          defaultTankId={activeTank?.id}
        />
      </aside>
    </div>
  );
}

function ReminderRow({
  reminder,
  tankName,
  overdue,
  now,
}: {
  reminder: Reminder;
  tankName: string | undefined;
  overdue: boolean;
  now: Date;
}) {
  const meta = kindMeta(reminder.kind);
  const Icon = meta.icon;
  const recurring =
    reminder.recurrence && reminder.recurrence !== "none";

  return (
    <Card
      className={cn(
        "!p-4 transition duration-200 hover:border-lagoon-400/25 hover:bg-white/[0.06]",
        overdue && "border-coral-400/25 bg-coral-500/[0.05]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
            overdue
              ? "bg-coral-500/15 text-coral-200 ring-coral-400/30"
              : "bg-white/5 text-lagoon-300 ring-white/10",
          )}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-abyss-50">{reminder.title}</h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>

          <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-abyss-200/70">
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Due</dt>
              <CalendarClock
                className={cn(
                  "h-3.5 w-3.5",
                  overdue ? "text-coral-300" : "text-lagoon-300/80",
                )}
                aria-hidden
              />
              <dd className={overdue ? "text-coral-200" : undefined}>
                {formatDue(reminder.due_at, now)}
              </dd>
            </div>
            {recurring && (
              <div className="inline-flex items-center gap-1.5">
                <dt className="sr-only">Recurrence</dt>
                <Repeat className="h-3.5 w-3.5 text-lagoon-300/80" aria-hidden />
                <dd>
                  {RECURRENCE_LABEL[reminder.recurrence] ?? reminder.recurrence}
                </dd>
              </div>
            )}
            {tankName && (
              <div className="inline-flex items-center gap-1.5">
                <dt className="sr-only">Tank</dt>
                <Droplets
                  className="h-3.5 w-3.5 text-lagoon-300/80"
                  aria-hidden
                />
                <dd>{tankName}</dd>
              </div>
            )}
          </dl>

          <ReminderActions
            id={reminder.id}
            title={reminder.title}
            className="mt-3"
          />
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────── Routine checklists ─────────────────────────── */

function RoutineChecklists() {
  return (
    <section aria-labelledby="checklists-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-lagoon-300" aria-hidden />
        <h2
          id="checklists-heading"
          className="font-display text-xl font-semibold text-abyss-50"
        >
          Routine checklists
        </h2>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/70">
        A solid baseline for a healthy reef. Adjust the cadence to your system —
        heavily-stocked or SPS-dominant tanks often want more frequent testing.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <ChecklistCard
          title="Weekly"
          icon={Repeat}
          tasks={WEEKLY_TASKS}
          accent="lagoon"
        />
        <ChecklistCard
          title="Monthly"
          icon={CalendarClock}
          tasks={MONTHLY_TASKS}
          accent="coral"
        />
      </div>

      <DisclaimerBanner text="These checklists are general reef-keeping guidance, not a substitute for observing your own system. Change parameters slowly and consult an aquatic vet or experienced reefer for livestock health concerns." />
    </section>
  );
}

function ChecklistCard({
  title,
  icon: Icon,
  tasks,
  accent,
}: {
  title: string;
  icon: LucideIcon;
  tasks: string[];
  accent: "lagoon" | "coral";
}) {
  const headingId = `checklist-${title.toLowerCase()}`;
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset",
            accent === "lagoon"
              ? "bg-lagoon-500/15 text-lagoon-200 ring-lagoon-400/30"
              : "bg-coral-500/15 text-coral-200 ring-coral-400/30",
          )}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h3
          id={headingId}
          className="font-display text-lg font-semibold text-abyss-50"
        >
          {title}
        </h3>
      </div>
      <ul aria-labelledby={headingId} className="space-y-2.5">
        {tasks.map((task) => (
          <li key={task} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                accent === "lagoon" ? "bg-lagoon-400" : "bg-coral-400",
              )}
              aria-hidden
            />
            <span className="leading-relaxed text-abyss-100/85">{task}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─────────────────────────── Scoped entrance motion ─────────────────────────── */

function ScopedMotion() {
  return (
    <style>{`
      .reef-reveal {
        opacity: 0;
        animation: reefReveal 0.5s ease-out forwards;
      }
      @keyframes reefReveal {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .reef-reveal { animation: none; opacity: 1; }
      }
    `}</style>
  );
}
