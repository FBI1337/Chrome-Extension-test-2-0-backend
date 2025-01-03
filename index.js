const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const cors = require('cors');
const { time, timeStamp } = require('console');


const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set ();

app.use(express.json());
app.use(cors());

mongoose.connect('mongodb+srv://slavashelkynov1337:8g5GBJVcGSMFvBca@authentication.9lvzi.mongodb.net/authentication', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MnogoDB connected'))
.catch(err => console.error('Connection error', err));

const userShema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    adminLevel: { type: Number, default: 0 },
});

const messageShema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageShema);
const User = mongoose.model('User', userShema);

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family == 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}

async function getExternalIpAdress() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (error) {
        console.error('Не удалось получить внешний IP:', error);
        return null;
    }
}

app.get('/api/messages', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: 'Токен отсутствует' });

    try {
        const decoded = jwt.verify(token, 'secretKey');
        const message = await Message.find({ userId: decoded.id }).sort({ timestamp: 1 });
        res.status(200).json({ message });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

app.get('/api/support/users', async (req, res) => {
    try {
        const users = await User.find().select("_id username email");
        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

app.get('/api/support/messages/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const messages = await Message.find({ userId });
        res.status(200).json({ messages });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Токен отсутствует' });

        const decoded = jwt.verify(token, 'secretKey');
        const admin = await User.findById(decoded.id);

        if (admin.adminLevel !== 1) {
            return res.status(403).json({ message: 'Недостаточно прав' });
        }

        const users = await User.find({}, '_id username email');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

app.get('/api/user', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Токен отсутствует' });

        const decoded = jwt.verify(token, 'secretKey');
        const user = await User.findById(decoded.id);

        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

        res.status(200).json({
            id: user._id,
            username: user.username,
            email: user.email,
            adminLevel: user.adminLevel,
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

app.get('/api/config', async (req, res) => {
    const localIp = getLocalIpAddress();
    const externalIp = await getExternalIpAdress();
    const port = 5000;

    res.json({
        localUrl: `http://${localIp}:${port}`,
        externalUrl: `http://${externalIp}:${port}`,
    });
});

app.post("/api/messages", async (req, res) => {
    const { text } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Токен отсутствует" });

    try {
        const decoded = jwt.verify(token, "secretKey");
        const message = new Message({
            userId: decoded.id,
            sender: decoded.username,
            text,
        });
        await message.save();
        res.status(201).json({ message: "Сообщение сохранено" });
    } catch (error) {
        res.status(500).json({ message: "Ошибка сервера", error });
    }
});

app.post('/api/register', async (req,res) => {
    const { username, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Пользователь уже существует' });


        const hashedPassword = await bcrypt.hash(password, 10);
    
        const newUser = new User({ username, email, password:hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error});
    }
});

app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;

    try {
        const user = await User.findOne({ $or: [{ email: login }, {username: login}] });
        if (!user) return res.status(400).json({ message: 'Неправельные данные' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Неправильный пароль' });

        const token = jwt.sign({ id: user._id, username: user.username }, 'secretKey', { expiresIn: '1h' });

        res.status(200).json({ token });
    } catch (error) {
        res.status(400).json({ message: 'Ошибка сервера', error });
    }
});

app.get('/api/check-admin', async (req, res) => {
    const { token } = req.headers;

    try {
        const decoded = jwt.verify(token, 'secretKey');
        const user = await User.findById(decoded.id);

        if (user.adminLevel === 1) {
            return res.status(200).json({ message: 'Пользователь является администратором' });
        } else {
            return res.status(403).json({ message: 'Нет прав администратора' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Ошибка проверки пользователя', error });
    }
});

wss.on('connection', (ws) => {


    ws.on ('message', async (message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.userId) {
            const newMessage = new Message({
                userId: parsedMessage.userId,
                sender: parsedMessage.sender,
                text: parsedMessage.text,
                timestamp: new Date(),
            });
            await newMessage.save();

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(newMessage));
                }
            });
        }

        if (!isActive) {
            console.log('Клиент вошел в чат поддержки');
            ws.send(JSON.stringify({ sender: 'support', text: 'Добро пожаловать в чат поддержки!'}));
            isActive = true;
        }
        console.log('Получено сообщение:', message);
    });

    let isActive = false;
    
    clients.add(ws);


    ws.on('error', (error) => {
        console.error('Ошибка WebSocket:', error);
    });
});

app.get('/', (req, res) => {
    res.send('WebSocket сервер работает');
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running ${PORT}`));