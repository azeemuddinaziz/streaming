import { Request, Response } from "express";
import { ENV } from "../config/env";
import { AuthService } from "../services/auth.service";
import asyncHandler from "../utils/asyncHandler";

const authService = new AuthService();

/**
 * @class AuthController
 * @description Controller for handling authentication-related HTTP requests.
 * Bridges the gap between the HTTP interface and the AuthService.
 */
class AuthController {
  /**
   * Registers a new user.
   * @route {POST} /auth/register
   * @middleware validate(registerSchema)
   * @param {Request} req - Express request containing 'username' and 'password' in body.
   * @param {Response} res - Express response.
   * @returns {void} Returns 201 Created with user data on success.
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.register(req.body);
    res.status(201).json({ status: "success", data: user });
  });

  /**
   * Authenticates a user and establishes a session.
   * @route {POST} /auth/login
   * @middleware validate(loginSchema)
   * @param {Request} req - Express request containing 'username' and 'password' in body.
   * @param {Response} res - Express response.
   * @returns {void} Returns 200 OK with JWT in a secure cookie and response body.
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ status: "success", data: result.user });
  });
}

export { AuthController };
