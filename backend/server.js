// server.js
const express = require('express');
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "SUPER_SECRET_KEY";
const { getDeliveryPrice } = require('./utils/delivery')

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "غير مصرح بالدخول" });
  }

  const token = authHeader.split(" ")[1]; // Bearer TOKEN

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "توكن غير صالح" });
    }

    req.merchant = decoded;
    next();
  });
}

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

app.post("/merchants/:id/upload-image", upload.single("image"), async (req, res) => {
  const merchantId = parseInt(req.params.id);

  const imagePath = "/uploads/" + req.file.filename;

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { storeImage: imagePath }
  });

  res.json({ success: true, image: imagePath });
});

// -------------------------------
// دالة توليد كود عشوائي للرابط
// -------------------------------
function generateCode() {
  return Math.random().toString(36).substring(2, 8);
}

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
    const {
      name,
      category,
      price,
      description,
      merchantId,
      features
    } = req.body;

    // تحويل الميزات من نص إلى JSON
    let parsedFeatures = [];
    if (features) {
      parsedFeatures = JSON.parse(features);
    }

    // مسار الصورة إن وُجدت
    const imagePath = req.file ? "/uploads/" + req.file.filename : null;

    const product = await prisma.product.create({
      data: {
        name,
        category,
        price: parseFloat(price),
        description,
        merchantId: parseInt(merchantId),
        image: imagePath,
        features: parsedFeatures,
        orderLink: "order-" + Date.now(),
        status: "active"
      }
    });

    res.json({ success: true, product });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
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
      deliveryType} = req.body;
    const productIdNum = Number(productId)
    // 🔥 1. جلب السعر من DB
    const delivery = await prisma.deliveryPrice.findFirst({
  where: { wilaya: Number(wilaya) }
    })

    if (!delivery) {
      return res.json({ success: false, message: "السعر غير موجود" })
    }
    const deliveryPriceNum =
      deliveryType === "desk"
        ? delivery.deskPrice || 0
        : delivery.homePrice || 0
// التحقق من صحة البيانات المدخلة
    if (!productIdNum || !customerName || !customerPhone) {
      return res.status(400).json({ error: "الرجاء إدخال جميع البيانات الصحيحة" });
    }
// جلب المنتج للتحقق من وجوده وحساب السعر الإجمالي
    const product = await prisma.product.findUnique({
      where: { id: productIdNum }
    });
// التحقق من وجود المنتج
    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
// حساب السعر الإجمالي (سعر المنتج + سعر التوصيل)
    const totalPrice = product.price + deliveryPriceNum;
