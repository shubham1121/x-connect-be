import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.emit("join-meeting", {
    meetingId: "test-meeting",
    userId: "user-1"
  });
});

socket.on("user-joined", (data) => {
  console.log("User joined:", data);
});

socket.on("user-left", (data) => {
  console.log("User left:", data);
});