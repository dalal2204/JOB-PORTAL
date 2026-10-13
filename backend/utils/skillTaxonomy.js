export const SKILL_TAXONOMY = {
    JavaScript: ["javascript", "js", "ecmascript"],
    TypeScript: ["typescript", "ts"],
    React: ["react", "reactjs", "react.js"],
    "Node.js": ["node.js", "nodejs", "node"],
    Express: ["express", "express.js", "expressjs"],
    Python: ["python", "py"],
    Java: ["java"],
    "C++": ["c++", "cpp"],
    SQL: ["sql", "mysql", "postgresql", "postgres"],
    MongoDB: ["mongodb", "mongo"],
    AWS: ["aws", "amazon web services"],
    Docker: ["docker"],
    Kubernetes: ["kubernetes", "k8s"],
    Git: ["git", "github", "gitlab"],
    HTML: ["html", "html5"],
    CSS: ["css", "css3", "tailwind", "tailwind css"],
    "Machine learning": ["machine learning", "ml"],
    "Natural language processing": ["natural language processing", "nlp"],
    Figma: ["figma"],
    Redis: ["redis"],
    GraphQL: ["graphql"],
    "REST APIs": ["rest api", "restful api", "rest apis"],
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const findSkills = (text, taxonomy = SKILL_TAXONOMY) => {
    const source = String(text || "").toLowerCase();
    return Object.entries(taxonomy).filter(([, aliases]) => aliases.some((alias) => {
        const pattern = escapeRegex(alias.toLowerCase()).replace(/\\ /g, "\\s+");
        return new RegExp(`(^|[^a-z0-9+#.])${pattern}($|[^a-z0-9+#.])`, "i").test(source);
    })).map(([name]) => name);
};

