"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { useHealthCart } from "@/context/HealthCartContext";
import {
  addMember,
  createFamily,
  deleteMember,
  seedJohnsonDemo,
  updateMember,
  type MemberBody,
} from "@/lib/api-client";
import type { FamilyMemberDto, MemberRelation, DietType } from "@/lib/types";

const CONDITIONS = [
  "diabetes",
  "cholesterol",
  "anemia",
  "thyroid",
  "hypertension",
  "celiac",
  "peanut allergy",
  "lactose intolerance",
  "obesity",
];

const RELATIONS: MemberRelation[] = [
  "self",
  "spouse",
  "child",
  "parent",
  "grandparent",
  "sibling",
  "other",
];

const emptyForm = (): MemberBody => ({
  name: "",
  age: 30,
  relation: "self",
  dietType: "flexible",
  conditions: [],
  allergies: [],
});

export default function FamilySetup() {
  const { familyId, family, setFamilyId, setFamily, setBasket } = useHealthCart();
  const [familyName, setFamilyName] = useState("");
  const [form, setForm] = useState<MemberBody>(emptyForm());
  const [customCondition, setCustomCondition] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [isTemporary, setIsTemporary] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleCondition = (c: string) => {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.includes(c)
        ? f.conditions.filter((x) => x !== c)
        : [...f.conditions, c],
    }));
  };

  const addCustomCondition = () => {
    if (!customCondition.trim()) return;
    setForm((f) => ({
      ...f,
      conditions: [...f.conditions, customCondition.trim()],
    }));
    setCustomCondition("");
  };

  const addAllergy = () => {
    if (!allergyInput.trim()) return;
    setForm((f) => ({
      ...f,
      allergies: [...f.allergies, allergyInput.trim()],
    }));
    setAllergyInput("");
  };

  const startEdit = (m: FamilyMemberDto) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      age: m.age,
      relation: m.relation,
      dietType: m.dietType,
      conditions: m.conditions,
      allergies: m.allergies,
      heightCm: m.heightCm ?? undefined,
      weightKg: m.weightKg ?? undefined,
      isTemporary: m.isTemporary,
      startDate: m.startDate ?? undefined,
      endDate: m.endDate ?? undefined,
    });
    setIsTemporary(!!m.isTemporary);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsTemporary(false);
    setStartDate("");
    setEndDate("");
  };

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return;
    setLoading(true);
    const { data } = await createFamily(familyName.trim());
    setLoading(false);
    if (data) {
      setFamilyId(data.id);
      setFamily(data);
    }
  };

  const handleSaveMember = async () => {
    if (!familyId || !form.name.trim()) return;
    setLoading(true);
    const body = {
      ...form,
      isTemporary,
      ...(isTemporary && startDate ? { startDate: new Date(startDate).toISOString() } : {}),
      ...(isTemporary && endDate ? { endDate: new Date(endDate).toISOString() } : {}),
    };
    const { data } = editingId
      ? await updateMember(familyId, editingId, body)
      : await addMember(familyId, body);
    setLoading(false);
    if (data) {
      setFamily(data);
      setBasket(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("healthcart_basketId");
      }
      resetForm();
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!familyId) return;
    const { data } = await deleteMember(familyId, memberId);
    if (data) setFamily(data);
  };

  const handleJohnson = async () => {
    setLoading(true);
    const { data } = await seedJohnsonDemo();
    setLoading(false);
    if (data) {
      setFamilyId(data.familyId);
      setFamily(data.family);
    }
  };

  if (!familyId) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-3xl text-primary">Your Family</h1>
        <p className="text-text/80">Create a family profile to personalize your store.</p>
        <input
          type="text"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          placeholder="Family name"
          className="w-full rounded-lg border border-primary/20 px-4 py-3"
        />
        <Button onClick={handleCreateFamily} loading={loading} className="w-full">
          Get Started
        </Button>
        <Button variant="secondary" onClick={handleJohnson} loading={loading} className="w-full">
          Load Sample Family (Johnson)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl text-primary">{family?.name ?? "Your Family"}</h1>
        <Button variant="secondary" onClick={handleJohnson} loading={loading}>
          Load Sample Family (Johnson)
        </Button>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl text-primary">
          {editingId ? "Edit Member" : "Add Member"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-primary/20 px-3 py-2"
          />
          <input
            type="number"
            placeholder="Age"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: parseInt(e.target.value, 10) || 0 })}
            className="rounded-lg border border-primary/20 px-3 py-2"
          />
          <select
            value={form.relation}
            onChange={(e) =>
              setForm({ ...form, relation: e.target.value as MemberRelation })
            }
            className="rounded-lg border border-primary/20 px-3 py-2"
          >
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            {(["vegetarian", "non_vegetarian", "flexible"] as DietType[]).map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="diet"
                  checked={form.dietType === d}
                  onChange={() => setForm({ ...form, dietType: d })}
                />
                {d.replace("_", "-")}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Health conditions</p>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCondition(c)}
                className={`rounded-full px-3 py-1 text-sm ${
                  form.conditions.includes(c)
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-text"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="Other condition"
              value={customCondition}
              onChange={(e) => setCustomCondition(e.target.value)}
              className="flex-1 rounded-lg border border-primary/20 px-3 py-2 text-sm"
            />
            <Button variant="ghost" onClick={addCustomCondition}>
              Add
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Allergies</p>
          <div className="flex flex-wrap gap-1">
            {form.allergies.map((a) => (
              <Tag key={a} label={a} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              className="flex-1 rounded-lg border border-primary/20 px-3 py-2 text-sm"
            />
            <Button variant="ghost" onClick={addAllergy}>
              Add
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <input
            type="number"
            placeholder="Height (cm) optional"
            value={form.heightCm ?? ""}
            onChange={(e) =>
              setForm({ ...form, heightCm: parseFloat(e.target.value) || undefined })
            }
            className="rounded-lg border border-primary/20 px-3 py-2"
          />
          <input
            type="number"
            placeholder="Weight (kg) optional"
            value={form.weightKg ?? ""}
            onChange={(e) =>
              setForm({ ...form, weightKg: parseFloat(e.target.value) || undefined })
            }
            className="rounded-lg border border-primary/20 px-3 py-2"
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTemporary}
            onChange={(e) => setIsTemporary(e.target.checked)}
          />
          This person is visiting
        </label>
        {isTemporary && (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-primary/20 px-3 py-2"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-primary/20 px-3 py-2"
            />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button onClick={handleSaveMember} loading={loading}>
            {editingId ? "Update Member" : "Add Member"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl text-primary">Members</h2>
        {family?.members.map((m) => (
          <div key={m.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-text">
                  {m.name}, {m.age} — {m.relation}
                  {m.isTemporary && (
                    <span className="ml-2 text-sm text-accent">(visiting)</span>
                  )}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.conditions.map((c) => (
                    <Tag key={c} label={c} />
                  ))}
                  {m.allergies.map((a) => (
                    <Tag key={a} label={`allergy: ${a}`} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(m)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => handleDelete(m.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
