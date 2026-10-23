import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/connection";
import { unauthorized } from "../lib/errors";
import { authenticate, currentOfficer, signToken } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/** POST /api/auth/login → { token, officer } */
router.post("/login", validate(LoginBody), (_req, res) => {
  const { email, password } = res.locals.body as z.infer<typeof LoginBody>;
  const row = getDb().prepare("SELECT * FROM officers WHERE email = ?").get(email) as
    | { id: number; email: string; password_hash: string; name: string; designation: string }
    | undefined;
  // One message for both cases so accounts can't be enumerated.
  if (!row || !bcrypt.compareSync(password, row.password_hash)) throw unauthorized("Invalid email or password");
  const officer = { id: row.id, name: row.name, email: row.email, designation: row.designation };
  res.json({ token: signToken(officer), officer });
});

/** GET /api/auth/me */
router.get("/me", authenticate, (req, res) => {
  res.json({ officer: currentOfficer(req) });
});

export default router;
