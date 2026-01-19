import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Simple hash function for OTP codes (in production, use a proper hashing library)
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Generate a 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate a secure session token
function generateSessionToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Store OTP in database
export const storeOtp = mutation({
  args: {
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Invalidate any existing unused OTPs for this email
    const existingOtps = await ctx.db
      .query("otpCodes")
      .withIndex("by_email_and_used", (q) =>
        q.eq("email", args.email).eq("used", false)
      )
      .collect();

    for (const otp of existingOtps) {
      await ctx.db.patch(otp._id, { used: true });
    }

    // Create new OTP
    await ctx.db.insert("otpCodes", {
      email: args.email,
      codeHash: args.codeHash,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
      used: false,
    });
  },
});

// Verify OTP and create session
export const verifyOtp = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const codeHash = hashCode(args.code);
    const now = Date.now();

    // Find valid OTP
    const otps = await ctx.db
      .query("otpCodes")
      .withIndex("by_email_and_used", (q) =>
        q.eq("email", args.email).eq("used", false)
      )
      .collect();

    const validOtp = otps.find(
      (otp) => otp.codeHash === codeHash && otp.expiresAt > now
    );

    if (!validOtp) {
      return { success: false, error: "Invalid or expired OTP" };
    }

    // Mark OTP as used
    await ctx.db.patch(validOtp._id, { used: true });

    // Find or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      // Create new user (open signup)
      const userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.email.split("@")[0], // Default name from email
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      return { success: false, error: "Failed to create user" };
    }

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.db.insert("sessions", {
      userId: user._id,
      token: sessionToken,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      sessionToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  },
});

// Get session by token
export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);

    if (!user) {
      return null;
    }

    return {
      session: {
        id: session._id,
        expiresAt: session.expiresAt,
      },
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  },
});

// Delete session (logout)
export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// Request OTP action (generates OTP and returns it - email sending happens on the server side)
export const requestOtp = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const otp = generateOtp();
    const codeHash = hashCode(otp);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store OTP hash
    await ctx.runMutation(api.auth.storeOtp, {
      email: args.email,
      codeHash,
      expiresAt,
    });

    // Return the OTP so the calling code can send it via email
    return { otp, email: args.email };
  },
});
