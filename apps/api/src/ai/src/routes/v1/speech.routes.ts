import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { pythonCore } from "../../lib/python-core.js";
import { AppError } from "../../errors.js";

export const speechRouter = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

speechRouter.post(
  "/transcribe",
  upload.single("audio_file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;
      if (!file) {
        throw new AppError("No file uploaded", 400);
      }

      const result = await pythonCore.transcribeAudio(
        file.buffer,
        file.mimetype || "audio/webm",
        file.originalname || "recording.webm"
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
