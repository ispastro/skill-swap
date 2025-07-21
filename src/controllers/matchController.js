import prisma from '../config/db.js';


export const findKillsMatch = async(req, res)=>{
try{
  const currentUser = await prisma.user.findUnique({
    where :{id:req.user.id},
    
  });

  if(!currentUser){
    return res.status(404).json({message: "user not found 🚫"}) ;
  }


  const matches = await prisma.user.findMany({
where:{id:{not:currentUser.id}},
select:{
  id:true,
  name:true,
  email:true,
  skillsWant:true,
  skillsHave:true,
},
  });

res.status(200).json({
    message: matches.length>0  ? "Matches found! 🎉" : "No matches found. Try updating your profile! 📝",
    matches,

});




}catch(error){
    console.error("Matchmaking error:", error);
    res.status(500).json({message: "Internal server error. Please try again later."});
}


}