import { Router, Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require admin access
router.use(authenticate);

/**
 * GET /api/users
 * List all users (Admin only)
 */
router.get('/', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const query: any = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * Get specific user (Admin only)
 */
router.get('/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:id/role
 * Change user role (Admin only)
 */
router.put('/:id/role', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({ error: 'Invalid role. Must be: admin, analyst, or user' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'Role updated', user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:id/deactivate
 * Deactivate a user (Admin only)
 */
router.put('/:id/deactivate', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.userId) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'User deactivated', user });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/stats/overview
 * Get platform statistics (Admin only)
 */
router.get('/stats/overview', authorize(UserRole.ADMIN), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const roleDistribution = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const recentSignups = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({
      totalUsers,
      activeUsers,
      roleDistribution,
      recentSignups,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
