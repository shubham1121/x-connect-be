import { Request, Response } from "express";
import User from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    // Send response (without password)
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const loginUser = async (req : Request, res: Response) => {
  try{
      const { email, password } = req.body;
      if(!email || !password){
          return res.status(400).json({
              message: "Email and password are required"
          });
      }
      const user = await User.findOne({ email });
      if(!user){
          return res.status(400).json({
              message: "Invalid email or password"
          });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if(!isMatch){
          return res.status(400).json({
              message: "Invalid email or password"
          });
      }

      const token = jwt.sign(
      {
        userId: user._id,
        email: user.email
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d"
      }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  }
  catch(error){
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
