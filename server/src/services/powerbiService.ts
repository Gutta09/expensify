import axios from 'axios';
import { Transaction, UserRole } from '../models';
import { logger } from '../utils/logger';

const POWERBI_API_BASE = 'https://api.powerbi.com/v1.0/myorg';

interface EmbedConfig {
  embedUrl: string;
  token: string;
  reportId: string;
  expiry: string;
}

interface Report {
  id: string;
  name: string;
  description: string;
  embedUrl: string;
}

export class PowerBIService {
  private static accessToken: string | null = null;
  private static tokenExpiry: Date | null = null;

  /**
   * Get Azure AD access token for Power BI API calls
   * Uses service principal (client credentials) flow
   */
  private static async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const tenantId = process.env.POWERBI_TENANT_ID;
      const response = await axios.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.POWERBI_CLIENT_ID || '',
          client_secret: process.env.POWERBI_CLIENT_SECRET || '',
          scope: 'https://analysis.windows.net/powerbi/api/.default',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
      return this.accessToken!;
    } catch (error) {
      logger.error('Power BI authentication failed:', error);
      throw new Error('Failed to authenticate with Power BI');
    }
  }

  /**
   * Generate an embed token for a Power BI report
   * Includes Row-Level Security (RLS) to scope data to the user
   */
  static async getEmbedToken(
    userId: string,
    userEmail: string,
    userRole: UserRole,
    reportId?: string
  ): Promise<EmbedConfig> {
    try {
      const token = await this.getAccessToken();
      const workspaceId = process.env.POWERBI_WORKSPACE_ID;
      const targetReportId = reportId || process.env.POWERBI_REPORT_ID;

      // Get report details
      const reportResponse = await axios.get(
        `${POWERBI_API_BASE}/groups/${workspaceId}/reports/${targetReportId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const report = reportResponse.data;

      // Generate embed token with RLS
      const embedBody: any = {
        accessLevel: 'View',
        allowSaveAs: false,
        datasets: [{ id: report.datasetId }],
        reports: [{ id: targetReportId }],
      };

      // Apply Row-Level Security based on user role
      if (userRole === UserRole.USER) {
        embedBody.identities = [
          {
            username: userEmail,
            roles: ['UserScope'],
            datasets: [report.datasetId],
          },
        ];
      } else if (userRole === UserRole.ANALYST) {
        embedBody.identities = [
          {
            username: userEmail,
            roles: ['AnalystScope'],
            datasets: [report.datasetId],
          },
        ];
      }
      // Admin gets full access (no RLS identity)

      const embedResponse = await axios.post(
        `${POWERBI_API_BASE}/groups/${workspaceId}/reports/${targetReportId}/GenerateToken`,
        embedBody,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return {
        embedUrl: report.embedUrl,
        token: embedResponse.data.token,
        reportId: targetReportId!,
        expiry: embedResponse.data.expiration,
      };
    } catch (error) {
      logger.error('Power BI embed token generation failed:', error);
      throw new Error('Failed to generate dashboard token');
    }
  }

  /**
   * List available reports based on user role
   */
  static async listReports(userRole: UserRole): Promise<Report[]> {
    try {
      const token = await this.getAccessToken();
      const workspaceId = process.env.POWERBI_WORKSPACE_ID;

      const response = await axios.get(
        `${POWERBI_API_BASE}/groups/${workspaceId}/reports`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const allReports = response.data.value;

      // Filter reports based on role
      const roleReportMap: Record<string, string[]> = {
        admin: ['spending-forecast', 'trend-analysis', 'budget-variance', 'anomaly-alerts', 'ai-insights', 'platform-overview'],
        analyst: ['spending-forecast', 'trend-analysis', 'budget-variance', 'anomaly-alerts', 'ai-insights'],
        user: ['spending-forecast', 'trend-analysis', 'budget-variance', 'anomaly-alerts'],
      };

      const allowedPrefixes = roleReportMap[userRole] || roleReportMap.user;

      return allReports
        .filter((r: any) => allowedPrefixes.some((prefix) => r.name.toLowerCase().includes(prefix)))
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          embedUrl: r.embedUrl,
        }));
    } catch (error) {
      logger.error('Power BI reports list failed:', error);
      throw new Error('Failed to fetch reports');
    }
  }

  /**
   * Trigger a dataset refresh
   */
  static async refreshDataset(): Promise<void> {
    try {
      const token = await this.getAccessToken();
      const workspaceId = process.env.POWERBI_WORKSPACE_ID;
      const datasetId = process.env.POWERBI_DATASET_ID;

      await axios.post(
        `${POWERBI_API_BASE}/groups/${workspaceId}/datasets/${datasetId}/refreshes`,
        { notifyOption: 'NoNotification' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logger.info('Power BI dataset refresh triggered');
    } catch (error) {
      logger.error('Power BI dataset refresh failed:', error);
      throw new Error('Failed to refresh dataset');
    }
  }

  /**
   * Push transaction data to Power BI Push Dataset
   */
  static async pushTransactionData(): Promise<{ rowCount: number }> {
    try {
      const token = await this.getAccessToken();
      const workspaceId = process.env.POWERBI_WORKSPACE_ID;
      const datasetId = process.env.POWERBI_DATASET_ID;

      // Get recent transactions for push
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const transactions = await Transaction.find({
        updatedAt: { $gte: oneDayAgo },
      })
        .populate('userId', 'email firstName lastName')
        .limit(10000);

      if (transactions.length === 0) {
        return { rowCount: 0 };
      }

      // Format for Power BI
      const rows = transactions.map((t) => ({
        TransactionId: t._id.toString(),
        UserId: t.userId.toString(),
        Date: t.date.toISOString(),
        Amount: t.amount,
        Type: t.type,
        Category: t.category,
        Merchant: t.merchant,
        IsAnomaly: t.isAnomaly,
        AnomalyScore: t.anomalyScore,
        Sentiment: t.sentiment || 'discretionary',
        Currency: t.currency,
      }));

      // Push in batches of 10000
      for (let i = 0; i < rows.length; i += 10000) {
        const batch = rows.slice(i, i + 10000);
        await axios.post(
          `${POWERBI_API_BASE}/groups/${workspaceId}/datasets/${datasetId}/tables/Transactions/rows`,
          { rows: batch },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      logger.info(`Pushed ${rows.length} rows to Power BI`);
      return { rowCount: rows.length };
    } catch (error) {
      logger.error('Power BI data push failed:', error);
      throw new Error('Failed to push data to Power BI');
    }
  }
}
