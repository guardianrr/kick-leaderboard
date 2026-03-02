const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// --- CONFIG ---
const MONGO_URI = "mongodb+srv://guardian:Leopereira22@cluster0.u9ytsqd.mongodb.net/kick_stats?retryWrites=true&w=majority"; 
const KICK_CHANNEL_ID = "39698743"; 
const PORT = process.env.PORT || 3000;

let db;
const lastMessages = {}; 

const kickEmotes = ["asmonSmash", "AYAYA", "BBoomer", "beeBobble", "Bwop", "CaptFail", "catblobDance", "catKISS", "Clap", "coffinPls", "DanceDance", "DonoWall", "duckPls", "EDDIE", "EDMusiC", "EZ", "FLASHBANG", "Flowie", "gachiGASM", "GIGACHAD", "GnomeDisco", "HaHaa", "HYPERCLAP", "Kappa", "KEKBye", "KEKLEO", "KEKW", "kkHuh", "LetMeIn", "LULW", "mericCat", "modCheck", "MuteD", "NODDERS", "NugTime", "ODAJAM", "OOOO", "OuttaPocket", "PatrickBoo", "PeepoClap", "peepoDJ", "peepoRiot", "peepoShy", "PogU", "POLICE", "politeCat", "ppJedi", "Prayge", "ratJAM", "Sadge", "SaltT", "SenpaiWhoo", "SIT", "SUSSY", "ThisIsFine", "TOXIC", "TriKool", "TRUEING", "vibePls", "WeirdChamp", "WeSmart", "YouTried"];
const extraEmojis = ["Angel", "Angry", "Astonished", "Awake", "BlowKiss", "Bubbly", "Cheerful", "Clown", "Cool", "Crave", "Cry", "Crying", "Curious", "Cute", "Dead", "Devil", "Disappoint", "Disguise", "DJ", "Down", "Enraged", "Excited", "EyeRoll", "Fire", "Gamer", "Glass", "Goofy", "Gramps", "Grimacing", "Grin", "Grumpy", "Happy", "HeartEyes", "Hmm", "Hydrate", "King", "Kiss", "Lady", "Laughing", "Loading", "Lol", "Man", "MoneyEyes", "No", "Oof", "Oooh", "Ouch", "Pleading", "Rich", "Shocked", "Sleep", "Smart", "Smerking", "Smiling", "Sorry", "Stare", "StarEyes", "Swearing", "Unamused", "Vomiting", "Wink", "XEyes", "Yay", "Yes", "Yuh", "Yum"];
const allForbidden = [...kickEmotes, ...extraEmojis.map(e => "emoji" + e)];

async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db('kick_stats');
        console.log("✅ MongoDB Connected!");
    } catch (err) { console.error("❌ DB Error:", err); }
}

function startKickBot() {
    const ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false');

    ws.on('open', () => {
        console.log("📡 Listening to Kick Chat...");
        ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: `chatrooms.${KICK_CHANNEL_ID}.v2` } }));
    });

    ws.on('message', async (data) => {
        try {
            const payload = JSON.parse(data);
            if (payload.event === 'App\\Events\\ChatMessageEvent') {
                const chatData = JSON.parse(payload.data);
                const username = chatData.sender.username;
                const originalMsg = chatData.content.trim();
                const now = Date.now();

                let cleanMsg = originalMsg.replace(/\[emote:\d+:[^\]]+\]/g, ""); 
                allForbidden.forEach(emote => {
                    const regex = new RegExp(emote + "\\d*", "gi"); 
                    cleanMsg = cleanMsg.replace(regex, "");
                });

                if (!/[a-zA-Z0-9]/.test(cleanMsg.trim())) return;

                const msgLower = originalMsg.toLowerCase();
                if (lastMessages[username] && lastMessages[username].content === msgLower && (now - lastMessages[username].timestamp) / 1000 < 60) return;
                
                lastMessages[username] = { content: msgLower, timestamp: now };

                await db.collection('leaderboard').updateOne(
                    { username: username },
                    { $inc: { total_messages: 1 }, $set: { last_seen: new Date() } },
                    { upsert: true }
                );
            }
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => setTimeout(startKickBot, 5000));
}

app.get('/api/top50', async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = {};

        if (start && end) {
            query.last_seen = {
                $gte: new Date(start),
                $lte: new Date(end + "T23:59:59Z")
            };
        }

        const top50 = await db.collection('leaderboard')
            .find(query)
            .sort({ total_messages: -1 })
            .limit(50)
            .toArray();
        res.json(top50);
    } catch (err) { res.status(500).json({ error: "API Error" }); }
});

connectDB().then(() => {
    startKickBot();
    app.listen(PORT, () => console.log(`🚀 Live on Port: ${PORT}`));
});