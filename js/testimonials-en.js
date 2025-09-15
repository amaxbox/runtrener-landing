// Array of all testimonials (English)
const allTestimonials = [
    { quote: "The bot-coach helped me prepare for my first half marathon. Individual training plan and constant support - exactly what a beginner needs. The 1:55 result exceeded all expectations!", author: "Anna Peterson" },
    { quote: "The goal was ambitious - to improve results on all distances simultaneously. The bot created an ideal plan: already achieved 10K in 55 minutes, now going for the coveted 25 minutes on 5K. Thanks for the systematic approach!", author: "David Clark" },
    { quote: "I send the bot screenshots of workouts from the app - it instantly analyzes the data and gives specific recommendations. Progressive workouts have become much more effective!", author: "Maria Smith" },
    { quote: "It's convenient to send voice messages about workouts - the bot understands everything and gives detailed answers. The feedback is always constructive and motivating!", author: "Alex Johnson" },
    { quote: "Ran the marathon in 4:18 thanks to training with the bot. Now the goal is to conquer the 4-hour mark. I believe it's achievable with such a coach!", author: "Elena Brown" },
    { quote: "I photograph my breakfasts and lunches - the bot counts calories and gives nutrition advice for runners. It helps maintain optimal weight and energy for workouts!", author: "Steve Wilson" },
    { quote: "Dreaming of becoming a master of sport in running! Current results: 10K in 54 minutes. The bot helps steadily move toward the goal, considering my physical data and capabilities. At 33, everything is just beginning!", author: "Olga Taylor" },
    { quote: "The variety of workouts is impressive: steady runs, fartlek, intervals, repeats. The bot explains the purpose of each workout and helps execute them correctly. Progress is obvious!", author: "Igor Davis" },
    { quote: "Preparing for a marathon with a goal of 3:40-3:50. The bot even considers weather conditions when analyzing workouts! A 100-minute run in the heat went under its control.", author: "Tanya Miller" },
    { quote: "Started the path to marathon with significant excess weight. The bot created a gentle plan that gradually prepares for big loads. Already feeling progress and confidence!", author: "Andrew White" },
    { quote: "Everything went well. Completed all plans. The long run went excellently, easily, without fatigue. As planned at 5 min per km, one hour twenty. Average heart rate 147.", author: "Roman" },
    { quote: "You're an awesome bot, thank you! It's very pleasant to communicate with you.", author: "Christina" },
    { quote: "The week went well. Ran what was expected according to tasks. On Saturday did strength training, and on Sunday closed with a long 20K, aerobic, average pace 4:54.", author: "Roman" },
    { quote: "Excellent plan, thank you! Everything is clear and structured.", author: "Dmitry" },
    { quote: "Yesterday I ran 14K with 330 meters of elevation gain at 6:50 pace. Feeling great!", author: "Maria" },
    { quote: "You help me so much. I feel great, everything is according to plan, I can easily control the loads.", author: "Roman" }
];

// Function to randomly select testimonials
function getRandomTestimonials(count = 6) {
    const shuffled = [...allTestimonials].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Function to update testimonials
function updateTestimonials() {
    const testimonialsGrid = document.querySelector('.testimonials-grid');
    if (!testimonialsGrid) return;

    const randomTestimonials = getRandomTestimonials(6);
    
    // Add fade-out effect
    testimonialsGrid.style.opacity = '0.3';
    
    setTimeout(() => {
        testimonialsGrid.innerHTML = randomTestimonials.map(testimonial => `
            <div class="testimonial-card">
                <div class="testimonial-quote">${testimonial.quote}</div>
                <div class="testimonial-author">— ${testimonial.author}</div>
            </div>
        `).join('');
        
        // Fade-in effect
        testimonialsGrid.style.opacity = '1';
    }, 200);
}