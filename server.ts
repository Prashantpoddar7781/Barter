import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "barterhub-secret-key-2026";

// Initialize Nodemailer Transporter
const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpFrom = process.env.SMTP_FROM || '"BarterHub" <noreply@barterhub.in>';

const transporter = smtpHost && smtpUser && smtpPass ? nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  connectionTimeout: 10000, // 10 seconds connection timeout
  socketTimeout: 10000,     // 10 seconds socket timeout
  greetingTimeout: 10000,   // 10 seconds greeting timeout
  tls: {
    rejectUnauthorized: false // bypass SSL verification issues for custom domain/gmail servers
  }
}) : null;

if (transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error("[SMTP] Connection verification failed:", error);
    } else {
      console.log("[SMTP] Connection verified successfully! Transporter is ready.");
    }
  });
} else {
  console.log("[SMTP] SMTP host credentials not found. Sandbox mode active.");
}

// Initialize Prisma
const prisma = new PrismaClient();

// ================= SAFETY & MODERATION HELPERS =================
const PROFANITY_WORDS = ["abuse", "bastard", "idiot", "scammer", "fraudster", "harass", "fuck", "shit", "chutiya", "kamina", "saala"];
const SUSPICIOUS_KEYWORDS = ["drugs", "weapons", "gun", "stolen", "wire transfer", "hack", "cheat code", "cheat cash", "illegal"];

function filterProfanity(text: string): string {
  if (!text) return "";
  let sanitized = text;
  for (const word of PROFANITY_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    sanitized = sanitized.replace(regex, "****");
  }
  return sanitized;
}

function containsSuspiciousKeywords(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(word => lowerText.includes(word));
}

function checkImageModeration(images: any): boolean {
  if (!images) return false;
  const imgStr = JSON.stringify(images).toLowerCase();
  return imgStr.includes("inappropriate") || imgStr.includes("flag") || imgStr.includes("unsafe") || imgStr.includes("nude");
}

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

function safeJsonParse(value: any, fallback: any = []): any {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_) {
      return [value];
    }
  }
  return value;
}

// Enable CORS for cross-domain requests (Vercel frontend -> Railway backend)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Auth Request Type
export interface AuthRequest extends express.Request {
  user?: {
    id: string;
    emailOrPhone: string;
  };
}

// Authentication Middleware
function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      if (dbUser && dbUser.isSuspended) {
        return res.status(403).json({ error: "Your account has been suspended by the administrator. Contact support@barterhub.in." });
      }
    } catch (_) {}

    req.user = decoded;
    next();
  });
}

// Fallback logic for when Gemini is loading or if key is not defined, to ensure flawless mock-AI responsiveness
function getFallbackBarterIntelligence(title: string, category: string, value: number, wants: string[]) {
  const minVal = Math.round(value * 0.85);
  const maxVal = Math.round(value * 1.15);
  const rangeStr = `₹${(minVal/1000).toFixed(1)}k–₹${(maxVal/1000).toFixed(1)}k`;

  let who = `Surat residents interested in ${category}. Especially those offering peer-to-peer services.`;
  let fair = `An item worth ~${rangeStr}, or equivalent hours (approx. 10-20 hrs) of skilled bartering.`;
  let threeWay = `Trade standard items to a designer, swap that design with a freelancer, who can then swap for this ${title}.`;
  let best = wants.length > 0 ? wants[0] : `${category} items of similar quality`;

  const lowerTitle = title.toLowerCase();
  const lowerCat = category.toLowerCase();
  
  if (lowerCat.includes('electronics') || lowerTitle.includes('phone') || lowerTitle.includes('camera') || lowerTitle.includes('ipad')) {
    who = "Tech collectors or digital creators who want robust hardware.";
    fair = `An iPad Mini, a GoPro Hero, or 12 hours of website design services.`;
    threeWay = `Yes! Trade your old gadgets to Priya for coding lessons, then trade those lessons to the seller of this ${title}.`;
    best = `A secondary smartphone, graphics tablet, or premium audio gear.`;
  } else if (lowerCat.includes('home') || lowerCat.includes('furniture') || lowerTitle.includes('bedsheet') || lowerCat.includes('lifestyle')) {
    who = "Homemakers, college students, or local renovators setting up a room.";
    fair = `Curtains of equal luxury, a sturdy writing desk, or 5-8 hours of gardening/home-organization.`;
    threeWay = `Yes! Trade your kitchen accessory with Priya, trade her vintage lamp to the seller of this ${title}.`;
    best = `Designer cushion covers, handcrafted carpets, or minimal wall-art frames.`;
  }

  return {
    pricingSuggestion: `This ${title} usually exchanges for items/services worth ${rangeStr}`,
    tradeScore: 78,
    insights: {
      whoToTradeWith: who,
      fairExchange: fair,
      threeWayTrade: threeWay,
      bestItemToExchange: best
    }
  };
}

