import { MongoClient } from "mongodb";

import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.ATLAS_URI);

let conn;
try {
  conn = await client.connect();
  console.log("connected");
} catch (err) {
  console.log(err);
}
let db = conn.db("sample_training"); // Put the actual Database you want to call inside.

export default db;
