import { NextResponse } from "next/server";
import { z } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: { message } }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: { message } }, { status: 404 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: { message } }, { status: 500 });
}

export const memberRelationSchema = z.enum([
  "self",
  "spouse",
  "child",
  "parent",
  "grandparent",
  "sibling",
  "other",
]);

export const dietTypeSchema = z.enum([
  "vegetarian",
  "non_vegetarian",
  "flexible",
]);

export const familyMemberBodySchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0).max(120),
  relation: memberRelationSchema,
  dietType: dietTypeSchema,
  conditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  isTemporary: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const createFamilySchema = z.object({
  name: z.string().min(1),
});

export const chatBodySchema = z.object({
  familyId: z.string().min(1),
  message: z.string().min(1),
  budget: z.number().positive().optional(),
});

export const basketBodySchema = z.object({
  familyId: z.string().min(1),
  budget: z.number().positive().optional(),
});

export const basketAdjustSchema = z.object({
  familyId: z.string().min(1),
  basketId: z.string().min(1),
  adjustments: z.array(
    z.object({
      productId: z.string().min(1),
      newQuantity: z.union([z.number().positive(), z.literal("remove")]),
    }),
  ),
});

export const basketAddSchema = z.object({
  familyId: z.string().min(1),
  basketId: z.string().optional(),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().positive().optional(),
});

export function parseId(id: string | undefined, label: string): string {
  if (!id || id.trim() === "") {
    throw new Error(`Missing ${label}`);
  }
  return id;
}
