import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import dotenv from "dotenv";

dotenv.config();

console.log("CLERK_SECRET_KEY loaded:", !!process.env.CLERK_SECRET_KEY);

export const clerkAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // ✅ DEVELOPMENT MODE
  if (process.env.NODE_ENV !== "production") {
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        // 🔥 Decode JWT (THIS IS THE FIX)
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );

        req.auth = {
          userId: payload.sub, // ✅ REAL Clerk user ID
          token,
        };
      } catch (err) {
        console.error("Token decode error:", err);
        return res.status(401).json({ error: "Invalid token" });
      }
    } else {
      return res.status(401).json({ error: "No token provided" });
    }

    return next();
  }

  // ✅ PRODUCTION
  return ClerkExpressRequireAuth()(req, res, next);
};
