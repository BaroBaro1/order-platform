const { PrismaClient } = require("@prisma/client");


const prisma = new PrismaClient();

async function createMerchant() {
  const merchant = await prisma.merchant.create({
    data: {
      name: "متجر تجريبي",
      email: "test@example.com",
      phone: "0555123456",
      password: "123456",   // لاحقًا سنشفرها بـ bcrypt
      status: "trial",
      trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // يومين من الآن
      subscriptionPlan: "basic"
    }
  });

  console.log("✅ Merchant created successfully:");
  console.log(merchant);
}

createMerchant()
  .catch(e => console.error("❌ Error:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
