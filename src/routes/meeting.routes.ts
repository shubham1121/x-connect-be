import { Router } from "express";
import { createMeeting, joinMeeting, leaveMeeting, endMeeting } from "../controllers/meeting.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/create", protect, createMeeting);
router.post("/join", protect, joinMeeting);
router.post("/leave", protect, leaveMeeting);
router.post("/end", protect, endMeeting);

export default router;