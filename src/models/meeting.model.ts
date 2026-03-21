import mongoose, { Schema, Document } from "mongoose";

export interface IMeeting extends Document {
  meetingId: string;
  host: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
}

const MeetingSchema = new Schema<IMeeting>({
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Meeting = mongoose.model<IMeeting>("Meeting", MeetingSchema);

export default Meeting;