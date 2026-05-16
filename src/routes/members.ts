import { z } from "zod";
import { prisma } from "@lib/prisma";
import { createRouter } from "@lib/generic-router";
import { requireAuth } from "@middleware/auth";
import { HttpError, JwtPayload } from "@/types";

// ── Validation schemas ─────────────────────────────────────────────────────

const createMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const updateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

type CreateMember = z.infer<typeof createMemberSchema>;
type UpdateMember = z.infer<typeof updateMemberSchema>;

// ── Select shape returned to callers ──────────────────────────────────────

const memberSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  joinedAt: true,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveClientId(query: Record<string, string>, user: JwtPayload): string {
  if (user.orgId) return user.orgId;
  if (query.clientId) return query.clientId;
  throw new HttpError(400, "clientId query parameter is required");
}

// ── Service ────────────────────────────────────────────────────────────────

const membersService = {
  async findAll(params: Record<string, string>, user: JwtPayload) {
    const clientId = resolveClientId(params, user);
    return prisma.member.findMany({
      where: { clientId, isActive: true },
      select: memberSelect,
      orderBy: { joinedAt: "desc" },
    });
  },

  async findById(id: string, user: JwtPayload) {
    const member = await prisma.member.findUnique({
      where: { id },
      select: { ...memberSelect, clientId: true },
    });
    if (!member) return null;
    if (user.orgId && member.clientId !== user.orgId) {
      throw new HttpError(403, "Forbidden");
    }
    return member;
  },

  async create(data: CreateMember, user: JwtPayload) {
    const { name, email, password } = data;
    const clientId = user.orgId;
    if (!clientId) throw new HttpError(403, "Only client members can create members");

    const existing = await prisma.member.findFirst({ where: { email, clientId } });
    if (existing) throw new HttpError(409, "A member with this email already exists");

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    return prisma.member.create({
      data: { name, email, password: hashed, clientId },
      select: memberSelect,
    });
  },

  async update(id: string, data: UpdateMember, user: JwtPayload) {
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) throw new HttpError(404, "Member not found");
    if (user.orgId && member.clientId !== user.orgId) {
      throw new HttpError(403, "Forbidden");
    }
    return prisma.member.update({ where: { id }, data, select: memberSelect });
  },

  async remove(id: string, user: JwtPayload) {
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) throw new HttpError(404, "Member not found");
    if (user.orgId && member.clientId !== user.orgId) {
      throw new HttpError(403, "Forbidden");
    }
    await prisma.member.update({ where: { id }, data: { isActive: false } });
  },
};

// ── Router ────────────────────────────────────────────────────────────────

type MemberRow = { id: string; name: string; email: string; isActive: boolean; joinedAt: Date };

export default createRouter<MemberRow, CreateMember, UpdateMember>({
  service: membersService,
  createSchema: createMemberSchema,
  updateSchema: updateMemberSchema,
  before: [requireAuth],
});
