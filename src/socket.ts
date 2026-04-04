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

      // 🔥 Get all users in room
      const users = Array.from(
        io.sockets.adapter.rooms.get(meetingId) || [],
      ).filter((id) => id !== socket.id);

      // 🔥 Send existing users to NEW user
      socket.emit("existing-users", users);

      // 🔥 Notify others
      socket.to(meetingId).emit("user-joined", {
        userId,
        socketId: socket.id,
      });
    });

    socket.on("offer", ({ offer, to }) => {
      console.log("📡 Offer from", socket.id, "to", to);

      socket.to(to).emit("offer", {
        offer,
        from: socket.id,
      });
    });

    socket.on("answer", ({ answer, to }) => {
      console.log("📡 Answer from", socket.id, "to", to);

      socket.to(to).emit("answer", {
        answer,
        from: socket.id,
      });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
      console.log("📡 ICE candidate from", socket.id, "to", to);

      socket.to(to).emit("ice-candidate", {
        candidate,
        from: socket.id,
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
