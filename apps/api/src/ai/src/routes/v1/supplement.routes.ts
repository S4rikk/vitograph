import { Router } from "express";
import { supplementController } from "../../supplement/supplement.controller.js";

const supplementRouter = Router();

// /api/v1/supplements/...
supplementRouter.get("/today", supplementController.getTodaySupplements.bind(supplementController));
supplementRouter.post("/log", supplementController.logSupplement.bind(supplementController));

export { supplementRouter };
