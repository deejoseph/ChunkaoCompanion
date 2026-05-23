// Part 1 话题库
export const part1Topics = {
    study: {
        name: '学习',
        questions: [
            "Do you enjoy studying? Why or why not?",
            "What subject do you find most interesting? Why?",
            "Where do you prefer to study, at home or in the library?",
            "What do you usually do after studying to relax?",
            "Do you prefer studying alone or with others?"
        ]
    },
    hometown: {
        name: '家乡',
        questions: [
            "Where is your hometown? What is it famous for?",
            "What do you like most about your hometown?",
            "Has your hometown changed much in recent years?",
            "Would you recommend your hometown to tourists? Why?",
            "What kind of jobs do people in your hometown do?"
        ]
    },
    hobbies: {
        name: '爱好',
        questions: [
            "What do you like to do in your free time?",
            "How often do you do this activity?",
            "Why do you enjoy it so much?",
            "Did you have different hobbies when you were younger?",
            "Do you prefer indoor or outdoor activities?"
        ]
    },
    music: {
        name: '音乐',
        questions: [
            "What type of music do you enjoy listening to?",
            "When do you usually listen to music?",
            "Do you play any musical instrument?",
            "Has your taste in music changed over time?",
            "Do you prefer live music or recorded music?"
        ]
    },
    sport: {
        name: '运动',
        questions: [
            "Do you like sports? Why or why not?",
            "What sports do you play or watch regularly?",
            "How often do you exercise?",
            "Why is physical activity important for students?",
            "Do you prefer team sports or individual sports?"
        ]
    },
    reading: {
        name: '阅读',
        questions: [
            "Do you enjoy reading books? Why?",
            "What kind of books do you like to read?",
            "When did you last read a book?",
            "Do you prefer e-books or paper books? Why?",
            "Who is your favorite author?"
        ]
    },
    weather: {
        name: '天气',
        questions: [
            "What's the weather like in your hometown?",
            "Which season do you like best? Why?",
            "How does weather affect your mood?",
            "Do you prefer hot or cold weather?",
            "What do you do on rainy days?"
        ]
    },
    technology: {
        name: '科技',
        questions: [
            "How often do you use the internet?",
            "What do you use your phone for most?",
            "Has technology changed how you study?",
            "Do you think we rely too much on computers?",
            "What's your favorite app? Why?"
        ]
    },
    travel: {
        name: '旅行',
        questions: [
            "Do you like to travel? Why or why not?",
            "What was your best travel experience?",
            "Do you prefer traveling alone or with others?",
            "What place would you like to visit in the future?",
            "Do you prefer domestic or international travel?"
        ]
    },
    food: {
        name: '食物',
        questions: [
            "What's your favorite food?",
            "Do you prefer home-cooked meals or eating out?",
            "Can you cook? What can you make?",
            "What food is famous in your hometown?",
            "Have your eating habits changed over time?"
        ]
    }
};

// Part 2 话题卡
export const part2Topics = [
    {
        id: 1,
        title: "Describe a gift you received that was important to you",
        prompts: ["what the gift was", "who gave it to you", "when you received it", "and explain why it was important to you"],
        followUp: "gift"
    },
    {
        id: 2,
        title: "Describe a trip you enjoyed recently",
        prompts: ["where you went", "who you went with", "what you did there", "and explain why you enjoyed it"],
        followUp: "travel"
    },
    {
        id: 3,
        title: "Describe a book that influenced you",
        prompts: ["what the book is", "when you read it", "what it is about", "and explain why it influenced you"],
        followUp: "reading"
    },
    {
        id: 4,
        title: "Describe a person you admire",
        prompts: ["who this person is", "how you know them", "what they do", "and explain why you admire them"],
        followUp: "person"
    },
    {
        id: 5,
        title: "Describe a skill you want to learn",
        prompts: ["what the skill is", "why you want to learn it", "how you plan to learn it", "and explain how it will help you"],
        followUp: "education"
    },
    {
        id: 6,
        title: "Describe a memorable event in your life",
        prompts: ["what the event was", "when and where it happened", "who was with you", "and explain why it was memorable"],
        followUp: "experience"
    },
    {
        id: 7,
        title: "Describe a piece of advice you received",
        prompts: ["what the advice was", "who gave it to you", "what situation it was about", "and explain how it helped you"],
        followUp: "advice"
    },
    {
        id: 8,
        title: "Describe a website you often use",
        prompts: ["what the website is", "how you found it", "what you use it for", "and explain why you like it"],
        followUp: "technology"
    }
];

// Part 3 后续问题
export const part3FollowUp = {
    gift: {
        category: "Gifts and Values",
        questions: [
            "In your culture, is it common to give gifts?",
            "Do you think people spend too much money on gifts nowadays?",
            "What factors influence people's choice of gifts?",
            "Do you think handmade gifts are more meaningful than bought ones?",
            "Should parents give children expensive gifts?"
        ]
    },
    travel: {
        category: "Travel and Tourism",
        questions: [
            "Do you think travel is important for education? Why?",
            "How has tourism changed in recent years?",
            "What are the advantages and disadvantages of tourism?",
            "Do you prefer domestic or international travel? Why?",
            "How does travel affect a person's perspective?"
        ]
    },
    reading: {
        category: "Reading and Education",
        questions: [
            "Do you think people read less now than in the past?",
            "How has technology changed reading habits?",
            "Should schools encourage more reading?",
            "What's the future of printed books?",
            "Is reading more important for children or adults?"
        ]
    },
    person: {
        category: "Role Models and Influence",
        questions: [
            "What qualities make a good role model?",
            "Do celebrities have a responsibility to be good role models?",
            "Who influences young people more, parents or celebrities?",
            "How do role models affect society?",
            "Is it important for leaders to be good role models?"
        ]
    },
    education: {
        category: "Education and Skills",
        questions: [
            "What skills are most important for young people to learn?",
            "Should schools teach practical life skills?",
            "How does education affect career opportunities?",
            "Is online learning as effective as traditional learning?",
            "What's the purpose of education?"
        ]
    },
    experience: {
        category: "Life Experiences",
        questions: [
            "How do life experiences shape a person's character?",
            "Do you think people learn more from success or failure?",
            "Why do some people remember certain events more clearly?",
            "How does memory affect our identity?",
            "Can people change their personality through experiences?"
        ]
    },
    advice: {
        category: "Advice and Decision Making",
        questions: [
            "Who do people usually turn to for advice?",
            "Is it better to get advice from family or friends?",
            "How has the internet changed how people seek advice?",
            "Why do some people ignore good advice?",
            "What makes advice valuable?"
        ]
    },
    technology: {
        category: "Technology and Society",
        questions: [
            "How has technology changed the way we communicate?",
            "What are the disadvantages of overusing technology?",
            "Will artificial intelligence replace human jobs?",
            "How can we balance technology use and real-life interaction?",
            "What's the most important technological invention in recent years?"
        ]
    }
};

export const getRandomPart1Question = () => {
    const topics = Object.values(part1Topics);
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const randomQuestion = randomTopic.questions[Math.floor(Math.random() * randomTopic.questions.length)];
    return { topic: randomTopic.name, question: randomQuestion, category: randomTopic.name };
};

export const getRandomPart2Topic = () => {
    const randomIndex = Math.floor(Math.random() * part2Topics.length);
    return part2Topics[randomIndex];
};

export const getPart3Questions = (followUpKey) => {
    return part3FollowUp[followUpKey] || part3FollowUp.education;
};