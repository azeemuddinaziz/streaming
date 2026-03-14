// /middlewares/validate.middleware.ts
import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from "zod";

export const validate = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // We parse the request components against the schema
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Optional: Replace req objects with validated data
      // This strips out any extra fields the user tried to sneak in
      req.body = validatedData.body;
      if (validatedData.query) {
        Object.assign(req.query, validatedData.query);
      }
      if (validatedData.params) {
        Object.assign(req.params, validatedData.params);
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        req.wideEvent.payload = {
          validation_failed: true,
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            code: i.code,
          })),
        };

        // Format the Zod error into something readable for the client
        return res.status(400).json({
          status: "fail",
          errors: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      return next(error);
    }
  };
};
