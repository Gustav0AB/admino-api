import { z } from "zod";
import { prisma } from "@lib/prisma";
import { createRouter } from "@lib/generic-router";
import { requireAuth } from "@middleware/auth";
import { HttpError, JwtPayload } from "@/types";

// ── Validation schemas ─────────────────────────────────────────────────────

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

type CreateClient = z.infer<typeof createClientSchema>;
type UpdateClient = z.infer<typeof updateClientSchema>;

// ── Select shape returned to callers ──────────────────────────────────────

const clientSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  joinedAt: true,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveOrgId(
  query: Record<string, string>,
  user: JwtPayload
): string {
  // Org members / clients use their own orgId; system admins must pass ?orgId=
  if (user.orgId) return user.orgId;
  if (query.orgId) return query.orgId;
  throw new HttpError(400, "orgId query parameter is required");
}

// ── Service ────────────────────────────────────────────────────────────────

const clientsService = {
  async findAll(params: Record<string, string>, user: JwtPayload) {
    const organizationId = resolveOrgId(params, user);
    return prisma.client.findMany({
      where: { organizationId, isActive: true },
      select: clientSelect,
      orderBy: { joinedAt: "desc" },
    });
  },

  async findById(id: string, user: JwtPayload) {
    const client = await prisma.client.findUnique({
      where: { id },
      select: { ...clientSelect, organizationId: true },
    });
    if (!client) return null;
    if (user.orgId && client.organizationId !== user.orgId) {
      throw new HttpError(403, "Forbidden");
    }
    return client;
  },

  async create(data: CreateClient, user: JwtPayload) {
    const { name, email, password } = data;
    const organizationId = user.orgId;
    if (!organizationId) throw new HttpError(403, "Only org members can create clients");

    const existing = await prisma.client.findFirst({
      where: { email, organizationId },
    });
    if (existing) throw new HttpError(409, "A client with this email already exists");

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    return prisma.client.create({
      data: { name, email, password: hashed, organizationId },
      select: clientSelect,
    });
  },

  async update(id: string, data: UpdateClient, user: JwtPayload) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw new HttpError(404, "Client not found");
    if (user.orgId && client.organizationId !== user.orgId) {
      throw new HttpError(403, "Forbidden");
    }
    return prisma.client.update({
      where: { id },
      data,
      select: clientSelect,
    });
  },

  async remove(id: string, user: JwtPayload) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw new HttpError(404, "Client not found");
    if (user.orgId && client.organizationId !== user.orgId) {
      throw new HttpError(403, "Forbidden");
    }
    await prisma.client.delete({ where: { id } });
  },
};

// ── Router (generic CRUD factory + auth guard) ────────────────────────────

type ClientRow = { id: string; name: string; email: string; isActive: boolean; joinedAt: Date };

export default createRouter<ClientRow, CreateClient, UpdateClient>({
  service: clientsService,
  createSchema: createClientSchema,
  updateSchema: updateClientSchema,
  before: [requireAuth],
});
