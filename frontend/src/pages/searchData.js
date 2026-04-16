// Hot search keyword list
export const HOT_SEARCHES = [
  {
    // Unique item id
    id: "hot-1",

    // Search keyword
    keyword: "assignment tips",

    // Short description for this hot topic
    blurb: "Students are collecting revision tactics and deadline survival notes.",

    // Search popularity count
    hitCount: 128,
  },
  {
    // Unique item id
    id: "hot-2",

    // Search keyword
    keyword: "group project",

    // Short description for this hot topic
    blurb: "Popular discussions about collaboration, workload balance, and planning.",

    // Search popularity count
    hitCount: 103,
  },
  {
    // Unique item id
    id: "hot-3",

    // Search keyword
    keyword: "exam prep",

    // Short description for this hot topic
    blurb: "Quick scan into the most active prep conversations this week.",

    // Search popularity count
    hitCount: 96,
  },
  {
    // Unique item id
    id: "hot-4",

    // Search keyword
    keyword: "#feedback",

    // Short description for this hot topic
    blurb: "Common reflections on class participation, peer review, and rubric comments.",

    // Search popularity count
    hitCount: 84,
  },
  {
    // Unique item id
    id: "hot-5",

    // Search keyword
    keyword: "lecture recap",

    // Short description for this hot topic
    blurb: "Searches around concise summaries, key takeaways, and clarifications.",

    // Search popularity count
    hitCount: 71,
  },
  {
    // Unique item id
    id: "hot-6",

    // Search keyword
    keyword: "weekly check-in",

    // Short description for this hot topic
    blurb: "Short progress updates and course pulse conversations are trending.",

    // Search popularity count
    hitCount: 65,
  },
];

// Mock search result list
export const MOCK_SEARCH_RESULTS = [
  {
    // Unique result id
    id: "post-1",

    // Result type
    type: "post",

    // Result title
    title: "Assignment tips for staying ahead in week 7",

    // Short preview text
    snippet:
      "A compact checklist for splitting research, drafting early, and keeping feedback loops short before the deadline hits.",

    // Target page link
    href: "/courses",

    // Course name
    courseName: "COMP9900 Capstone Project",

    // Author name
    authorName: "Ava Chen",

    // Creation time
    createdAt: "2026-03-16T09:00:00Z",

    // Ranking label
    rankLabel: "Trending in posts",

    // Tokens used for search matching
    queryTokens: ["assignment", "tips", "deadline", "feedback", "week"],
  },
  {
    // Unique result id
    id: "post-2",

    // Result type
    type: "post",

    // Result title
    title: "Group project retro: what actually made our sprint smoother",

    // Short preview text
    snippet:
      "We switched from long status updates to short daily check-ins and a shared issue list, which reduced duplicate work fast.",

    // Target page link
    href: "/courses",

    // Course name
    courseName: "COMP9900 Capstone Project",

    // Author name
    authorName: "Liam Patel",

    // Creation time
    createdAt: "2026-03-14T05:20:00Z",

    // Ranking label
    rankLabel: "Most saved this week",

    // Tokens used for search matching
    queryTokens: ["group", "project", "sprint", "check-in", "planning"],
  },
  {
    // Unique result id
    id: "post-3",

    // Result type
    type: "post",

    // Result title
    title: "Exam prep thread with concise lecture recap links",

    // Short preview text
    snippet:
      "Collected revision summaries, likely focus areas, and short recap notes from the last three lectures in one place.",

    // Target page link
    href: "/courses",

    // Course name
    courseName: "COMP9900 Capstone Project",

    // Author name
    authorName: "Mia Johnson",

    // Creation time
    createdAt: "2026-03-12T11:15:00Z",

    // Ranking label
    rankLabel: "High reply activity",

    // Tokens used for search matching
    queryTokens: ["exam", "prep", "lecture", "recap", "revision"],
  },
  {
    // Unique result id
    id: "post-4",

    // Result type
    type: "post",

    // Result title
    title: "Weekly check-in template for studio-style courses",

    // Short preview text
    snippet:
      "A reusable format for blockers, wins, and next steps that keeps updates fast without losing project context.",

    // Target page link
    href: "/studenthome",

    // Course name
    courseName: "Studio Community",

    // Author name
    authorName: "Noah Wilson",

    // Creation time
    createdAt: "2026-03-10T08:30:00Z",

    // Ranking label
    rankLabel: "Useful template",

    // Tokens used for search matching
    queryTokens: ["weekly", "check-in", "template", "updates", "project"],
  },
  {
    // Unique result id
    id: "post-5",

    // Result type
    type: "post",

    // Result title
    title: "Feedback patterns that helped improve final presentations",

    // Short preview text
    snippet:
      "Students compared what kinds of peer feedback led to clearer structure, tighter demos, and stronger delivery.",

    // Target page link
    href: "/notifications",

    // Course name
    courseName: "Presentation Workshop",

    // Author name
    authorName: "Ethan Brown",

    // Creation time
    createdAt: "2026-03-09T03:45:00Z",

    // Ranking label
    rankLabel: "Recommended read",

    // Tokens used for search matching
    queryTokens: ["feedback", "presentation", "peer", "review", "improve"],
  },
  {
    // Unique result id
    id: "post-6",

    // Result type
    type: "post",

    // Result title
    title: "Lecture recap: key product thinking frameworks in plain English",

    // Short preview text
    snippet:
      "A student-friendly summary of the core framework, with examples of how it applies to messy real project decisions.",

    // Target page link
    href: "/courses",

    // Course name
    courseName: "Product Strategy",

    // Author name
    authorName: "Sophia Kim",

    // Creation time
    createdAt: "2026-03-08T10:10:00Z",

    // Ranking label
    rankLabel: "Strong keyword match",

    // Tokens used for search matching
    queryTokens: ["lecture", "recap", "framework", "product", "thinking"],
  },
];
