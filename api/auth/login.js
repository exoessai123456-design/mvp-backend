import connectDB from "../../lib/db.js";
import Admin from "../../models/admin.js";
import jwt from "jsonwebtoken";
import { withCors } from "../../lib/middleware.js";

 async function handler(req, res) {

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await connectDB();

  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ admin: { email: admin.email, _id: admin._id } }, process.env.JWT_SECRET, { expiresIn: "1h" });
    return res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
}


export default withCors(handler);