import connectDB from "../../lib/db.js";
import Admin from "../../models/admin.js";
import jwt from "jsonwebtoken";
import { withAuth } from "../../lib/middleware.js";

 async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await connectDB();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "No token, auth denied" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.admin.email;

    const admin = await Admin.findOne({ email }).select("-password");
    if (!admin) return res.status(404).json({ msg: "Admin not found" });

    return res.status(200).json({ email: admin.email, username: admin.email.split("@")[0] });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ msg: "Token is not valid" });
  }
}



export default withAuth(handler);