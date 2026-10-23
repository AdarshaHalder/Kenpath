import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Officer } from "../lib/domain";
import { unauthorized } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      officer?: Officer;
    }
  }
}

export function signToken(o: Officer): string {
  return jwt.sign({ sub: String(o.id), name: o.name, email: o.email, designation: o.designation }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/** Requires `Authorization: Bearer <jwt>`. Every officer route sits behind this. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  try {
    const p = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    req.officer = { id: Number(p.sub), name: p.name, email: p.email, designation: p.designation };
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}

export function currentOfficer(req: Request): Officer {
  if (!req.officer) throw unauthorized();
  return req.officer;
}
