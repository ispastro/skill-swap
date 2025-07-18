import prisma  from '../config/db.js';


export  const getUserProfile =async (req, res) => {
const userId = req.user.id;

    try{
        const user = await prisma.user.findUnique({
            where:{id:userId},
            select:{
                username:true,
                email:true,
                bio:true,
                skillsHave:true,
                skillsWant:true,


            },
        });

        if(!user){
            return res.status(404).json({message:"User not found"});
        }
        const profileCompleted = user.bio && user.skillsHave.length>0 && user.skillsWant.length>0;
  
        res.status(200).json({
            message:profileCompleted 
            ? "Wellcome to your Dashboard"
            : "Wellcome! Please complete your profile"
            , 
            user:{
                username:user.username,
                email:user.email
            }, 
            profileCompleted,
        });
    }
        catch(error){
          
            res.status(500).json({message:"Server error", error: error.message});
        }
    }

