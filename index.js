const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const os = require('os');
const axios = require('axios');


const app = express();
const PORT= process.env.PORT || 5000;

app.use(express.json());

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

app.listen(PORT, '0.0.0.0', () => console.log(`Server running ${PORT}`));