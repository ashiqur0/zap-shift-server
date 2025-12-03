const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

// mongodb connection uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.edix7i0.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // create database
        const db = client.db('zap-shift-db');

        // create collections
        const parcelCollection = db.collection('parcels');

        // parcel api
        app.get('/parcels', async(req, res) => {
            const query = {};
            const {email} = req.query;

            if (email) {
                query.senderEmail = email;
            }

            const options = {sort: {createdAt: -1}};

            const cursor = parcelCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/parcels', async(req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();

            const result = await parcelCollection.insertOne(parcel);
            res.send(result);
        });

        app.delete('/parcels', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};

            const result = await parcelCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from server');
});

app.listen(port, (req, res) => {
    console.log(`Server is running at: http://localhost:${port}`);
});