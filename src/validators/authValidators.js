

import {body }  from 'express-validator';

export const registerValidator=[


    body("email")
        .notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Invalid email format"),

    body("username")
        .notEmpty().withMessage("Username is required").bail(),

    body("password")
        .notEmpty().withMessage("Password is required").bail()
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/).withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number")

]


export const loginValidator = [

    body("email")
        .notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Invalid email format"),
    

    body("password")
        .notEmpty().withMessage("Password is required").bail()

]


