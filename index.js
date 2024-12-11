const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const cors = require('cors');

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
});

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

app.get('/api/config', async (req, res) => {
    const localIp = getLocalIpAddress();
    const externalIp = await getExternalIpAdress();
    const port = 5000;

    res.json({
        localUrl: `http://${localIp}:${port}`,
        externalUrl: `http://${externalIp}:${port}`,
    });
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

wss.on('connection', (ws) => {
    console.log('Клиент подключен');
    
    clients.add(ws);

    ws.send(JSON.stringify({ sender: 'support', text: 'Добро пожаловать в чат поддержки!'}));

    ws.on('message', (message) => {
        console.log('Получено сообщение:', message);

        const parsedMessage = JSON.parse(message);
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(parsedMessage));
            }
        });
    });

    ws.on('close', () => {
        console.log('Клиент отключен');
        clients.delete(ws);
    });

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