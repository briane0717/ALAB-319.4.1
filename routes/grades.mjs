import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

// Helper function to validate ObjectId
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);
// console.log(ObjectId);

// Create a single grade entry
router.post("/", async (req, res) => {
  let collection = await db.collection("grades");
  let newDocument = req.body;

  // rename fields for backwards compatibility
  if (newDocument.student_id) {
    newDocument.learner_id = newDocument.student_id;
    delete newDocument.student_id;
  }

  let result = await collection.insertOne(newDocument);
  res.status(204).send(result);
});

// Get a single grade entry
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).send({ error: "Invalid ID format" });
  }

  let collection = await db.collection("grades");
  let query = { _id: new ObjectId(id) };

  try {
    let result = await collection.findOne(query);

    if (!result) return res.status(404).send("Not found");
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Add a score to a grade entry
router.patch("/:id/add", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).send({ error: "Invalid ID format" });
  }

  let collection = await db.collection("grades");
  let query = { _id: ObjectId(id) };

  try {
    let result = await collection.updateOne(query, {
      $push: { scores: req.body },
    });

    if (!result.matchedCount) return res.status(404).send("Not found");
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Remove a score from a grade entry
router.patch("/:id/remove", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).send({ error: "Invalid ID format" });
  }

  let collection = await db.collection("grades");
  let query = { _id: ObjectId(id) };

  try {
    let result = await collection.updateOne(query, {
      $pull: { scores: req.body },
    });

    if (!result.matchedCount) return res.status(404).send("Not found");
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Delete a single grade entry
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).send({ error: "Invalid ID format" });
  }

  let collection = await db.collection("grades");
  let query = { _id: ObjectId(id) };

  try {
    let result = await collection.deleteOne(query);

    if (!result.deletedCount) return res.status(404).send("Not found");
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Get route for backwards compatibility
router.get("/student/:id", async (req, res) => {
  res.redirect(`learner/${req.params.id}`);
});

// Get a learner's grade data
router.get("/learner/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { learner_id: Number(req.params.id) };

  // Check for class_id parameter
  if (req.query.class) query.class_id = Number(req.query.class);

  let result = await collection.find(query).toArray();

  if (!result) res.status(404).send("Not found");
  else res.status(200).send(result);
});

// Delete a learner's grade data
router.delete("/learner/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { learner_id: Number(req.params.id) };

  let result = await collection.deleteOne(query);

  if (!result.deletedCount) res.status(404).send("Not found");
  else res.status(200).send(result);
});

// Get a class's grade data
router.get("/class/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { class_id: Number(req.params.id) };

  // Check for learner_id parameter
  if (req.query.learner) query.learner_id = Number(req.query.learner);

  let result = await collection.find(query).toArray();

  if (!result) res.status(404).send("Not found");
  else res.status(200).send(result);
});

// Update a class id
router.patch("/class/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { class_id: Number(req.params.id) };

  try {
    let result = await collection.updateMany(query, {
      $set: { class_id: req.body.class_id },
    });

    if (!result.matchedCount) res.status(404).send("Not found");
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});
router.get("/", async (req, res) => {
  try {
    let collection = await db.collection("grades");
    let result = await collection.find().toArray();
    res.status(200).send(result);
  } catch {
    console.error("Error fetching documents:", error);
    res.status(500).send("Error fetching documents");
  }
});

router.get("/stats", async (req, res) => {
  try {
    let collection = await db.collection("grades");
    let result = await collection
      .aggregate([
        {
          $group: {
            _id: "$",
          },
        },
      ])
      .toArray();

    console.log(result);
    res.status(200).send(result);
  } catch (error) {
    console.error("Error counting documents:", error);
    res.status(500).send("Error counting documents");
  }
});

// GET /grades/stats/:id
router.get("/stats/:id", async (req, res) => {
  const classId = Number(req.params.id);
  if (isNaN(classId)) {
    return res.status(400).send({ error: "Invalid class_id" });
  }

  try {
    const collection = await db.collection("grades");

    const result = await collection
      .aggregate([
        { $match: { class_id: classId } }, // Filter by class_id
        {
          $group: {
            _id: "$learner_id", // Group by learner_id
            averageScore: { $avg: "$scores.value" }, // Example: average score calculation
            totalScores: { $sum: "$scores.value" }, // Example: total score calculation
            scoreCount: { $sum: 1 }, // Count documents
          },
        },
        { $sort: { averageScore: -1 } }, // Sort by averageScore descending
      ])
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error("Error in stats route:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Create indices
(async () => {
  try {
    const collection = await db.collection("grades");

    // Single-field indices
    await collection.createIndex({ class_id: 1 });
    await collection.createIndex({ learner_id: 1 });

    // Compound index
    await collection.createIndex({ learner_id: 1, class_id: 1 });

    console.log("Indices created successfully.");
  } catch (error) {
    console.error("Error creating indices:", error);
  }
})();

// Set validation rules
(async () => {
  try {
    const adminDb = await db.admin();
    const validation = {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["class_id", "learner_id"],
          properties: {
            class_id: {
              bsonType: "int",
              minimum: 0,
              maximum: 300,
              description: "Must be an integer between 0 and 300.",
            },
            learner_id: {
              bsonType: "int",
              minimum: 0,
              description: "Must be an integer greater than or equal to 0.",
            },
          },
        },
      },
      validationAction: "warn",
    };

    await adminDb.command({
      collMod: "grades",
      ...validation,
    });

    console.log("Validation rules updated successfully.");
  } catch (error) {
    console.error("Error setting validation rules:", error);
  }
})();

// Delete a class
router.delete("/class/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { class_id: Number(req.params.id) };

  try {
    let result = await collection.deleteMany(query);

    if (!result.deletedCount) res.status(404).send("Not found");
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});

export default router;
