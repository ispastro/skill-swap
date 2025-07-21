
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Register controller
export const register = async (req, res) => {
  const { username, email, password } = req.body;

  // 1. Check if all fields are provided
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // // 2. Check if the user already exists in the DB
     const exists = await prisma.user.findUnique({
      where: { email },
     });

     if (exists) {
       return res.status(400).json({ message: "User already exists" });
     }

    // 3. Hash the password
    const hash = await bcrypt.hash(password, 10);

    // 4. Create a new user in the database
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hash,
      },
    });

    // 5. Generate JWT token
    const token = jwt.sign(
      { id: user.id }, // use user.id (Postgres/Prisma)
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    // 6. Return the token
    res.status(201).json({ token });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// Login controller
export const login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Check if both fields are filled
  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // 2. Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 4. Create token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    // 5. Send token
    res.status(200).json({ token });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


