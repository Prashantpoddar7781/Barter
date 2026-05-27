import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "barterhub-secret-key-2026";

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json());

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

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
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

// POST /api/auth/send-passcode - Generate and save a 6-digit passcode
app.post("/api/auth/send-passcode", async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ error: "Email or phone number is required" });
    }

    const cleanInput = String(emailOrPhone).trim().toLowerCase();
    
    // Generate code (accept 123456 or generate random code)
    const code = "123456"; // Fixed code for sandbox ease, but we save it in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.passcode.upsert({
      where: { emailOrPhone: cleanInput },
      update: { code, expiresAt },
      create: { emailOrPhone: cleanInput, code, expiresAt }
    });

    console.log(`[PASSCODE] Sent passcode ${code} to ${cleanInput}`);
    res.json({ success: true, message: "Verification passcode sent successfully." });
  } catch (error: any) {
    console.error("Send passcode error:", error);
    res.status(500).json({ error: error.message });
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

    if (!passcodeRecord || passcodeRecord.code !== String(code) || passcodeRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired passcode. Try 123456." });
    }

    // Passcode valid, delete it
    await prisma.passcode.delete({
      where: { emailOrPhone: cleanInput }
    }).catch(() => {});

    // Find or create User
    let user = await prisma.user.findUnique({
      where: { emailOrPhone: cleanInput }
    });

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

// POST /api/auth/onboarding - Complete profile setup
app.post("/api/auth/onboarding", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, avatar, location, interests } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: "Name and location are required" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user?.id },
      data: {
        name: name.trim(),
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        location: location.trim(),
        interests: interests || [],
        isOnboardingCompleted: true
      }
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
        idVerificationStatus: "verified", // auto-approve for simulated mockup verification
        idVerified: true
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

      // Refetch
      listings = await prisma.listing.findMany({
        orderBy: { createdAt: 'desc' }
      });
    }

    // Convert fields from Prisma JSON to plain JS arrays
    const formattedListings = listings.map(l => ({
      ...l,
      images: typeof l.images === 'string' ? JSON.parse(l.images) : l.images,
      wants: typeof l.wants === 'string' ? JSON.parse(l.wants) : l.wants,
      negotiableCategories: typeof l.negotiableCategories === 'string' ? JSON.parse(l.negotiableCategories) : l.negotiableCategories,
      tags: typeof l.tags === 'string' ? JSON.parse(l.tags) : l.tags
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

    const listing = await prisma.listing.create({
      data: {
        userId: req.user?.id!,
        title,
        description: description || `Exchange offer of ${title}`,
        images: images, // Prisma takes JSON directly
        category,
        condition: condition || (isService ? "Professional Skill" : "Excellent condition"),
        estimatedValue: Number(estimatedValue),
        location: location || "Surat, Gujarat",
        distance: distance || "0.1km away",
        wants: wants || ["Open to negotiate"],
        openToNegotiate: !!openToNegotiate,
        negotiableCategories: negotiableCategories || [],
        tags: tags || [],
        isService: !!isService
      }
    });

    res.status(201).json(listing);
  } catch (error: any) {
    console.error("Create listing error:", error);
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

    const message = await prisma.message.create({
      data: {
        senderId: req.user?.id!,
        receiverId,
        listingId: listingId || null,
        text,
        timestamp: Number(Date.now())
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
