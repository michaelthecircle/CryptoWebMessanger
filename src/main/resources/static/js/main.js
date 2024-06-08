'use strict';

const usernamePage = document.querySelector('#username-page');
const chatPage = document.querySelector('#chat-page');
const usernameForm = document.querySelector('#usernameForm');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const connectingElement = document.querySelector('.connecting');
const chatArea = document.querySelector('#chat-messages');
const logout = document.querySelector('#logout');

const P = 23n;
const G = 5n;

function getRandomBigInt(max) {
    let randomBigInt;
    do {
        randomBigInt = BigInt(Math.floor(Math.random() * Number(max)));
    } while (randomBigInt === 0n);
    return randomBigInt;
}

function generatePrivateKey() {
    const maxRandom = P - 1n;
    return getRandomBigInt(maxRandom);
}

function generatePublicKey(privateKey) {
    return G ** privateKey % P;
}

function generateSharedKey(publicKey, privateKey) {
    return publicKey ** privateKey % P;
}

let stompClient = null;
let nickname = null;
let fullname = null;
let selectedUserId = null;

function connect(event) {
    nickname = document.querySelector('#nickname').value.trim();
    fullname = document.querySelector('#fullname').value.trim();

    if (nickname && fullname) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}

function onConnected() {
    stompClient.subscribe(`/user/${nickname}/queue/messages`, onMessageReceived);
    stompClient.subscribe(`/user/public`, onMessageReceived);

    stompClient.send("/app/user.addUser",
        {},
        JSON.stringify({nickName: nickname, fullName: fullname, status: 'ONLINE'})
    );
    document.querySelector('#connected-user-fullname').textContent = fullname;
    findAndDisplayConnectedUsers().then();
}

async function findAndDisplayConnectedUsers() {
    const connectedUsersResponse = await fetch('/users');
    let connectedUsers = await connectedUsersResponse.json();
    connectedUsers = connectedUsers.filter(user => user.nickName !== nickname);
    const connectedUsersList = document.getElementById('connectedUsers');
    connectedUsersList.innerHTML = '';

    connectedUsers.forEach(user => {
        appendUserElement(user, connectedUsersList);
        if (connectedUsers.indexOf(user) < connectedUsers.length - 1) {
            const separator = document.createElement('li');
            separator.classList.add('separator');
            connectedUsersList.appendChild(separator);
        }
    });
}

function appendUserElement(user, connectedUsersList) {
    const listItem = document.createElement('li');
    listItem.classList.add('user-item');
    listItem.id = user.nickName;

    const userImage = document.createElement('img');
    userImage.src = '../img/pivo.jpeg';
    userImage.alt = user.fullName;

    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = user.fullName;

    const receivedMsgs = document.createElement('span');
    receivedMsgs.textContent = '0';
    receivedMsgs.classList.add('nbr-msg', 'hidden');

    listItem.appendChild(userImage);
    listItem.appendChild(usernameSpan);
    listItem.appendChild(receivedMsgs);

    listItem.addEventListener('click', userItemClick);

    connectedUsersList.appendChild(listItem);
}

function userItemClick(event) {
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    messageForm.classList.remove('hidden');

    const clickedUser = event.currentTarget;
    clickedUser.classList.add('active');

    selectedUserId = clickedUser.getAttribute('id');
    fetchAndDisplayUserChat().then();

    const nbrMsg = clickedUser.querySelector('.nbr-msg');
    nbrMsg.classList.add('hidden');
    nbrMsg.textContent = '0';
}

function displayMessage(senderId, content) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message');
    if (senderId === nickname) {
        messageContainer.classList.add('sender');
    } else {
        messageContainer.classList.add('receiver');
    }
    const message = document.createElement('p');
    message.textContent = content;
    messageContainer.appendChild(message);
    chatArea.appendChild(messageContainer);
}

async function fetchAndDisplayUserChat() {
    const userChatResponse = await fetch(`/messages/${nickname}/${selectedUserId}`);
    const userChat = await userChatResponse.json();
    chatArea.innerHTML = '';
    userChat.forEach(chat => {
        displayMessage(chat.senderId, chat.content);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}

function onError() {
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh this page to try again!';
    connectingElement.style.color = 'red';
}

let selectedAlgorithm = "";
let encryptionMode = "";
let padding = "";
function selectEncryptionAlgorithm(algorithm) {
    selectedAlgorithm = algorithm;
}

//DH
let privateKeyAlice = 0n;
let publicKeyAlice = 0n;
let sharedKeyAlice = 0n;
let privateKeyBob = 0n;
let publicKeyBob = 0n;
let sharedKeyBob = 0n;
let statusHellman = 0;

function setHellmanStatus(status) {
    statusHellman = status;
}

async function encrypt(messageContent, selectedAlgorithm, sharedKey, timeStamp) {
    var xhr = new XMLHttpRequest();
    var url = "http://localhost:8090/encryptMsg";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    let result = "";
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            result = JSON.parse(xhr.responseText).content;
        } else if (xhr.readyState === 4) {
            console.error("Failed to encrypt message:", xhr.status, xhr.responseText);
        }
    };
    var data = JSON.stringify({
        key: timeStamp,
        crypto_algorithm: selectedAlgorithm,
        padding: "ZEROS",
        cipher_mode: "CBC",
        content: messageContent
    });
    console.log("Sending data:", data);
    xhr.send(data);
    return result;
}

