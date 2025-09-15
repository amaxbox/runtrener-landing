// Interactive dialog demo (English)
const demoMessages = [
    {
        sender: 'user',
        text: 'Hi! I want to start running and prepare for a 5K race. I\'m a beginner in running.',
        delay: 1500
    },
    {
        sender: 'bot',
        text: 'Hi! Great that you decided to start running — it\'s an awesome choice! I\'ll help you prepare for your first 5K race as efficiently and safely as possible.',
        delay: 2500
    },
    {
        sender: 'bot',
        text: 'Let\'s get to know each other better to create an individual plan:\n1. How old are you, what\'s your height and weight?\n2. Do you have any sports experience or physical activity now?\n3. When are you planning to participate in the 5K race?',
        delay: 2000
    },
    {
        sender: 'user', 
        text: 'I\'m 28 years old, 5\'9" tall, weigh 172 lbs. Haven\'t been very active in sports lately, just occasionally at the gym.',
        delay: 1800
    },
    {
        sender: 'user',
        text: 'I want to run the race in 2-3 months.',
        delay: 1200
    },
    {
        sender: 'bot',
        text: 'Excellent! We have enough time for quality preparation — 8-12 weeks is a good timeframe for a beginner. Your parameters are normal, that\'s a plus.',
        delay: 2200
    },
    {
        sender: 'bot',
        text: 'A few more important questions:\n1. How many days a week are you ready to train?\n2. What time is more convenient for running — morning or evening?\n3. Any health issues or injuries?\n4. What\'s your goal — just finish or do you have a desired time?',
        delay: 2000
    },
    {
        sender: 'user',
        text: 'I can train 3 times a week, preferably in the evening after work. Health is fine, no injuries.',
        delay: 1600
    },
    {
        sender: 'user',
        text: 'I want to run 5K in 30 minutes or less — is that realistic for a beginner?',
        delay: 1400
    },
    {
        sender: 'bot', 
        text: 'The goal of running 5K in 30 minutes (6:00/km pace) is absolutely achievable for a beginner in 2-3 months of preparation! It\'s a good motivating goal.',
        delay: 2800
    },
    {
        sender: 'bot',
        text: '**Weekly training plan:**\n\n🏃‍♂️ **Monday** — Easy run 20-25 min (heart rate 120-140)\n🏃‍♂️ **Wednesday** — Interval training: warm-up 10 min + 4x2 min fast/2 min rest + cool-down 10 min\n🏃‍♂️ **Friday** — Long run 30-40 min at comfortable pace',
        delay: 3000
    },
    {
        sender: 'bot',
        text: '**First 2 weeks:** you can alternate running and brisk walking\n**Weeks 3-4:** increase continuous running\n**Weeks 5-8:** work on pace and endurance',
        delay: 2500
    },
    {
        sender: 'bot',
        text: 'Shall we start this week? Ready for your first training session?',
        delay: 1800
    }
];

let currentMessageIndex = 0;
let isPlaying = false;

function createMessage(sender, text, animate = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (sender === 'bot') {
        const avatarImg = document.createElement('img');
        avatarImg.src = '/generated-image.jpg';
        avatarImg.alt = 'Coach';
        avatarImg.style.width = '100%';
        avatarImg.style.height = '100%';
        avatarImg.style.borderRadius = '50%';
        avatarImg.style.objectFit = 'cover';
        avatarDiv.appendChild(avatarImg);
    } else {
        avatarDiv.textContent = '👤';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format text (replace \n with <br> and bold **text**)
    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    contentDiv.innerHTML = formattedText;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    contentDiv.appendChild(timeDiv);
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    if (animate) {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(30px) scale(0.95)';
    }
    
    return messageDiv;
}

function createTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot typing';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = '/generated-image.jpg';
    avatarImg.alt = 'Coach';
    avatarImg.style.width = '100%';
    avatarImg.style.height = '100%';
    avatarImg.style.borderRadius = '50%';
    avatarImg.style.objectFit = 'cover';
    avatarDiv.appendChild(avatarImg);
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    
    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(typingIndicator);
    return typingDiv;
}

function showMessage(messageElement, delay = 0) {
    return new Promise(resolve => {
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0) scale(1)';
            messageElement.style.transition = 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)';
            
            // Manage message stack
            const chatMessages = document.getElementById('chat-messages');
            const messages = Array.from(chatMessages.children);
            
            // Move old messages to stack
            messages.forEach((msg, index) => {
                if (index < messages.length - 3) {
                    // Old messages go to stack in the background
                    msg.style.transform = `translateY(-${(messages.length - index - 3) * 8}px) scale(${1 - (messages.length - index - 3) * 0.05})`;
                    msg.style.opacity = `${Math.max(0.3, 1 - (messages.length - index - 3) * 0.2)}`;
                    msg.style.zIndex = index;
                } else {
                    // Last 3 messages remain active
                    msg.style.transform = 'translateY(0) scale(1)';
                    msg.style.opacity = '1';
                    msg.style.zIndex = 10 + index;
                }
            });
            
            // Remove very old messages (more than 8)
            if (messages.length > 8) {
                const oldestMessage = messages[0];
                oldestMessage.style.animation = 'messageDisappear 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                oldestMessage.style.animationFillMode = 'forwards';
                setTimeout(() => {
                    if (oldestMessage.parentNode) {
                        oldestMessage.parentNode.removeChild(oldestMessage);
                    }
                }, 600);
            }
            
            resolve();
        }, delay);
    });
}

async function playNextMessage() {
    if (currentMessageIndex >= demoMessages.length) {
        // Demo finished, restart after 5 seconds
        isPlaying = false;
        setTimeout(() => {
            startDemo();
        }, 5000);
        return;
    }

    const chatMessages = document.getElementById('chat-messages');
    const message = demoMessages[currentMessageIndex];
    
    // Show typing indicator for bot messages
    let typingIndicator = null;
    if (message.sender === 'bot') {
        typingIndicator = createTypingIndicator();
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Wait a bit for typing effect
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Remove typing indicator
        chatMessages.removeChild(typingIndicator);
    }
    
    // Create and show message
    const messageElement = createMessage(message.sender, message.text);
    chatMessages.appendChild(messageElement);
    
    await showMessage(messageElement, 100);
    
    currentMessageIndex++;
    
    // Schedule next message
    setTimeout(() => {
        if (isPlaying) {
            playNextMessage();
        }
    }, message.delay);
}

function startDemo() {
    const chatMessages = document.getElementById('chat-messages');
    
    // Start demo automatically
    isPlaying = true;
    currentMessageIndex = 0;
    
    // Clear chat
    chatMessages.innerHTML = '';
    
    // Start showing messages
    setTimeout(() => {
        playNextMessage();
    }, 1000);
}

function restartDemo() {
    // Restart demo after 5 seconds after completion
    setTimeout(() => {
        if (!isPlaying) {
            startDemo();
        }
    }, 5000);
}