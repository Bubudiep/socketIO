const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs'); // Add this line to require the fs module
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const axios = require('axios'); // Add this line to require the axios module

// Store rooms and users in an object
const rooms = {},
    users = {},
    rooms_data = {};
// Handle connections from other WebSocket clients (like WinForms)
io.on('connection', (socket) => {
    // Khi người dùng kết nối
    var name = '';
    if (socket.handshake.headers.cookie) {
        try {
            var cookie = socket.handshake.headers.cookie.split(';');
            cookie.forEach((items) => {
                var its = items.trim().split('=');
                if (its[0] == 'user_name') {
                    name = its[1];
                }
            });
        } catch (e) {
            socket.emit('error', 'please login!');
            return false;
        }
        if (!Object.values(users).includes(name)) {
            users[socket.id] = name;
        }
    } else {
        name = 'backend';
    }
    console.log(name + ' is connected');
    socket.emit('user online', users);
    io.emit('user connected', users);
    socket.on('disconnect', () => {
        io.emit('user disconnected', socket.id);
        for (const room in rooms) {
            if (rooms.hasOwnProperty(room)) {
                rooms[room] = rooms[room].filter((user) => user !== socket.id);
                io.to(room).emit('user disconnected', socket.id);
            }
        }
    });

    socket.on('join room', (room, data) => {
        // Khi có người join room
        socket.join(room);
        console.log(data);
        if (!rooms[room]) {
            rooms[room] = [name];
            rooms_data[room] = [];
            rooms_data[room].push({
                key: socket.id,
                name: name,
                data: data,
            });
        } else {
            rooms[room].push(name);
            rooms_data[room].push({
                key: socket.id,
                name: name,
                data: data,
            });
        }
        socket.to(room).emit('user joined', data);
    });

    socket.on('notice', (data) => {
        socket.to(data.room).emit('notice', socket.id);
    });
    socket.on('room_data', (data) => {
        io.to(socket.id).emit('room_data', rooms_data);
    });

    socket.on('leave room', (room) => {
        socket.leave(room);
        if (rooms[room]) {
            rooms[room] = rooms[room].filter((user) => user !== socket.id);
            socket.to(room).emit('user left', socket.id);
        }
    });
    socket.on('backend-data', (data) => {
        io.emit('message', { type: 'CommonCartonStation', message: data });
    });
    socket.on('backend-wo', (data) => {
        io.emit('message', { type: 'updateWO', message: data });
    });
    socket.on('backend-schedule', (data) => {
        io.emit('message', { type: 'updatePLAN', message: data });
    });
    socket.on('chat message', (msg, room) => {
        // Broadcast the message to all users in the room
        io.to(room).emit('chat message', { message: msg, sender: name });
    });
    socket.on('message', (type, msg) => {
        // Public messenger
        io.emit('message', { type: type, message: msg });
    });

    socket.on('ping', (callback) => {
        callback('pong'); // hoặc có thể không cần gửi gì cả
    });

    socket.on('backend-message', (msg) => {
        // Public messenger
        io.emit('message', { type: msg.type, message: msg });
        try {
            if (msg.function == 'mail') {
                console.log(msg.mail);
                sendPostRequest({
                    from: msg.mail.from,
                    to: msg.mail.to,
                    subject: msg.mail.subject,
                    attachments: msg.mail.attachments,
                    body: msg.mail.body,
                });
            }
        } catch (e) {
            console.log(e);
        }
    });
    // Handle private messages
    socket.on('private message', ({ to, message }) => {
        const recipientSocketId = Object.keys(users).find((key) => users[key] === to);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('private message', { from: name, message: message });
        } else {
            socket.emit('error', `User ${to} is not online.`);
        }
    });
});
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});

// Function to send a POST request
function sendPostRequest(
    data = {
        from: 'Hung Dep Trai',
        to: 'hung.diep@fbin.com',
        subject: 'test',
        body: '<b>test</b>',
    },
) {
    console.log(data);
    axios
        .post('http://localhost/mail/auto.php', data, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then((response) => {
            console.log('POST request sent successfully:', response.data);
        })
        .catch((error) => {
            console.error('Error sending POST request:', error);
        });
}
// socket dotnet server
// const net = require('net');
// const server2 = net.createServer(socket => {
//   console.log('Client connected');
//   socket.write('Hello from Node.js server!');
//   socket.on('data', data => {
//     console.log('Received from client:', data.toString());
//   });
//   socket.on('end', () => {
//     console.log('Client disconnected');
//   });
// });
// server2.listen(3003, () => {
//   console.log('Server running on port 3003');
// });
