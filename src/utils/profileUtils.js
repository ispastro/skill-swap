
 export function checkProfileCompletion(user) {
    const hasBio = user.bio?.trim().length>0;
    const hasSkillsHave = Array.isArray(user.skillsHave) && user.skillsHave.length > 0;
    const hasSkillsWant = Array.isArray(user.skillsWant) && user.skillsWant.length > 0;

   const profileCompleted = hasBio && hasSkillsHave && hasSkillsWant;

   const missing =[];


   if(!hasBio) missing.push("bio");
   
   if(!hasSkillsHave) missing.push("skillsHave");

   if(!hasSkillsWant) missing.push("skillsWant");


   return {
    profileCompleted,
    missing
   }
   

 }