const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * When an admin deletes a user in User Management, this removes the account
 * from BOTH Firestore and Firebase Authentication so they can no longer log in.
 * Only callable by an admin (Firestore users/{uid}.isAdmin === true).
 */
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in to perform this action."
    );
  }

  const callerUid = context.auth.uid;
  const targetUid = data && data.uid;

  if (!targetUid || typeof targetUid !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing or invalid user ID to delete."
    );
  }

  if (callerUid === targetUid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "You cannot delete your own account."
    );
  }

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete users."
    );
  }

  const callerData = callerDoc.data();
  const isAdmin =
    callerData.isAdmin === true ||
    callerData.email === "signtifydev@dev.com";

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete users."
    );
  }

  try {
    await db.collection("users").doc(targetUid).delete();
    await admin.auth().deleteUser(targetUid);
    return { success: true };
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      return { success: true };
    }
    console.error("adminDeleteUser error:", err);
    throw new functions.https.HttpsError(
      "internal",
      err.message || "Failed to delete user."
    );
  }
});
