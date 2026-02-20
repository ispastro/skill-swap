/**
 * Skill Taxonomy — Normalization Map
 * 
 * Maps skill aliases, abbreviations, and common variants to a canonical form.
 * This eliminates the need for ML-based synonym generation.
 * 
 * Rules:
 * - All canonical names are lowercase, no special characters
 * - Add new mappings as users introduce new skill names
 */

const SKILL_ALIASES: Record<string, string> = {
    // --- Programming Languages ---
    'js': 'javascript',
    'javascript': 'javascript',
    'ecmascript': 'javascript',
    'es6': 'javascript',
    'es2015': 'javascript',
    'typescript': 'typescript',
    'ts': 'typescript',
    'python': 'python',
    'py': 'python',
    'python3': 'python',
    'java': 'java',
    'c#': 'csharp',
    'csharp': 'csharp',
    'c sharp': 'csharp',
    'c++': 'cpp',
    'cpp': 'cpp',
    'c plus plus': 'cpp',
    'c': 'c',
    'go': 'golang',
    'golang': 'golang',
    'rust': 'rust',
    'ruby': 'ruby',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'kt': 'kotlin',
    'dart': 'dart',
    'r': 'r-lang',
    'r language': 'r-lang',
    'scala': 'scala',
    'perl': 'perl',
    'lua': 'lua',
    'matlab': 'matlab',
    'sql': 'sql',
    'html': 'html',
    'html5': 'html',
    'css': 'css',
    'css3': 'css',
    'sass': 'sass',
    'scss': 'sass',
    'less': 'less',

    // --- Frontend Frameworks ---
    'react': 'react',
    'reactjs': 'react',
    'react.js': 'react',
    'react js': 'react',
    'vue': 'vue',
    'vuejs': 'vue',
    'vue.js': 'vue',
    'vue js': 'vue',
    'angular': 'angular',
    'angularjs': 'angular',
    'angular.js': 'angular',
    'svelte': 'svelte',
    'sveltejs': 'svelte',
    'next': 'nextjs',
    'nextjs': 'nextjs',
    'next.js': 'nextjs',
    'nuxt': 'nuxtjs',
    'nuxtjs': 'nuxtjs',
    'nuxt.js': 'nuxtjs',
    'tailwind': 'tailwindcss',
    'tailwindcss': 'tailwindcss',
    'tailwind css': 'tailwindcss',
    'bootstrap': 'bootstrap',

    // --- Backend ---
    'node': 'nodejs',
    'nodejs': 'nodejs',
    'node.js': 'nodejs',
    'node js': 'nodejs',
    'express': 'expressjs',
    'expressjs': 'expressjs',
    'express.js': 'expressjs',
    'django': 'django',
    'flask': 'flask',
    'fastapi': 'fastapi',
    'spring': 'spring',
    'spring boot': 'spring',
    'springboot': 'spring',
    'rails': 'rails',
    'ruby on rails': 'rails',
    'laravel': 'laravel',
    'nest': 'nestjs',
    'nestjs': 'nestjs',
    'nest.js': 'nestjs',
    'asp.net': 'aspnet',
    'aspnet': 'aspnet',

    // --- Databases ---
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'mysql': 'mysql',
    'mongodb': 'mongodb',
    'mongo': 'mongodb',
    'redis': 'redis',
    'sqlite': 'sqlite',
    'firebase': 'firebase',
    'supabase': 'supabase',
    'dynamodb': 'dynamodb',
    'cassandra': 'cassandra',
    'elasticsearch': 'elasticsearch',

    // --- DevOps & Cloud ---
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'k8s': 'kubernetes',
    'aws': 'aws',
    'amazon web services': 'aws',
    'gcp': 'gcp',
    'google cloud': 'gcp',
    'azure': 'azure',
    'ci/cd': 'cicd',
    'cicd': 'cicd',
    'ci cd': 'cicd',
    'terraform': 'terraform',
    'ansible': 'ansible',
    'jenkins': 'jenkins',
    'github actions': 'github-actions',
    'git': 'git',
    'linux': 'linux',
    'bash': 'bash',
    'shell': 'bash',
    'nginx': 'nginx',

    // --- Mobile ---
    'react native': 'react-native',
    'reactnative': 'react-native',
    'flutter': 'flutter',
    'ios': 'ios-dev',
    'ios development': 'ios-dev',
    'android': 'android-dev',
    'android development': 'android-dev',

    // --- Data & AI ---
    'machine learning': 'machine-learning',
    'ml': 'machine-learning',
    'deep learning': 'deep-learning',
    'dl': 'deep-learning',
    'artificial intelligence': 'ai',
    'ai': 'ai',
    'data science': 'data-science',
    'data analysis': 'data-analysis',
    'data engineering': 'data-engineering',
    'nlp': 'nlp',
    'natural language processing': 'nlp',
    'computer vision': 'computer-vision',
    'cv': 'computer-vision',
    'tensorflow': 'tensorflow',
    'tf': 'tensorflow',
    'pytorch': 'pytorch',
    'pandas': 'pandas',
    'numpy': 'numpy',

    // --- Design ---
    'ui': 'ui-design',
    'ui design': 'ui-design',
    'ux': 'ux-design',
    'ux design': 'ux-design',
    'ui/ux': 'uiux-design',
    'uiux': 'uiux-design',
    'figma': 'figma',
    'sketch': 'sketch',
    'adobe xd': 'adobe-xd',
    'photoshop': 'photoshop',
    'illustrator': 'illustrator',
    'graphic design': 'graphic-design',
    'web design': 'web-design',

    // --- General Skills ---
    'frontend': 'frontend-dev',
    'front end': 'frontend-dev',
    'front-end': 'frontend-dev',
    'frontend development': 'frontend-dev',
    'backend': 'backend-dev',
    'back end': 'backend-dev',
    'back-end': 'backend-dev',
    'backend development': 'backend-dev',
    'fullstack': 'fullstack-dev',
    'full stack': 'fullstack-dev',
    'full-stack': 'fullstack-dev',
    'devops': 'devops',
    'dev ops': 'devops',
    'api': 'api-development',
    'api development': 'api-development',
    'rest api': 'api-development',
    'restful': 'api-development',
    'graphql': 'graphql',
    'websockets': 'websockets',
    'websocket': 'websockets',
    'testing': 'testing',
    'unit testing': 'unit-testing',
    'tdd': 'tdd',
    'agile': 'agile',
    'scrum': 'scrum',

    // --- Non-Tech Skills ---
    'guitar': 'guitar',
    'piano': 'piano',
    'singing': 'singing',
    'vocals': 'singing',
    'music production': 'music-production',
    'photography': 'photography',
    'video editing': 'video-editing',
    'writing': 'writing',
    'copywriting': 'copywriting',
    'content writing': 'content-writing',
    'blogging': 'blogging',
    'cooking': 'cooking',
    'baking': 'baking',
    'drawing': 'drawing',
    'painting': 'painting',
    'illustration': 'illustration',
    'animation': 'animation',
    '3d modeling': '3d-modeling',
    'language learning': 'language-learning',
    'english': 'english',
    'spanish': 'spanish',
    'french': 'french',
    'amharic': 'amharic',
    'arabic': 'arabic',
    'mandarin': 'mandarin',
    'chinese': 'mandarin',
    'japanese': 'japanese',
    'public speaking': 'public-speaking',
    'leadership': 'leadership',
    'project management': 'project-management',
    'marketing': 'marketing',
    'digital marketing': 'digital-marketing',
    'seo': 'seo',
    'social media': 'social-media-marketing',
    'entrepreneurship': 'entrepreneurship',
    'finance': 'finance',
    'accounting': 'accounting',
    'math': 'mathematics',
    'mathematics': 'mathematics',
    'statistics': 'statistics',
    'physics': 'physics',
    'chemistry': 'chemistry',
    'biology': 'biology',
};

/**
 * Normalize a single skill name using the taxonomy.
 * Falls back to lowercase trimming if no alias is found.
 */
export function normalizeSkillName(skill: string): string {
    const cleaned = skill.toLowerCase().trim().replace(/\s+/g, ' ');
    return SKILL_ALIASES[cleaned] || cleaned;
}

/**
 * Normalize an array of skills, removing duplicates.
 */
export function normalizeSkillList(skills: string[]): string[] {
    const normalized = skills.map(normalizeSkillName);
    return [...new Set(normalized)];
}

/**
 * Check if a skill name is known in the taxonomy.
 */
export function isKnownSkill(skill: string): boolean {
    const cleaned = skill.toLowerCase().trim().replace(/\s+/g, ' ');
    return cleaned in SKILL_ALIASES;
}

/**
 * Get all canonical skill names in the taxonomy.
 */
export function getCanonicalSkills(): string[] {
    return [...new Set(Object.values(SKILL_ALIASES))];
}

export { SKILL_ALIASES };
