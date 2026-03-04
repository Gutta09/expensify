import { Request, Response } from 'express';

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({
    error: `Route not found: ${_req.method} ${_req.originalUrl}`,
  });
};
