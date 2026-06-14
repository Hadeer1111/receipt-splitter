"use client";

import { useState } from "react";
import { useGroups } from "@/lib/hooks";
import type { StoredGroup } from "@/lib/types";
import { getInstapay } from "@/lib/types";
import { PageShell, Card, Button, Input, EmptyState, LoadingSpinner } from "@/components/ui";

interface MemberForm {
  name: string;
  instapay: string;
}

export default function GroupsPage() {
  const { groups, loaded, save, remove } = useGroups();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<MemberForm[]>([{ name: "", instapay: "" }]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (!loaded) return <LoadingSpinner />;

  function addMember() {
    setMembers([...members, { name: "", instapay: "" }]);
  }

  function updateMember(index: number, field: keyof MemberForm, value: string) {
    const next = [...members];
    next[index] = { ...next[index], [field]: value };
    setMembers(next);
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, i) => i !== index));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validMembers = members.filter((m) => m.name.trim());
    if (!name.trim() || validMembers.length === 0) {
      setError("Group name and at least one member required");
      return;
    }

    const group: StoredGroup = {
      id: crypto.randomUUID(),
      name: name.trim(),
      updatedAt: new Date().toISOString(),
      members: validMembers.map((m) => ({
        id: crypto.randomUUID(),
        name: m.name.trim(),
        instapay: m.instapay.trim() || undefined,
      })),
    };

    save(group);
    setName("");
    setMembers([{ name: "", instapay: "" }]);
    setShowForm(false);
  }

  return (
    <PageShell title="Saved Groups" subtitle="Your regular dining crews">
      {!showForm && (
        <Button className="mb-6 w-full" onClick={() => setShowForm(true)}>
          + New Group
        </Button>
      )}

      {showForm && (
        <Card className="mb-6 space-y-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Work lunch crew" />
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted">Members</p>
              {members.map((member, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Name"
                    value={member.name}
                    onChange={(e) => updateMember(i, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="InstaPay"
                    value={member.instapay}
                    onChange={(e) => updateMember(i, "instapay", e.target.value)}
                    className="w-32"
                  />
                  {members.length > 1 && (
                    <Button type="button" variant="ghost" onClick={() => removeMember(i)}>×</Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addMember}>+ Add member</Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save group</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {groups.length === 0 ? (
        <EmptyState title="No groups yet" description="Save your friends for one-tap split setup." />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{group.name}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {group.members.map((m) => {
                      const instapay = getInstapay(m);
                      return (
                        <li key={m.id}>
                          {m.name}{instapay ? ` · ${instapay}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button variant="ghost" className="text-red-500" onClick={() => remove(group.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
