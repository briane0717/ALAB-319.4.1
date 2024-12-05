import express from "express";
import db from "../db/conn.mjs";

const router = express.Router();

/**
 * It is not best practice to separate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizes: 30%
 * - Homework: 20%
 */

// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = await db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $match: { learner_id: Number(req.params.id) },
      },
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$class_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          class_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
    ])
    .toArray();

  if (!result) res.status(404).send("Not found");
  else res.status(200).send(result);
});

// Aggregate statistics for all learners
router.get("/stats", async (req, res) => {
  try {
    const collection = await db.collection("grades");
    const stats = await collection
      .aggregate([
        {
          $project: {
            learner_id: 0,
            class_id: 1,
            weightedAverage: { $avg: "$scores.score" },
          },
        },
        {
          $group: {
            _id: null,
            totalLearners: { $sum: 1 },
            above70Count: {
              $sum: { $cond: [{ $gt: ["$weightedAverage", 70] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalLearners: 1,
            above70Count: 1,
            above70Percentage: {
              $multiply: [
                { $divide: ["$above70Count", "$totalLearners"] },
                100,
              ],
            },
          },
        },
      ])
      .toArray();

    res.status(200).send(stats[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to calculate statistics" });
  }
});

export default router;
