import { AppError } from '../utils/AppError.js';

export function validate(schemas) {
  return (req, _res, next) => {
    const issues = [];

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const parsed = schema.safeParse(req[part]);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({
            location: part,
            field: issue.path.join('.') || part,
            code: issue.code,
            message: issue.message,
          });
        }
      } else {
        req[part] = parsed.data;
      }
    }

    if (issues.length > 0) {
      return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', issues));
    }

    return next();
  };
}

