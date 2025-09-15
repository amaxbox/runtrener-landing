// Интерактивный диалог-демо
const demoMessages = [
    {
        sender: 'user',
        text: 'Привет! Хочу начать бегать и подготовиться к забегу на 5 км. Я новичок в беге.',
        delay: 1500
    },
    {
        sender: 'bot',
        text: 'Привет! Отлично, что решил заняться бегом — это классный выбор! Помогу тебе подготовиться к первому забегу на 5км максимально эффективно и безопасно.',
        delay: 2500
    },
    {
        sender: 'bot',
        text: 'Давай познакомимся поближе для составления индивидуального плана:\n1. Сколько тебе лет, какой рост и вес?\n2. Есть ли какой-то спортивный опыт или физическая активность сейчас?\n3. Когда планируешь участвовать в забеге на 5км?',
        delay: 2000
    },
    {
        sender: 'user', 
        text: 'Мне 28 лет, рост 175 см, вес 78 кг. Спортом особо не занимался последние годы, только иногда в спортзале.',
        delay: 1800
    },
    {
        sender: 'user',
        text: 'Забег хочу пробежать через 2-3 месяца.',
        delay: 1200
    },
    {
        sender: 'bot',
        text: 'Отлично! У нас достаточно времени для качественной подготовки — 8-12 недель это хороший срок для новичка. Твои параметры в норме, это плюс.',
        delay: 2200
    },
    {
        sender: 'bot',
        text: 'Еще несколько важных вопросов:\n1. Сколько дней в неделю готов тренироваться?\n2. В какое время удобнее бегать — утром или вечером?\n3. Есть ли проблемы со здоровьем, травмы?\n4. Какую цель ставишь — просто финишировать или есть желаемое время?',
        delay: 2000
    },
    {
        sender: 'user',
        text: 'Могу тренироваться 3 раза в неделю, лучше вечером после работы. Здоровье в порядке, травм нет.',
        delay: 1600
    },
    {
        sender: 'user',
        text: 'Хочу пробежать 5км за 30 минут или меньше — это реально для новичка?',
        delay: 1400
    },
    {
        sender: 'bot', 
        text: 'Цель пробежать 5км за 30 минут (темп 6:00/км) — абсолютно реальна для новичка за 2-3 месяца подготовки! Это хорошая мотивирующая цель.',
        delay: 2800
    },
    {
        sender: 'bot',
        text: '**План тренировок на неделю:**\n\n🏃‍♂️ **Понедельник** — Легкий бег 20-25 мин (пульс 120-140)\n🏃‍♂️ **Среда** — Интервальная тренировка: разминка 10 мин + 4х2 мин быстро/2 мин отдых + заминка 10 мин\n🏃‍♂️ **Пятница** — Длительный бег 30-40 мин в комфортном темпе',
        delay: 3000
    },
    {
        sender: 'bot',
        text: '**Первые 2 недели:** можешь чередовать бег и быструю ходьбу\n**3-4 недели:** увеличиваем непрерывный бег\n**5-8 недели:** работаем над темпом и выносливостью',
        delay: 2500
    },
    {
        sender: 'bot',
        text: 'Начнем уже на этой неделе? Готов к первой тренировке?',
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
        avatarImg.alt = 'Тренер';
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
    
    // Форматируем текст (заменяем \n на <br> и выделяем жирным **текст**)
    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    contentDiv.innerHTML = formattedText;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('ru-RU', { 
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
    avatarImg.alt = 'Тренер';
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
            
            // Управляем стопкой сообщений
            const chatMessages = document.getElementById('chat-messages');
            const messages = Array.from(chatMessages.children);
            
            // Сдвигаем старые сообщения в стопку
            messages.forEach((msg, index) => {
                if (index < messages.length - 3) {
                    // Старые сообщения уходят в стопку на задний план
                    msg.style.transform = `translateY(-${(messages.length - index - 3) * 8}px) scale(${1 - (messages.length - index - 3) * 0.05})`;
                    msg.style.opacity = `${Math.max(0.3, 1 - (messages.length - index - 3) * 0.2)}`;
                    msg.style.zIndex = index;
                } else {
                    // Последние 3 сообщения остаются активными
                    msg.style.transform = 'translateY(0) scale(1)';
                    msg.style.opacity = '1';
                    msg.style.zIndex = 10 + index;
                }
            });
            
            // Удаляем совсем старые сообщения (больше 8)
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
        // Демо закончено, перезапускаем через 5 секунд
        isPlaying = false;
        setTimeout(() => {
            startDemo();
        }, 5000);
        return;
    }

    const chatMessages = document.getElementById('chat-messages');
    const message = demoMessages[currentMessageIndex];
    
    // Показываем индикатор печати для сообщений бота
    let typingIndicator = null;
    if (message.sender === 'bot') {
        typingIndicator = createTypingIndicator();
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Ждем немного для эффекта печати
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Убираем индикатор печати
        chatMessages.removeChild(typingIndicator);
    }
    
    // Создаем и показываем сообщение
    const messageElement = createMessage(message.sender, message.text);
    chatMessages.appendChild(messageElement);
    
    await showMessage(messageElement, 100);
    
    currentMessageIndex++;
    
    // Планируем следующее сообщение
    setTimeout(() => {
        if (isPlaying) {
            playNextMessage();
        }
    }, message.delay);
}

function startDemo() {
    const chatMessages = document.getElementById('chat-messages');
    
    // Начинаем демо автоматически
    isPlaying = true;
    currentMessageIndex = 0;
    
    // Очищаем чат
    chatMessages.innerHTML = '';
    
    // Начинаем показ сообщений
    setTimeout(() => {
        playNextMessage();
    }, 1000);
}

function restartDemo() {
    // Перезапускаем демо через 5 секунд после завершения
    setTimeout(() => {
        if (!isPlaying) {
            startDemo();
        }
    }, 5000);
}