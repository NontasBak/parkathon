import kDTree from './kdtree.js';
import parking from './parking.js';
import openAI from 'openai';

import 'dotenv/config';

import express from "express";
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const prt = 9000;
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// app.use(express.json());
app.use(cookieParser());
app.use(cors({
	origin: '*',
	methods: 'GET,POST,PUT,DELETE',
	credentials: true
}));

// app.use(cors());
// app.use(express.json());

const db = await mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

const openai = new openAI({ apiKey: process.env.OPENAI_API_KEY});

const GenerateToken = (id) => {
	return id;
	// return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};
const AuthenticateToken = async (token) => {
	try {
		// const decoded = jwt.verify(token, JWT_SECRET);
		const [users] = await db.query('SELECT user_id FROM user WHERE user_id = ?', [token]);
		return users.length > 0 ? token : null;
	} catch {
		return null;
	}
};

app.post('/user/signup', async (req, res) => {
    const { name, email, password } = req.query;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const [exist] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (exist.length > 0) {
            return res.status(400).json({ error: "User already exists" });
        }
        const [result] = await db.query(
            'INSERT INTO user (name, email, password) VALUES (?, ?, ?)',
            [name, email, await bcrypt.hash(password, 10)]
        );
        return res.json({
			success: true, 
			message: "User registered successfully",
			userId: GenerateToken(result.insertId)
		});
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.post('/user/login', async (req, res) => {
    const { email, password } = req.query;

    if (!email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const [users] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        if (!await bcrypt.compare(password, users[0].password)) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
		return res.json({
			success: true, 
			message: "User login successful",
			userId: GenerateToken(users[0].user_id)
		});
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/map/name/at', async (req, res) => {
	let {
		lat,
		lon,
	} = req.query;
	
	if (!lat || !lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	
	try {
		return res.json(await parking.OpenStreetLocationInfoAt(lat, lon));
	} catch (error) {
		return res.status(500).json(error);
	}
});

app.get('/park/list/active', async (req, res) => {
	let {
		user,
	} = req.query;
	
	user = await AuthenticateToken(user);
	if (!user) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	
	try {
		const [rows] = await db.query(`SELECT * FROM parking WHERE user_id = ${user} AND end_time IS NULL;`);
		return res.json(rows);
	} catch (error) {
		return res.status(500).json(error);
	}
});

app.get('/park/list/all', async (req, res) => {
	let {
		user,
	} = req.query;
	
	user = await AuthenticateToken(user);
	if (!user) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	
	try {
		const [rows] = await db.query(`SELECT * FROM parking WHERE user_id = ${user};`);
		return res.json(rows);
	} catch (error) {
		return res.status(500).json(error);
	}
});

// POST
app.post('/park/occupy', async (req, res) => {
	let {
		user,
		lat,
		lon,
	} = req.query;
	
	user = await AuthenticateToken(user);
	if (!user) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	if (!lat || !lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	
	try {
		const tree = new kDTree();
		const data = await parking.OpenStreetMapFetchRoadsAt(lat, lon, 500);
		const spot = parking.GeographicDataToParkingSpaces(data);
		
		tree.InsertPoints(spot);
		
		const near = tree.Nearest(parking.GeographicToEuclidean({
			lat: lat,
			lon: lon,
		}), 40);
		
		if (near) {
			const q = 'INSERT INTO parking (user_id, lat, lon) VALUES (?, ?, ?)';
			const v = [user, near[2], near[3]];
			const [results] = await db.execute(q, v);
			return res.json(results);
		} else {
			return res.status(500).json({ error: "Illegal parking" });
		}
		
		const q = 'INSERT INTO parking (user_id, lat, lon) VALUES (?, ?, ?)';
		const v = [user, lat, lon];
		const [results] = await db.execute(q, v);
		return res.json(results);
	} catch (error) {
		return res.status(500).json(error);
	}
});

// POST
app.post('/park/vacay', async (req, res) => {
	let {
		parking,
		user,
	} = req.query;

	user = await AuthenticateToken(user);
	if (!user) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	if (!parking /* or parking not in database */) {
		return res.status(400).json({ error: "Invalid parking id provided" });
	}
	
	try {
		const q = 'UPDATE parking SET end_time = NOW() WHERE parking_id = ? AND user_id = ? AND end_time IS NULL';
        const v = [parking, user];
		const [results] = await db.execute(q, v);
		return res.json(results);
	} catch (error) {
		return res.status(500).json(error);
	}
});

app.get('/park/find', async (req, res) => {
	let {
		lat,
		lon,
		rad,
	} = req.query;
	
	if (!lat || !lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	
	rad = rad || 100;
	
	try {
		const tree = new kDTree();
		const data = await parking.OpenStreetMapFetchRoadsAt(lat, lon, 500);
		const spot = parking.GeographicDataToParkingSpaces(data);
		
		tree.InsertPoints(spot);
		
		const [rows] = await db.query('SELECT * FROM parking WHERE start_time <= NOW() AND end_time IS NULL;');
		rows.forEach((entry) => {
			/** Remove the nearest parking spot in a radius of 40m. */
			tree.RemoveNearest(parking.GeographicToEuclidean({
				lat: entry.lat,
				lon: entry.lon,
			}), 40);
		});
    
		return res.json(tree.Query(parking.GeographicToEuclidean({
				lat: lat,
				lon: lon,
		}), rad));
	} catch (error) {
		return res.status(500).json(error);
	}
});

app.get('/park/demo/clean', async (req, res) => {
	const user = 1;
	
	try {
		const [result] = await db.execute(
			'DELETE FROM parking WHERE user_id = ?',
			[user]
		);
		return res.json(result);
	} catch (error) {
		return res.status(500).json(error);
	}
});

app.get('/park/demo/simulate', async (req, res) => {
	let {
		q_lat,
		q_lon,
		rad,
	} = req.query;
	
	if (!q_lat || !q_lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	
	rad = rad || 500; // By default the radius is 100m
	
	const RandomWithinRadius = (in_lat, in_lon, in_rad) => {
		const R_lat = (in_rad / 111320); // 1 degree ≈ 111.32 km
		const R_lon = (in_rad / (111320 * Math.cos(in_lat * (Math.PI / 180))));
		return {
			lat: in_lat + (Math.random() - 0.5) * R_lat * 2,
			lon: in_lon + (Math.random() - 0.5) * R_lon * 2,
		};
	};
	
	try {
		const data = await parking.OpenStreetMapFetchRoadsAt(q_lat, q_lon, rad);
		const spot = parking.GeographicDataToParkingSpaces(data);
		
		const fake = [];
		const user = 1;
		
		/**
		 * Some people might end up parking on the sea... that shouldn't really be a problem though!
		 */
		const mark = Math.floor(spot.length * (0.9 + Math.random() * 0.1));
		
		for (let i = 0; i < mark; i++) {
			const {
				lat,
				lon
			} = RandomWithinRadius(parseFloat(q_lat), parseFloat(q_lon), rad);
			const [result] = await db.execute(
				'INSERT INTO parking (user_id, lat, lon) VALUES (?, ?, ?)',
				[user, lat, lon]
			);
			fake.push(result.insertId);
		}
		
		/** Less than 10% of the occupied parking spots will be released! */
		const free = Math.floor(fake.length * Math.random() * 0.1);
		
		for (let i = 0; i < free; i++) {
			const id = fake[Math.floor(Math.random() * fake.length)];
			const [result] = await db.execute(
				'UPDATE parking SET end_time = NOW() WHERE parking_id = ? AND user_id = ? AND end_time IS NULL',
				[id, user]
			);
		}
		
		return res.json({
			total: spot.length,
			count: mark,
			freed: free
		});
	} catch (error) {
		return res.status(500).json(error);
	}
});

app.get("/transcript", async (req, res) => {
    let { text } = req.query;

    if (!text) {
        return res.status(400).json({ error: "Text query is required" });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a location extractor. Extract only the location name from the given text. Respond with just the location name, nothing else. If the user specifies the road or any other information that correlates with the location, add that as well. The final result should be a location on the map.",
                },
                {
                    role: "user",
                    content: text,
                },
            ],
            temperature: 0.2,
            max_tokens: 70,
        });

        const location = completion.choices[0].message.content.trim();
        return res.json({ location });
    } catch (error) {
        return res
            .status(500)
            .json({ error: "Failed to process location from text" });
    }
});

app.listen(prt, () => console.log(`Backend running on port ${prt}`));
