var socket;

const roomName = location.pathname.substring(13);
var userId;
var username = localStorage.getItem('username');
var validCategories = [];
var validSubcategories = [];

function connectToWebSocket() {
    socket = new WebSocket(location.href.replace('http', 'ws'), roomName);
    socket.onopen = function () {
        socket.send(JSON.stringify({ type: 'join', username: username }));
        console.log('Connected to websocket');
    }
    socket.onmessage = function (event) {
        let data = JSON.parse(event.data);
        console.log(data);
        let li = document.createElement('li');
        switch (data.type) {
            case 'user-id':
                userId = data.userId;
                createPlayerAccordion(userId, username);
                break;
            case 'change-username':
                li.innerHTML = document.getElementById('accordion-username-' + data.userId).innerHTML + ' changed their name to ' + data.username;
                document.getElementById('accordion-username-' + data.userId).innerHTML = data.username;
                break;
            case 'set-name':
            case 'packet-number':
                li.innerHTML = `${data.username} set the ${data.type} to ${data.value}`;
                document.getElementById(data.type).value = data.value;
                break;
            case 'start':
                start('tossups');
                break;
            case 'buzz':
                li.innerHTML = `${data.username} buzzed`;
                processBuzz(data.userId, data.username);
                document.getElementById('buzz').disabled = true;
                break;
            case 'next':
                next();
                break;
            case 'reading-speed':
                document.getElementById('reading-speed').value = data.value;
                document.getElementById('reading-speed-display').innerHTML = data.value;
                break;
            case 'update-subcategories':
                validSubcategories = data.value;
                loadCategories(validCategories, validSubcategories);
                break;
            case 'update-categories':
                validCategories = data.value;
                loadCategories(validCategories, validSubcategories);
                break;
            case 'join':
                createPlayerAccordion(data.userId, data.username);
                break;
            case 'leave':
                document.getElementById('accordion-' + data.userId).remove();
                break;
            case 'pause':
                pause();
                break;
        }
        document.getElementById('event-log').appendChild(li);
    }
    socket.onclose = function () {
        console.log('Disconnected from websocket');
    }
}

function createPlayerAccordion(userId, username) {
    let button = document.createElement('button');
    button.className = 'accordion-button collapsed';
    button.type = 'button';
    button.setAttribute('data-bs-target', '#accordion-body-' + userId);
    button.setAttribute('data-bs-toggle', 'collapse');
    button.id = 'accordion-username-' + userId;
    button.innerHTML = username;

    let h2 = document.createElement('h2');
    h2.className = 'accordion-header';
    h2.id = 'heading-' + userId;
    h2.appendChild(button);

    let statline = document.createElement('span');
    statline.className = 'statline';
    statline.innerHTML = '0/0/0 with 0 tossups seen (0 pts, celerity: 0)';
    statline.id = 'statline-' + userId;
    let accordionBody = document.createElement('div');
    accordionBody.className = 'accordion-body';
    accordionBody.appendChild(statline);

    let div = document.createElement('div');
    div.className = 'accordion-collapse collapse';
    div.id = 'accordion-body-' + userId;
    div.appendChild(accordionBody);

    let accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';
    accordionItem.id = 'accordion-' + userId;
    accordionItem.appendChild(h2);
    accordionItem.appendChild(div);
    document.getElementById('player-accordion').appendChild(accordionItem);
}

function processBuzz(userId, username) {
    clearTimeout(timeoutID);

    // Include buzzpoint
    document.getElementById('question').innerHTML += '(#) ';

    document.getElementById('buzz').disabled = true;
    document.getElementById('pause').disabled = true;
}

function processAnswer(userId, username, givenAnswer, score) {
    let li = docuemnt.createElement('li');
    li.innerHTML = `${username} ${score > 0 ? '' : 'in'}correctly answered with ${givenAnswer} for ${score} points`;
    document.getElementById('event-log').appendChild(li);
}

document.getElementById('username').addEventListener('change', function () {
    username = this.value;
    document.getElementById('accordion-username-' + userId).innerHTML = username;
    socket.send(JSON.stringify({ 'type': 'change-username', userId: userId, username: username }));
    localStorage.setItem('username', username);
});

// Event listeners
document.getElementById('reading-speed').oninput = function () {
    localStorage.setItem('speed', this.value);
    document.getElementById('reading-speed-display').innerHTML = this.value;
    socket.send(JSON.stringify({ 'type': 'reading-speed', value: this.value }));
}

document.getElementById('start').addEventListener('click', function () {
    this.blur();
    start('tossups');
    socket.send(JSON.stringify({ 'type': 'start' }));
});

document.getElementById('buzz').addEventListener('click', function () {
    this.blur();
    processBuzz(userId, username);
    document.getElementById('answer-input-group').classList.remove('d-none');
    socket.send(JSON.stringify({ type: 'buzz', userId: userId, username: username }));
});

document.getElementById('pause').addEventListener('click', function () {
    this.blur();
    pause();
    socket.send(JSON.stringify({ type: 'pause', userId: userId, username: username }));
});

document.getElementById('next').addEventListener('click', function () {
    this.blur();
    readQuestion();
    socket.send(JSON.stringify({ type: 'next', userId: userId, username: username }));
});

document.getElementById('toggle-correct').addEventListener('click', function () {
    this.blur();
    toggleCorrect();
});

document.querySelectorAll('#categories input').forEach(input => {
    input.addEventListener('click', function (event) {
        this.blur();
        [validCategories, validSubcategories] = updateCategory(input.id, validCategories, validSubcategories);
        socket.send(JSON.stringify({ type: 'update-categories', username: username, value: validCategories }));
        socket.send(JSON.stringify({ type: 'update-subcategories', username: username, value: validSubcategories }));
    });
});

document.querySelectorAll('#subcategories input').forEach(input => {
    input.addEventListener('click', function (event) {
        this.blur();
        validSubcategories = updateSubcategory(input.id, validSubcategories);
        socket.send(JSON.stringify({ type: 'update-subcategories', username: username, value: validSubcategories }))
    });
});

var packetNameField = document.getElementById('set-name');
packetNameField.addEventListener('change', function () {
    localStorage.setItem('packetNameTossupSave', packetNameField.value);
    socket.send(JSON.stringify({ type: 'set-name', username: username, value: packetNameField.value }));
});

var packetNumberField = document.getElementById('packet-number');
packetNumberField.addEventListener('change', function () {
    localStorage.setItem('packetNumberTossupSave', packetNumberField.value);
    socket.send(JSON.stringify({ type: 'packet-number', username: username, value: packetNumberField.value }));
});

var questionNumberField = document.getElementById('question-select');
questionNumberField.addEventListener('change', function () {
    localStorage.setItem('questionNumberTossupSave', questionNumberField.value);
    socket.send(JSON.stringify({ type: 'question-number', username: username, value: questionNumberField.value }));
});

window.onload = () => {
    document.getElementById('username').value = username;
    connectToWebSocket();
    fetch(`/api/get-room?room=${encodeURI(roomName)}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('set-name').value = data.setName;
            document.getElementById('packet-number').value = data.packetNumbers;
            validCategories = data.validCategories;
            validSubcategories = data.validSubcategories;
            loadCategories(validCategories, validSubcategories);
            data.players.forEach(player => {
                if (player.userId !== userId) {
                    createPlayerAccordion(player.userId, player.username);
                }
            });
        });
}