import { z } from "zod";
import { APP_EVENT_TYPES } from "@/lib/config";

const id = (re: RegExp, what: string) => z.string().min(1).max(64).regex(re, `${what} has unexpected characters`);
const slug = z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "must be a lowercase slug");

/**
 * The exact payload shape from the brief. Property values are untrusted text:
 * they are stored and displayed, never interpreted.
 */
export const AppEventSchema = z
  .object({
    event_id: id(/^[A-Za-z0-9_\-:.]+$/, "event_id"),
    event: z.enum(APP_EVENT_TYPES),
    user_id: id(/^[A-Za-z0-9_\-]+$/, "user_id").nullable(),
    device_id: id(/^[A-Za-z0-9_\-]+$/, "device_id"),
    timestamp: z.string().datetime({ offset: true }),
    properties: z
      .object({
        story: slug.optional(),
        url: z.string().url().max(2048).optional(),
      })
      .catchall(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
      .default({}),
  })
  .strict();

export type AppEvent = z.infer<typeof AppEventSchema>;
