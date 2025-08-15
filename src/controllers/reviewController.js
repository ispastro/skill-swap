import prisma from '../config/db.js';


export const createReview = async(req, res)=>{

    try{
        const { revieweeId, rating, comment } = req.body;
        const reviewerId = req.user.id;


        if(!revieweeId || !rating ) {
            return res.status(400).json({message : "Reviewee Id and rating are required fields"});
        }


        // this is to check that user can't review himself
        if(reviewerId === revieweeId) {
            return res.status(400).json({message : "You cannot review yourself"});
        }

        // check if the reviewee exists
        const existing = await prisma.user.findFirst({
            where :{
                revieweeId, reviewerId
            }
        });

        if(existing){
            return res.status(400).json({message : "you have already reviewed this user"});

        }


        // create the review
        const review = await prisma.review.create({
            data:{
                revieweeId,
                reviewerId,
                rating,
                comment
            }
        });

        res.status(201).json({
            message: "Review created successfully",
            review
        });

        //


    } catch(error){
        console.error("Review creation error:", error);
        res.status(500).json({
            message:"server error",error: error.message
        });
    }
};

// get all reviews for a user( as reviewee)

export const getUserReviews = async(req, res)=>{
    try{
        const userId= req.params;

        const reviews =await prisma.review.findMany({

            where: { revieweeId: userId },
            include:{
                reviewer: {
                    select: {
                        id: true,
                        username: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({reviews});

                

        
    } catch (error) {
        console.error("Error fetching user reviews:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Get all reviews by a user (as reviewer)

export const getReviewsGiven = async(req, res)=>{
    try{
        const userId = req.params;
        const  reviews = await prisma.review.findMany({
            where: { reviewerId: userId },
            include:{
                reviewee:{
                    select:{
                        id:true,
                        username:true
                    }
                }

            },
            orderBy :{
                createdAt: 'desc'
            }
        });
        res.json({reviews});
    } catch(error){
        res.status(500).json({
            message: "server error", error: error.message
        });
    }
};

// get average rating for a user

export const getUserAverageRating  = async(req, res) =>{
    try{
        const userId = req.params;
        const result = await prisma.review.aggregate({
            where :{
                revieweeId: userId
            },
            _avg: {
                rating: true
            },
            _count: {
                rating: true
            }
        });
        res.json({ averageRating: result._avg.rating, reviewCount: result._count.rating });
    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}