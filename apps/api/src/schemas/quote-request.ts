import { z } from "zod";

const addressSchema = z
  .object({
    country: z.string().optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    postalCode: z.string().optional(),
    addressLine: z.string().optional(),
  })
  .passthrough();

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
  origin: addressSchema,
  destination: addressSchema,
  parcels: z.array(parcelSchema).min(1),
  totalWeightGrams: z.number().positive(),
  declaredValue: moneySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteRequestBody = z.infer<typeof quoteRequestSchema>;
