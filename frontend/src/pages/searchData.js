export const HOT_SEARCHES = [
  {
    id: "hot-1",
    keyword: "assignment tips",
    blurb: "Students are collecting revision tactics and deadline survival notes.",
    hitCount: 128,
  },
  {
    id: "hot-2",
    keyword: "group project",
    blurb: "Popular discussions about collaboration, workload balance, and planning.",
    hitCount: 103,
  },
  {
    id: "hot-3",
    keyword: "exam prep",
    blurb: "Quick scan into the most active prep conversations this week.",
    hitCount: 96,
  },
  {
    id: "hot-4",
    keyword: "#feedback",
    blurb: "Common reflections on class participation, peer review, and rubric comments.",
    hitCount: 84,
  },
  {
    id: "hot-5",
    keyword: "lecture recap",
    blurb: "Searches around concise summaries, key takeaways, and clarifications.",
    hitCount: 71,
  },
  {
    id: "hot-6",
    keyword: "weekly check-in",
    blurb: "Short progress updates and course pulse conversations are trending.",
    hitCount: 65,
  },
];

export const MOCK_SEARCH_RESULTS = [
  {
    id: "post-1",
    type: "post",
    title: "Assignment tips for staying ahead in week 7",
    snippet:
      "A compact checklist for splitting research, drafting early, and keeping feedback loops short before the deadline hits.",
    href: "/courses",
    courseName: "COMP9900 Capstone Project",
    authorName: "Ava Chen",
    createdAt: "2026-03-16T09:00:00Z",
    rankLabel: "Trending in posts",
    queryTokens: ["assignment", "tips", "deadline", "feedback", "week"],
  },
  {
    id: "post-2",
    type: "post",
    title: "Group project retro: what actually made our sprint smoother",
    snippet:
      "We switched from long status updates to short daily check-ins and a shared issue list, which reduced duplicate work fast.",
    href: "/courses",
    courseName: "COMP9900 Capstone Project",
    authorName: "Liam Patel",
    createdAt: "2026-03-14T05:20:00Z",
    rankLabel: "Most saved this week",
    queryTokens: ["group", "project", "sprint", "check-in", "planning"],
  },
  {
    id: "post-3",
    type: "post",
    title: "Exam prep thread with concise lecture recap links",
    snippet:
      "Collected revision summaries, likely focus areas, and short recap notes from the last three lectures in one place.",
    href: "/courses",
    courseName: "COMP9900 Capstone Project",
    authorName: "Mia Johnson",
    createdAt: "2026-03-12T11:15:00Z",
    rankLabel: "High reply activity",
    queryTokens: ["exam", "prep", "lecture", "recap", "revision"],
  },
  {
    id: "post-4",
    type: "post",
    title: "Weekly check-in template for studio-style courses",
    snippet:
      "A reusable format for blockers, wins, and next steps that keeps updates fast without losing project context.",
    href: "/courses",
    courseName: "Studio Community",
    authorName: "Noah Wilson",
    createdAt: "2026-03-10T08:30:00Z",
    rankLabel: "Useful template",
    queryTokens: ["weekly", "check-in", "template", "updates", "project"],
  },
  {
    id: "post-5",
    type: "post",
    title: "Feedback patterns that helped improve final presentations",
    snippet:
      "Students compared what kinds of peer feedback led to clearer structure, tighter demos, and stronger delivery.",
    href: "/notifications",
    courseName: "Presentation Workshop",
    authorName: "Ethan Brown",
    createdAt: "2026-03-09T03:45:00Z",
    rankLabel: "Recommended read",
    queryTokens: ["feedback", "presentation", "peer", "review", "improve"],
  },
  {
    id: "post-6",
    type: "post",
    title: "Lecture recap: key product thinking frameworks in plain English",
    snippet:
      "A student-friendly summary of the core framework, with examples of how it applies to messy real project decisions.",
    href: "/courses",
    courseName: "Product Strategy",
    authorName: "Sophia Kim",
    createdAt: "2026-03-08T10:10:00Z",
    rankLabel: "Strong keyword match",
    queryTokens: ["lecture", "recap", "framework", "product", "thinking"],
  },
];
