/**
 * Central Reusable Utility: Customer Account Resolution & Creation
 *
 * Used across:
 * 1. POS Cashier sale (auto-account creation by phone)
 * 2. Desired Products conversion to Service / Order
 * 3. Chat / WhatsApp intake
 * 4. Maintenance / Warranty booking
 */

const getUsersModel = require("./userModel");

/**
 * Ensures a customer account exists by phone or email.
 * If user exists: returns existing user doc & ID.
 * If not: creates account with username/email & password = phone number.
 */
async function ensureCustomerAccount(subdomain, options = {}) {
  const Users = getUsersModel(subdomain);
  const rawPhone = String(options.phone || "").trim();
  const cleanPhone = rawPhone.replace(/[\s-]/g, "");
  const customerName = String(options.name || options.fullname || "عميل المتجر").trim();
  const customerEmail = String(options.email || "").trim();
  const address = String(options.address || "").trim();
  const city = String(options.city || "القاهرة").trim();

  if ((!cleanPhone || cleanPhone === "00000000000" || cleanPhone.length < 6) && !customerEmail) {
    return { userDoc: null, userId: null, isNew: false };
  }

  // 1. Search existing user by phone or email
  const searchOr = [];
  if (cleanPhone && cleanPhone.length >= 6) {
    searchOr.push({ phone: cleanPhone });
    if (rawPhone !== cleanPhone) searchOr.push({ phone: rawPhone });
  }
  if (customerEmail && customerEmail.includes("@")) {
    searchOr.push({ email: customerEmail.toLowerCase() });
  }

  let userDoc = null;
  if (searchOr.length > 0) {
    userDoc = await Users.findOne({ $or: searchOr });
  }

  if (userDoc) {
    return {
      userDoc,
      userId: userDoc._id,
      fullname: userDoc.fullname,
      phone: userDoc.phone,
      email: userDoc.email,
      isNew: false
    };
  }

  // 2. Not found -> Auto create customer account
  const autoEmail = customerEmail && customerEmail.includes("@")
    ? customerEmail.toLowerCase()
    : `${cleanPhone || Date.now()}@phone.store`;

  // Password defaults to phone number so customer can login immediately with phone/phone!
  const defaultPassword = cleanPhone || "123456";

  const newUser = new Users({
    fullname: customerName,
    phone: cleanPhone || rawPhone || "00000000000",
    email: autoEmail,
    password: defaultPassword, // pre-save will bcrypt-hash it
    address,
    city,
    role: "user"
  });

  await newUser.save();

  return {
    userDoc: newUser,
    userId: newUser._id,
    fullname: newUser.fullname,
    phone: newUser.phone,
    email: newUser.email,
    username: cleanPhone,
    tempPassword: defaultPassword,
    isNew: true
  };
}

module.exports = {
  ensureCustomerAccount
};
