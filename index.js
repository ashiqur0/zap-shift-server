const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

const admin = require("firebase-admin");
const serviceAccount = require("./zap-shift-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const verifyFirebaseToken = async (req, res, next) => {
    const authorized = req.headers?.authorization;

    if (!authorized) {
        return res.status(401).send({ message: 'unauthorized access1' });
    }

    try {
        const token = authorized.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded_email = decoded.email;

        next();
    } catch (error) {
        return res.status(401).send({ message: 'unauthorized access2' });
    }
}

function generateTrackingId() {
    const prefix = "PRCL";  // your brand prefix
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");    //YYMMDD
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();     // 6 character random hex

    return `${prefix}-${date}-${random}`;
}

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
        const usersCollection = db.collection('users');
        const parcelCollection = db.collection('parcels');
        const paymentCollection = db.collection('payments');
        const ridersCollection = db.collection('riders');

        // users related api
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'user';
            user.createdAt = new Date();
            const email = user.email;

            const userExists = await usersCollection.findOne({ email });
            if (userExists) {
                return res.send({message: 'User Exist'});
            }

            const result = usersCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/:id', verifyFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const roleInfo = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: roleInfo.role
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        app.get('/users', verifyFirebaseToken, async (req, res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // parcel api
        app.get('/parcels', async (req, res) => {
            const query = {};
            const { email } = req.query;

            if (email) {
                query.senderEmail = email;
            }

            const options = { sort: { createdAt: -1 } };

            const cursor = parcelCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await parcelCollection.findOne(query);
            res.send(result);
        });

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();
            parcel.paymentStatus = 'unpaid';

            const result = await parcelCollection.insertOne(parcel);
            res.send(result);
        });

        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await parcelCollection.deleteOne(query);
            res.send(result);
        })

        // payment related api
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100;

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: amount,
                            product_data: {
                                name: `Please pay for ${paymentInfo.parcelName}`,
                            }
                        },
                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo.senderEmail,
                mode: 'payment',
                metadata: {
                    parcelId: paymentInfo.parcelId,
                    parcelName: paymentInfo.parcelName,
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
            })

            res.send({ url: session.url });
        });

        app.patch('/payment-success', async (req, res) => {
            const sessionId = req.query.session_id;

            const session = await stripe.checkout.sessions.retrieve(sessionId);

            const transactionId = session.payment_intent;
            const query = { transactionId: transactionId };
            const paymentExist = await paymentCollection.findOne(query);

            if (paymentExist) {
                return res.send({
                    message: 'already exist',
                    transactionId,
                    trackingId: paymentExist.trackingId
                });
            }

            const trackingId = generateTrackingId();

            if (session.payment_status === 'paid') {
                const id = session.metadata.parcelId;
                const query = { _id: new ObjectId(id) };
                const update = {
                    $set: {
                        paymentStatus: 'paid',
                        trackingId: trackingId
                    }
                }
                const options = {};
                const result = await parcelCollection.updateOne(query, update, options);

                const payment = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    parcelId: session.metadata.parcelId,
                    parcelName: session.metadata.parcelName,
                    transactionId: transactionId,
                    paymentStatus: session.payment_status,
                    paidAt: new Date(),
                    trackingId: trackingId
                }

                if (session.payment_status === 'paid') {
                    const resultPayment = await paymentCollection.insertOne(payment);
                    res.send(
                        {
                            success: true,
                            modifyParcel: result,
                            trackingId: trackingId,
                            transactionId: session.payment_intent,
                            paymentInfo: resultPayment
                        }
                    );
                }
            }

            res.send({ success: false });
        })

        app.get('/payments', verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {}
            if (email) {
                query.customerEmail = email;

                // check email address
                if (email !== req.decoded_email) {
                    return res.status(403).send({ message: 'forbidden access' });
                }
            }

            const cursor = paymentCollection.find(query).sort({ paidAt: -1 });
            const result = await cursor.toArray();
            res.send(result);
        });

        // riders related api
        app.post('/riders', async (req, res) => {
            const rider = req.body;
            rider.status = 'pending';
            rider.createdAt = new Date();

            const result = await ridersCollection.insertOne(rider);
            res.send(result);
        });

        app.get('/riders', async (req, res) => {
            const query = {};
            if (req.query.status) {
                query.status = req.query.status;
            }
            
            const cursor = ridersCollection.find(query).sort({createdAt: -1});
            const result = await cursor.toArray();
            res.send(result);
        });

        app.patch('/riders/:id', verifyFirebaseToken, async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: status
                }
            }

            const result = await ridersCollection.updateOne(query, updatedDoc);

            if (status === 'approved') {
                const email = req.body.email;
                const userQuery = {email};
                const updateUser = {
                    $set: {
                        role: 'rider'
                    }
                }
                const userResult = await usersCollection.updateOne(userQuery, updateUser);            
            }

            res.send(result);
        });

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