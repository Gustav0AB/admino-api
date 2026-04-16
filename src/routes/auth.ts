import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { prisma } from "@lib/prisma";
import { env } from "@config/env";
import { HttpError, JwtPayload } from "@/types";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/login
 * Resolves user across SystemAdmin → OrgMember → Client, verifies password,
 * and returns a signed JWT with { sub, email, role, orgId }.
 */
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user =
        (await prisma.systemAdmin.findUnique({ where: { email } })) ??
        (await prisma.orgMember.findFirst({ where: { email } })) ??
        (await prisma.client.findFirst({ where: { email } }));

      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new HttpError(401, "Invalid credentials");
      }

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: "role" in user ? String(user.role) : "SYSTEM_ADMIN",
        orgId: "organizationId" in user ? user.organizationId : null,
      };

      const token = jwt.sign(payload, env.jwt.secret, {
        expiresIn: env.jwt.expiresIn,
      } as jwt.SignOptions);

      res.json({ token, user: payload });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
