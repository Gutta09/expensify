import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { logger } from '../utils/logger';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

export class PlaidService {
  /**
   * Create a Link token for the frontend Plaid Link UI
   */
  static async createLinkToken(userId: string): Promise<string> {
    try {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'ExpenseIQ',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: `${process.env.CLIENT_URL}/api/plaid/webhook`,
      });
      return response.data.link_token;
    } catch (error) {
      logger.error('Plaid Link token creation failed:', error);
      throw new Error('Failed to create bank connection token');
    }
  }

  /**
   * Exchange public token for access token
   */
  static async exchangePublicToken(
    publicToken: string
  ): Promise<{ accessToken: string; itemId: string }> {
    try {
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id,
      };
    } catch (error) {
      logger.error('Plaid token exchange failed:', error);
      throw new Error('Failed to link bank account');
    }
  }

  /**
   * Get account details
   */
  static async getAccounts(accessToken: string): Promise<any[]> {
    try {
      const response = await plaidClient.accountsGet({
        access_token: accessToken,
      });
      return response.data.accounts;
    } catch (error) {
      logger.error('Plaid accounts fetch failed:', error);
      throw new Error('Failed to fetch account details');
    }
  }

  /**
   * Get transactions for a date range
   */
  static async getTransactions(
    accessToken: string,
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<any[]> {
    try {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      let allTransactions: any[] = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start,
          end_date: end,
          options: { count: 500, offset },
        });

        allTransactions = allTransactions.concat(response.data.transactions);
        hasMore = allTransactions.length < response.data.total_transactions;
        offset = allTransactions.length;
      }

      return allTransactions;
    } catch (error) {
      logger.error('Plaid transactions fetch failed:', error);
      throw new Error('Failed to fetch transactions from bank');
    }
  }

  /**
   * Remove a linked bank item
   */
  static async removeItem(accessToken: string): Promise<void> {
    try {
      await plaidClient.itemRemove({
        access_token: accessToken,
      });
    } catch (error) {
      logger.error('Plaid item removal failed:', error);
      throw new Error('Failed to unlink bank account');
    }
  }
}