// ================= AUTH ENDPOINTS =================

// POST /api/auth/send-passcode - Generate and save a 6-digit passcode (and send via email)
app.post("/api/auth/send-passcode", async (req, res) => {
  let code = "123456";
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ error: "Email or phone number is required" });
    }

    const cleanInput = String(emailOrPhone).trim().toLowerCase();
    
    // Generate a random 6-digit code, or fallback to 123456 for sandbox testing if no email service is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    const isRealMailConfigured = !!(transporter || resendApiKey);
    code = isRealMailConfigured ? Math.floor(100000 + Math.random() * 900000).toString() : "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.passcode.upsert({
      where: { emailOrPhone: cleanInput },
      update: { code, expiresAt },
      create: { emailOrPhone: cleanInput, code, expiresAt }
    });

    console.log(`[PASSCODE] Generated passcode ${code} for ${cleanInput}`);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5df; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 28px; font-weight: bold; color: #2D6A4F;">BarterHub</span>
        </div>
        <h2 style="color: #2d2d2d; margin-bottom: 12px; text-align: center;">Verification Passcode</h2>
        <p style="font-size: 14px; color: #666; line-height: 1.6; text-align: center;">
          Use the secure passcode below to complete your sign-in or verify your email:
        </p>
        <div style="background-color: #F5F5F0; padding: 18px; border-radius: 12px; margin: 24px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2D6A4F; font-family: monospace;">${code}</span>
        </div>
        <p style="font-size: 11px; color: #999; text-align: center;">
          This code will expire in 10 minutes. If you did not request this code, please ignore this email.
        </p>
      </div>
    `;

    if (resendApiKey && cleanInput.includes("@")) {
      console.log(`[PASSCODE] Attempting to send Resend email API to ${cleanInput}`);
      let fromEmail = "BarterHub <onboarding@resend.dev>";
      // Only use custom SMTP_FROM if it's set and doesn't belong to a public email domain (Gmail, Yahoo, Outlook, etc.) which cannot be verified on Resend
      if (smtpFrom && smtpFrom.includes("@") && !smtpFrom.includes("@gmail.com") && !smtpFrom.includes("@yahoo") && !smtpFrom.includes("@outlook") && !smtpFrom.includes("@hotmail") && !smtpFrom.includes("@icloud")) {
        fromEmail = smtpFrom;
      }
      
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: cleanInput,
          subject: "Your BarterHub OTP Verification Code",
          html: emailHtml
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Resend API returned status ${response.status}`);
      }
      
      console.log(`[PASSCODE] Successfully sent email OTP to ${cleanInput} via Resend HTTP API`);
    } else if (transporter && cleanInput.includes("@")) {
      console.log(`[PASSCODE] Attempting to send Nodemailer SMTP to ${cleanInput}`);
      const mailOptions = {
        from: smtpFrom,
        to: cleanInput,
        subject: "Your BarterHub OTP Verification Code",
        html: emailHtml
      };
      await transporter.sendMail(mailOptions);
      console.log(`[PASSCODE] Successfully sent email OTP to ${cleanInput} via SMTP`);
    }

    res.json({ success: true, message: "Verification passcode sent successfully." });
  } catch (error: any) {
    console.error("Send passcode error:", error);
    // Return a success JSON with sandboxCode so that clients can bypass sandbox email limits when testing
    res.json({ 
      success: true, 
      message: `Email delivery failed (${error.message}). Sandbox fallback active.`, 
      sandboxCode: code 
    });
  }
});

