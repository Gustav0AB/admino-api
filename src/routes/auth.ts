import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { prisma } from "@lib/prisma";
import { env } from "@config/env";
import { HttpError, JwtPayload, AuthRequest } from "@/types";
import { requireAuth } from "@middleware/auth";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
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
      const { username, password } = loginSchema.parse(req.body);

      const systemAdmin = await prisma.systemAdmin.findUnique({ where: { email: username } });
      const clientMember = !systemAdmin ? await prisma.clientMember.findFirst({ where: { username } }) : null;
      const member = !systemAdmin && !clientMember
        ? await prisma.member.findFirst({ where: { OR: [{ email: username }, { username }] } })
        : null;

      const user = systemAdmin ?? clientMember ?? member;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new HttpError(401, "Invalid credentials");
      }

      const payload: JwtPayload = {
        sub: user.id,
        username: clientMember ? clientMember.username : (user as { email: string }).email,
        role: systemAdmin ? "SYSTEM_ADMIN" : clientMember ? String(clientMember.role) : "MEMBER",
        orgId: "clientId" in user ? user.clientId : null,
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

/**
 * PATCH /auth/change-password
 * Allows authenticated users to change their own password.
 */
router.patch(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const { sub, role } = (req as AuthRequest).user!;

      let user: { password: string } | null = null;
      let updateFn: (hash: string) => Promise<unknown>;

      if (role === "SYSTEM_ADMIN") {
        user = await prisma.systemAdmin.findUnique({ where: { id: sub } });
        updateFn = (hash) => prisma.systemAdmin.update({ where: { id: sub }, data: { password: hash } });
      } else if (role === "OWNER" || role === "ADMIN" || role === "CLIENT") {
        user = await prisma.clientMember.findUnique({ where: { id: sub } });
        updateFn = (hash) => prisma.clientMember.update({ where: { id: sub }, data: { password: hash } });
      } else {
        user = await prisma.member.findUnique({ where: { id: sub } });
        updateFn = (hash) => prisma.member.update({ where: { id: sub }, data: { password: hash } });
      }

      if (!user) throw new HttpError(404, "User not found");
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        throw new HttpError(400, "Current password is incorrect");
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await updateFn(hash);

      res.json({ message: "Password updated successfully" });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
