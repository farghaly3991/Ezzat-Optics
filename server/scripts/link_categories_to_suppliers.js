const mongoose = require('mongoose');
require('dotenv').config({ path: 'server/.env' });
const { ensureTenantConnection } = require('../core/database');
const getSupplierModel = require('../modules/finance/procurement/supplierModel');
const getProductModel = require('../modules/products/productModel');

async function linkMore() {
  const subdomain = 'localhost';
  const conn = await ensureTenantConnection(subdomain, process.env.DEFAULT_DB);
  const Supplier = getSupplierModel(subdomain);
  const Product = getProductModel(subdomain);

  const suppliers = await Supplier.find().lean();
  const ahram = suppliers.find((s) => s.name.includes('الأهرام'));
  const delta = suppliers.find((s) => s.name.includes('دلتا'));
  const nile = suppliers.find((s) => s.name.includes('النيل'));
  const swiss = suppliers.find((s) => s.name.includes('السويسرية'));
  const egy = suppliers.find((s) => s.name.includes('المصري'));

  if (delta) {
    const res = await Product.updateMany(
      { name: /تكييف/i, supplierId: null },
      { $set: { supplierId: delta._id, criticalStockThreshold: 4, reorderQuantity: 8 } }
    );
    console.log('Linked ACs to Delta:', res.modifiedCount);
  }

  if (ahram) {
    const res = await Product.updateMany(
      { name: /هاتف|آيفون|سامسونج|شاومي/i, supplierId: null },
      { $set: { supplierId: ahram._id, criticalStockThreshold: 5, reorderQuantity: 12 } }
    );
    console.log('Linked Phones to Ahram:', res.modifiedCount);
  }

  if (nile) {
    const res = await Product.updateMany(
      { name: /لابتوب|ماك بوك|ديل|كمبيوتر|شاشة/i, supplierId: null },
      { $set: { supplierId: nile._id, criticalStockThreshold: 3, reorderQuantity: 6 } }
    );
    console.log('Linked Computers to Nile:', res.modifiedCount);
  }

  if (swiss) {
    const res = await Product.updateMany(
      { name: /سماعة|ساعة|صوت/i, supplierId: null },
      { $set: { supplierId: swiss._id, criticalStockThreshold: 4, reorderQuantity: 15 } }
    );
    console.log('Linked Audio to Swiss:', res.modifiedCount);
  }

  if (egy) {
    const res = await Product.updateMany(
      { name: /شاحن|كابل|باور|وصلة/i, supplierId: null },
      { $set: { supplierId: egy._id, criticalStockThreshold: 10, reorderQuantity: 30 } }
    );
    console.log('Linked Accessories to Egyptian Chargers:', res.modifiedCount);
  }

  const counts = await Product.aggregate([
    {
      $group: {
        _id: '$supplierId',
        count: { $sum: 1 }
      }
    }
  ]);

  console.log('Aggregated product counts:', counts);
  await conn.close();
}

linkMore().catch(console.error);
