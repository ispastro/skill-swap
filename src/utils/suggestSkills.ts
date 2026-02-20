const relatedSkillsMap: Record<string, string[]> = {
    javascript: ['typescript', 'node.js', 'react', 'vue'],
    python: ['flask', 'django', 'pandas', 'numpy'],
    react: ['redux', 'next.js'],
    node: ['express', 'mongodb'],
};

export const suggestSkills = (userSkills: string[] = []): string[] => {
    const lowerSkills = userSkills.map(s => s.toLowerCase());
    const suggestions = new Set<string>();

    lowerSkills.forEach(skill => {
        if (relatedSkillsMap[skill]) {
            relatedSkillsMap[skill].forEach(s => {
                if (!lowerSkills.includes(s)) suggestions.add(s);
            });
        }
    });

    return Array.from(suggestions);
};
