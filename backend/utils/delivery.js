const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getDeliveryPrice(wilaya, type = "home") {

  console.log("📍 Wilaya received:", wilaya)

  const price = await prisma.deliveryPrice.findFirst({
    where: {
      wilaya: Number(wilaya),
      company: "Yalidine"
    }
  })

  if (!price) {
    console.log("❌ No price found")
    return 0
  }

  return type === "desk"
    ? price.deskPrice
    : price.homePrice
}

module.exports = { getDeliveryPrice }