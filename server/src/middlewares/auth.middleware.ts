// /middlewares/auth.middleware.ts
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import asyncHandler from "../utils/asyncHandler";

/**
 * Higher-order middleware to validate request data against a Zod schema.
 * - Strips unknown fields not defined in the schema.
 * - Forwards Zod errors formatted as a 400 JSON response.
 * * @param schema - The Zod schema to validate the body, params, and query.
 */
const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // 1. Check Cookies OR Authorization Header
    if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "You are not logged in" });
    }

    // 2. Verify Token
    const decoded = jwt.verify(token, ENV.JWT_SECRET!) as unknown as {
      id: string;
    };

    // 3. Attach User ID to the request
    req.user = { id: decoded.id };

    req.wideEvent.identity = {
      user_id: decoded.id,
      type: "registered_user",
      source: req.cookies?.token ? "cookie" : "bearer_token",
    };

    next();
  },
);

export { protect };
