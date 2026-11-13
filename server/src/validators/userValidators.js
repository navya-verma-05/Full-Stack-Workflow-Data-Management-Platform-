import { z } from "zod";
import { USER_ROLES } from "../models/User.js";
import {
  boundedString,
  objectIdSchema,
  paginationQuerySchema,
} from "./common.js";

export const userIdParamSchema = {
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
};

export const listUsersSchema = {
  query: paginationQuerySchema
    .extend({
      role: z.enum(USER_ROLES).optional(),
      active: z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .optional(),
      search: boundedString(1, 120).optional(),
    })
    .strict(),
};

export const updateUserSchema = {
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
  body: z
    .object({
      name: boundedString(2, 120).optional(),
      role: z.enum(USER_ROLES).optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field (name, role, active) must be provided",
    }),
};