async function sendMessage(event) {
    const messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        if (statusHellman === 0) {
            privateKeyAlice = generatePrivateKey();
            publicKeyAlice = generatePublicKey(privateKeyAlice);
            setHellmanStatus(1);
        } else if (statusHellman === 2) {
            sharedKeyAlice = generateSharedKey(publicKeyBob, privateKeyAlice);
        }
        const encryptedMessage = await encrypt(messageContent, selectedAlgorithm, sharedKeyAlice, timeStamp);
        const chatMessage = {
            senderId: nickname,
            recipientId: selectedUserId,
            content: encryptedMessage,
            algorithm: selectedAlgorithm,
            timestamp: new Date()
        };
        console.log("СООБЩЕНИЕ ПРИШЛО НА ОТПРАВКУ");
        console.log(encryptedMessage);
        console.log("-------------");
        stompClient.send("/app/chat", {}, JSON.stringify(chatMessage));
        displayMessage(nickname, messageContent);
        messageInput.value = '';
    }
    chatArea.scrollTop = chatArea.scrollHeight;
    event.preventDefault();
}

function decrypt(content, selectedAlgorithm, shared, timeStamp) {
    var xhr = new XMLHttpRequest();
    var url = "http://localhost:8090/decryptMsg";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    let result = "";
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            result = JSON.parse(xhr.responseText).content;
        } else if (xhr.readyState === 4) {
            console.error("Failed to encrypt message:", xhr.status, xhr.responseText);
        }
    };
    var data = JSON.stringify({
        key: timeStamp,
        crypto_algorithm: selectedAlgorithm,
        padding: "ZEROS",
        cipher_mode: "CBC",
        content: messageContent
    });
    console.log("Sending data:", data);
    xhr.send(data);
    return result;
}

async function onMessageReceived(payload) {
    await findAndDisplayConnectedUsers();
    console.log('Message received', payload);
    const message = JSON.parse(payload.body);
    if (selectedUserId && selectedUserId === message.senderId) {
        if (statusHellman === 1) {
            privateKeyBob = generatePrivateKey();
            publicKeyBob = generatePublicKey(privateKeyBob);
            sharedKeyBob = generateSharedKey(publicKeyAlice, privateKeyBob);
            setHellmanStatus(2);
        }
        selectEncryptionAlgorithm(message.algorithm);
        console.log("СООБЩЕНИЕ ПРИШЛО");
        console.log(message.content);
        console.log("-------------");
        const decryptedMessage = decrypt(message.content, selectedAlgorithm, sharedKeyBob, timeStamp);
        displayMessage(message.senderId, decryptedMessage);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    if (selectedUserId) {
        document.querySelector(`#${selectedUserId}`).classList.add('active');
    } else {
        messageForm.classList.add('hidden');
    }

    const notifiedUser = document.querySelector(`#${message.senderId}`);
    if (notifiedUser && !notifiedUser.classList.contains('active')) {
        const nbrMsg = notifiedUser.querySelector('.nbr-msg');
        nbrMsg.classList.remove('hidden');
        nbrMsg.textContent = '';
    }
}

const fileInput = document.getElementById('fileInput');
const attachFileButton = document.getElementById('attachFileButton');

attachFileButton.addEventListener('click', () => {
    fileInput.click();
});

const refreshUsersButton = document.getElementById('refreshUsersButton');

refreshUsersButton.addEventListener('click', async () => {
    try {
        await findAndDisplayConnectedUsers();
        console.log('User list refreshed successfully');
    } catch (error) {
        console.error('Error refreshing user list:', error);
    }
});

fileInput.addEventListener('change', handleFileSelection);
let timeStamp = "examplekey123456";
function handleFileSelection(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const file = files[0];
        const formData = new FormData();
        formData.append('pathForLoadFile', file.name);
        formData.append('cryptoAlgorithm', selectedAlgorithm);
        formData.append('padding', padding);
        formData.append('encryptionMode', encryptionMode);
        formData.append('content', "");
        formData.append('format', file.name.split('.').pop().toLowerCase());
        formData.append('key', sharedKeyAlice);

        fetch('http://localhost:8090/upload', {
            method: 'POST',
            body: formData,
            mode: 'no-cors'
        })
            .then(response => {
                if (response.ok) {
                    console.log('File uploaded successfully');
                } else {
                    console.error('Failed to upload file');
                }
            })
            .catch(error => {
                console.error('Error uploading file:', error);
            });
    }
}

function onLogout() {
    if (stompClient) {
        stompClient.send("/app/user.disconnectUser",
            {},
            JSON.stringify({nickName: nickname, fullName: fullname, status: 'OFFLINE'})
        );
    }
    window.location.reload();
}

window.addEventListener('beforeunload', async function(event) {
    if (stompClient) {
        stompClient.send("/app/user.disconnectUser",
            {},
            JSON.stringify({nickName: nickname, fullName: fullname, status: 'OFFLINE'})
        );
    }
});


usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', sendMessage, true);
logout.addEventListener('click', onLogout, true);
