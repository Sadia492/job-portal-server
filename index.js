const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-4b52d.web.app",
      "https://job-portal-4b52d.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Token verification failed", err);
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.dr5qw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const jobsCollection = client.db("jobPortalDB").collection("jobs");
    const jobsApplicationCollection = client
      .db("jobPortalDB")
      .collection("applications");
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(req.body);
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // job related works

    app.get("/jobs", async (req, res) => {
      const searchTitle = req.query.title;
      const FilterJobType = req.query.jobType;
      let query = {};
      if (searchTitle) {
        query = { title: { $regex: searchTitle, $options: "i" } };
      }
      if (FilterJobType) {
        query = { jobType: FilterJobType };
      }

      const result = await jobsCollection.find(query).toArray();

      res.send(result);
    });

    app.get("/availableJobs", async (req, res) => {
      const today = new Date();
      const result = await jobsCollection
        .find({
          applicationDeadline: { $gte: today.toISOString().split("T")[0] },
        })
        .limit(6)
        .toArray();
      //   console.log(result);
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.get("/user-jobs/:email", verifyToken, async (req, res) => {
      // console.log(req.user.email)

      if (req.user.email !== req.params.email) {
        return res.status(403).send("Forbidden access");
      }

      const newEmail = req.params.email;
      const query = { hr_email: newEmail };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const job = req.body;
      const result = await jobsCollection.insertOne(job);
      res.send(result);
    });
    app.put("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const jobsData = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: jobsData,
      };
      const result = await jobsCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    app.delete("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // application related works

    app.get("/applications", async (req, res) => {
      const result = await jobsApplicationCollection.find().toArray();
      // fokira way to do this
      for (const application of result) {
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
        }
      }
      res.send(result);
    });
    app.get("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsApplicationCollection.findOne(query);
      res.send(result);
    });
    app.get("/user-applications/:email", verifyToken, async (req, res) => {
      console.log(req.user.email);

      if (req.user.email !== req.params.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const newEmail = req.params.email;
      const query = { applicant_email: newEmail };
      const result = await jobsApplicationCollection.find(query).toArray();
      // fokira way to do this
      for (const application of result) {
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
        }
      }

      res.send(result);
    });

    app.get("/applications/jobs/:jobId", async (req, res) => {
      const id = req.params.jobId;
      const query = { job_id: id };
      const result = await jobsApplicationCollection.find(query).toArray();
      for (const application of result) {
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
        }
      }
      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await jobsApplicationCollection.insertOne(application);
      // not the best way use aggregate
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);
      let count = 0;
      if (job.applicants_count) {
        count = job.applicants_count + 1;
      } else {
        count = 1;
      }
      //   now update the job info
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          applicants_count: count,
        },
      };
      const updateResult = await jobsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.delete("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsApplicationCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const data = req.body;
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await jobsApplicationCollection.updateOne(
        query,
        updatedDoc
      );
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("My server is running");
});
app.listen(port, () => {
  console.log("my port is running");
});
