// middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  // Get the JWT from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "No token provided or invalid format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the JWT using your secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach the decoded user payload to the request object
    next(); // Move to the next middleware or route handler
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
