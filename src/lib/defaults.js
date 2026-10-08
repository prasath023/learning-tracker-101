export const uid = () => Math.random().toString(36).slice(2, 9);

export const PALETTE = ['#ffa116', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e', '#eab308', '#6366f1'];

/** Starter roadmaps. When a new subject's name matches a template, its topics are offered. */
export const TOPIC_TEMPLATES = {
  DSA: [
    'Big-O & complexity analysis', 'Arrays & Hashing', 'Two Pointers', 'Sliding Window', 'Stack', 'Binary Search',
    'Linked List', 'Trees', 'Tries', 'Heap / Priority Queue', 'Backtracking', 'Graphs (BFS / DFS)',
    'Advanced Graphs (Dijkstra, Union-Find, Topo sort)', '1-D Dynamic Programming', '2-D Dynamic Programming',
    'Greedy', 'Intervals', 'Math & Geometry', 'Bit Manipulation',
  ],
  'System Design': [
    'Scalability basics (vertical vs horizontal)', 'Load balancing', 'Caching strategies', 'CDN', 'SQL vs NoSQL',
    'Replication & Sharding', 'CAP theorem & consistency models', 'Consistent hashing', 'Message queues & pub/sub',
    'Rate limiting', 'API design (REST, gRPC, pagination)', 'Microservices vs monolith', 'Back-of-the-envelope estimation',
    'Design: URL shortener', 'Design: Chat app', 'Design: News feed', 'Design: Video streaming', 'Design: Ride sharing',
  ],
  AWS: [
    'IAM (users, roles, policies)', 'EC2 & Auto Scaling', 'S3 & storage classes', 'VPC, subnets, security groups',
    'ELB / ALB', 'RDS & Aurora', 'DynamoDB', 'Lambda', 'API Gateway', 'CloudFront', 'Route 53',
    'SQS / SNS / EventBridge', 'CloudWatch & CloudTrail', 'ECS / EKS / Fargate', 'CloudFormation / CDK',
    'Well-Architected Framework', 'Practice exam (SAA)',
  ],
  'English Speaking': [
    'Self introduction (60 sec)', '"Tell me about yourself"', 'Explain my projects clearly',
    'STAR method for behavioral answers', 'Strengths & weaknesses', 'Explaining my approach while coding aloud',
    'Explaining a system design aloud', 'Asking clarifying questions', 'Useful interview phrases & transitions',
    'Reducing filler words', 'Pronunciation of tech terms', 'Record & review a mock interview',
    'Salary / notice-period conversations',
  ],
};

export const makeTopics = (texts) => texts.map((text) => ({ id: uid(), text, done: false }));

export function defaultState() {
  const seed = [
    ['DSA', '#ffa116', 90],
    ['System Design', '#3b82f6', 60],
    ['AWS', '#a855f7', 45],
    ['English Speaking', '#ec4899', 30],
  ];
  const subjects = [];
  const topics = {};
  for (const [name, color, goal] of seed) {
    const id = uid();
    subjects.push({ id, name, color, goal });
    topics[id] = makeTopics(TOPIC_TEMPLATES[name]);
  }
  return { version: 2, subjects, logs: {}, notes: {}, topics, schedule: [], timer: null, ui: { period: 'daily', topicTab: subjects[0].id } };
}
