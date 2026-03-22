import { Request, Response } from "express";
import Meeting from "../models/meeting.model";
import { v4 as uuidv4 } from "uuid";

export const createMeeting = async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId;

    const meetingId = uuidv4();

    const meeting = await Meeting.create({
      meetingId,
      host: userId,
      participants: [userId]
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
    const userId = req.body.userId;

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
        if(!meeting.participants.some(id => id.toString() === userId)){
            meeting.participants.push(userId);
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

export const leaveMeeting = async (req: Request, res: Response) => {
  try{
    const userId = req.body.userId;
    const meetingId = req.body.meetingId;
    const meeting = await Meeting.findOne({ meetingId });
    if(!meeting){
      return res.status(404).json({
        message: "Meeting not found"
      });
    }
    // check if user is part of the meeting
    if(!meeting.participants.some(id => id.toString() === userId)){
      return res.status(400).json({
        message: "User is not part of the meeting"
      });
    }
    // Remove user from participants
    meeting.participants = meeting.participants.filter(id => id.toString() !== userId);
    await meeting.save();
    res.status(200).json({
      message: "Left the meeting successfully",
      meeting
    });
  }
  catch (error) {
  console.error(error);
  res.status(500).json({
    message: "Internal server error"
  });
}
};

export const endMeeting = async (req: Request, res: Response) => {
  try{
    const userId = req.body.userId;
    const meetingId = req.body.meetingId;
    const meeting = await Meeting.findOne({ meetingId });
    if(!meeting){
      return res.status(404).json({
        message: "Meeting not found"
      });
    }
    // check if user is actually host of the meeting
    if(meeting.host.toString() !== userId){
      return res.status(403).json({
        message: "Only the host can end the meeting"
      });
    }
    // End the meeting
    meeting.isActive = false;
    //remove all the participants from the meeting
    meeting.participants = [];
    await meeting.save();
    res.status(200).json({
      message: "Meeting ended successfully",
      meeting
    });
  }
  catch (error) {
  console.error(error);
  res.status(500).json({
    message: "Internal server error"
  });
}
};