import { body, query, param } from 'express-validator';

// ─── Auth Validators ─────────────────────────────────────────
export const registerValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
];

export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Transaction Validators ──────────────────────────────────
export const createTransactionValidator = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('type')
    .isIn(['expense', 'income', 'transfer'])
    .withMessage('Type must be expense, income, or transfer'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('merchant').optional({ values: 'falsy' }).trim(),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
];

export const transactionQueryValidator = [
  query('startDate').optional().isISO8601().withMessage('Valid start date required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date required'),
  query('category').optional().isString(),
  query('type').optional().isIn(['expense', 'income', 'transfer']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
];

// ─── Budget Validators ───────────────────────────────────────
export const createBudgetValidator = [
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('period')
    .isIn(['weekly', 'monthly', 'quarterly', 'annual'])
    .withMessage('Valid period is required'),
  body('limitAmount').isFloat({ gt: 0 }).withMessage('Limit must be a positive number'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
];

// ─── Common Validators ───────────────────────────────────────
export const mongoIdValidator = [
  param('id').isMongoId().withMessage('Invalid resource ID'),
];
