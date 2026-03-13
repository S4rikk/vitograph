import { Router } from "express";
import { pythonCore } from "../../lib/python-core.js";

/**
 * Profiles Router — Proxies profile-related requests to the Python backend.
 */
export const profilesRouter = Router();

// GET /api/v1/profiles/:userId
profilesRouter.get("/:userId", async (req, res, next) => {
  try {
    const response = await pythonCore.request(`/api/v1/profiles/${req.params.userId}`, {
      method: "GET",
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/profiles/:userId
profilesRouter.patch("/:userId", async (req, res, next) => {
  try {
    const response = await pythonCore.request(`/api/v1/profiles/${req.params.userId}`, {
      method: "PATCH",
      body: JSON.stringify(req.body),
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/profiles
profilesRouter.post("/", async (req, res, next) => {
  try {
    const response = await pythonCore.request("/api/v1/profiles", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});
