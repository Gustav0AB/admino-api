import { createServer } from "http";
import { createApp } from "./app";
import { env } from "@config/env";
import { prisma } from "@lib/prisma";
import { initSocket } from "@lib/socket";

async function main() {
  const app = createApp();
  const httpServer = createServer(app);

  initSocket(httpServer);

  await prisma.$connect();
  console.log("[db] Prisma connected");

  httpServer.listen(env.port, () => {
    console.log(`[server] Running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
