import { Router, Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { User, UserRole } from '../models';
import { authenticate } from '../middleware/auth';
import { registerValidator, loginValidator } from '../middleware/validators';
import { logger } from '../utils/logger';

const router = Router();

// Helper to generate tokens
const generateTokens = (userId: string, role: UserRole, email: string) => {
  const accessOpts: SignOptions = { expiresIn: '15m' };
  const refreshOpts: SignOptions = { expiresIn: '7d' };

  const accessToken = jwt.sign(
    { userId, role, email },
    process.env.JWT_SECRET || 'secret',
    accessOpts
  );
  const refreshToken = jwt.sign(
    { userId, role, email },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    refreshOpts
  );
  return { accessToken, refreshToken };
};

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', registerValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: UserRole.USER,
    });
    await user.save();

    const tokens = generateTokens(
      user._id.toString(),
      user.role,
      user.email
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
router.post('/login', loginValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account has been deactivated.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const tokens = generateTokens(
      user._id.toString(),
      user.role,
      user.email
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        preferences: user.preferences,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required.' });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    ) as { userId: string; role: UserRole; email: string };

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid refresh token.' });
      return;
    }

    const tokens = generateTokens(
      user._id.toString(),
      user.role,
      user.email
    );

    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user!._id,
      email: req.user!.email,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      role: req.user!.role,
      preferences: req.user!.preferences,
      mlProfile: req.user!.mlProfile,
      linkedAccounts: req.user!.linkedAccounts?.map((a) => ({
        institutionName: a.institutionName,
        accountIds: a.accountIds,
        lastSynced: a.lastSynced,
      })),
      createdAt: req.user!.createdAt,
    },
  });
});

/**
 * PUT /api/auth/preferences
 * Update user preferences
 */
router.put('/preferences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currency, timezone, notificationsEnabled, anomalyAlertThreshold, budgetAlertPercent } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (currency) user.preferences.currency = currency;
    if (timezone) user.preferences.timezone = timezone;
    if (typeof notificationsEnabled === 'boolean')
      user.preferences.notificationsEnabled = notificationsEnabled;
    if (anomalyAlertThreshold !== undefined)
      user.preferences.anomalyAlertThreshold = anomalyAlertThreshold;
    if (budgetAlertPercent !== undefined)
      user.preferences.budgetAlertPercent = budgetAlertPercent;

    await user.save();
    res.json({ message: 'Preferences updated', preferences: user.preferences });
  } catch (error) {
    next(error);
  }
});

export default router;
