import { Router } from "express";
import { pythonCore } from "../../lib/python-core.js";

/**
 * Users Router — Proxies user-related requests (like feedback) to the Python backend.
 */
export const usersRouter = Router();

// POST /api/v1/users/me/feedback
usersRouter.post("/me/feedback", async (req, res, next) => {
  try {
    const response = await pythonCore.request("/api/v1/users/me/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify(req.body),
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});
