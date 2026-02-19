interface UserProfile {
    bio?: string | null;
    skillsHave?: string[];
    skillsWant?: string[];
}

interface ProfileCompletionResult {
    profileCompleted: boolean;
    missing: string[];
}

export function checkProfileCompletion(user: UserProfile): ProfileCompletionResult {
    const hasBio = (user.bio?.trim().length ?? 0) > 0;
    const hasSkillsHave = Array.isArray(user.skillsHave) && user.skillsHave.length > 0;
    const hasSkillsWant = Array.isArray(user.skillsWant) && user.skillsWant.length > 0;

    const profileCompleted = hasBio && hasSkillsHave && hasSkillsWant;

    const missing: string[] = [];
    if (!hasBio) missing.push('bio');
    if (!hasSkillsHave) missing.push('skillsHave');
    if (!hasSkillsWant) missing.push('skillsWant');

    return { profileCompleted, missing };
}
