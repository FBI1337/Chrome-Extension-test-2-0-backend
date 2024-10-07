const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;

app.use(express.json());

mongoose.connect('mongodb+srv://slavashelkynov1337:8g5GBJVcGSMFvBca@authentication.9lvzi.mongodb.net/authentication?retryWrites=true&w=majority', {
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
    }
})