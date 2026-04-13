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
const leaveBtn = document.getElementById("leaveBtn");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const screenBtn = document.getElementById("screenBtn");

// --- State ---
// Map of socketId -> RTCPeerConnection (one per remote peer)
const peerConnections = {};
let localStream = null;
let socket = null;
let isMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let screenStream = null;
let screenTrack = null;

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

  // --- Add screen share track if currently sharing ---
  if (isScreenSharing && screenTrack && screenStream) {
    pc.addTrack(screenTrack, screenStream);
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
  console.log("Track received from", remoteSocketId);

  const stream = event.streams[0];
  let cameraVideo = document.getElementById(remoteSocketId + "-camera");

  if (!cameraVideo) {
    // First stream from this peer → camera
    cameraVideo = document.createElement("video");
    cameraVideo.id = remoteSocketId + "-camera";
    cameraVideo.autoplay = true;
    cameraVideo.playsInline = true;
    cameraVideo.style.width = "200px";
    document.getElementById("remoteVideos").appendChild(cameraVideo);
    cameraVideo.srcObject = stream;
  } else if (cameraVideo.srcObject && cameraVideo.srcObject.id === stream.id) {
    // Same stream as camera (e.g. audio track added to existing stream)
    // Nothing to do – existing video element handles it
  } else {
    // Different stream → screen share
    showScreenShare(remoteSocketId, stream, event.track);
  }
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

    // If we're currently sharing screen, the screen track wasn't part of
    // the incoming offer so it wasn't negotiated in the answer.
    // Send a new offer to renegotiate and include the screen track.
    if (isScreenSharing && screenTrack && screenStream) {
      const reoffer = await pc.createOffer();
      await pc.setLocalDescription(reoffer);
      socket.emit("offer", { offer: pc.localDescription, to: from });
    }
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

  socket.on("user-left", ({ userId, socketId }) => {
    console.log("User left:", socketId);

    const pc = peerConnections[socketId];
    if (pc) {
      pc.close();
      delete peerConnections[socketId];
    }

    // 🔥 Remove camera video element
    const video = document.getElementById(socketId + "-camera");
    if (video) {
      video.srcObject = null;
      video.remove();
    }

    // 🔥 Remove screen share if any
    removeScreenShare(socketId);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from signalling server");
  });
}

function leaveMeeting() {
  if (!socket) return;

  const meetingId = meetingIdInput.value.trim();
  const userId = userIdInput.value.trim();

  // 🔥 Notify backend
  socket.emit("leave-meeting", { meetingId, userId });

  // 🔥 Close all peer connections
  Object.keys(peerConnections).forEach((socketId) => {
    const pc = peerConnections[socketId];
    if (pc) {
      pc.close();
      delete peerConnections[socketId];
    }
  });

  // 🔥 Remove ALL remote videos
  const remoteContainer = document.getElementById("remoteVideos");
  if (remoteContainer) {
    remoteContainer.innerHTML = "";
  }

  // 🔥 Remove ALL screen shares
  const screensContainer = document.getElementById("remoteScreens");
  if (screensContainer) {
    screensContainer.innerHTML = "";
  }
  document.getElementById("screenShareContainer").style.display = "none";

  // 🔥 Stop screen sharing if active
  if (isScreenSharing) {
    stopScreenShare();
  }

  // 🔥 Stop local media
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  // 🔥 Clear local video
  if (localVideo) {
    localVideo.srcObject = null;
  }

  // 🔥 Disconnect socket
  socket.disconnect();

  console.log("Left meeting completely");
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

leaveBtn.addEventListener("click", () => {
  leaveMeeting();
});

muteBtn.addEventListener("click", () => {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;

  isMuted = !isMuted;
  audioTrack.enabled = !isMuted;

  muteBtn.textContent = isMuted ? "Unmute" : "Mute";

  console.log("Audio enabled:", audioTrack.enabled);
});

videoBtn.addEventListener("click", () => {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  isVideoOff = !isVideoOff;
  videoTrack.enabled = !isVideoOff;

  videoBtn.textContent = isVideoOff ? "Turn Camera On" : "Turn Camera Off";

  console.log("Video enabled:", videoTrack.enabled);
});

screenBtn.addEventListener("click", async () => {
  if (!isScreenSharing) {
    await startScreenShare();
  } else {
    await stopScreenShare();
  }
});

// ============================================================
// Screen Share DOM helpers
// ============================================================
function showScreenShare(peerId, stream, track) {
  const container = document.getElementById("screenShareContainer");
  container.style.display = "block";

  let screenVideo = document.getElementById(peerId + "-screen");
  if (!screenVideo) {
    screenVideo = document.createElement("video");
    screenVideo.id = peerId + "-screen";
    screenVideo.autoplay = true;
    screenVideo.playsInline = true;
    document.getElementById("remoteScreens").appendChild(screenVideo);
  }
  screenVideo.srcObject = stream;

  // Auto-remove when the track ends (remote stops sharing)
  if (track) {
    track.onended = () => removeScreenShare(peerId);
    track.onmute = () => removeScreenShare(peerId);
  }
}

function removeScreenShare(peerId) {
  const screenVideo = document.getElementById(peerId + "-screen");
  if (screenVideo) {
    screenVideo.srcObject = null;
    screenVideo.remove();
  }

  // Hide container if no more screen shares
  const screens = document.getElementById("remoteScreens");
  if (screens && screens.children.length === 0) {
    document.getElementById("screenShareContainer").style.display = "none";
  }
}

async function startScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    screenTrack = screenStream.getVideoTracks()[0];

    // 🔥 Add track in ALL peer connections and renegotiate
    for (const [socketId, pc] of Object.entries(peerConnections)) {
      pc.addTrack(screenTrack, screenStream);

      // Renegotiate so the remote side receives the new track
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { offer: pc.localDescription, to: socketId });
    }

    // 🔥 Show local screen share in the screen share container
    showScreenShare("local", screenStream, null);

    isScreenSharing = true;
    screenBtn.textContent = "Stop Sharing";

    // 🔥 When user clicks "Stop sharing" from browser UI
    screenTrack.onended = () => {
      stopScreenShare();
    };

  } catch (err) {
    console.error("Screen share error:", err);
  }
}

async function stopScreenShare() {
  if (!screenStream) return;

  for (const [socketId, pc] of Object.entries(peerConnections)) {

    // 🔥 Find sender that is sending screen
    const sender = pc.getSenders().find(
      (s) => s.track === screenTrack
    );

    if (sender) {
      pc.removeTrack(sender); // 🔥 remove ONLY screen
    }

    // Renegotiate so the remote side drops the screen track
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { offer: pc.localDescription, to: socketId });
  }

  // 🔥 Stop screen capture
  screenTrack.stop();

  // 🔥 Remove local screen share from DOM
  removeScreenShare("local");

  screenTrack = null;
  screenStream = null;

  isScreenSharing = false;
  screenBtn.textContent = "Share Screen";

  console.log("Screen sharing stopped");
}

