import { Router } from "express";
import { createMeeting, joinMeeting } from "../controllers/meeting.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/create", protect, createMeeting);
router.post("/join", protect, joinMeeting);

export default router;