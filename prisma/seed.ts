import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin1234!", 10);
  const clientPassword = await bcrypt.hash("Client1234!", 10);

  const admin = await prisma.systemAdmin.upsert({
    where: { email: "admin@admino.io" },
    update: {},
    create: {
      email: "admin@admino.io",
      password: adminPassword,
      name: "System Admin",
    },
  });

  const org = await prisma.organization.upsert({
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

  const orgOwner = await prisma.orgMember.upsert({
    where: { email_organizationId: { email: "owner@elite-academy.com", organizationId: org.id } },
    update: {},
    create: {
      email: "owner@elite-academy.com",
      password: await bcrypt.hash("Owner1234!", 10),
      name: "Academy Owner",
      role: "OWNER",
      organizationId: org.id,
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
          organizationId: org.id,
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
    const athlete = athletes[i];
    const client = await prisma.client.upsert({
      where: { email_organizationId: { email: athlete.email, organizationId: org.id } },
      update: {},
      create: {
        email: athlete.email,
        password: clientPassword,
        name: athlete.name,
        organizationId: org.id,
      },
    });

    await prisma.planAssignment.upsert({
      where: { clientId_planId: { clientId: client.id, planId: plans[i].id } },
      update: {},
      create: {
        clientId: client.id,
        planId: plans[i].id,
      },
    });
  }

  console.log(`✓ SystemAdmin:  ${admin.email}`);
  console.log(`✓ Organization: ${org.name} (${org.slug})`);
  console.log(`✓ Org Owner:    ${orgOwner.email}`);
  console.log(`✓ Plans:        ${plans.length} created`);
  console.log(`✓ Athletes:     ${athletes.length} created with plan assignments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
