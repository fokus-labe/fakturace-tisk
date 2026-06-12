import { z } from "zod";

export type PerVenueRole = "manager" | "viewer";

// Provozovna v matici přístupů (lehká varianta)
export type VenueLite = { id: string; slug: string; name: string };

// Jedno venue přiřazení usera, jak ho vidí UI
export type UserVenueAccess = {
  slug: string;
  name: string;
  role: "manager" | "viewer" | "admin";
};

// Řádek tabulky /users
export type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  isAdmin: boolean;
  access: UserVenueAccess[];
};

// Payload pro create/edit — jeden venue přístup
export const venueAccessSchema = z.object({
  slug: z.string().min(1),
  role: z.enum(["manager", "viewer"]),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Heslo musí mít aspoň 8 znaků"),
  isAdmin: z.boolean(),
  venues: z.array(venueAccessSchema),
});

export const updateUserSchema = z.object({
  email: z.string().email(),
  isAdmin: z.boolean(),
  venues: z.array(venueAccessSchema),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Heslo musí mít aspoň 8 znaků"),
});

export type VenueAccessInput = z.infer<typeof venueAccessSchema>;
