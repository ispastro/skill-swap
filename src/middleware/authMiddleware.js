import jwt from 'jsonwebtoken';

//  This middleware checks if a user is authenticated (has a valid token)
const authMiddleware = async (req, res, next) => {
  // 1. Get the Authorization header
  const authHeader = req.headers.authorization;

  // 2. Check if the header exists and starts with "Bearer"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  // 3. Extract the token part
  const token = authHeader.split(' ')[1];

  try {
    // 4. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // ⚠️ fixed typo from JWT_SECERET → JWT_SECRET

    // 5. Attach the user info to the request (you can now access req.user in protected routes)
    req.user = decoded;

    next(); //  go to the next middleware or route handler

  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};
export default authMiddleware; // export as 'protect' for consistency with other files
