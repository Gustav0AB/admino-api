import { Router } from "express";
import authRouter from "./auth";
import clientsRouter from "./clients";

const router = Router();

router.use("/auth", authRouter);
router.use("/clients", clientsRouter);

export default router;