// تسجيل الطلب في قاعدة البيانات
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
// إنشاء إشعار للتاجر عند تسجيل طلب جديد
    await prisma.notification.create({
      data: {
        merchantId: product.merchantId,
        message: `طلب جديد للمنتج: ${product.name}`
      }
    });

    res.json({ success: true, order });

  } 
  // -------------------------------

  catch (error) {
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
app.get("/merchants/:id/orders", authMiddleware,async (req, res) => {
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
app.get("/merchants/:id/notifications", authMiddleware, async (req, res) => {
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
// تحديد إشعار كمقروء
app.patch("/notifications/:id/read", async (req, res) => {
  const id = Number(req.params.id);

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });

  res.json(updated);
});

// تحديد كل الإشعارات كمقروء
app.patch("/merchants/:id/notifications/read-all", async (req, res) => {
  const merchantId = Number(req.params.id);

  await prisma.notification.updateMany({
    where: { merchantId },
    data: { isRead: true }
  });

  res.json({ success: true });
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
const hashedPassword = await bcrypt.hash(password, 10);
    const merchant = await prisma.merchant.create({
      data: { name, email, phone,  password: hashedPassword, }
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

    const isMatch = await bcrypt.compare(password, merchant.password);

    if (!isMatch) {
      return res.json({ error: "كلمة المرور خاطئة" });
    }

    // 🔹 إنشاء التوكن
    const token = jwt.sign(
      { id: merchant.id, email: merchant.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ===============================
// 🔹 جلب تاجر واحد (مهم للإعدادات)
// ===============================
app.get("/merchants/:id", authMiddleware, async (req, res) => {
  try {
    const merchantId = Number(req.params.id);

    if (isNaN(merchantId)) {
      return res.status(400).json({ error: "merchantId يجب أن يكون رقمًا" });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    if (!merchant) {
      return res.status(404).json({ error: "التاجر غير موجود" });
    }

    res.json(merchant);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب بيانات التاجر" });
  }
});
// ===============================
// 🔐 تغيير كلمة مرور التاجر
// ===============================
app.patch("/merchants/:id/password",authMiddleware, async (req, res) => {
  const merchantId = Number(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: "يجب إدخال كلمة مرور جديدة" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { password: hashedPassword }
  });

  res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
});

app.put("/merchants/:id", async (req, res) => {
  const merchantId = Number(req.params.id);
  const { name, phone, email, storeName } = req.body;

  try {
    const updated = await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        name,
        phone,
        email,
        storeName      // ← مهم
      }
    });

    res.json({ success: true, merchant: updated });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل تحديث بيانات التاجر" });
  }
});
app.get("/merchants/:id/stats", authMiddleware, async (req, res) => {
  const merchantId = Number(req.params.id);

  try {
    const orders = await prisma.order.findMany({
      where: {
        product: {
          merchantId
        }
      }
    });

    const totalOrders = orders.length;

    const pendingOrders = orders.filter(o => o.status !== "done").length;

    const doneOrders = orders.filter(o => o.status === "done").length;

    const totalRevenue = orders
      .filter(o => o.status === "done")
      .reduce((sum, o) => sum + o.totalPrice, 0);

    res.json({
      totalOrders,
      pendingOrders,
      doneOrders,
      totalRevenue
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل حساب الإحصائيات" });
  }
});
// ===============================
// جلب منتج واحد لتاجر معيّن
// ===============================
app.get("/merchants/:id/products/:productId", authMiddleware, async (req, res) => {
  try {
    const merchantId = Number(req.params.id);
    const productId = Number(req.params.productId);

    if (isNaN(merchantId) || isNaN(productId)) {
      return res.status(400).json({ error: "المعرّفات يجب أن تكون أرقامًا" });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        merchantId: merchantId
      }
    });

    if (!product) {
      return res.status(404).json({ error: "المنتج غير موجود لهذا التاجر" });
    }

    res.json(product);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في جلب المنتج" });
  }
});
// ===============================
// تعديل منتج معيّن لتاجر
// ===============================
app.put("/merchants/:id/products/:productId", authMiddleware, async (req, res) => {
  try {
    const merchantId = Number(req.params.id);
    const productId = Number(req.params.productId);

    const { name, category, price, description } = req.body;

    const updated = await prisma.product.updateMany({
      where: {
        id: productId,
        merchantId: merchantId
      },
      data: {
        name,
        category,
        price: parseFloat(price),
        description
      }
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "المنتج غير موجود أو ليس تابعًا لهذا التاجر" });
    }

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل تحديث المنتج" });
  }
});
// ===============================
// جلب كل شركات التوصيل
// ===============================
app.get("/delivery-companies", async (req, res) => {
  const companies = await prisma.deliveryCompany.findMany();
  res.json(companies);
});
// إضافة شركة توصيل جديدة
app.post("/delivery-companies", upload.single("logo"), async (req, res) => {
  const { name, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: "اسم الشركة مطلوب" });
  }

  const logoPath = req.file ? `/uploads/${req.file.filename}` : null;

  const company = await prisma.deliveryCompany.create({
    data: {
      name,
      phone: phone || null,
      logo: logoPath
    }
  });

  res.json({ success: true, company });
});

// ربط شركة توصيل بتاجر معين
app.post("/merchants/:merchantId/delivery", async (req, res) => {
  const { merchantId } = req.params;
  const { deliveryId } = req.body;

  await prisma.merchantDelivery.upsert({
    where: {
      merchantId_deliveryId: {
        merchantId: Number(merchantId),
        deliveryId: Number(deliveryId)
      }
    },
    update: {},
    create: {
      merchantId: Number(merchantId),
      deliveryId: Number(deliveryId)
    }
  });

  res.json({ message: "تم حفظ شركة التوصيل بنجاح" });
});
// جلب شركة التوصيل المرتبطة بتاجر معين
// ✅ جلب شركة التوصيل المرتبطة بتاجر معين — النسخة الصحيحة
app.get("/merchants/:merchantId/delivery", async (req, res) => {
  const { merchantId } = req.params;

  const record = await prisma.merchantDelivery.findFirst({
    where: { merchantId: Number(merchantId) },
    include: { deliveryCompany: true }   // ✅ الاسم الصحيح
  });

  if (!record) {
    return res.json({ selected: null });
  }

  res.json({
    selected: {
      deliveryId: record.deliveryId,
      company: record.deliveryCompany
    }
  });
});


// ===============================
// API لحساب سعر التوصيل بناءً على الولاية ونوع التوصيل
// ===============================
app.get("/delivery-price", async (req, res) => {

  const { wilaya, type } = req.query

  console.log("👉 Query:", wilaya, type)

  const price = await getDeliveryPrice(wilaya, type)

  res.json({ price })
})

// -------------------------------
// تشغيل السيرفر
// -------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
