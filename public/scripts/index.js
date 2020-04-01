let isAlreadyCalling = false;
let getCalled = false;

const existingCalls = [];

const { RTCPeerConnection, RTCSessionDescription } = window;

const peerConnection = new RTCPeerConnection();

function unselectUsersFromList() {
  const alreadySelectedUser = document.querySelectorAll(
    '.active-user.active-user--selected'
  );

  alreadySelectedUser.forEach((el) => {
    el.setAttribute('class', 'active-user');
  });
}

function createUserItemContainer(socketId) {
  const userContainerEl = document.createElement('div');

  const usernameEl = document.createElement('p');

  userContainerEl.setAttribute('class', 'active-user');
  userContainerEl.setAttribute('id', socketId);
  usernameEl.setAttribute('class', 'username');
  usernameEl.innerHTML = `Socket: ${socketId}`;

  userContainerEl.appendChild(usernameEl);

  userContainerEl.addEventListener('click', () => {
    unselectUsersFromList();
    userContainerEl.setAttribute('class', 'active-user active-user--selected');
    const talkingWithInfo = document.getElementById('talking-with-info');
    talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}"`;
    callUser(socketId);
  });

  return userContainerEl;
}

async function callUser(socketId) {
  const offer = await peerConnection.createOffer();
  try {
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    // console.log(offer);
  } catch (error) {
    console.log(error);
  }
  socket.emit('call-user', {
    offer,
    to: socketId
  });
}

function updateUserList(socketIds) {
  const activeUserContainer = document.getElementById('active-user-container');

  socketIds.forEach((socketId) => {
    const alreadyExistingUser = document.getElementById(socketId);
    if (!alreadyExistingUser) {
      const userContainerEl = createUserItemContainer(socketId);

      activeUserContainer.appendChild(userContainerEl);
    }
  });
}

const socket = io.connect('localhost:5000');

socket.on('update-user-list', ({ users }) => {
  updateUserList(users);
});

socket.on('remove-user', ({ socketId }) => {
  const elToRemove = document.getElementById(socketId);

  if (elToRemove) {
    elToRemove.remove();
  }
});

socket.on('call-made', async (data) => {
  if (getCalled) {
    const confirmed = confirm(
      `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
    );

    if (!confirmed) {
      socket.emit('reject-call', {
        from: data.socket
      });

      return;
    }
  }
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.log('peerConnection', error);
  }

  socket.emit('make-answer', {
    answer,
    to: data.socket
  });
  getCalled = true;
});

socket.on('answer-made', async (data) => {
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  } catch (error) {
    console.log(error);
  }

  if (!isAlreadyCalling) {
    callUser(data.socket);
    isAlreadyCalling = true;
  }
});

socket.on('call-rejected', (data) => {
  alert(`User: "Socket: ${data.socket}" rejected your call.`);
  unselectUsersFromList();
});

peerConnection.ontrack = function({ streams: [stream, ...rest] }) {
  // const remoteVideo = document.getElementById('remote-video');
  console.log(rest);

  const newVideoFrame = document.createElement('video');
  newVideoFrame.setAttribute('class', 'remote-video');
  newVideoFrame.setAttribute('autoplay', '');
  const videoContainer = document.querySelector('.video-container');
  videoContainer.appendChild(newVideoFrame);
  newVideoFrame.srcObject = stream;
  // <video autoplay class="remote-video" id="remote-video"></video>
  // if (remoteVideo) {
  //   remoteVideo.srcObject = stream;
  //   remoteVideo.play();

  //   console.log(remoteVideo);
  // }
};

navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    const localVideo = document.getElementById('local-video');

    if (localVideo) {
      localVideo.srcObject = stream;
    }

    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));
  })
  .catch((error) => {
    console.warn(error.message);
  });
