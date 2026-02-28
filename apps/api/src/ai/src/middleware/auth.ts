import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../errors.js";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

let supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase credentials in environment variables");
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Missing authorization header", 401);
    }

    const token = authHeader.split(" ")[1];
    const client = getSupabase();

    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      throw new AppError("Invalid or expired token", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
