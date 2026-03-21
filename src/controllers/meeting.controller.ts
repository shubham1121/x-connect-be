import { Request, Response } from "express";
import Meeting from "../models/meeting.model";
import { v4 as uuidv4 } from "uuid";

export const createMeeting = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const meetingId = uuidv4();

    const meeting = await Meeting.create({
      meetingId,
      host: user.userId,
      participants: [user.userId]
    });

    res.status(201).json({
      message: "Meeting created",
      meeting
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};

export const joinMeeting = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const meetingId = req.body.meetingId;

    const meeting = await Meeting.findOne({ meetingId});

    if(!meeting){
      return res.status(404).json({
        message: "Meeting not found"
      });
    }
    else if(!meeting.isActive){
      return res.status(400).json({
        message: "Meeting has ended!"
      });
    }
    else{
        // Add user to participants if not already in the list
        if(!meeting.participants.some(id => id.toString() === user.userId)){
            meeting.participants.push(user.userId);
            await meeting.save();
        }
    }
    res.status(201).json({
      message: "Meeting joined",
      meeting
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};