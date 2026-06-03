import { z } from "zod";

function createLocationInputSchema(role: "origin" | "destination") {
  return z
    .object({
      method: z.string(),
      countryCode: z.string().optional(),
      postalCode: z.string().optional(),
      level1: z.string().optional(),
      level2: z.string().optional(),
      level3: z.string().optional(),
      level4: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .superRefine((value, context) => {
      if (value.method === "coordinate") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Coordinate input is not supported in API v0.1. Use method "location" with countryCode and postalCode or level1+level2.',
          path: ["method"],
        });
        return;
      }

      if (value.method !== "location") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'method must be "location" in API v0.1',
          path: ["method"],
        });
        return;
      }

      if (!value.countryCode?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "countryCode is required",
          path: ["countryCode"],
        });
      }

      const hasPostal = Boolean(value.postalCode?.trim());
      const hasLevel1 = Boolean(value.level1?.trim());
      const hasLevel2 = Boolean(value.level2?.trim());

      if (role === "origin" && !hasPostal && !(hasLevel1 && hasLevel2)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "must include postalCode or both level1 and level2",
        });
      }

      const levels = [
        { key: "level2", parent: "level1" },
        { key: "level3", parent: "level2" },
        { key: "level4", parent: "level3" },
      ] as const;

      for (const { key, parent } of levels) {
        const child = value[key]?.trim();
        const ancestor = value[parent]?.trim();
        if (child && !ancestor) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} requires ${parent}`,
            path: [key],
          });
        }
      }
    });
}

const originLocationInputSchema = createLocationInputSchema("origin");
const destinationLocationInputSchema = createLocationInputSchema("destination");

const parcelSchema = z.object({
  weightGrams: z.number().positive(),
  dimensions: z
    .object({
      lengthCm: z.number().positive(),
      widthCm: z.number().positive(),
      heightCm: z.number().positive(),
    })
    .optional(),
  quantity: z.number().int().positive().optional(),
});

const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1),
});

export const quoteRequestSchema = z.object({
  providers: z.union([z.string(), z.array(z.string())]).optional(),
  origin: originLocationInputSchema,
  destination: destinationLocationInputSchema,
  parcels: z.array(parcelSchema).min(1),
  totalWeightGrams: z.number().positive(),
  declaredValue: moneySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteRequestBody = z.infer<typeof quoteRequestSchema>;
