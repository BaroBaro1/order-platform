const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const prices = [
  { wilaya: 16, home: 750, desk: 350 },
  { wilaya: 31, home: 900, desk: 350 },
  { wilaya: 19, home: 850, desk: 350 },
  { wilaya: 9, home: 800, desk: 350 },
  { wilaya: 15, home: 850, desk: 400 },
]

async function main() {
  for (const p of prices) {
    await prisma.deliveryPrice.create({
      data: {
        company: "Yalidine",
        wilaya: p.wilaya, // الآن رقم ✔
        homePrice: p.home,
        deskPrice: p.desk
      }
    })
  }

  console.log("✅ Seed completed")
}

main()