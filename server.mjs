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

// ✅ Start Server
app.listen(8000, () => console.log("✅ Server running on http://localhost:8000"));