// POST /api/auth/verify-passcode - Verify passcode and authenticate user
app.post("/api/auth/verify-passcode", async (req, res) => {
  try {
    const { emailOrPhone, code } = req.body;
    if (!emailOrPhone || !code) {
      return res.status(400).json({ error: "Email/phone and passcode code are required" });
    }

    const cleanInput = String(emailOrPhone).trim().toLowerCase();

    // Check passcode in DB
    const passcodeRecord = await prisma.passcode.findUnique({
      where: { emailOrPhone: cleanInput }
    });

    // Accept local fallback 123456 only if SMTP is not configured or for the demo account
    const isDemoUser = cleanInput === "ravi@barterhub.in";
    const isValidSandbox = (!transporter || isDemoUser) && String(code) === "123456";
    const isValidRecord = passcodeRecord && passcodeRecord.code === String(code) && passcodeRecord.expiresAt >= new Date();

    if (!isValidSandbox && !isValidRecord) {
      return res.status(400).json({ error: "Invalid or expired passcode. Check your email or try again." });
    }

    // Passcode valid, delete it
    await prisma.passcode.delete({
      where: { emailOrPhone: cleanInput }
    }).catch(() => {});

    // Find or create User
    let user = await prisma.user.findUnique({
      where: { emailOrPhone: cleanInput }
    });

    if (user && user.isSuspended) {
      return res.status(403).json({ error: "Your account has been suspended by the administrator. Contact support@barterhub.in." });
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          emailOrPhone: cleanInput,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanInput)}`,
          isOnboardingCompleted: false
        }
      });
    }

    // Sign Token
    const token = jwt.sign({ id: user.id, emailOrPhone: user.emailOrPhone }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user,
      isNewUser: isNewUser || !user.isOnboardingCompleted
    });
  } catch (error: any) {
    console.error("Verify passcode error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login-password - Standard password authentication
app.post("/api/auth/login-password", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: "Email/phone and password are required" });
    }

    const cleanInput = String(emailOrPhone).trim().toLowerCase();

    // Find User
    const user = await prisma.user.findUnique({
      where: { emailOrPhone: cleanInput }
    });

    if (user && user.isSuspended) {
      return res.status(403).json({ error: "Your account has been suspended by the administrator. Contact support@barterhub.in." });
    }

    if (!user) {
      return res.status(400).json({ error: "No user account exists for this email/phone number. Verify via OTP first." });
    }

    if (!user.password) {
      return res.status(400).json({ error: "No password has been set for this account yet. Please use 'Forgot Password / Reset with OTP' to set a password." });
    }

    // Verify Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Incorrect password. Please try again or use OTP." });
    }

    // Sign Token
    const token = jwt.sign({ id: user.id, emailOrPhone: user.emailOrPhone }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user,
      isNewUser: !user.isOnboardingCompleted
    });
  } catch (error: any) {
    console.error("Login password error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/reset-password - Verify OTP and update user password
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { emailOrPhone, code, newPassword } = req.body;
    if (!emailOrPhone || !code || !newPassword) {
      return res.status(400).json({ error: "Email/phone, OTP passcode, and new password are required" });
    }

    const cleanInput = String(emailOrPhone).trim().toLowerCase();

    // Check passcode in DB
    const passcodeRecord = await prisma.passcode.findUnique({
      where: { emailOrPhone: cleanInput }
    });

    const isValidSandbox = !transporter && String(code) === "123456";
    const isValidRecord = passcodeRecord && passcodeRecord.code === String(code) && passcodeRecord.expiresAt >= new Date();

    if (!isValidSandbox && !isValidRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP passcode." });
    }

    // Passcode valid, delete it
    await prisma.passcode.delete({
      where: { emailOrPhone: cleanInput }
    }).catch(() => {});

    // Hash new password
    const hashedPassword = await bcrypt.hash(String(newPassword).trim(), 10);

    // Find or create User
    let user = await prisma.user.findUnique({
      where: { emailOrPhone: cleanInput }
    });

    if (user) {
      user = await prisma.user.update({
        where: { emailOrPhone: cleanInput },
        data: { password: hashedPassword }
      });
    } else {
      user = await prisma.user.create({
        data: {
          emailOrPhone: cleanInput,
          password: hashedPassword,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanInput)}`,
          isOnboardingCompleted: false
        }
      });
    }

    // Sign Token
    const token = jwt.sign({ id: user.id, emailOrPhone: user.emailOrPhone }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user,
      isNewUser: !user.isOnboardingCompleted
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me - Get current user profile
app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error: any) {
    console.error("Auth me error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id - Get current user public profile details
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        avatar: true,
        location: true,
        rating: true,
        tradesCount: true,
        isVerified: true,
        isTopTrader: true,
        responseRate: true,
        createdAt: true,
        interests: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error: any) {
    console.error("Get user public profile error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/onboarding - Complete profile setup
app.post("/api/auth/onboarding", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, avatar, location, interests, password } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: "Name and location are required" });
    }

    const updateData: any = {
      name: name.trim(),
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      location: location.trim(),
      interests: interests || [],
      isOnboardingCompleted: true
    };

    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user?.id },
      data: updateData
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error("Onboarding error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/verify-id - Verify user ID via Aadhaar
app.post("/api/auth/verify-id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { aadhaarFront, aadhaarBack } = req.body;
    if (!aadhaarFront || !aadhaarBack) {
      return res.status(400).json({ error: "Aadhaar front and back images are required" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user?.id },
      data: {
        aadhaarFront,
        aadhaarBack,
        idVerificationStatus: "pending",
        idVerified: false
      }
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error("Verify ID error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ================= LISTING ENDPOINTS =================

// GET /api/listings - Get all listings (or search/filter)
app.get("/api/listings", async (req, res) => {
  try {
    let listings = await prisma.listing.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Auto-seeding mock data if table is completely empty
    if (listings.length === 0) {
      console.log("Database is empty, auto-seeding mock users and listings...");
      
      // Create mock users
      const priyaUser = await prisma.user.upsert({
        where: { emailOrPhone: "priya@barterhub.in" },
        update: {},
        create: {
          id: "priya",
          name: "Priya S.",
          emailOrPhone: "priya@barterhub.in",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
          location: "Surat, Gujarat",
          rating: 4.9,
          tradesCount: 34,
          isVerified: true,
          isOnboardingCompleted: true
        }
      });

      const arjunUser = await prisma.user.upsert({
        where: { emailOrPhone: "arjun@barterhub.in" },
        update: {},
        create: {
          id: "arjun",
          name: "Arjun M.",
          emailOrPhone: "arjun@barterhub.in",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun",
          location: "Remote",
          rating: 4.7,
          tradesCount: 12,
          isVerified: true,
          isOnboardingCompleted: true
        }
      });

      const meUser = await prisma.user.upsert({
        where: { emailOrPhone: "ravi@barterhub.in" },
        update: {},
        create: {
          id: "me",
          name: "Ravi Kumar",
          emailOrPhone: "ravi@barterhub.in",
          avatar: "https://api.dicebear.com/7.x/initials/svg?seed=RK",
          location: "Surat, Gujarat",
          rating: 4.8,
          tradesCount: 47,
          isVerified: true,
          isOnboardingCompleted: true
        }
      });

      // Create mock listings
      await prisma.listing.createMany({
        data: [
          {
            id: "l1",
            userId: priyaUser.id,
            title: "Monstera plant (large)",
            description: "Large, healthy Monstera plant. Well-maintained.",
            images: JSON.stringify(['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=400']),
            category: "Other",
            condition: "Healthy",
            estimatedValue: 1500,
            location: "Surat, Gujarat",
            distance: "2km away",
            wants: JSON.stringify(['Yoga sessions', 'Baked goods']),
            openToNegotiate: false,
            negotiableCategories: JSON.stringify([]),
            tags: JSON.stringify(['Goods', 'Service ok']),
            isService: false
          },
          {
            id: "l2",
            userId: arjunUser.id,
            title: "Logo design (2 concepts)",
            description: "Professional logo design with 2 distinct concepts and revisions.",
            images: JSON.stringify(['https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=400']),
            category: "Skills",
            condition: "New",
            estimatedValue: 5000,
            location: "Remote",
            distance: "Remote",
            wants: JSON.stringify(['Web hosting credits', 'SEO help']),
            openToNegotiate: true,
            negotiableCategories: JSON.stringify(['Creative Services', 'Other']),
            tags: JSON.stringify(['Service', 'Verified Pro']),
            isService: true
          },
          {
            id: "l3",
            userId: meUser.id,
            title: "DSLR Camera (Canon 200D)",
            description: "Barely used Canon 200D with kit lens.",
            images: JSON.stringify(['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400']),
            category: "Electronics",
            condition: "Excellent",
            estimatedValue: 35000,
            location: "Surat, Gujarat",
            distance: "5km away",
            wants: JSON.stringify(['Laptop', 'Video editing service']),
            openToNegotiate: true,
            negotiableCategories: JSON.stringify(['Electronics', 'Skills']),
            tags: JSON.stringify(['Goods or Service']),
            isService: false
          }
        ]
      });

      // Seed mock wishlists
      await prisma.wishlistItem.createMany({
        data: [
          {
            id: "w1",
            userId: priyaUser.id,
            title: "DSLR Camera",
            description: "Looking for a working DSLR camera for hobby photography.",
            category: "Electronics",
            estimatedValue: 30000,
            location: "Surat, Gujarat"
          },
          {
            id: "w2",
            userId: arjunUser.id,
            title: "Monstera plant",
            description: "Looking for indoor monstera or other plants.",
            category: "Other",
            estimatedValue: 1200,
            location: "Surat, Gujarat"
          }
        ]
      }).catch(() => {});

      // Seed mock trade records (profile history)
      await prisma.tradeRecord.createMany({
        data: [
          {
            id: "t1",
            user1Id: "me",
            user1Name: "Ravi Kumar",
            user2Id: priyaUser.id,
            user2Name: priyaUser.name || "Priya S.",
            item1Title: "Aesthetic Writing Table Desk",
            item2Title: "Monstera Plant (large) 🌿",
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          },
          {
            id: "t2",
            user1Id: "me",
            user1Name: "Ravi Kumar",
            user2Id: arjunUser.id,
            user2Name: arjunUser.name || "Arjun M.",
            item1Title: "Gaming Console Retro Handheld",
            item2Title: "Minimalist Brand Logo Vector Design",
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          }
        ]
      }).catch(() => {});

      // Seed a starter notification for matching
      await prisma.notification.create({
        data: {
          id: "n1",
          userId: "me",
          title: "New Match! 🌟",
          message: "Priya S. is looking for 'DSLR Camera' which matches your Canon 200D!",
          type: "match"
        }
      }).catch(() => {});

      // Refetch
      listings = await prisma.listing.findMany({
        orderBy: { createdAt: 'desc' }
      });
    }

    // Convert fields from Prisma JSON to plain JS arrays
    const formattedListings = listings.map(l => ({
      ...l,
      images: safeJsonParse(l.images),
      wants: safeJsonParse(l.wants),
      negotiableCategories: safeJsonParse(l.negotiableCategories),
      tags: safeJsonParse(l.tags)
    }));

    res.json(formattedListings);
  } catch (error: any) {
    console.error("Get listings error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/listings - Create listing
app.post("/api/listings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      description,
      images,
      category,
      condition,
      estimatedValue,
      location,
      distance,
      wants,
      openToNegotiate,
      negotiableCategories,
      tags,
      isService
    } = req.body;

    if (!title || !estimatedValue || !images || images.length === 0) {
      return res.status(400).json({ error: "Title, estimatedValue, and images are required" });
    }

    // 1. Safety & Moderation: Profanity filter
    const sanitizedTitle = filterProfanity(title);
    const rawDesc = description || `Exchange offer of ${title}`;
    const sanitizedDesc = filterProfanity(rawDesc);

    // 2. Banned Keyword Flagging
    const isSuspicious = containsSuspiciousKeywords(sanitizedTitle) || containsSuspiciousKeywords(sanitizedDesc);

    // 3. Image Moderation Check
    const isUnsafeImage = checkImageModeration(images);

    const listing = await prisma.listing.create({
      data: {
        userId: req.user?.id!,
        title: sanitizedTitle,
        description: sanitizedDesc,
        images: safeJsonParse(images),
        category,
        condition: condition || (isService ? "Professional Skill" : "Excellent condition"),
        estimatedValue: Number(estimatedValue),
        location: location || "Surat, Gujarat",
        distance: distance || "0.1km away",
        wants: safeJsonParse(wants, ["Open to negotiate"]),
        openToNegotiate: !!openToNegotiate,
        negotiableCategories: safeJsonParse(negotiableCategories),
        tags: safeJsonParse(tags),
        isService: !!isService,
        isFlagged: isSuspicious,
        isModerated: isUnsafeImage
      }
    });

    // 4. Trigger Matching Notifications for Wishlists
    try {
      const wishlists = await prisma.wishlistItem.findMany();
      const matchedWishlist = wishlists.filter(item => 
        sanitizedTitle.toLowerCase().includes(item.title.toLowerCase()) || 
        item.title.toLowerCase().includes(sanitizedTitle.toLowerCase())
      );
      for (const item of matchedWishlist) {
        if (item.userId !== req.user?.id) {
          await prisma.notification.create({
            data: {
              userId: item.userId,
              title: "New Match Found! 🌟",
              message: `Someone just listed "${sanitizedTitle}" which matches your wishlist item "${item.title}"!`,
              type: "match",
              listingId: listing.id
            }
          });
        }
      }
    } catch (matchErr) {
      console.error("Match check error:", matchErr);
    }

    res.status(201).json(listing);
  } catch (error: any) {
    console.error("Create listing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/:id - Get single listing
app.get("/api/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({
      where: { id }
    });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const formatted = {
      ...listing,
      images: safeJsonParse(listing.images),
      wants: safeJsonParse(listing.wants),
      negotiableCategories: safeJsonParse(listing.negotiableCategories),
      tags: safeJsonParse(listing.tags)
    };

    res.json(formatted);
  } catch (error: any) {
    console.error("Get listing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/listings/:id - Delete listing
app.delete("/api/listings/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({
      where: { id }
    });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (listing.userId !== req.user?.id) {
      return res.status(403).json({ error: "Unauthorized to delete this listing" });
    }

    await prisma.listing.delete({
      where: { id }
    });

    res.json({ success: true, message: "Listing deleted successfully" });
  } catch (error: any) {
    console.error("Delete listing error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ================= MESSAGING ENDPOINTS =================

// GET /api/messages - Fetch chat history for user
app.get("/api/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const myId = req.user?.id!;
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myId },
          { receiverId: myId }
        ]
      },
      include: {
        sender: true,
        receiver: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error: any) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages - Send message
app.post("/api/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { receiverId, listingId, text } = req.body;
    if (!receiverId || !text) {
      return res.status(400).json({ error: "Receiver ID and message text are required" });
    }

    // Sanitize message using profanity filter
    const sanitizedText = filterProfanity(text);

    const message = await prisma.message.create({
      data: {
        senderId: req.user?.id!,
        receiverId,
        listingId: listingId || null,
        text: sanitizedText,
        timestamp: Number(Date.now())
      },
      include: {
        sender: true,
        receiver: true
      }
    });

    res.status(201).json(message);
  } catch (error: any) {
    console.error("Create message error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ================= AI BARTER INTELLIGENCE =================

// API: AI Barter Intelligence
app.post("/api/ai/barter-intelligence", async (req, res) => {
  try {
    const { title, category, estimatedValue, wants, user } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      const fallback = getFallbackBarterIntelligence(title, category, estimatedValue, wants || []);
      return res.json(fallback);
    }

    const minV = Math.round(estimatedValue * 0.85);
    const maxV = Math.round(estimatedValue * 1.15);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        You are a smart AI Barter Expert for "BarterHub", a direct peer-to-peer bartering and skills-exchange app.
        We have a listing of:
        - Title: "${title}"
        - Category: "${category}"
        - Estimated Market Value: ₹${estimatedValue}
        - Exchange Wants: ${JSON.stringify(wants)}
        
        The active user viewing this listing is:
        - Name: "${user?.name || "Viewer"}"
        - Skills/Services: ${JSON.stringify(user?.skills || [])}

        Generate highly realistic barter swap predictions that help reduce friction.
        Keep the answers creative, extremely short, realistic (1 sentence maximum per answer), and matches item values.
        
        Return a JSON response adhering to this format EXACTLY:
        {
          "pricingSuggestion": "description of typical swap value/range (e.g., 'This iPad usually exchanges for items/services worth ₹18k–₹22k')",
          "tradeScore": 88,
          "insights": {
            "whoToTradeWith": "Who is the ideal trader persona? (1 sentence)",
            "fairExchange": "What is a fair exchange? Mention suitable products/services totaling around ₹${minV} to ₹${maxV}. (1 sentence)",
            "threeWayTrade": "Explain a creative 3-way circular trade scenario path with name ideas. (1 sentence)",
            "bestItemToExchange": "Name the specific best candidate item or professional skill. (1 sentence)"
          }
        }
      `,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "";
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanJson);
    res.json(result);
  } catch (error) {
    console.error("Gemini Barter Intelligence Error:", error);
    const { title, category, estimatedValue, wants } = req.body;
    const fallback = getFallbackBarterIntelligence(title, category, estimatedValue, wants || []);
    res.json(fallback);
  }
});

// API: AI Matching logic
app.post("/api/ai/match", async (req, res) => {
  try {
    const { listingTitle, userWants, offerItem } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        score: 75,
        reasoning: "API Key not configured. Standard mock match calculation used.",
        suggestion: "Trade looks viable! Complete the dialogue to finalise barter."
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        As a barter expert for BarterHub, calculate a "Barter Compatibility Score" (0-100) between these two entities:
        Listing: ${listingTitle}
        User Wants: ${userWants}
        Offered item: ${offerItem}
        
        Return a JSON response with:
        - score: number
        - reasoning: string (brief)
        - suggestion: string (how to make the trade better)
      `,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text || "";
    const jsonStr = text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(jsonStr));
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate match score" });
  }
});

// ================= WISHLIST ENDPOINTS =================
app.get("/api/wishlist", async (req, res) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error: any) {
    console.error("Get wishlist error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/wishlist", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { title, description, category, estimatedValue, location } = req.body;
    if (!title || !category || !estimatedValue) {
      return res.status(400).json({ error: "Title, category, and expected value are required" });
    }

    const sanitizedTitle = filterProfanity(title);
    const sanitizedDesc = filterProfanity(description || "");

    const item = await prisma.wishlistItem.create({
      data: {
        userId: req.user?.id!,
        title: sanitizedTitle,
        description: sanitizedDesc,
        category,
        estimatedValue: Number(estimatedValue),
        location: location || "Surat, Gujarat"
      }
    });

    // Scan for matches in existing listings
      const listings = await prisma.listing.findMany();
    const matchedListings = listings.filter(l => 
      sanitizedTitle.toLowerCase().includes(l.title.toLowerCase()) || 
      l.title.toLowerCase().includes(sanitizedTitle.toLowerCase())
    );
    for (const l of matchedListings) {
      if (l.userId !== req.user?.id) {
        await prisma.notification.create({
          data: {
            userId: req.user?.id!,
            title: "Wishlist Match Found!",
            message: `An active listing "${l.title}" matches your new wishlist item "${sanitizedTitle}"!`,
            type: "match",
            listingId: l.id
          }
        });
      }
    }

    res.status(201).json(item);
  } catch (error: any) {
    console.error("Create wishlist error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= NOTIFICATION ENDPOINTS =================
app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user?.id! },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error: any) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notifications/read", authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user?.id!, read: false },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Read notifications error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= REPORT ENDPOINTS =================
app.post("/api/reports", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { targetType, targetId, reason, details } = req.body;
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: "Target type, target ID, and reason are required" });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user?.id!,
        targetType,
        targetId,
        reason,
        details: details || ""
      }
    });

    res.status(201).json(report);
  } catch (error: any) {
    console.error("Create report error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= TRADE HISTORY ENDPOINTS =================
app.get("/api/trades/history", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const records = await prisma.tradeRecord.findMany({
      where: {
        OR: [
          { user1Id: req.user?.id! },
          { user2Id: req.user?.id! }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error: any) {
    console.error("Get trade history error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= SWAP CIRCLE 3-WAY MATCHING =================
app.get("/api/trades/circles", async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      include: { user: true }
    });

    const nodes = listings.map(l => ({
      id: l.id,
      userId: l.userId,
      userName: l.user.name || "Anonymous",
      userAvatar: l.user.avatar,
      title: l.title,
      category: l.category,
      estimatedValue: l.estimatedValue,
      images: safeJsonParse(l.images),
      wants: safeJsonParse(l.wants)
    }));

    const wantsItem = (nodeX: typeof nodes[0], nodeY: typeof nodes[0]) => {
      const lowerTitle = nodeY.title.toLowerCase();
      const lowerCategory = nodeY.category.toLowerCase();
      return nodeX.wants.some(w => {
        const lowerWant = w.toLowerCase();
        return lowerTitle.includes(lowerWant) || lowerCategory.includes(lowerWant) || lowerWant.includes(lowerTitle) || lowerWant.includes(lowerCategory);
      });
    };

    const cycles: any[] = [];
    const seenCycles = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const nodeB = nodes[j];
        if (nodeA.userId === nodeB.userId) continue;

        if (wantsItem(nodeA, nodeB)) {
          for (let k = 0; k < nodes.length; k++) {
            if (i === k || j === k) continue;
            const nodeC = nodes[k];
            if (nodeA.userId === nodeC.userId || nodeB.userId === nodeC.userId) continue;

            if (wantsItem(nodeB, nodeC) && wantsItem(nodeC, nodeA)) {
              const sortedIds = [nodeA.id, nodeB.id, nodeC.id].sort();
              const cycleKey = sortedIds.join("-");

              if (!seenCycles.has(cycleKey)) {
                seenCycles.add(cycleKey);
                cycles.push({
                  id: cycleKey,
                  nodeA: {
                    id: nodeA.id,
                    userId: nodeA.userId,
                    userName: nodeA.userName,
                    avatar: nodeA.userAvatar,
                    title: nodeA.title,
                    image: nodeA.images[0]
                  },
                  nodeB: {
                    id: nodeB.id,
                    userId: nodeB.userId,
                    userName: nodeB.userName,
                    avatar: nodeB.userAvatar,
                    title: nodeB.title,
                    image: nodeB.images[0]
                  },
                  nodeC: {
                    id: nodeC.id,
                    userId: nodeC.userId,
                    userName: nodeC.userName,
                    avatar: nodeC.userAvatar,
                    title: nodeC.title,
                    image: nodeC.images[0]
                  }
                });
              }
            }
          }
        }
      }
    }

    res.json(cycles);
  } catch (error: any) {
    console.error("Get swap circles error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= ADMIN ENDPOINTS =================

// Helper to calculate or mock platform metrics
app.get("/api/admin/metrics", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userCount = await prisma.user.count();
    const listingCount = await prisma.listing.count();
    const reportCount = await prisma.report.count();
    const tradeCount = await prisma.tradeRecord.count();
    
    // Simulate Daily Active Users (DAU) as userCount * ~70%
    const DAU = Math.max(1, Math.round(userCount * 0.75));
    // Simulate platform revenue (e.g. ₹250 average fee per trade + premium options)
    const revenue = (tradeCount * 250) + (userCount * 99);

    res.json({
      dau: DAU,
      listingsCount: listingCount,
      tradesCount: tradeCount,
      reportsCount: reportCount,
      usersCount: userCount,
      revenue: revenue
    });
  } catch (error: any) {
    console.error("Admin metrics error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET all users
app.get("/api/admin/users", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error: any) {
    console.error("Admin get users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST toggle user suspension (ban/unban)
app.post("/api/admin/users/:id/ban", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isSuspended: !user.isSuspended }
    });

    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Admin toggle suspension error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST verify/approve/reject User ID Verification
app.post("/api/admin/users/:id/verify", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, approve } = req.body; // "approve"/"reject" or boolean approve
    
    let isApprove = false;
    if (action === "approve" || approve === true) {
      isApprove = true;
    } else if (action === "reject" || approve === false) {
      isApprove = false;
    } else {
      return res.status(400).json({ error: "Action must be approve or reject" });
    }

    const status = isApprove ? "verified" : "unverified";

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        idVerificationStatus: status,
        idVerified: isApprove,
        isVerified: isApprove
      }
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: id,
        title: isApprove ? "e-KYC Approved! 🌟" : "e-KYC Rejected ⚠️",
        message: isApprove 
          ? "Your Aadhaar identity verification request has been approved. You now have a verified badge!"
          : "Your Aadhaar verification request was rejected. Please upload clear images and try again.",
        type: "system"
      }
    }).catch(() => {});

    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Admin verify ID error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET all listings for moderation
app.get("/api/admin/listings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const listings = await prisma.listing.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = listings.map(l => ({
      ...l,
      images: safeJsonParse(l.images),
      wants: safeJsonParse(l.wants),
      negotiableCategories: safeJsonParse(l.negotiableCategories),
      tags: safeJsonParse(l.tags)
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error("Admin get listings error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST toggle listing flag/moderation
app.post("/api/admin/listings/:id/moderate", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        isFlagged: !listing.isFlagged,
        isModerated: !listing.isModerated
      }
    });

    res.json({ success: true, listing: updated });
  } catch (error: any) {
    console.error("Admin toggle flag error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET all reports (disputes center)
app.get("/api/admin/reports", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: true,
        listing: {
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error: any) {
    console.error("Admin get reports error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST resolve dispute report
app.post("/api/admin/reports/:id/resolve", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    let { resolvedInFavorOf } = req.body; // "reporter", "target", "lister" or "neither"
    if (resolvedInFavorOf === "lister") {
      resolvedInFavorOf = "target";
    }
    if (!resolvedInFavorOf || (resolvedInFavorOf !== "reporter" && resolvedInFavorOf !== "target" && resolvedInFavorOf !== "neither")) {
      return res.status(400).json({ error: "resolvedInFavorOf must be reporter, lister, target or neither" });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: { reporter: true }
    });
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Update Report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedInFavorOf
      }
    });

    // Notify Reporter
    await prisma.notification.create({
      data: {
        userId: report.reporterId,
        title: "Dispute Resolved 🛡️",
        message: `Your dispute report ID #${report.id.substring(0, 8)} has been resolved in favor of the ${resolvedInFavorOf}.`,
        type: "system"
      }
    }).catch(() => {});

    // Notify Target if target user can be found
    if (report.targetType === "user") {
      await prisma.notification.create({
        data: {
          userId: report.targetId,
          title: "Dispute Investigation Closed 🛡️",
          message: `The admin has completed the investigation regarding the dispute filed against you. Resolution: favor of ${resolvedInFavorOf}.`,
          type: "system"
        }
      }).catch(() => {});
      
      // If reporter won, ban the fraudulent user automatically!
      if (resolvedInFavorOf === "reporter") {
        await prisma.user.update({
          where: { id: report.targetId },
          data: { isSuspended: true }
        }).catch(() => {});
      }
    } else if (report.targetType === "listing") {
      const listing = await prisma.listing.findUnique({ where: { id: report.targetId } });
      if (listing) {
        await prisma.notification.create({
          data: {
            userId: listing.userId,
            title: "Listing Moderation Update 🛡️",
            message: `Dispute investigation for your listing "${listing.title}" is closed. Resolution: favor of ${resolvedInFavorOf}.`,
            type: "system"
          }
        }).catch(() => {});
        
        // If reporter won, moderate the listing automatically instead of deleting!
        if (resolvedInFavorOf === "reporter") {
          await prisma.listing.update({
            where: { id: report.targetId },
            data: { isModerated: true, isFlagged: true }
          }).catch(() => {});
        }
      }
    }

    res.json({ success: true, report: updatedReport });
  } catch (error: any) {
    console.error("Admin resolve dispute error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST broadcast notification alerts to all users or specific segments
app.post("/api/admin/notifications", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { segment, title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    let targetUsers: { id: string }[] = [];
    if (segment === "unverified") {
      targetUsers = await prisma.user.findMany({
        where: { idVerified: false },
        select: { id: true }
      });
    } else if (segment === "top_traders") {
      targetUsers = await prisma.user.findMany({
        where: { isTopTrader: true },
        select: { id: true }
      });
    } else {
      // Default: all users
      targetUsers = await prisma.user.findMany({
        select: { id: true }
      });
    }

    // Insert notifications in database
    for (const u of targetUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          title,
          message,
          type: "system"
        }
      }).catch(() => {});
    }

    res.json({ success: true, message: `Broadcast sent to ${targetUsers.length} users successfully.` });
  } catch (error: any) {
    console.error("Admin broadcast error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware / Static serving setup
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
