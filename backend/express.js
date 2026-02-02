const express = require('express');
const{PrismaClient}=require("@prisma/client");
const app = express();
const prisma = new PrismaClient();

app.use(express.json());
// مثال: جلب كل التجار
app.get('/merchants', async (req, res) => {
    const merchants = await prisma.merchant.findMany({
        include: { products: true }
    });
    res.json(merchants);
});

const PORT = process.env.PORT || 5000; 
app.get("/merchants/create", async (req, res) => {
  try {
    const merchant = await prisma.merchant.create({
      data: {
        name: "متجر تجريبي",
        email: "test@example.com",
        status: "active"
      }
    });

    res.json({
      message: "تم إنشاء التاجر بنجاح",
      merchant
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// دالة توليد كود عشوائي للرابط
function generateCode() {
  return Math.random().toString(36).substring(2, 8);
}

// -------------------------------
// API لإضافة منتج جديد
// -------------------------------
app.post("/products", async (req, res) => {
  try {
    const { merchantId, name, category, price, description } = req.body;

    // توليد رابط فريد
    const orderLink = generateCode();

    const product = await prisma.product.create({
      data: {
        merchantId: Number(merchantId),
        name,
        category,
        price: Number(price),
        description,
        orderLink
      }
    });

    res.json({
      success: true,
      product,
      orderUrl: `http://localhost:3000/order/${orderLink}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في إضافة المنتج" });
  }
});
// -------------------------------
// API لتسجيل طلب جديد من الزبون
// -------------------------------
app.post("/orders", async (req, res) => {
  try {
    const {
      productId,
      customerName,
      customerPhone,
      wilaya,
      commune,
      address,
      deliveryType,
      deliveryPrice
    } = req.body;

    // جلب بيانات المنتج والسعر
    const product = await prisma.product.findUnique({
      where: { id: Number(productId) }
    });

    if (!product) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    const totalPrice = product.price + Number(deliveryPrice);

    // إنشاء الطلب
    const order = await prisma.order.create({
      data: {
        productId: Number(productId),
        customerName,
        customerPhone,
        wilaya,
        commune,
        address,
        deliveryType,
        deliveryPrice: Number(deliveryPrice),
        totalPrice
      }
    });

    // إنشاء إشعار للتاجر
    await prisma.notification.create({
      data: {
        merchantId: product.merchantId,
        message: `طلب جديد للمنتج: ${product.name}`
      }
    });

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الطلب" });
  }
});

// تشغيل السيرفر
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});