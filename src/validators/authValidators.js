

import {body }  from 'express-validator';

export const registerValidator=[


    body("email")
        .notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Invalid email format"),

    body("name")
        .notEmpty().withMessage("Name is required").bail(),

    body("password")
        .notEmpty().withMessage("Password is required").bail()
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
        // Allow any characters but require at least one uppercase, one lowercase, one digit
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
        .withMessage("Password must have uppercase, lowercase, and a number")

]


export const loginValidator = [

    body("email")
        .notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Invalid email format"),
    

    body("password")
        .notEmpty().withMessage("Password is required").bail()

]


