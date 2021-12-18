const express = require("express");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');

const cors = require("cors");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());
// app.use(express.json({limit: '50mb'}));
// app.use(express.limit(100000000));
app.use(bodyParser.json({
  limit: '50mb'
}));

app.use(bodyParser.urlencoded({
  limit: '50mb',
  parameterLimit: 100000,
  extended: true 
}));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5bgr9.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();
    const database = client.db("restore-service");
    const usersCollection = database.collection("users");
    const reviewCollection = client.db("restore-service").collection("review");
    const servicesCollection = client.db("restore-service").collection("services");
    const ordersCollection = client.db("restore-service").collection("orders");

    // users insert in db
    app.post("/users", async (req, res) => {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        // console.log(result);
        res.json(result);
      });
      // google users update
      app.put("/users", async (req, res) => {
        const user = req.body;
        const filter = { email: user.email };
        const options = { upsert: true };
        const updateDoc = { $set: user };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.json(result);
      });
      app.put("/users/admin", async (req, res) => {
        const user = req.body;
        const filter = {email: user.email};
        const updateDoc = {$set: {role: 'admin'}}
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.json(result);
    });
    // check admin or not
    app.get("/checkAdmin/:email", async (req, res) => {
        const result = await usersCollection
        .find({ email: req.params.email })
        .toArray();
        // console.log(result);
        res.send(result);
    });
    //post api for add review insert
    app.post("/review", async (req, res) => {
        const review = req.body;
        console.log("hit the post api", review);
        const result = await reviewCollection.insertOne(review);
        // console.log(result);
        res.json(result);
      });
      // GET API for show review
      app.get("/review", async (req, res) => {
        const cursor = reviewCollection.find({});
        const review = await cursor.toArray();
        res.send(review);
      });
      //post api for add product insert
    app.post("/services", async (req, res) => {
      let service = req.body;
      const image = req.files.image;
      const imageData = image.data;
      const encodedPic = imageData.toString("base64");
      const imageBuffer = Buffer.from(encodedPic, "base64");
      service["image"] = imageBuffer;
      const result = await servicesCollection.insertOne(service);
      res.send(result);
    });
    //show service
    app.get('/services', async (req, res) => {
      const result = await servicesCollection.find({}).toArray();
      res.send(result);
  })
  // GET Single service id
  app.get("/services/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await servicesCollection.findOne(query);
    res.json(result);
  });
  // delete service
  app.delete("/services/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await servicesCollection.deleteOne(query);
    // console.log("deleting user with id ", result);
    res.json(result);
  });
   // Add Orders API
   app.post("/placeorder", async (req, res) => {
    const order = req.body;
    const result = await ordersCollection.insertOne(order);
    res.json(result);
  });
  // show my orders
  app.get("/myOrder/:email", async (req, res) => {
    const result = await ordersCollection
      .find({
        email: req.params.email,
      })
      .toArray();
    res.send(result);
  });
  app.delete("/myOrders/:id", (req, res) => {
    ordersCollection
      .deleteOne({ _id: req.params.id })
      .then((result) => {
        res.send(result);
        console.log(result);
      });
    console.log(req.params.id);
  });
  // show my orders
  app.get("/orders", async (req, res) => {
    const cursor = ordersCollection.find({});
    const product = await cursor.toArray();
    res.send(product);
  });
    //update orders api
      app.put("/updateStatusOrders/:id", async (req, res) => {
        const id = req.params.id;
        const updatedOrders = req.body;
        const query = { _id: id };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            OrderStatus: updatedOrders.OrderStatus,
          },
        };
        const result = await ordersCollection.updateOne(
          query,
          updatedDoc,
          options
        );
        res.json(result);
      });
      // show my orders
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await ordersCollection.findOne(query);
      res.send(result);
    });

    app.post('/create-payment-intent', async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
          currency: 'usd',
          amount: amount,
          payment_method_types: ['card']
      });
      res.json({ clientSecret: paymentIntent.client_secret })
  })
  app.put('/orders/:id', async (req, res) => {
    const id = req.params.id;
    const payment = req.body;
    const filter = { _id: id };
    const updateDoc = {
        $set: {
            payment: payment
        }
    };
    const result = await ordersCollection.updateOne(filter, updateDoc);
    res.json(result);
});


   
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("running my restore server");
});
app.listen(port, () => {
  console.log("listening on port", port);
});
