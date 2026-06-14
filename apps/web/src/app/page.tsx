"use client";

import { useGroups, useSplits } from "@/lib/hooks";
import { PageShell, Card, LinkButton, EmptyState, LoadingSpinner } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { splits, loaded: splitsLoaded } = useSplits();
  const { groups, loaded: groupsLoaded } = useGroups();

  if (!splitsLoaded || !groupsLoaded) return <LoadingSpinner />;

  return (
    <PageShell title="Receipt Splitter" subtitle="Split bills, assign items, roast your friends ( lovingly ).">
      <div className="mb-6">
        <LinkButton href="/splits/new" className="w-full">
          + New Split
        </LinkButton>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recent Splits</h2>
        </div>
        {splits.length === 0 ? (
          <EmptyState
            title="No splits yet"
            description="Create your first split after your next group dinner."
            action={<LinkButton href="/splits/new">Start a split</LinkButton>}
          />
        ) : (
          <div className="space-y-3">
            {splits.slice(0, 5).map((split) => {
              const total =
                split.lineItems.reduce((s, i) => s + i.priceCents * i.quantity, 0) +
                split.taxCents +
                split.tipCents;
              return (
                <Link key={split.id} href={`/splits/${split.id}`}>
                  <Card className="transition hover:border-primary/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{split.title}</h3>
                        <p className="text-sm text-muted">
                          {split.participants.length} people · {new Date(split.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-semibold text-primary">{formatCents(total)}</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Saved Groups</h2>
          <Link href="/groups" className="text-sm text-primary">
            Manage
          </Link>
        </div>
        {groups.length === 0 ? (
          <EmptyState
            title="No saved groups"
            description="Save your regular dining crew for quick splits."
            action={<LinkButton href="/groups" variant="secondary">Add a group</LinkButton>}
          />
        ) : (
          <div className="space-y-3">
            {groups.slice(0, 3).map((group) => (
              <Card key={group.id}>
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-sm text-muted">
                  {group.members.map((m) => m.name).join(", ")}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
