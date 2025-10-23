import express from "express";
import dotenv from "dotenv";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import sendgrid from "@sendgrid/mail";
import cors from "cors";

dotenv.config();

sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// ✅ SendGrid Email Route
app.post("/send-email", async (req, res) => {
  const { to, subject, message } = req.body;
  console.log("📩 Email request received:", req.body);

  try {
    await sendgrid.send({
      to,
      from: "monarchandvael@gmail.com", // <-- replace with your verified sender
      subject,
      text: message,
    });
    res.status(200).send("Email sent successfully ✅");
  } catch (error) {
    console.error("❌ SendGrid error:", error);
    res.status(500).send("Email failed ❌");
  }
});

// ✅ Plaid Config
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

// ✅ Plaid Routes
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
// ✅ Plaid Summary Route
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
      .filter(t => new Date(t.date).toDateString() === today)
      .reduce((sum, t) => sum + t.amount, 0);

    const weekTotal = txs.reduce((sum, t) => sum + t.amount, 0);

    res.json({ todayTotal: -todayTotal, weekTotal: -weekTotal });
  } catch (error) {
    console.error("❌ Plaid summary error:", error);
    res.status(500).json({ error: error.message });
  }
});
// ✅ Temporary App Review Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "appleuser@gmail.com" && password === "applejacks") {
  console.log("✅ Apple review bypass used for", email);
  return res.json({ ok: true, token: "review-bypass-token" });
}


  // Normal login (requires security code)
  res.status(401).json({ error: "Security code required" });
});

// ✅ Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
