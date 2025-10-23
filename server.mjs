import express from "express";
import dotenv from "dotenv";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import sendgrid from "@sendgrid/mail";
import cors from "cors";
import fs from "fs/promises";
import path from "path";

dotenv.config();

sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// ---------- simple JSON "DB" for per-user app data ----------
const DATA_DIR = path.resolve("data");
const DATA_FILE = path.join(DATA_DIR, "userdata.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({}), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const buf = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(buf || "{}");
}

async function writeStore(obj) {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}

// ---------- SendGrid ----------
app.post("/send-email", async (req, res) => {
  const { to, subject, message } = req.body;
  console.log("📩 Email request received:", req.body);

  try {
    await sendgrid.send({
      to,
      from: "monarchandvael@gmail.com",
      subject,
      text: message,
    });
    res.status(200).send("Email sent successfully ✅");
  } catch (error) {
    console.error("❌ SendGrid error:", error);
    res.status(500).send("Email failed ❌");
  }
});

// ---------- Plaid ----------
const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(config);

app.get("/api/create-link-token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "user-001" },
      client_name: "Monarch & Vael Finance",
      products: ["transactions"],
      language: "en",
      country_codes: ["US"],
    });
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Plaid link token failed" });
  }
});

app.get("/api/plaid/summary", async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: weekAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });

    const txs = response.data.transactions;
    const today = new Date().toDateString();

    const todayTotal = txs
      .filter((t) => new Date(t.date).toDateString() === today)
      .reduce((sum, t) => sum + t.amount, 0);

    const weekTotal = txs.reduce((sum, t) => sum + t.amount, 0);

    res.json({ todayTotal: -todayTotal, weekTotal: -weekTotal });
  } catch (error) {
    console.error("❌ Plaid summary error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/plaid/transactions", async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });

    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: monthAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });

    const txs = response.data.transactions.map((t) => ({
      name: t.name,
      amount: t.amount,
      date: t.date,
      category: t.category || [],
    }));

    res.json(txs);
  } catch (error) {
    console.error("❌ Plaid transactions error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- NEW: Per-user App Data (accounts, cards, events, settings) ----------
app.get("/api/userData", async (req, res) => {
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const store = await readStore();
  const data = store[userId] || { accounts: [], cards: [], events: [], settings: {} };
  return res.json(data);
});

app.post("/api/userData", async (req, res) => {
  const { userId, accounts = [], cards = [], events = [], settings = {} } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const store = await readStore();
  store[userId] = { accounts, cards, events, settings };
  await writeStore(store);

  return res.json({ success: true });
});

// ---------- Start ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
