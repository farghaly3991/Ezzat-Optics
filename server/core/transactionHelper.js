/**
 * MongoDB Multi-Tenant ACID Transaction Helper
 * 
 * Provides atomic all-or-nothing guarantees across multiple collections
 * (e.g. Orders + Product Stock + Finance Payments + Partner Ledger).
 * 
 * In production/Atlas (replica set), guarantees ACID rollback on any failure.
 * In standalone dev mode without replica sets, falls back gracefully without breaking.
 */

const { getMongooseConnection } = require("./database");

/**
 * Executes a callback within a MongoDB transaction session.
 * 
 * @param {string} subdomain - Tenant domain
 * @param {function(mongoose.ClientSession): Promise<any>} callback - Callback receiving session
 * @returns {Promise<any>}
 */
async function withTransaction(subdomain, callback) {
  const conn = getMongooseConnection(subdomain);
  let session = null;

  try {
    session = await conn.startSession();
    session.startTransaction();

    const result = await callback(session);

    if (session.inTransaction()) {
      await session.commitTransaction();
    }
    return result;
  } catch (err) {
    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.warn("[TX_ABORT_WARN]:", abortErr.message);
      }
    }

    // Check if error is due to MongoDB standalone mode without replica set
    const isStandaloneError =
      err.message &&
      (err.message.includes("replica set") ||
        err.message.includes("Transaction numbers are only allowed") ||
        err.message.includes("Transactions are not supported"));

    if (isStandaloneError) {
      console.warn("[TX_STANDALONE_FALLBACK]: Running operation without transaction session due to standalone Mongo.");
      return await callback(null);
    }

    throw err;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (endErr) {
        // Ignored
      }
    }
  }
}

module.exports = {
  withTransaction
};
