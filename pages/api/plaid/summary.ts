import type { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments.production,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
    },
  })
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { accessToken } = req.query;
    if (!accessToken || typeof accessToken !== 'string')
      return res.status(400).json({ error: 'Missing accessToken' });

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: weekAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });

    const txs = response.data.transactions;
    const today = new Date().toDateString();

    const todayTotal = txs
      .filter(t => new Date(t.date).toDateString() === today)
      .reduce((sum, t) => sum + t.amount, 0);

    const weekTotal = txs.reduce((sum, t) => sum + t.amount, 0);

    return res.status(200).json({ todayTotal: -todayTotal, weekTotal: -weekTotal });
  } catch (err: any) {
    console.error('Plaid summary error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
