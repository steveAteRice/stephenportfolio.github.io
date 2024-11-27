require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const csvParser = require('csv-parser');

const app = express();
app.use(cors());
app.use(express.json());

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const dbName = 'ChatGPT_Evaluation';
const apiUrl = 'https://api.openai.com/v1/chat/completions';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is missing in .env file');
    process.exit(1);
}

async function makeRequestWithRetry(url, options, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios(url, options);
            return response; // Return response if successful
        } catch (error) {
            if (attempt < retries && (error.response?.status === 429 || error.code === 'ECONNABORTED')) {
                console.log(`Retry attempt ${attempt} failed. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000)); 
            } else {
                throw error;
            }
        }
    }
}

async function loadCsvToMongo(filePath, collectionName) {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const data = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
                data.push({
                    question_text: row[Object.keys(row)[0]],
                    anticipated_answer: Object.values(row).slice(1).join(' | '),
                    chatgpt_response: null,
                });
            })
            .on('end', async () => {
                try {
                    await collection.insertMany(data);
                    console.log(`${collectionName} populated successfully.`);
                    resolve();
                } catch (err) {
                    reject(`Error inserting data into ${collectionName}: ${err.message}`);
                }
            });
    });
}

app.post('/load-data', async (req, res) => {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        await loadCsvToMongo('./computer_security_test.csv', 'Computer_Security');
        await loadCsvToMongo('./prehistory_test.csv', 'History');
        await loadCsvToMongo('./sociology_test.csv', 'Social_Science');
        res.send('Data loaded successfully!');
    } catch (err) {
        console.error('Error loading data:', err.message);
        res.status(500).send('Error loading data: ' + err.message);
    }
});

app.get('/questions', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        const questions = await db.collection('Computer_Security').find().toArray();
        res.json(questions);
    } catch (err) {
        res.status(500).send('Error fetching questions: ' + err.message);
    }
});

app.post('/questions/ask', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        console.log('Question received:', question);

        const response = await makeRequestWithRetry(
            apiUrl,
            {
                method: 'post',
                data: {
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: question }],
                },
                headers: { Authorization: `Bearer ${apiKey}` },
            }
        );

        const answer = response.data.choices[0].message.content;
        console.log('ChatGPT Response:', answer);

        const db = client.db(dbName);
        await db.collection('Computer_Security').updateOne(
            { question_text: question },
            { $set: { chatgpt_response: answer } }
        );

        res.json({ success: true, chatgpt_response: answer });
    } catch (err) {
        console.error('Error with ChatGPT API:', err.response?.data || err.message);
        res.status(500).send('Error with ChatGPT API: ' + err.message);
    }
});

app.get('/results', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        const questions = await db.collection('Computer_Security').find().toArray();

        const accuracy = questions.reduce((acc, q) => {
            return q.chatgpt_response === q.anticipated_answer ? acc + 1 : acc;
        }, 0) / questions.length;

        const responseTimes = questions.map((q) => q.response_time || 0);
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

        res.json({ accuracy, avgResponseTime });
    } catch (err) {
        res.status(500).send('Error calculating results: ' + err.message);
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
