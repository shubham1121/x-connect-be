// ============================================================
// X-Connect WebRTC Testing App
// A minimal peer-to-peer video call client using Socket.IO
// and the browser WebRTC API.
// ============================================================

// --- Configuration ---
const SOCKET_SERVER = "http://localhost:5000";
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

// --- DOM Elements ---
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const meetingIdInput = document.getElementById("meetingId");
const userIdInput = document.getElementById("userId");
const joinBtn = document.getElementById("joinBtn");

// --- State ---
// Map of socketId -> RTCPeerConnection (one per remote peer)
const peerConnections = {};
let localStream = null;
let socket = null;

// ============================================================
// 1. Capture local media (camera + microphone)
// ============================================================
async function getLocalStream() {
  // Try with both video and audio first, fall back to video-only, then audio-only
  const attempts = [
    { video: { width: 640, height: 480 }, audio: true },
    { video: true, audio: true },
    { video: true, audio: false },
    { video: false, audio: true },
  ];

  for (const constraints of attempts) {
    try {
      console.log("Trying getUserMedia with:", JSON.stringify(constraints));
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      localVideo.srcObject = localStream;
      console.log("Local stream acquired");
      return;
    } catch (err) {
      console.warn("getUserMedia failed with constraints:", constraints, err);
    }
  }

  // All attempts failed
  alert(
    "Could not access camera or microphone.\n\n" +
      "Make sure no other app is using the camera and that you have granted permission.",
  );
}

// ============================================================
// 2. Create a new RTCPeerConnection for a given remote socket
// ============================================================
function createPeerConnection(remoteSocketId) {
  if (peerConnections[remoteSocketId]) {
    return peerConnections[remoteSocketId];
  }
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // --- Add local tracks so the remote side receives our media ---
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  // --- ICE candidate handling ---
  // When the browser discovers a new ICE candidate, send it to
  // the remote peer via the signalling server.
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate to", remoteSocketId);
      socket.emit("ice-candidate", {
        candidate: event.candidate,
        to: remoteSocketId,
      });
    }
  };

  // --- Remote stream handling ---
  // When remote tracks arrive, attach them to the remote video element.
  pc.ontrack = (event) => {
    console.log("Received remote track from", remoteSocketId);
    // event.streams[0] contains the remote MediaStream
    remoteVideo.srcObject = event.streams[0];
  };

  // Store the connection for later use
  peerConnections[remoteSocketId] = pc;
  return pc;
}

// ============================================================
// 3. Offer flow – called for each user already in the meeting
// ============================================================
async function createAndSendOffer(remoteSocketId) {
  const pc = createPeerConnection(remoteSocketId);

  try {
    // Create an SDP offer
    const offer = await pc.createOffer();
    // Set it as our local description
    await pc.setLocalDescription(offer);

    console.log("Sending offer to", remoteSocketId);
    socket.emit("offer", {
      offer: pc.localDescription,
      to: remoteSocketId,
    });
  } catch (err) {
    console.error("Error creating offer:", err);
  }
}

// ============================================================
// 4. Answer flow – called when we receive an offer
// ============================================================
async function handleOffer(data) {
  const { offer, from } = data;
  console.log("Received offer from", from);

  const pc = createPeerConnection(from);

  try {
    // Set the received offer as the remote description
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Create an SDP answer
    const answer = await pc.createAnswer();
    // Set it as our local description
    await pc.setLocalDescription(answer);

    console.log("Sending answer to", from);
    socket.emit("answer", {
      answer: pc.localDescription,
      to: from,
    });
  } catch (err) {
    console.error("Error handling offer:", err);
  }
}

// ============================================================
// 5. Handle incoming answer
// ============================================================
async function handleAnswer(data) {
  const { answer, from } = data;
  console.log("Received answer from", from);

  const pc = peerConnections[from];
  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error("Error setting remote description:", err);
    }
  }
}

// ============================================================
// 6. Handle incoming ICE candidate
// ============================================================
async function handleIceCandidate(data) {
  const { candidate, from } = data;
  console.log("Received ICE candidate from", from);

  const pc = peerConnections[from];
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }
}

// ============================================================
// 7. Socket.IO setup & event listeners
// ============================================================
function setupSocket(meetingId, userId) {
  socket = io(SOCKET_SERVER);

  socket.on("connect", () => {
    console.log("Connected to signalling server, socketId:", socket.id);
    console.log("Emitting join-meeting", { meetingId, userId });
    socket.emit("join-meeting", { meetingId, userId });
  });

  // --- "existing-users" ---
  // Fired after we join a meeting. Contains the list of socket IDs
  // that are already in the room. We initiate an offer to each one.
  socket.on("existing-users", (users) => {
    console.log("Existing users in meeting:", users);
    users.forEach((socketId) => {
      if (socketId !== socket.id) {
        createAndSendOffer(socketId);
      }
    });
  });

  // --- "user-joined" ---
  // Fired when a new user joins the meeting after us.
  // We don't need to do anything here because the new user will
  // send us an offer (they receive us in their "existing-users" list).
  socket.on("user-joined", (data) => {
    console.log("User joined:", data);
  });

  // --- Signalling events ---
  socket.on("offer", handleOffer);
  socket.on("answer", handleAnswer);
  socket.on("ice-candidate", handleIceCandidate);

  socket.on("disconnect", () => {
    console.log("Disconnected from signalling server");
  });
}

// ============================================================
// 8. Join Meeting button handler
// ============================================================
joinBtn.addEventListener("click", async () => {
  const meetingId = meetingIdInput.value.trim();
  const userId = userIdInput.value.trim();

  if (!meetingId || !userId) {
    alert("Please enter both Meeting ID and User ID.");
    return;
  }

  // Capture local camera/mic first
  await getLocalStream();
  if (!localStream) return; // bail if no media

  // Connect to the socket server and set up listeners
  setupSocket(meetingId, userId);

  // Disable the button to prevent duplicate joins
  joinBtn.disabled = true;
  joinBtn.textContent = "Joined";
});
