// server.js
const express = require('express');
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ----------------------
// إعداد مكان حفظ الصور
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// السماح بالوصول للصور عبر URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------------------
// دالة توليد كود عشوائي للرابط
// -------------------------------
function generateCode() {
  return Math.random().toString(36).substring(2, 8);
}

// -------------------------------
// API لإنشاء تاجر تجريبي
// -------------------------------
app.get("/merchants/create", async (req, res) => {
  try {
    const merchant = await prisma.merchant.create({
      data: {
        name: "متجر تجريبي",
        email: "test@example.com",
        status: "active"
      }
    });
    res.json({ message: "تم إنشاء التاجر بنجاح", merchant });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------
// API لجلب كل التجار مع منتجاتهم
// -------------------------------
app.get('/merchants', async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      include: { products: true }
    });
    res.json(merchants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب التجار" });
  }
});

// -------------------------------
// API لإضافة منتج جديد مع صورة
// -------------------------------
app.post("/products", upload.single("image"), async (req, res) => {
  try {
    const { merchantId, name, category, price, description } = req.body;

    const merchantIdNum = Number(merchantId);
    const priceNum = Number(price);

    if (!merchantIdNum || !priceNum || !name || !category) {
      return res.status(400).json({ error: "الرجاء إدخال جميع البيانات الصحيحة" });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const orderLink = generateCode();

    const product = await prisma.product.create({
      data: {
        merchantId: merchantIdNum,
        name,
        category,
        price: priceNum,
        description,
        image: imageUrl,
        orderLink,
        status: "active"
      }
    });

    res.json({
      success: true,
      product,
      orderUrl: `http://localhost:${PORT}/order/${orderLink}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في إضافة المنتج" });
  }
});

// -------------------------------
// API لجلب المنتج عبر رابط الطلب
// -------------------------------
app.get("/order/:link", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { orderLink: req.params.link }
    });

    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب المنتج" });
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

    const productIdNum = Number(productId);
    const deliveryPriceNum = Number(deliveryPrice || 0);

    if (!productIdNum || !customerName || !customerPhone) {
      return res.status(400).json({ error: "الرجاء إدخال جميع البيانات الصحيحة" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productIdNum }
    });

    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });

    const totalPrice = product.price + deliveryPriceNum;

    const order = await prisma.order.create({
      data: {
        productId: productIdNum,
        customerName,
        customerPhone,
        wilaya,
        commune,
        address,
        deliveryType,
        deliveryPrice: deliveryPriceNum,
        totalPrice
      }
    });

    await prisma.notification.create({
      data: {
        merchantId: product.merchantId,
        message: `طلب جديد للمنتج: ${product.name}`
      }
    });

    res.json({ success: true, order });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الطلب" });
  }
});
// ===============================
// API لجلب منتجات تاجر معيّن
// ===============================
app.get("/merchants/:id/products", async (req, res) => {
  try {
    const merchantId = parseInt(req.params.id, 10);

    if (isNaN(merchantId)) {
      return res.status(400).json({ error: "merchantId يجب أن يكون رقمًا" });
    }

    const products = await prisma.product.findMany({
      where: { merchantId }
    });

    res.json(products);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب المنتجات" });
  }
});

// ===============================
// جلب جميع طلبات تاجر معيّن
// ===============================
app.get("/merchants/:id/orders", async (req, res) => {
  try {
    const merchantId = Number(req.params.id);
 if (isNaN(merchantId)) {
      return res.status(400).json({ error: "merchantId يجب أن يكون رقمًا" });
    }
    const orders = await prisma.order.findMany({
      where: {
        product: {
          merchantId
        }
      },
      include: {
        product: true
      }
    });

    res.json(orders);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب الطلبات" });
  }
});
// ===============================
// جلب إشعارات تاجر معيّن
// ===============================
app.get("/merchants/:id/notifications", async (req, res) => {
  try {
    const merchantId = Number(req.params.id);
if (isNaN(merchantId)) {
      return res.status(400).json({ error: "merchantId يجب أن يكون رقمًا" });
    }
    const notifications = await prisma.notification.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" }
    });

    res.json(notifications);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب الإشعارات" });
  }
});
app.patch("/orders/:id", async (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body;

  // تأكد أن الحالة صحيحة
  if (!["pending", "done", "canceled"].includes(status)) {
    return res.status(400).json({ error: "حالة غير صحيحة" });
  }

  try {
    // إذا كنت تستخدم Prisma:
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: status }
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل تحديث الطلب" });
  }
});
app.post("/merchant/register", async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    const existing = await prisma.merchant.findUnique({
      where: { email }
    });

    if (existing) {
      return res.json({ error: "البريد الإلكتروني موجود بالفعل" });
    }

    const merchant = await prisma.merchant.create({
      data: { name, email, phone, password }
    });

    res.json({ message: "تم إنشاء الحساب بنجاح" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});
app.post("/merchant/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email }
    });

    if (!merchant) {
      return res.json({ error: "البريد الإلكتروني غير موجود" });
    }

    if (merchant.password !== password) {
      return res.json({ error: "كلمة المرور خاطئة" });
    }

    res.json({
      id: merchant.id,
      name: merchant.name
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// -------------------------------
// تشغيل السيرفر
// -------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
