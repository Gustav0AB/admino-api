import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const adminPassword = await bcrypt.hash("Admin1234!", 10);
  const memberPassword = await bcrypt.hash("Client1234!", 10);

  const admin = await prisma.systemAdmin.upsert({
    where: { email: "admin@admino.io" },
    update: {},
    create: {
      email: "admin@admino.io",
      password: adminPassword,
      name: "System Admin",
    },
  });

  const client = await prisma.client.upsert({
    where: { slug: "elite-academy" },
    update: {},
    create: {
      name: "Elite Academy",
      slug: "elite-academy",
      branding: {
        primaryColor: "#556B2F",
        secondaryColor: "#1C1C1C",
        logoUrl: null,
      },
    },
  });

  const clientOwner = await prisma.clientMember.upsert({
    where: { email_clientId: { email: "owner@elite-academy.com", clientId: client.id } },
    update: {},
    create: {
      email: "owner@elite-academy.com",
      password: await bcrypt.hash("Owner1234!", 10),
      name: "Academy Owner",
      role: "OWNER",
      clientId: client.id,
    },
  });

  const planNames = ["Strength Foundation", "Hypertrophy Block", "Conditioning Circuit", "Power Development", "Recovery & Mobility"];

  const plans = await Promise.all(
    planNames.map((name, i) =>
      prisma.plan.upsert({
        where: { id: `seed-plan-${i + 1}` },
        update: {},
        create: {
          id: `seed-plan-${i + 1}`,
          name,
          description: `${name} — designed for elite athletes.`,
          status: "ACTIVE",
          clientId: client.id,
        },
      })
    )
  );

  const athletes = [
    { name: "Marcus Reeves", email: "marcus@elite-academy.com" },
    { name: "Sofia Torres", email: "sofia@elite-academy.com" },
    { name: "James Okafor", email: "james@elite-academy.com" },
    { name: "Yuki Tanaka", email: "yuki@elite-academy.com" },
    { name: "Priya Nair", email: "priya@elite-academy.com" },
  ];

  for (let i = 0; i < athletes.length; i++) {
    const athlete = athletes[i]!;
    const member = await prisma.member.upsert({
      where: { email_clientId: { email: athlete.email, clientId: client.id } },
      update: {},
      create: {
        email: athlete.email,
        password: memberPassword,
        name: athlete.name,
        clientId: client.id,
      },
    });

    await prisma.planAssignment.upsert({
      where: { memberId_planId: { memberId: member.id, planId: plans[i]!.id } },
      update: {},
      create: {
        memberId: member.id,
        planId: plans[i]!.id,
      },
    });
  }

  console.log(`✓ SystemAdmin:  ${admin.email}`);
  console.log(`✓ Client:       ${client.name} (${client.slug})`);
  console.log(`✓ Client Owner: ${clientOwner.email}`);
  console.log(`✓ Plans:        ${plans.length} created`);
  console.log(`✓ Members:      ${athletes.length} created with plan assignments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
