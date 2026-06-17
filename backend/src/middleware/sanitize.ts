import { Request, Response, NextFunction } from 'express';

export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const clean = (val: any): any => {
    if (typeof val === 'string') {
      // Strips out any HTML tags to harden against cross-site scripting
      return val.replace(/<[^>]*>/g, '');
    }
    if (Array.isArray(val)) {
      return val.map(clean);
    }
    if (val !== null && typeof val === 'object') {
      const result: any = {};
      for (const k in val) {
        result[k] = clean(val[k]);
      }
      return result;
    }
    return val;
  };

  req.body = clean(req.body);
  req.query = clean(req.query);
  req.params = clean(req.params);
  next();
}
