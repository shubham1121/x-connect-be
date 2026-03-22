import { Server } from "socket.io";

let io: Server;

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id);

    // Join meeting room
    socket.on("join-meeting", ({ meetingId, userId }) => {
      socket.join(meetingId);

      console.log(`User ${userId} joined meeting ${meetingId}`);

      // Notify others
      socket.to(meetingId).emit("user-joined", {
        userId,
      });
    });

    // Leave meeting
    socket.on("leave-meeting", ({ meetingId, userId }) => {
      socket.leave(meetingId);

      socket.to(meetingId).emit("user-left", {
        userId,
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket not initialized");
  }
  return io;
};
