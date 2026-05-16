import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "@lib/prisma";
import { requireAuth } from "@middleware/auth";
import { AuthRequest } from "@/types";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.sub;
    const record = await prisma.userExpenses.findUnique({ where: { userId } });
    res.json(record ? record.data : {});
  } catch (e) {
    next(e);
  }
});

router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.sub;
    const { savedAt: _ignored, ...rest } = req.body as Record<string, unknown>;

    const data = { ...rest, savedAt: new Date().toISOString() };

    const record = await prisma.userExpenses.upsert({
      where: { userId },
      create: { userId, data },
      update: { data },
    });

    res.json(record.data);
  } catch (e) {
    next(e);
  }
});

export default router;
