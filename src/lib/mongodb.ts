// MongoDB connection singleton — reuses the connection across hot-reloads in dev.
import { MongoClient, Db, ObjectId } from "mongodb";

export { ObjectId };

const uri = process.env.MONGODB_URI!;
if (!uri) throw new Error("MONGODB_URI env variable is not set");

// Global cache to survive HMR in dev
const g = global as typeof global & { _mongoClient?: MongoClient };

async function getClient(): Promise<MongoClient> {
  if (!g._mongoClient) {
    g._mongoClient = new MongoClient(uri);
    await g._mongoClient.connect();
  }
  return g._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db("bluwaves");
}

// Typed collections
export async function collections() {
  const db = await getDb();
  return {
    users: db.collection("users"),
    trips: db.collection("trips"),
    passengers: db.collection("passengers"),
    smsMessages: db.collection("sms_messages"),
    expenses: db.collection("expenses"),
  };
}
