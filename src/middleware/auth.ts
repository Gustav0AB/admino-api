import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { prisma } from "@lib/prisma";
import { AuthRequest, HttpError, JwtPayload, OrgBranding } from "@/types";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing or invalid authorization header"));
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    (req as AuthRequest).user = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;
    if (!user) {
      next(new HttpError(401, "Unauthorized"));
      return;
    }
    if (!roles.includes(user.role)) {
      next(new HttpError(403, "Forbidden: insufficient role"));
      return;
    }
    next();
  };
}

export async function loadOrgContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = (req as AuthRequest).user;
  if (!user?.orgId) {
    next();
    return;
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { id: true, name: true, slug: true, branding: true, isActive: true },
    });

    if (!org || !org.isActive) {
      next(new HttpError(403, "Organization not found or inactive"));
      return;
    }

    (req as AuthRequest).org = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      branding: org.branding as OrgBranding,
    };

    next();
  } catch (e) {
    next(e);
  }
}
