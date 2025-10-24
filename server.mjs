import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// ---------- Plaid Link Token ----------
app.get("/api/create-link-token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "unique_user_id" },
      client_name: "Monarch & Vael Finance",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("❌ Link token error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Plaid Public Token Exchange ----------
app.post("/api/exchange-public-token", async (req, res) => {
  try {
    const { publicToken } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    res.json({ access_token: response.data.access_token });
  } catch (error) {
    console.error("❌ Exchange token error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Plaid Transactions ----------
app.get("/api/plaid/transactions", async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: thirtyDaysAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });

    const transactions = response.data.transactions.map((tx) => ({
      name: tx.name,
      amount: tx.amount,
      date: tx.date,
      category: tx.category || [],
    }));

    res.json(transactions);
  } catch (error) {
    console.error("❌ Plaid transactions error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- NEW: Plaid Accounts ----------
app.get("/api/plaid/accounts", async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });

    const response = await plaidClient.accountsGet({ access_token: accessToken });
    const accounts = response.data.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      balance: a.balances.current || 0,
      mask: a.mask || "",
    }));

    res.json(accounts);
  } catch (error) {
    console.error("❌ Plaid accounts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Per-user App Data ----------
import fs from "fs";
const DATA_FILE = "./userData.json";

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.post("/api/userData", (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const data = loadData();
    data[userId] = req.body;
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Save userData error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/userData", (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const data = loadData();
    res.json(data[userId] || {});
  } catch (error) {
    console.error("❌ Get userData error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
