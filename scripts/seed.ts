import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Demo Corp",
      plan: "pro",
      theme: JSON.stringify({ primaryColor: "#4f46e5" }),
    },
  });

  const user = await prisma.user.upsert({
    where: { email_tenantId: { email: "admin@demo.com", tenantId: tenant.id } },
    update: {},
    create: {
      email: "admin@demo.com",
      role: "admin",
      tenantId: tenant.id,
    },
  });

  console.log("✅ Seeded tenant:", tenant.slug);
  console.log("✅ Seeded admin user:", user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
